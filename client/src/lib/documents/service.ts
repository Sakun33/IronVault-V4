/**
 * Document Service
 * Main service for document management with encryption
 * Handles import, viewing, and export operations
 */

import { v4 as uuidv4 } from 'uuid';
import {
  DocumentMeta,
  DocumentCreateInput,
  ImportProgress,
  ExportOptions,
  ExportProgress,
  MAX_FILE_SIZE_TOTAL,
  formatFileSize,
  getMimeType,
} from './types';
import {
  generateEncryptionKey,
  encryptData,
  decryptData,
  exportKey,
  importKey,
  packageEncryptedData,
  unpackageEncryptedData,
  generateSalt,
} from './crypto';
import {
  saveDocumentMeta,
  getDocumentMeta,
  listDocumentMetas,
  deleteDocumentMeta,
  determineStorageMode,
  saveEncryptedBlob,
  getEncryptedBlob,
  deleteEncryptedBlob,
} from './storage';
import { exportDocumentAsZip, exportMultipleDocumentsAsZip, ExportResult } from './export';

// In-memory key storage (per session)
let sessionKey: CryptoKey | null = null;
let sessionSalt: Uint8Array | null = null;

const VAULT_KEY_STORAGE = 'ironvault_doc_vault_key';

export async function initializeVault(masterPassword?: string): Promise<void> {
  if (masterPassword) {
    sessionSalt = generateSalt();
    // For now, generate a random key - in production, derive from master password
    sessionKey = await generateEncryptionKey();
    
    // Store encrypted key reference (not the actual key)
    const keyData = await exportKey(sessionKey);
    localStorage.setItem(VAULT_KEY_STORAGE, btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(keyData)))));
  } else {
    // Try to restore from session
    const stored = localStorage.getItem(VAULT_KEY_STORAGE);
    if (stored) {
      const keyData = Uint8Array.from(atob(stored), c => c.charCodeAt(0)).buffer;
      sessionKey = await importKey(keyData);
      sessionSalt = generateSalt();
    } else {
      // Generate new vault key
      sessionKey = await generateEncryptionKey();
      sessionSalt = generateSalt();
      const keyData = await exportKey(sessionKey);
      localStorage.setItem(VAULT_KEY_STORAGE, btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(keyData)))));
    }
  }
}

export async function ensureVaultInitialized(): Promise<void> {
  if (!sessionKey) {
    await initializeVault();
  }
}

export async function listDocuments(vaultId?: string): Promise<DocumentMeta[]> {
  await ensureVaultInitialized();
  return listDocumentMetas(vaultId);
}

export async function getDocument(id: string): Promise<DocumentMeta | null> {
  await ensureVaultInitialized();
  return getDocumentMeta(id);
}

export async function importDocument(
  file: File,
  vaultId: string = 'default',
  onProgress?: (progress: ImportProgress) => void
): Promise<DocumentMeta> {
  await ensureVaultInitialized();

  // Validate file size
  if (file.size > MAX_FILE_SIZE_TOTAL) {
    throw new Error(`File too large. Maximum size is ${formatFileSize(MAX_FILE_SIZE_TOTAL)}`);
  }

  onProgress?.({ stage: 'reading', progress: 10, message: 'Reading file...' });

  // Read file data
  const arrayBuffer = await file.arrayBuffer();

  onProgress?.({ stage: 'encrypting', progress: 40, message: 'Encrypting...' });

  // Encrypt the data
  if (!sessionKey || !sessionSalt) {
    throw new Error('Vault not initialized');
  }

  const { encrypted, iv } = await encryptData(arrayBuffer, sessionKey);
  const packagedData = packageEncryptedData(encrypted, iv, sessionSalt);

  onProgress?.({ stage: 'storing', progress: 70, message: 'Storing encrypted data...' });

  // Determine storage mode
  const storageMode = determineStorageMode(packagedData.byteLength);
  const id = uuidv4();

  // Store encrypted blob
  const storageRef = await saveEncryptedBlob(id, packagedData, storageMode);

  // Create metadata
  const now = new Date();
  const meta: DocumentMeta = {
    id,
    vaultId,
    name: file.name,
    mimeType: file.type || getMimeType(file.name),
    sizeBytes: file.size,
    createdAt: now,
    updatedAt: now,
    storageMode,
    storageRef,
    isEncrypted: true,
  };

  // Extract PDF page count if applicable
  if (meta.mimeType === 'application/pdf') {
    try {
      const pdfPageCount = await extractPdfPageCount(arrayBuffer);
      meta.pdfPageCount = pdfPageCount;
    } catch (e) {
      console.warn('Failed to extract PDF page count:', e);
    }
  }

  // Save metadata
  await saveDocumentMeta(meta);

  onProgress?.({ stage: 'complete', progress: 100, message: 'Import complete' });

  return meta;
}

export async function getDecryptedDocumentData(id: string): Promise<ArrayBuffer> {
  await ensureVaultInitialized();

  const meta = await getDocumentMeta(id);
  if (!meta) {
    throw new Error('Document not found');
  }

  // Get encrypted blob
  const encryptedPackage = await getEncryptedBlob(id, meta.storageMode, meta.storageRef);

  // Unpackage and decrypt
  const { data, iv } = unpackageEncryptedData(encryptedPackage);

  if (!sessionKey) {
    throw new Error('Vault not initialized');
  }

  const decrypted = await decryptData(data, sessionKey, iv);

  // Update last opened timestamp
  meta.lastOpenedAt = new Date();
  await saveDocumentMeta(meta);

  return decrypted;
}

export async function deleteDocument(id: string): Promise<void> {
  await ensureVaultInitialized();

  const meta = await getDocumentMeta(id);
  if (!meta) {
    throw new Error('Document not found');
  }

  // Delete encrypted blob
  await deleteEncryptedBlob(id, meta.storageMode, meta.storageRef);

  // Delete metadata
  await deleteDocumentMeta(id);
}

export async function exportDocument(
  id: string,
  options: ExportOptions = {},
  onProgress?: (progress: ExportProgress) => void
): Promise<ExportResult> {
  await ensureVaultInitialized();

  onProgress?.({ stage: 'decrypting', progress: 10, message: 'Decrypting document...' });

  const meta = await getDocumentMeta(id);
  if (!meta) {
    throw new Error('Document not found');
  }

  // Get decrypted data (in memory only)
  const decryptedData = await getDecryptedDocumentData(id);

  // Export as ZIP (with optional password protection)
  return exportDocumentAsZip(
    meta.name,
    meta.mimeType,
    decryptedData,
    options,
    onProgress
  );
}

export async function exportMultipleDocuments(
  ids: string[],
  options: ExportOptions & { zipFilename?: string } = {},
  onProgress?: (progress: ExportProgress) => void
): Promise<ExportResult> {
  await ensureVaultInitialized();

  onProgress?.({ stage: 'decrypting', progress: 5, message: 'Preparing documents...' });

  const files: Array<{ filename: string; mimeType: string; data: ArrayBuffer }> = [];

  for (let i = 0; i < ids.length; i++) {
    const meta = await getDocumentMeta(ids[i]);
    if (!meta) continue;

    const decryptedData = await getDecryptedDocumentData(ids[i]);
    files.push({
      filename: meta.name,
      mimeType: meta.mimeType,
      data: decryptedData,
    });

    const progress = 5 + (i + 1) / ids.length * 30;
    onProgress?.({ stage: 'decrypting', progress, message: `Decrypting ${meta.name}...` });
  }

  const zipFilename = options.zipFilename || `documents_${Date.now()}.zip`;

  return exportMultipleDocumentsAsZip(files, zipFilename, options, onProgress);
}

async function extractPdfPageCount(data: ArrayBuffer): Promise<number> {
  // Simple extraction - look for /Count in PDF
  const text = new TextDecoder('latin1').decode(data.slice(0, Math.min(data.byteLength, 50000)));
  const match = text.match(/\/Count\s+(\d+)/);
  return match ? parseInt(match[1], 10) : 1;
}

export function getDocumentIconType(mimeType: string): 'pdf' | 'image' | 'text' | 'file' {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('text/')) return 'text';
  return 'file';
}

export { ExportResult } from './export';
