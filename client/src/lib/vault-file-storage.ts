/**
 * Persistent Vault File Storage
 *
 * Writes an encrypted snapshot of the vault's IndexedDB entries to a durable
 * file location that survives browser cache clears:
 *
 *   Native (Android/iOS via Capacitor): Directory.Data — survives everything
 *     except a full app uninstall or "Clear Storage" (not just "Clear Cache").
 *
 *   Web PWA (OPFS): navigator.storage.getDirectory() — sandboxed per-origin
 *     file system that persists independently of Cache/Cookies. Survives
 *     "Clear cached images and files". Combined with navigator.storage.persist()
 *     it is significantly harder for the browser to evict than IndexedDB alone.
 *
 * The snapshot file format is NOT an additional encryption layer. The entries
 * stored inside are the same AES-GCM ciphertexts already in IndexedDB. The
 * vault metadata (salt, KDF config) is stored alongside them so the snapshot
 * alone can fully reconstruct IndexedDB on a fresh device.
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

export interface RawEntry {
  id: string;
  data: string; // base64 AES-GCM ciphertext
  iv: string;   // base64 IV
  store: string; // logical store name (passwords, notes, …)
}

export interface VaultSnapshot {
  v: 1;
  vaultId: string;
  metadata: any;       // VaultMetadata (plaintext — salt is not a secret)
  entries: RawEntry[]; // all encrypted_data rows
  snapshottedAt: number;
}

// ─── adapter interface ──────────────────────────────────────────────────────

export abstract class VaultFileAdapter {
  abstract read(vaultId: string): Promise<VaultSnapshot | null>;
  abstract write(vaultId: string, snap: VaultSnapshot): Promise<void>;
  abstract delete(vaultId: string): Promise<void>;
}

// ─── Capacitor native adapter ───────────────────────────────────────────────

class NativeVaultFileAdapter extends VaultFileAdapter {
  private readonly dir = Directory.Data;

  private path(vaultId: string) {
    return `iv-vaults/${vaultId}.snap`;
  }

  async read(vaultId: string): Promise<VaultSnapshot | null> {
    try {
      const result = await Filesystem.readFile({
        path: this.path(vaultId),
        directory: this.dir,
        encoding: Encoding.UTF8,
      });
      return JSON.parse(result.data as string) as VaultSnapshot;
    } catch {
      return null;
    }
  }

  async write(vaultId: string, snap: VaultSnapshot): Promise<void> {
    await Filesystem.writeFile({
      path: this.path(vaultId),
      data: JSON.stringify(snap),
      directory: this.dir,
      encoding: Encoding.UTF8,
      recursive: true,
    });
  }

  async delete(vaultId: string): Promise<void> {
    try {
      await Filesystem.deleteFile({ path: this.path(vaultId), directory: this.dir });
    } catch { /* not found — no-op */ }
  }
}

// ─── OPFS (Origin Private File System) web adapter ─────────────────────────

class OPFSVaultFileAdapter extends VaultFileAdapter {
  private async vaultsDir(): Promise<FileSystemDirectoryHandle> {
    const root = await navigator.storage.getDirectory();
    return root.getDirectoryHandle('iv-vaults', { create: true });
  }

  async read(vaultId: string): Promise<VaultSnapshot | null> {
    try {
      const dir = await this.vaultsDir();
      const fh = await dir.getFileHandle(`${vaultId}.snap`);
      const file = await fh.getFile();
      return JSON.parse(await file.text()) as VaultSnapshot;
    } catch {
      return null;
    }
  }

  async write(vaultId: string, snap: VaultSnapshot): Promise<void> {
    try {
      const dir = await this.vaultsDir();
      const fh = await dir.getFileHandle(`${vaultId}.snap`, { create: true });
      // createWritable is the standard OPFS write mechanism
      const writable = await (fh as any).createWritable();
      await writable.write(JSON.stringify(snap));
      await writable.close();
    } catch (err) {
      // Safari < 17 does not support createWritable on OPFS — silently degrade
    }
  }

  async delete(vaultId: string): Promise<void> {
    try {
      const dir = await this.vaultsDir();
      await dir.removeEntry(`${vaultId}.snap`);
    } catch { /* not found — no-op */ }
  }
}

// ─── No-op fallback ─────────────────────────────────────────────────────────

class NoopVaultFileAdapter extends VaultFileAdapter {
  async read(_: string): Promise<null> { return null; }
  async write(_: string, __: VaultSnapshot): Promise<void> {}
  async delete(_: string): Promise<void> {}
}

// ─── factory ────────────────────────────────────────────────────────────────

export function getVaultFileAdapter(): VaultFileAdapter {
  if (Capacitor.isNativePlatform()) {
    return new NativeVaultFileAdapter();
  }
  // OPFS: available in Chrome 86+, Firefox 111+, Safari 15.2+ (read-only on old Safari)
  if (
    typeof navigator !== 'undefined' &&
    'storage' in navigator &&
    typeof (navigator.storage as any)?.getDirectory === 'function'
  ) {
    return new OPFSVaultFileAdapter();
  }
  return new NoopVaultFileAdapter();
}
