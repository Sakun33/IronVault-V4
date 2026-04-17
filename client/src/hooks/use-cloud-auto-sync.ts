import { useEffect, useRef, useCallback } from 'react';
import { vaultStorage } from '@/lib/storage';
import { pushCloudVault, isVaultCloudSynced, listCloudVaults, downloadCloudVault } from '@/lib/cloud-vault-sync';

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
