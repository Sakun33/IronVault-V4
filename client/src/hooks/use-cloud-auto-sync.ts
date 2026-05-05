import { useEffect, useRef, useCallback } from 'react';
import { vaultStorage } from '@/lib/storage';
import { listCloudVaults, downloadCloudVault, getCloudToken } from '@/lib/cloud-vault-sync';
import { isNoteEditing } from '@/lib/note-editing-guard';
import { enqueuePush, isCloudSyncEligible } from '@/lib/cloud-sync-queue';
import { vaultManager } from '@/lib/vault-manager';

/**
 * Cloud auto-sync hook.
 *
 * Push side:
 *   - Storage events (`vault:item:saved`, `vault:import:complete`,
 *     `vault:force-cloud-push`) all funnel into `cloud-sync-queue.enqueuePush`
 *     which handles coalescing + retries with backoff.
 *   - The queue is the single source of truth for push state. This hook
 *     just pipes events into it; it does NOT implement its own dirty-flag
 *     tracking, anti-wipe gates, or debouncers.
 *
 * Pull side:
 *   - On mount: pull once (replace local with server's blob if newer).
 *   - Then poll every 60s.
 *   - Skipped while `isNoteEditing()` is true — pulling does a destructive
 *     replace and would clobber the editor's note. Push is safe during
 *     editing because it only writes our blob to the server.
 */

const POLL_MS = 60_000;
const LAST_PULL_PREFIX = 'iv_last_pull_';
const LAST_BLOB_HASH_PREFIX = 'iv_last_blob_hash_';

export function useCloudAutoSync(
  vaultId: string | null | undefined,
  masterPassword: string | null,
) {
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPullingRef = useRef(false);
  const vaultIdRef = useRef(vaultId);
  const masterPasswordRef = useRef(masterPassword);
  vaultIdRef.current = vaultId;
  masterPasswordRef.current = masterPassword;

  // ── Push: route all push triggers through the queue ─────────────────────
  useEffect(() => {
    if (!vaultId || !masterPassword) return;

    const enqueueIfEligible = () => {
      if (!isCloudSyncEligible(vaultId)) return;
      if (vaultStorage.getCurrentVaultId() !== vaultId) {
        console.error(
          `[SYNC] vault mismatch on save: storage=${vaultStorage.getCurrentVaultId()} ` +
          `expected=${vaultId} — skipping push`,
        );
        return;
      }
      const meta = vaultManager.getExistingVaults().find((v: any) => v.id === vaultId);
      const vaultName = meta?.name ?? 'My Vault';
      enqueuePush(vaultId, vaultName, async () => {
        if (vaultStorage.getCurrentVaultId() !== vaultId) {
          console.error('[SYNC] vault changed before exporter ran — aborting');
          return null;
        }
        return await vaultStorage.exportVault(masterPassword);
      });
    };

    window.addEventListener('vault:item:saved', enqueueIfEligible);
    window.addEventListener('vault:import:complete', enqueueIfEligible);
    window.addEventListener('vault:force-cloud-push', enqueueIfEligible);
    return () => {
      window.removeEventListener('vault:item:saved', enqueueIfEligible);
      window.removeEventListener('vault:import:complete', enqueueIfEligible);
      window.removeEventListener('vault:force-cloud-push', enqueueIfEligible);
    };
  }, [vaultId, masterPassword]);

  // ── Pull: poll every 60s for changes from another device ─────────────────
  const doPull = useCallback(async () => {
    if (!vaultId || !masterPassword) return;
    if (!getCloudToken()) return;
    if (!isCloudSyncEligible(vaultId)) return;
    // Pull is destructive (replaces local IDB with cloud blob). Never pull
    // while a note is being edited — the in-progress edit would vanish.
    if (isNoteEditing()) return;
    if (isPullingRef.current) return;
    isPullingRef.current = true;
    try {
      const remotes = await listCloudVaults();
      const meta = remotes.find(v => v.vaultId === vaultId);
      if (!meta?.serverUpdatedAt) return;

      const lastPullKey = `${LAST_PULL_PREFIX}${vaultId}`;
      const lastPull = localStorage.getItem(lastPullKey);
      const serverTime = new Date(meta.serverUpdatedAt).getTime();
      const lastPullTime = lastPull ? new Date(lastPull).getTime() : 0;

      if (serverTime <= lastPullTime) return; // nothing new

      window.dispatchEvent(new CustomEvent('vault:cloud:syncing'));
      const full = await downloadCloudVault(vaultId);
      if (!full?.encryptedBlob) {
        window.dispatchEvent(new CustomEvent('vault:cloud:replaced'));
        return;
      }

      const blobHash = `${full.encryptedBlob.length}_${full.encryptedBlob.slice(-32)}`;
      const hashKey = `${LAST_BLOB_HASH_PREFIX}${vaultId}`;
      if (blobHash === localStorage.getItem(hashKey)) {
        localStorage.setItem(lastPullKey, meta.serverUpdatedAt);
        window.dispatchEvent(new CustomEvent('vault:cloud:replaced'));
        return;
      }

      // Vault isolation: refuse to wipe the wrong vault's local DB.
      if (vaultStorage.getCurrentVaultId() !== vaultId) {
        console.error(
          `[SYNC] Refusing pull replace: storage=${vaultStorage.getCurrentVaultId()} ` +
          `expected=${vaultId}`,
        );
        window.dispatchEvent(new CustomEvent('vault:cloud:replaced'));
        return;
      }

      await vaultStorage.replaceVaultFromBlob(full.encryptedBlob, masterPassword);
      localStorage.setItem(lastPullKey, meta.serverUpdatedAt);
      localStorage.setItem(hashKey, blobHash);
      window.dispatchEvent(new CustomEvent('vault:cloud:replaced'));
    } catch (e) {
      console.warn('[SYNC] pull failed:', e);
      window.dispatchEvent(new CustomEvent('vault:cloud:replaced'));
    } finally {
      isPullingRef.current = false;
    }
  }, [vaultId, masterPassword]);

  useEffect(() => {
    if (!vaultId || !masterPassword) return;
    void doPull();
    pollRef.current = setInterval(() => void doPull(), POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [vaultId, masterPassword, doPull]);
}
