import { useEffect, useRef, useCallback } from 'react';
import { vaultStorage } from '@/lib/storage';
import { pushCloudVault, isVaultCloudSynced, listCloudVaults, downloadCloudVault, getCloudToken, markVaultAsCloudSynced } from '@/lib/cloud-vault-sync';
import { isNoteEditing } from '@/lib/note-editing-guard';

const DEBOUNCE_MS = 3000;
const POLL_MS = 60_000;
const LAST_PULL_PREFIX = 'iv_last_pull_';
const LAST_BLOB_HASH_PREFIX = 'iv_last_blob_hash_';
// Survives logout: set when local data changes, cleared only after successful cloud push
const DIRTY_PREFIX = 'iv_dirty_';
// Anti-wipe safeguard: track last known healthy item counts on both sides
const LAST_PUSH_COUNT_PREFIX = 'iv_last_push_count_';
const LAST_PULL_COUNT_PREFIX = 'iv_last_pull_count_';
// Below this absolute count we don't gate (small vaults legitimately fluctuate)
const MIN_GATED_COUNT = 5;

export function useCloudAutoSync(
  vaultId: string | null | undefined,
  masterPassword: string | null,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Tracks whether a local push is queued or in-flight.
  const pushPendingRef = useRef(false);
  // Stable refs so cleanup callbacks always read the latest values, not stale closures
  const vaultIdRef = useRef(vaultId);
  const masterPasswordRef = useRef(masterPassword);
  vaultIdRef.current = vaultId;
  masterPasswordRef.current = masterPassword;

  // ── Core push executor ────────────────────────────────────────────────────
  // Takes explicit vid/mpwd so it can be called from cleanup with current refs.
  // Only advances lastPull and clears dirty flag on actual success.
  // Dispatches start/done/failed events so the header indicator can show
  // "Syncing…" → "Synced ✓" / "Sync failed ⚠" with the actual error.
  const executePush = useCallback(async (vid: string, mpwd: string): Promise<boolean> => {
    const fail = (reason: string, planError = false) => {
      console.error(`[SYNC] Push failed for ${vid}: ${reason}`);
      localStorage.setItem(`iv_last_sync_error_${vid}`, reason);
      window.dispatchEvent(new CustomEvent('vault:cloud:push:failed', {
        detail: { vaultId: vid, error: reason, planError },
      }));
      return false;
    };

    window.dispatchEvent(new CustomEvent('vault:cloud:push:start', { detail: { vaultId: vid } }));
    try {
      // Vault isolation: the singleton's open DB MUST be the vault we're
      // about to export. If they've drifted (e.g. a UI path forgot to call
      // vaultStorage.switchToVault), refuse rather than push the wrong
      // vault's data to this vault's cloud entry.
      if (vaultStorage.getCurrentVaultId() !== vid) {
        return fail(
          `Vault mismatch: storage is on "${vaultStorage.getCurrentVaultId()}" but expected "${vid}"`,
        );
      }
      // Anti-wipe gate: previously refused any push where local item count
      // dropped below 50% of the last known good count. That fired on
      // legitimate large deletes and silently locked the user out of cloud
      // sync forever (no UI, no log). Tightened to "going to ZERO from
      // 20+", which still protects the original race (unmount-before-
      // hydrate reads 0) but doesn't punish real deletes.
      const localCount = await vaultStorage.getTotalItemCount();
      const lastPushRaw = localStorage.getItem(`${LAST_PUSH_COUNT_PREFIX}${vid}`);
      const lastPullRaw = localStorage.getItem(`${LAST_PULL_COUNT_PREFIX}${vid}`);
      const lastKnown = Math.max(
        lastPushRaw ? parseInt(lastPushRaw, 10) || 0 : 0,
        lastPullRaw ? parseInt(lastPullRaw, 10) || 0 : 0,
      );
      if (lastKnown >= 20 && localCount === 0) {
        return fail(`Anti-wipe: refusing to push empty vault (cloud has ${lastKnown} items)`);
      }

      const blob = await vaultStorage.exportVault(mpwd);
      const { vaultManager } = await import('@/lib/vault-manager');
      const vaultMeta = vaultManager.getExistingVaults().find((v: any) => v.id === vid);
      const vaultName = vaultMeta?.name ?? 'My Vault';
      const result = await pushCloudVault(vid, vaultName, blob, false);
      if (result.success) {
        localStorage.setItem(`${LAST_PULL_PREFIX}${vid}`, new Date().toISOString());
        localStorage.setItem(`${LAST_PUSH_COUNT_PREFIX}${vid}`, String(localCount));
        localStorage.removeItem(`${DIRTY_PREFIX}${vid}`);
        localStorage.removeItem(`iv_last_sync_error_${vid}`);
        // Heal the cloud-synced registry: a successful push proves the
        // vault is on cloud, so make sure subsequent saves don't get
        // skipped by `isVaultCloudSynced` returning false (which can
        // happen if the registry got cleared by a cache wipe).
        markVaultAsCloudSynced(vid);
        window.dispatchEvent(new CustomEvent('vault:cloud:push:done', {
          detail: { vaultId: vid, count: localCount },
        }));
        return true;
      }
      // Push failed — surface why. On a plan-upgrade-required response,
      // mark the vault as local-only so we don't retry on every save and
      // spam the user with toasts. Removing this flag (or upgrading) lets
      // sync resume.
      if (result.planError) {
        localStorage.setItem(`iv_local_only_${vid}`, '1');
      }
      return fail(result.error || `Push refused (status ${result.status ?? 'unknown'})`, !!result.planError);
    } catch (e: any) {
      return fail(e?.message || String(e));
    }
  }, []);

  // ── Push: debounce 3s after any local mutation ────────────────────────────
  useEffect(() => {
    if (!vaultId || !masterPassword) return;

    const handleItemSaved = () => {
      if (!getCloudToken()) return;
      // Local-only vaults must NEVER be auto-promoted to cloud-synced —
      // the user explicitly chose local storage (Free plan or "create
      // local vault"). We use `iv_local_only_${vaultId}` as the explicit
      // opt-out marker. The previous `isVaultCloudSynced` gate was too
      // aggressive: a single cache wipe cleared the registry and
      // permanently silently blocked cloud sync for a Pro user — the
      // exact bug this fix is targeting. Now the gate is inverted:
      // attempt the push unless the user explicitly opted into local-only,
      // and let the server's plan check decide if it's allowed. A success
      // re-marks the vault as cloud-synced (heal path); a 403 with
      // PLAN_UPGRADE_REQUIRED surfaces a plan-error toast instead of a
      // generic failure.
      if (localStorage.getItem(`iv_local_only_${vaultId}`) === '1') return;
      // Mark dirty immediately — survives if logout races before debounce fires
      pushPendingRef.current = true;
      localStorage.setItem(`${DIRTY_PREFIX}${vaultId}`, '1');
      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(async () => {
        try {
          await executePush(vaultId, masterPassword);
        } finally {
          pushPendingRef.current = false;
        }
      }, DEBOUNCE_MS);
    };

    window.addEventListener('vault:item:saved', handleItemSaved);
    return () => {
      window.removeEventListener('vault:item:saved', handleItemSaved);
      if (timerRef.current) clearTimeout(timerRef.current);
      // Best-effort flush on unmount: fires immediately rather than cancelling.
      // Primary recovery is the dirty flag (handled at next mount), but this
      // catches the common case where encryption key is still valid at logout time.
      if (pushPendingRef.current) {
        pushPendingRef.current = false;
        const vid = vaultIdRef.current;
        const mpwd = masterPasswordRef.current;
        if (vid && mpwd) executePush(vid, mpwd).catch(() => {});
      }
    };
  }, [vaultId, masterPassword, executePush]);

  // ── Post-logout recovery: flush dirty data before any pull ───────────────
  // Runs on every mount/login. If the previous session ended before the push
  // debounce fired (logout race), push the local data first so the subsequent
  // doPull does not overwrite it with the old cloud version.
  useEffect(() => {
    if (!vaultId || !masterPassword) return;
    if (!getCloudToken()) return;
    if (localStorage.getItem(`iv_local_only_${vaultId}`) === '1') return;
    const isDirty = localStorage.getItem(`${DIRTY_PREFIX}${vaultId}`);
    if (!isDirty) return;

    pushPendingRef.current = true;
    executePush(vaultId, masterPassword).finally(() => {
      pushPendingRef.current = false;
    });
  }, [vaultId, masterPassword, executePush]);

  // ── Immediate push after a bulk import (no debounce) ─────────────────────
  useEffect(() => {
    if (!vaultId || !masterPassword) return;

    const handleImportComplete = async () => {
      if (!getCloudToken()) return;
      if (!vaultId || !masterPassword) return;
      // Vault isolation: refuse to export+push if the open DB doesn't
      // belong to this vault — that would publish another vault's data
      // under our cloud entry.
      if (vaultStorage.getCurrentVaultId() !== vaultId) {
        console.error(
          `[IMPORT] Refusing post-import push: storage is on "${vaultStorage.getCurrentVaultId()}", ` +
          `expected "${vaultId}".`,
        );
        return;
      }

      pushPendingRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      try {
        const blob = await vaultStorage.exportVault(masterPassword);
        const { vaultManager } = await import('@/lib/vault-manager');
        const vaultMeta = vaultManager.getExistingVaults().find((v: any) => v.id === vaultId);
        const vaultName = vaultMeta?.name ?? 'My Vault';
        const result = await pushCloudVault(vaultId, vaultName, blob, false);
        if (result.success) {
          markVaultAsCloudSynced(vaultId);
          localStorage.setItem(`${LAST_PULL_PREFIX}${vaultId}`, new Date().toISOString());
          localStorage.removeItem(`${DIRTY_PREFIX}${vaultId}`);
        } else if (result.serverNewer) {
        } else {
          console.error('[IMPORT] Cloud push failed. Records may not sync to other devices.', result);
        }
      } catch (e) {
        console.error('[IMPORT] Cloud push threw an error:', e);
      } finally {
        pushPendingRef.current = false;
      }
    };

    window.addEventListener('vault:import:complete', handleImportComplete);
    return () => window.removeEventListener('vault:import:complete', handleImportComplete);
  }, [vaultId, masterPassword]);

  // ── Immediate push on explicit CRUD save (no debounce) ────────────────────
  useEffect(() => {
    if (!vaultId || !masterPassword) return;

    const handleForcePush = async () => {
      if (!getCloudToken()) return;
      // Same opt-out gate as handleItemSaved — only skip when the user
      // explicitly chose local-only. Otherwise let the server's plan check
      // decide whether the push is permitted.
      if (localStorage.getItem(`iv_local_only_${vaultId}`) === '1') return;
      if (timerRef.current) clearTimeout(timerRef.current);
      pushPendingRef.current = true;
      localStorage.setItem(`${DIRTY_PREFIX}${vaultId}`, '1');
      try {
        await executePush(vaultId, masterPassword);
      } finally {
        pushPendingRef.current = false;
      }
    };

    window.addEventListener('vault:force-cloud-push', handleForcePush);
    return () => window.removeEventListener('vault:force-cloud-push', handleForcePush);
  }, [vaultId, masterPassword, executePush]);

  // ── Pull: poll every 60s for changes from another device ─────────────────
  const doPull = useCallback(async () => {
    if (!vaultId || !masterPassword || !isVaultCloudSynced(vaultId)) return;
    // Never pull while a local push is queued/in-flight — would overwrite unsaved data
    if (pushPendingRef.current) return;
    // Never pull while dirty flag is set — unpushed local changes take priority
    if (localStorage.getItem(`${DIRTY_PREFIX}${vaultId}`)) return;
    // Never pull while the user is actively editing a note. A pull does a
    // destructive replaceVaultFromBlob() which wipes local IDB and re-imports
    // the cloud blob; if the in-progress edit hasn't pushed yet, that wipe
    // makes the editor's note disappear and trips the close-on-delete path.
    if (isNoteEditing()) return;

    try {
      const remotes = await listCloudVaults();
      if (pushPendingRef.current) return;
      if (localStorage.getItem(`${DIRTY_PREFIX}${vaultId}`)) return;

      const meta = remotes.find(v => v.vaultId === vaultId);
      if (!meta?.serverUpdatedAt) return;

      const lastPullKey = `${LAST_PULL_PREFIX}${vaultId}`;
      const lastPull = localStorage.getItem(lastPullKey);
      const serverTime = new Date(meta.serverUpdatedAt).getTime();
      const lastPullTime = lastPull ? new Date(lastPull).getTime() : 0;

      if (serverTime <= lastPullTime) return; // nothing new

      // Signal UI that a cloud sync is about to replace local data
      window.dispatchEvent(new CustomEvent('vault:cloud:syncing'));
      const full = await downloadCloudVault(vaultId);
      if (pushPendingRef.current) return;
      if (localStorage.getItem(`${DIRTY_PREFIX}${vaultId}`)) return;
      if (!full?.encryptedBlob) {
        window.dispatchEvent(new CustomEvent('vault:cloud:replaced')); // clear syncing state
        return;
      }

      const blobHash = `${full.encryptedBlob.length}_${full.encryptedBlob.slice(-32)}`;
      const hashKey = `${LAST_BLOB_HASH_PREFIX}${vaultId}`;
      if (blobHash === localStorage.getItem(hashKey)) {
        localStorage.setItem(lastPullKey, meta.serverUpdatedAt);
        window.dispatchEvent(new CustomEvent('vault:cloud:replaced'));
        return;
      }

      // Anti-wipe gate: peek the cloud blob's item count before destructively
      // replacing local state. If cloud has materially fewer items than what
      // we have locally, refuse — that's a regression, not a sync. The UI's
      // "Syncing From Cloud" wipe-then-import previously caused user-visible
      // data loss whenever an older blob was served (e.g. plan downgrade,
      // cross-device clock skew, server replay).
      const cloudCount = await vaultStorage.peekVaultBlobItemCount(full.encryptedBlob, masterPassword);
      const localCount = await vaultStorage.getTotalItemCount();
      if (
        cloudCount !== null &&
        localCount >= MIN_GATED_COUNT &&
        cloudCount < localCount
      ) {
        // Mark dirty so the next push will reconcile cloud back up to local
        localStorage.setItem(`${DIRTY_PREFIX}${vaultId}`, '1');
        window.dispatchEvent(new CustomEvent('vault:cloud:replaced')); // clear syncing state
        return;
      }

      // Vault isolation: refuse to wipe the open DB if it doesn't belong
      // to the vault whose cloud blob we just downloaded. Without this
      // check, a pull while the singleton is mis-routed would overwrite
      // the wrong vault's local data.
      if (vaultStorage.getCurrentVaultId() !== vaultId) {
        console.error(
          `[SYNC] Refusing pull replace: storage is on "${vaultStorage.getCurrentVaultId()}", ` +
          `expected "${vaultId}".`,
        );
        window.dispatchEvent(new CustomEvent('vault:cloud:replaced'));
        return;
      }
      await vaultStorage.replaceVaultFromBlob(full.encryptedBlob, masterPassword);
      localStorage.setItem(lastPullKey, meta.serverUpdatedAt);
      localStorage.setItem(hashKey, blobHash);
      if (cloudCount !== null) {
        localStorage.setItem(`${LAST_PULL_COUNT_PREFIX}${vaultId}`, String(cloudCount));
      }
      window.dispatchEvent(new CustomEvent('vault:cloud:replaced'));
    } catch (e) {
      // Always clear the "Syncing from cloud" UI flag, even on error —
      // otherwise the spinner gets stuck whenever downloadCloudVault or
      // replaceVaultFromBlob throws (auth blip, network drop, blob decode
      // failure, etc.) and never recovers without a page reload.
      console.warn('[SYNC] Cloud pull failed; clearing syncing UI:', e);
      window.dispatchEvent(new CustomEvent('vault:cloud:replaced'));
    }
  }, [vaultId, masterPassword]);

  useEffect(() => {
    if (!vaultId || !masterPassword) return;

    // Initial pull on mount
    doPull();

    // Then poll every 60s
    pollRef.current = setInterval(doPull, POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [vaultId, masterPassword, doPull]);
}
