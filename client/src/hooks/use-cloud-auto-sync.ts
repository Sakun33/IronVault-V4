import { useEffect, useRef, useCallback } from 'react';
import { vaultStorage } from '@/lib/storage';
import { pushCloudVault, isVaultCloudSynced, listCloudVaults, downloadCloudVault, getCloudToken, markVaultAsCloudSynced } from '@/lib/cloud-vault-sync';

const DEBOUNCE_MS = 3000;
const POLL_MS = 60_000;
const LAST_PULL_PREFIX = 'iv_last_pull_';

export function useCloudAutoSync(
  vaultId: string | null | undefined,
  masterPassword: string | null,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Tracks whether a local push is queued or in-flight.
  // doPull checks this to avoid replacing freshly-saved local data with a
  // stale cloud snapshot before the debounced push has a chance to run.
  const pushPendingRef = useRef(false);

  // ── Push: debounce 3s after any local mutation ────────────────────────────
  useEffect(() => {
    if (!vaultId || !masterPassword) return;

    const handleItemSaved = () => {
      if (!isVaultCloudSynced(vaultId)) return;

      // Mark push as pending so concurrent pulls are blocked
      pushPendingRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(async () => {
        try {
          const blob = await vaultStorage.exportVault(masterPassword);
          const { vaultManager } = await import('@/lib/vault-manager');
          const vaultMeta = vaultManager.getLocalVaults().find(v => v.id === vaultId);
          const vaultName = vaultMeta?.name ?? 'My Vault';
          await pushCloudVault(vaultId, vaultName, blob, false);
          // After a successful push, advance lastPull so the next poll does
          // not re-download the data we just uploaded.
          const lastPullKey = `${LAST_PULL_PREFIX}${vaultId}`;
          localStorage.setItem(lastPullKey, new Date().toISOString());
        } catch {
          // Silently fail — user can manually sync later
        } finally {
          pushPendingRef.current = false;
        }
      }, DEBOUNCE_MS);
    };

    window.addEventListener('vault:item:saved', handleItemSaved);
    return () => {
      window.removeEventListener('vault:item:saved', handleItemSaved);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [vaultId, masterPassword]);

  // ── Immediate push after a bulk import (no debounce) ─────────────────────
  // Uses getCloudToken() instead of isVaultCloudSynced() so this never silently
  // skips the push due to a race condition: the heal effect in App.tsx marks the
  // vault as cloud-synced ASYNCHRONOUSLY (after a listCloudVaults() round-trip),
  // so a user who imports immediately after unlock could beat that write.
  useEffect(() => {
    if (!vaultId || !masterPassword) return;

    const handleImportComplete = async () => {
      // Primary gate: user must have cloud auth. For non-cloud users this is null.
      if (!getCloudToken()) return;
      if (!vaultId || !masterPassword) return;

      // Cancel any pending debounced push — we're about to push right now
      pushPendingRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      try {
        const blob = await vaultStorage.exportVault(masterPassword);
        const { vaultManager } = await import('@/lib/vault-manager');
        const vaultMeta = vaultManager.getLocalVaults().find((v: any) => v.id === vaultId);
        const vaultName = vaultMeta?.name ?? 'My Vault';
        console.log('[IMPORT] Pushing vault to cloud after import...');
        const result = await pushCloudVault(vaultId, vaultName, blob, false);
        if (result.success) {
          // Ensure vault is registered as cloud-synced in case the heal effect
          // hasn't run yet (the race condition this whole fix addresses).
          markVaultAsCloudSynced(vaultId);
          const lastPullKey = `${LAST_PULL_PREFIX}${vaultId}`;
          localStorage.setItem(lastPullKey, new Date().toISOString());
          console.log('[IMPORT] Cloud push complete — all imported records synced.');
        } else if (result.serverNewer) {
          console.warn('[IMPORT] Server has newer data — skipping push to avoid overwrite.');
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

  // ── Pull: poll every 60s for changes from another device ─────────────────
  const doPull = useCallback(async () => {
    if (!vaultId || !masterPassword || !isVaultCloudSynced(vaultId)) return;
    // Never pull while a local push is queued or in-flight — doing so would
    // replace freshly-saved data with a stale cloud snapshot before the push
    // gets a chance to upload the new item.
    if (pushPendingRef.current) return;
    try {
      const remotes = await listCloudVaults();
      // Re-check after network round-trip — user may have saved in the meantime
      if (pushPendingRef.current) return;

      const meta = remotes.find(v => v.vaultId === vaultId);
      if (!meta?.serverUpdatedAt) return;

      const lastPullKey = `${LAST_PULL_PREFIX}${vaultId}`;
      const lastPull = localStorage.getItem(lastPullKey);
      const serverTime = new Date(meta.serverUpdatedAt).getTime();
      const lastPullTime = lastPull ? new Date(lastPull).getTime() : 0;

      if (serverTime <= lastPullTime) return; // nothing new

      // Server has a newer version — download and replace
      const full = await downloadCloudVault(vaultId);
      // Re-check after the (potentially slow) blob download
      if (pushPendingRef.current) return;
      if (!full?.encryptedBlob) return;

      await vaultStorage.replaceVaultFromBlob(full.encryptedBlob, masterPassword);
      localStorage.setItem(lastPullKey, meta.serverUpdatedAt);
      window.dispatchEvent(new CustomEvent('vault:cloud:replaced'));
    } catch {
      // Silently fail
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
