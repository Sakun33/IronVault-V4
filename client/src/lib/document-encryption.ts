// Document Encryption Service
// This service handles secure document storage and encryption

import { CryptoService } from './crypto';

export interface EncryptedDocument {
  id: string;
  name: string;
  type: string;
  size: number;
  encryptedData: string;
  encryptionKey: string; // Exported key for decryption
  iv: string;
  salt: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: {
    author?: string;
    title?: string;
    subject?: string;
    keywords?: string[];
    created?: Date;
    modified?: Date;
  };
}

export interface DocumentMetadata {
  id: string;
  name: string;
  type: string;
  size: number;
  folderId: string | null;
  thumbnail?: string;
  createdAt: Date;
  updatedAt: Date;
  isStarred: boolean;
  tags: string[];
  password?: string;
  ocrText?: string;
  metadata: {
    author?: string;
    title?: string;
    subject?: string;
    keywords?: string[];
    created?: Date;
    modified?: Date;
  };
}

export class DocumentEncryptionService {
  private static instance: DocumentEncryptionService;
  private vault: IDBDatabase | null = null;

  private constructor() {}

  public static getInstance(): DocumentEncryptionService {
    if (!DocumentEncryptionService.instance) {
      DocumentEncryptionService.instance = new DocumentEncryptionService();
    }
    return DocumentEncryptionService.instance;
  }

  // Initialize IndexedDB for document storage
  public async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('IronVaultDocuments', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.vault = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Documents store
        if (!db.objectStoreNames.contains('documents')) {
          const documentsStore = db.createObjectStore('documents', { keyPath: 'id' });
          documentsStore.createIndex('folderId', 'folderId', { unique: false });
          documentsStore.createIndex('type', 'type', { unique: false });
          documentsStore.createIndex('createdAt', 'createdAt', { unique: false });
          documentsStore.createIndex('isStarred', 'isStarred', { unique: false });
        }
        
        // Folders store
        if (!db.objectStoreNames.contains('folders')) {
          const foldersStore = db.createObjectStore('folders', { keyPath: 'id' });
          foldersStore.createIndex('parentId', 'parentId', { unique: false });
        }
        
        // Thumbnails store
        if (!db.objectStoreNames.contains('thumbnails')) {
          db.createObjectStore('thumbnails', { keyPath: 'documentId' });
        }
      };
    });
  }

  // Encrypt and store a document
  public async storeDocument(
    file: File,
    folderId: string | null = null,
    password?: string
  ): Promise<DocumentMetadata> {
    if (!this.vault) {
      throw new Error('Document service not initialized');
    }

    // Generate encryption key
    const key = await CryptoService.generateKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const salt = crypto.getRandomValues(new Uint8Array(16));

    // Export the key so we can store it for later decryption
    const exportedKey = await crypto.subtle.exportKey('raw', key);

    // Read file as ArrayBuffer
    const fileBuffer = await file.arrayBuffer();
    
    // Encrypt the file data
    const encryptionResult = await CryptoService.encrypt(
      new Uint8Array(fileBuffer),
      key,
      iv
    );

    // Create document metadata
    const documentId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const document: EncryptedDocument = {
      id: documentId,
      name: file.name,
      type: this.getFileType(file.name),
      size: file.size,
      encryptedData: this.arrayBufferToBase64(encryptionResult.encrypted),
      encryptionKey: this.arrayBufferToBase64(new Uint8Array(exportedKey)), // Store the key
      iv: this.arrayBufferToBase64(encryptionResult.iv),
      salt: this.arrayBufferToBase64(salt),
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        author: 'User',
        title: file.name,
        created: new Date(),
        modified: new Date()
      }
    };

    // Store in IndexedDB
    const transaction = this.vault.transaction(['documents'], 'readwrite');
    const store = transaction.objectStore('documents');
    await this.promisifyRequest(store.add(document));

    // Generate thumbnail if it's an image
    let thumbnail: string | undefined;
    if (this.isImageFile(file.type)) {
      thumbnail = await this.generateThumbnail(file);
      if (thumbnail) {
        await this.storeThumbnail(documentId, thumbnail);
      }
    }

    // Return metadata (without encrypted data)
    return {
      id: document.id,
      name: document.name,
      type: document.type,
      size: document.size,
      folderId,
      thumbnail,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      isStarred: false,
      tags: [],
      password,
      metadata: document.metadata
    };
  }

  // Retrieve and decrypt a document
  public async retrieveDocument(documentId: string): Promise<File> {
    if (!this.vault) {
      throw new Error('Document service not initialized');
    }

    const transaction = this.vault.transaction(['documents'], 'readonly');
    const store = transaction.objectStore('documents');
    const document = await this.promisifyRequest(store.get(documentId)) as EncryptedDocument;

    if (!document) {
      throw new Error('Document not found');
    }

    // Retrieve the stored encryption key and decrypt
    const keyData = this.base64ToArrayBuffer(document.encryptionKey);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    const iv = this.base64ToArrayBuffer(document.iv);
    const encryptedData = this.base64ToArrayBuffer(document.encryptedData);

    const decryptedData = await CryptoService.decrypt(encryptedData, key, iv);

    // Create File object
    const blob = new Blob([decryptedData], { type: this.getMimeType(document.type) });
    return new File([blob], document.name, { type: this.getMimeType(document.type) });
  }

  // Delete a document
  public async deleteDocument(documentId: string): Promise<void> {
    if (!this.vault) {
      throw new Error('Document service not initialized');
    }

    const transaction = this.vault.transaction(['documents', 'thumbnails'], 'readwrite');
    
    // Delete document
    const documentsStore = transaction.objectStore('documents');
    await this.promisifyRequest(documentsStore.delete(documentId));
    
    // Delete thumbnail
    const thumbnailsStore = transaction.objectStore('thumbnails');
    await this.promisifyRequest(thumbnailsStore.delete(documentId));
  }

  // Get all documents
  public async getAllDocuments(): Promise<DocumentMetadata[]> {
    if (!this.vault) {
      throw new Error('Document service not initialized');
    }

    const transaction = this.vault.transaction(['documents'], 'readonly');
    const store = transaction.objectStore('documents');
    const documents = await this.promisifyRequest(store.getAll()) as EncryptedDocument[];

    return documents.map(doc => ({
      id: doc.id,
      name: doc.name,
      type: doc.type,
      size: doc.size,
      folderId: null, // Will be set by folder management
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      isStarred: false,
      tags: [],
      metadata: doc.metadata
    }));
  }

  // Generate thumbnail for image files
  private async generateThumbnail(file: File): Promise<string | undefined> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Set canvas size for thumbnail
        const maxSize = 200;
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw image
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Convert to base64
        const thumbnail = canvas.toDataURL('image/jpeg', 0.8);
        resolve(thumbnail);
      };

      img.onerror = () => resolve(undefined);
      img.src = URL.createObjectURL(file);
    });
  }

  // Store thumbnail
  private async storeThumbnail(documentId: string, thumbnail: string): Promise<void> {
    if (!this.vault) return;

    const transaction = this.vault.transaction(['thumbnails'], 'readwrite');
    const store = transaction.objectStore('thumbnails');
    await this.promisifyRequest(store.put({ documentId, thumbnail }));
  }

  // Get thumbnail
  public async getThumbnail(documentId: string): Promise<string | undefined> {
    if (!this.vault) return undefined;

    const transaction = this.vault.transaction(['thumbnails'], 'readonly');
    const store = transaction.objectStore('thumbnails');
    const result = await this.promisifyRequest(store.get(documentId));
    
    return result?.thumbnail;
  }

  // Utility methods
  private getFileType(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase() || 'other';
    const typeMap: Record<string, string> = {
      'pdf': 'pdf',
      'doc': 'doc',
      'docx': 'docx',
      'xls': 'xls',
      'xlsx': 'xlsx',
      'ppt': 'ppt',
      'pptx': 'pptx',
      'txt': 'txt',
      'jpg': 'jpg',
      'jpeg': 'jpeg',
      'png': 'png',
      'gif': 'gif',
      'bmp': 'bmp'
    };
    return typeMap[extension] || 'other';
  }

  private getMimeType(type: string): string {
    const mimeMap: Record<string, string> = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'txt': 'text/plain',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'bmp': 'image/bmp'
    };
    return mimeMap[type] || 'application/octet-stream';
  }

  private isImageFile(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  private arrayBufferToBase64(buffer: Uint8Array): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  private promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

// Export singleton instance
export const documentService = DocumentEncryptionService.getInstance();
