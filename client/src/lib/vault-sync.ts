/**
 * Vault Sync Service
 * 
 * Syncs vault metadata to the admin backend for CRM tracking.
 * This allows admins to see vault counts and default vault info per customer.
 */

import { vaultIndex, VaultIndexEntry } from './vault-index';

const API_BASE_URL = '/api';

export interface VaultSyncData {
  email: string;
  vaultCount: number;
  defaultVaultId: string | null;
  defaultVaultName: string | null;
  vaults: Array<{
    id: string;
    name: string;
    isDefault: boolean;
    createdAt: string;
    lastUnlockedAt: string | null;
  }>;
}

/**
 * Get customer email from localStorage
 */
function getCustomerEmail(): string | null {
  try {
    const profile = localStorage.getItem('customerProfile');
    if (profile) {
      const parsed = JSON.parse(profile);
      return parsed.email || null;
    }
  } catch (error) {
    console.error('Failed to get customer email:', error);
  }
  return null;
}

/**
 * Sync vault metadata to admin backend
 */
export async function syncVaultsToBackend(): Promise<boolean> {
  try {
    const email = getCustomerEmail();
    if (!email) {
      console.log('⏭️ No customer email, skipping vault sync');
      return false;
    }

    await vaultIndex.init();
    const vaults = await vaultIndex.getAllVaults();
    const defaultVault = vaults.find(v => v.isDefault);

    const syncData: VaultSyncData = {
      email,
      vaultCount: vaults.length,
      defaultVaultId: defaultVault?.id || null,
      defaultVaultName: defaultVault?.name || null,
      vaults: vaults.map(v => ({
        id: v.id,
        name: v.name,
        isDefault: v.isDefault,
        createdAt: v.createdAt.toISOString(),
        lastUnlockedAt: v.lastUnlockedAt?.toISOString() || null,
      })),
    };

    const response = await fetch(`${API_BASE_URL}/crm/vaults/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(syncData),
    });

    if (!response.ok) {
      console.warn('⚠️ Vault sync failed:', response.status);
      return false;
    }

    console.log('✅ Vaults synced to backend');
    return true;
  } catch (error) {
    console.error('❌ Vault sync error:', error);
    return false;
  }
}

/**
 * Sync after vault creation
 */
export async function syncAfterVaultCreate(): Promise<void> {
  // Non-blocking sync
  syncVaultsToBackend().catch(console.error);
}

/**
 * Sync after vault update (rename, set default)
 */
export async function syncAfterVaultUpdate(): Promise<void> {
  // Non-blocking sync
  syncVaultsToBackend().catch(console.error);
}

/**
 * Sync after vault deletion
 */
export async function syncAfterVaultDelete(): Promise<void> {
  // Non-blocking sync
  syncVaultsToBackend().catch(console.error);
}
