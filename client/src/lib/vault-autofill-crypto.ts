/**
 * Vault Autofill Encryption Helpers
 * 
 * Provides client-side encryption/decryption for autofill vault entries.
 * Uses AES-GCM for authenticated encryption with the app's master key.
 */

export interface EncryptedPayload {
  ciphertext: string; // Base64 encoded
  iv: string; // Base64 encoded initialization vector
  tag: string; // Base64 encoded authentication tag (included in ciphertext for GCM)
}

export interface VaultEntry {
  id: string;
  domain: string;
  title: string;
  username?: string;
  type: 'password' | 'api_key' | 'subscription' | 'note';
  encryptedPayload: EncryptedPayload;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
  lastUsed?: Date;
}

/**
 * Encrypt a plaintext secret using AES-GCM
 * @param plaintext - The secret to encrypt
 * @param masterKey - The CryptoKey derived from user's master password
 * @returns Encrypted payload with ciphertext, IV, and auth tag
 */
export async function encryptSecret(
  plaintext: string,
  masterKey: CryptoKey
): Promise<EncryptedPayload> {
  try {
    // Generate a random IV (12 bytes is standard for GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Convert plaintext to bytes
    const encoder = new TextEncoder();
    const plaintextBytes = encoder.encode(plaintext);
    
    // Encrypt using AES-GCM
    const ciphertextBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128, // 128-bit authentication tag
      },
      masterKey,
      plaintextBytes
    );
    
    // Convert to base64 for storage
    const ciphertext = arrayBufferToBase64(ciphertextBuffer);
    const ivBase64 = arrayBufferToBase64(iv);
    
    // In GCM mode, the tag is included in the ciphertext
    // Extract last 16 bytes for the tag (for reference, though it's already in ciphertext)
    const ciphertextArray = new Uint8Array(ciphertextBuffer);
    const tag = arrayBufferToBase64(ciphertextArray.slice(-16));
    
    return {
      ciphertext,
      iv: ivBase64,
      tag,
    };
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt secret');
  }
}

/**
 * Decrypt an encrypted payload using AES-GCM
 * @param payload - The encrypted payload
 * @param masterKey - The CryptoKey derived from user's master password
 * @returns Decrypted plaintext secret
 */
export async function decryptSecret(
  payload: EncryptedPayload,
  masterKey: CryptoKey
): Promise<string> {
  try {
    // Convert base64 back to bytes
    const ciphertextBytes = base64ToArrayBuffer(payload.ciphertext);
    const iv = base64ToArrayBuffer(payload.iv);
    
    // Decrypt using AES-GCM
    const plaintextBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128,
      },
      masterKey,
      ciphertextBytes
    );
    
    // Convert bytes back to string
    const decoder = new TextDecoder();
    const plaintext = decoder.decode(plaintextBuffer);
    
    return plaintext;
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt secret. Invalid master key or corrupted data.');
  }
}

/**
 * Derive a vault autofill key from the master password
 * This is separate from the main vault key for additional security
 * @param masterPassword - User's master password
 * @param salt - Salt for key derivation (should be stored with vault)
 * @returns CryptoKey suitable for AES-GCM encryption
 */
export async function deriveAutofillKey(
  masterPassword: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  try {
    const encoder = new TextEncoder();
    const passwordBytes = encoder.encode(masterPassword);
    
    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBytes,
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    // Derive key using PBKDF2
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 600000, // OWASP recommended minimum
        hash: 'SHA-256',
      },
      keyMaterial,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false, // Not extractable for security
      ['encrypt', 'decrypt']
    );
    
    return key;
  } catch (error) {
    console.error('Key derivation failed:', error);
    throw new Error('Failed to derive encryption key');
  }
}

/**
 * Validate that a CryptoKey is suitable for AES-GCM
 * @param key - The key to validate
 * @returns True if valid, false otherwise
 */
export function isValidEncryptionKey(key: CryptoKey): boolean {
  return (
    key.type === 'secret' &&
    key.algorithm.name === 'AES-GCM' &&
    key.usages.includes('encrypt') &&
    key.usages.includes('decrypt')
  );
}

// Helper functions for base64 encoding/decoding
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generate a random salt for key derivation
 * @returns 32-byte salt
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

/**
 * Extract domain from URL for filtering
 * @param url - Full URL or domain
 * @returns Clean domain (e.g., "example.com")
 */
export function extractDomain(url: string): string {
  try {
    // Handle URLs without protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    // If URL parsing fails, return as-is
    return url.replace('www.', '').toLowerCase();
  }
}

