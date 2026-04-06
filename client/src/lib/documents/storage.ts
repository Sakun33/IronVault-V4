/**
 * Document Storage Service
 * Handles encrypted document storage in IndexedDB (small files) or Filesystem (large files)
 * Never persists plaintext - all data stored is encrypted
 */

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { DocumentMeta, StorageMode, MAX_FILE_SIZE_IDB } from './types';

const DB_NAME = 'ironvault_documents';
const DB_VERSION = 1;
const STORE_META = 'document_meta';
const STORE_BLOBS = 'document_blobs';

let dbInstance: IDBDatabase | null = null;

async function getDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_META)) {
        const metaStore = db.createObjectStore(STORE_META, { keyPath: 'id' });
        metaStore.createIndex('vaultId', 'vaultId', { unique: false });
        metaStore.createIndex('createdAt', 'createdAt', { unique: false });
        metaStore.createIndex('name', 'name', { unique: false });
      }
      
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS, { keyPath: 'id' });
      }
    };
  });
}

export async function saveDocumentMeta(meta: DocumentMeta): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readwrite');
    const store = tx.objectStore(STORE_META);
    const request = store.put({
      ...meta,
      createdAt: meta.createdAt.toISOString(),
      updatedAt: meta.updatedAt.toISOString(),
      lastOpenedAt: meta.lastOpenedAt?.toISOString(),
    });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getDocumentMeta(id: string): Promise<DocumentMeta | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const store = tx.objectStore(STORE_META);
    const request = store.get(id);
    request.onsuccess = () => {
      const result = request.result;
      if (result) {
        resolve({
          ...result,
          createdAt: new Date(result.createdAt),
          updatedAt: new Date(result.updatedAt),
          lastOpenedAt: result.lastOpenedAt ? new Date(result.lastOpenedAt) : undefined,
        });
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function listDocumentMetas(vaultId?: string): Promise<DocumentMeta[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const store = tx.objectStore(STORE_META);
    const request = vaultId 
      ? store.index('vaultId').getAll(vaultId)
      : store.getAll();
    
    request.onsuccess = () => {
      const results = request.result.map((r: any) => ({
        ...r,
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
        lastOpenedAt: r.lastOpenedAt ? new Date(r.lastOpenedAt) : undefined,
      }));
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteDocumentMeta(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readwrite');
    const store = tx.objectStore(STORE_META);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export function determineStorageMode(sizeBytes: number): StorageMode {
  return sizeBytes <= MAX_FILE_SIZE_IDB ? 'idb' : 'fs';
}

export async function saveEncryptedBlob(
  id: string,
  encryptedData: ArrayBuffer,
  storageMode: StorageMode
): Promise<string> {
  if (storageMode === 'idb') {
    return saveToIndexedDB(id, encryptedData);
  } else {
    return saveToFilesystem(id, encryptedData);
  }
}

async function saveToIndexedDB(id: string, data: ArrayBuffer): Promise<string> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BLOBS, 'readwrite');
    const store = tx.objectStore(STORE_BLOBS);
    const request = store.put({ id, data });
    request.onsuccess = () => resolve(`idb://${id}`);
    request.onerror = () => reject(request.error);
  });
}

async function saveToFilesystem(id: string, data: ArrayBuffer): Promise<string> {
  const filename = `doc_${id}.enc`;
  const base64 = arrayBufferToBase64(data);
  
  if (Capacitor.isNativePlatform()) {
    await Filesystem.writeFile({
      path: `documents/${filename}`,
      data: base64,
      directory: Directory.Data,
      recursive: true,
    });
    return `fs://documents/${filename}`;
  } else {
    // Web fallback - use IndexedDB even for large files
    return saveToIndexedDB(id, data);
  }
}

export async function getEncryptedBlob(
  id: string,
  storageMode: StorageMode,
  storageRef: string
): Promise<ArrayBuffer> {
  if (storageMode === 'idb' || !Capacitor.isNativePlatform()) {
    return getFromIndexedDB(id);
  } else {
    return getFromFilesystem(storageRef);
  }
}

async function getFromIndexedDB(id: string): Promise<ArrayBuffer> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BLOBS, 'readonly');
    const store = tx.objectStore(STORE_BLOBS);
    const request = store.get(id);
    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result.data);
      } else {
        reject(new Error('Document blob not found'));
      }
    };
    request.onerror = () => reject(request.error);
  });
}

async function getFromFilesystem(storageRef: string): Promise<ArrayBuffer> {
  const path = storageRef.replace('fs://', '');
  const result = await Filesystem.readFile({
    path,
    directory: Directory.Data,
  });
  
  if (typeof result.data === 'string') {
    return base64ToArrayBuffer(result.data);
  }
  throw new Error('Unexpected file format');
}

export async function deleteEncryptedBlob(
  id: string,
  storageMode: StorageMode,
  storageRef: string
): Promise<void> {
  if (storageMode === 'idb' || !Capacitor.isNativePlatform()) {
    await deleteFromIndexedDB(id);
  } else {
    await deleteFromFilesystem(storageRef);
  }
}

async function deleteFromIndexedDB(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BLOBS, 'readwrite');
    const store = tx.objectStore(STORE_BLOBS);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function deleteFromFilesystem(storageRef: string): Promise<void> {
  const path = storageRef.replace('fs://', '');
  try {
    await Filesystem.deleteFile({
      path,
      directory: Directory.Data,
    });
  } catch (e) {
    console.warn('Failed to delete file from filesystem:', e);
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function saveTempFile(
  filename: string,
  data: ArrayBuffer
): Promise<string> {
  const base64 = arrayBufferToBase64(data);
  
  if (Capacitor.isNativePlatform()) {
    const result = await Filesystem.writeFile({
      path: `temp/${filename}`,
      data: base64,
      directory: Directory.Cache,
      recursive: true,
    });
    return result.uri;
  } else {
    // Web - create blob URL
    const blob = new Blob([data], { type: 'application/octet-stream' });
    return URL.createObjectURL(blob);
  }
}

export async function deleteTempFile(uri: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await Filesystem.deleteFile({ path: uri });
    } catch (e) {
      console.warn('Failed to delete temp file:', e);
    }
  } else {
    // Web - revoke blob URL
    if (uri.startsWith('blob:')) {
      URL.revokeObjectURL(uri);
    }
  }
}
