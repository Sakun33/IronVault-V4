/**
 * Document Types and Interfaces
 * Supports offline encrypted document storage
 */

export type StorageMode = 'idb' | 'fs';

export type SupportedMimeType = 
  | 'application/pdf'
  | 'image/png'
  | 'image/jpeg'
  | 'image/webp'
  | 'image/heic'
  | 'text/plain'
  | 'text/markdown';

export interface DocumentMeta {
  id: string;
  vaultId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  updatedAt: Date;
  storageMode: StorageMode;
  storageRef: string;
  pdfPageCount?: number;
  thumbnailDataUrl?: string;
  lastOpenedAt?: Date;
  isEncrypted: boolean;
}

export interface DocumentCreateInput {
  vaultId: string;
  name: string;
  mimeType: string;
  data: ArrayBuffer;
}

export interface ExportOptions {
  password?: string;
  filename?: string;
}

export interface ImportProgress {
  stage: 'reading' | 'encrypting' | 'storing' | 'complete' | 'error';
  progress: number;
  message: string;
}

export interface ExportProgress {
  stage: 'decrypting' | 'zipping' | 'encrypting' | 'saving' | 'complete' | 'error';
  progress: number;
  message: string;
}

export const SUPPORTED_TYPES: Record<string, SupportedMimeType> = {
  'pdf': 'application/pdf',
  'png': 'image/png',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'webp': 'image/webp',
  'heic': 'image/heic',
  'txt': 'text/plain',
  'md': 'text/markdown',
};

export const MIME_TO_EXTENSION: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'text/plain': 'txt',
  'text/markdown': 'md',
};

export const FILE_TYPE_CATEGORIES = {
  pdf: ['application/pdf'],
  images: ['image/png', 'image/jpeg', 'image/webp', 'image/heic'],
  text: ['text/plain', 'text/markdown'],
} as const;

export type FileCategory = keyof typeof FILE_TYPE_CATEGORIES | 'all';

export const MAX_FILE_SIZE_IDB = 10 * 1024 * 1024; // 10MB
export const MAX_FILE_SIZE_TOTAL = 100 * 1024 * 1024; // 100MB

export function getFileCategory(mimeType: string): FileCategory {
  if (FILE_TYPE_CATEGORIES.pdf.includes(mimeType as any)) return 'pdf';
  if (FILE_TYPE_CATEGORIES.images.includes(mimeType as any)) return 'images';
  if (FILE_TYPE_CATEGORIES.text.includes(mimeType as any)) return 'text';
  return 'all';
}

export function isPreviewSupported(mimeType: string): boolean {
  return Object.values(SUPPORTED_TYPES).includes(mimeType as SupportedMimeType);
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
}

export function getMimeType(filename: string): string {
  const ext = getFileExtension(filename);
  return SUPPORTED_TYPES[ext] || 'application/octet-stream';
}
