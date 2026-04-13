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

  // ── Push: debounce 3s after any local mutation ────────────────────────────
  useEffect(() => {
    if (!vaultId || !masterPassword) return;

    const handleItemSaved = () => {
      if (!isVaultCloudSynced(vaultId)) return;

      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(async () => {
        try {
          const blob = await vaultStorage.exportVault(masterPassword);
          const { vaultManager } = await import('@/lib/vault-manager');
          const vaultMeta = vaultManager.getLocalVaults().find(v => v.id === vaultId);
          const vaultName = vaultMeta?.name ?? 'My Vault';
          await pushCloudVault(vaultId, vaultName, blob, false);
        } catch {
          // Silently fail — user can manually sync later
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
    try {
      const remotes = await listCloudVaults();
      const meta = remotes.find(v => v.vaultId === vaultId);
      if (!meta?.serverUpdatedAt) return;

      const lastPullKey = `${LAST_PULL_PREFIX}${vaultId}`;
      const lastPull = localStorage.getItem(lastPullKey);
      const serverTime = new Date(meta.serverUpdatedAt).getTime();
      const lastPullTime = lastPull ? new Date(lastPull).getTime() : 0;

      if (serverTime <= lastPullTime) return; // nothing new

      // Server has a newer version — download and replace
      const full = await downloadCloudVault(vaultId);
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
