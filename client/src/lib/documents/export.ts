/**
 * Document Export Service
 * Handles password-protected ZIP export using AES-256 encryption
 * Uses zip.js for cross-platform compatibility
 */

import { BlobWriter, ZipWriter, TextReader, BlobReader } from '@zip.js/zip.js';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { ExportOptions, ExportProgress, MIME_TO_EXTENSION } from './types';

export interface ExportResult {
  success: boolean;
  filename?: string;
  uri?: string;
  error?: string;
}

export async function exportDocumentAsZip(
  filename: string,
  mimeType: string,
  decryptedData: ArrayBuffer,
  options: ExportOptions = {},
  onProgress?: (progress: ExportProgress) => void
): Promise<ExportResult> {
  try {
    onProgress?.({ stage: 'zipping', progress: 20, message: 'Creating archive...' });

    // Determine output filename
    const originalExt = MIME_TO_EXTENSION[mimeType] || 'bin';
    const baseName = filename.replace(/\.[^/.]+$/, '');
    const zipFilename = options.filename || `${baseName}.zip`;
    const innerFilename = filename.includes('.') ? filename : `${filename}.${originalExt}`;

    // Create ZIP with or without password
    const zipBlob = await createZipBlob(
      innerFilename,
      decryptedData,
      options.password
    );

    onProgress?.({ stage: 'saving', progress: 60, message: 'Saving file...' });

    if (Capacitor.isNativePlatform()) {
      return await exportToMobile(zipFilename, zipBlob, onProgress);
    } else {
      return await exportToWeb(zipFilename, zipBlob, onProgress);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Export failed';
    onProgress?.({ stage: 'error', progress: 0, message });
    return { success: false, error: message };
  }
}

async function createZipBlob(
  filename: string,
  data: ArrayBuffer,
  password?: string
): Promise<Blob> {
  const blobWriter = new BlobWriter('application/zip');
  
  const zipWriterOptions: any = {};
  
  if (password) {
    // Use AES-256 encryption
    zipWriterOptions.password = password;
    zipWriterOptions.encryptionStrength = 3; // AES-256
  }

  const zipWriter = new ZipWriter(blobWriter, zipWriterOptions);

  // Add the file to the ZIP
  const blob = new Blob([data]);
  await zipWriter.add(filename, new BlobReader(blob));

  return await zipWriter.close();
}

async function exportToMobile(
  filename: string,
  zipBlob: Blob,
  onProgress?: (progress: ExportProgress) => void
): Promise<ExportResult> {
  try {
    // Convert blob to base64
    const base64 = await blobToBase64(zipBlob);

    // Save to cache directory
    const result = await Filesystem.writeFile({
      path: `exports/${filename}`,
      data: base64,
      directory: Directory.Cache,
      recursive: true,
    });

    onProgress?.({ stage: 'complete', progress: 80, message: 'Opening share sheet...' });

    // Open share sheet
    await Share.share({
      title: filename,
      url: result.uri,
      dialogTitle: 'Export Document',
    });

    // Cleanup after a delay (give time for share to complete)
    setTimeout(async () => {
      try {
        await Filesystem.deleteFile({
          path: `exports/${filename}`,
          directory: Directory.Cache,
        });
      } catch (e) {
        console.warn('Failed to cleanup export file:', e);
      }
    }, 30000);

    onProgress?.({ stage: 'complete', progress: 100, message: 'Export complete' });

    return { success: true, filename, uri: result.uri };
  } catch (error) {
    throw error;
  }
}

async function exportToWeb(
  filename: string,
  zipBlob: Blob,
  onProgress?: (progress: ExportProgress) => void
): Promise<ExportResult> {
  try {
    // Create download link
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Cleanup blob URL after download starts
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    onProgress?.({ stage: 'complete', progress: 100, message: 'Download started' });

    return { success: true, filename };
  } catch (error) {
    throw error;
  }
}

export async function exportMultipleDocumentsAsZip(
  files: Array<{ filename: string; mimeType: string; data: ArrayBuffer }>,
  zipFilename: string,
  options: ExportOptions = {},
  onProgress?: (progress: ExportProgress) => void
): Promise<ExportResult> {
  try {
    onProgress?.({ stage: 'zipping', progress: 10, message: 'Creating archive...' });

    const blobWriter = new BlobWriter('application/zip');
    
    const zipWriterOptions: any = {};
    
    if (options.password) {
      zipWriterOptions.password = options.password;
      zipWriterOptions.encryptionStrength = 3; // AES-256
    }

    const zipWriter = new ZipWriter(blobWriter, zipWriterOptions);

    // Add each file to the ZIP
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = MIME_TO_EXTENSION[file.mimeType] || 'bin';
      const innerFilename = file.filename.includes('.') 
        ? file.filename 
        : `${file.filename}.${ext}`;
      
      const blob = new Blob([file.data]);
      await zipWriter.add(innerFilename, new BlobReader(blob));
      
      const progress = 10 + (i + 1) / files.length * 50;
      onProgress?.({ stage: 'zipping', progress, message: `Adding ${file.filename}...` });
    }

    const zipBlob = await zipWriter.close();

    onProgress?.({ stage: 'saving', progress: 60, message: 'Saving file...' });

    if (Capacitor.isNativePlatform()) {
      return await exportToMobile(zipFilename, zipBlob, onProgress);
    } else {
      return await exportToWeb(zipFilename, zipBlob, onProgress);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Export failed';
    onProgress?.({ stage: 'error', progress: 0, message });
    return { success: false, error: message };
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;
  
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: 'Weak', color: 'text-destructive' };
  if (score <= 2) return { score, label: 'Fair', color: 'text-yellow-500' };
  if (score <= 3) return { score, label: 'Good', color: 'text-blue-500' };
  return { score, label: 'Strong', color: 'text-green-500' };
}
