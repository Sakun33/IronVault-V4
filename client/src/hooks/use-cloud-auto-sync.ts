import { useEffect, useRef } from 'react';
import { vaultStorage } from '@/lib/storage';
import { pushCloudVault, isVaultCloudSynced } from '@/lib/cloud-vault-sync';

const DEBOUNCE_MS = 3000;

export function useCloudAutoSync(
  vaultId: string | null | undefined,
  masterPassword: string | null,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!vaultId || !masterPassword) return;

    const handleItemSaved = () => {
      // Only sync if this vault is marked as cloud-synced
      if (!isVaultCloudSynced(vaultId)) return;

      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(async () => {
        try {
          const blob = await vaultStorage.exportVault(masterPassword);
          // Get vault name from vault manager if available
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
}
