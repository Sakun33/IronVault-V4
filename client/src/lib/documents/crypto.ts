/**
 * Document Encryption Utilities
 * Uses WebCrypto API for AES-GCM encryption
 * No plaintext persistence - all decryption happens in memory
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const ITERATIONS = 100000;

export async function generateEncryptionKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function encryptData(
  data: ArrayBuffer,
  key: CryptoKey
): Promise<{ encrypted: ArrayBuffer; iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    data
  );

  return { encrypted, iv };
}

export async function decryptData(
  encryptedData: ArrayBuffer,
  key: CryptoKey,
  iv: Uint8Array
): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    encryptedData
  );
}

export async function exportKey(key: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.exportKey('raw', key);
}

export async function importKey(keyData: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

export function concatBuffers(...buffers: ArrayBuffer[]): ArrayBuffer {
  const totalLength = buffers.reduce((sum, buf) => sum + buf.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const buffer of buffers) {
    result.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  }
  return result.buffer;
}

export interface EncryptedPackage {
  iv: Uint8Array;
  salt: Uint8Array;
  data: ArrayBuffer;
}

export function packageEncryptedData(
  encrypted: ArrayBuffer,
  iv: Uint8Array,
  salt: Uint8Array
): ArrayBuffer {
  const ivLength = new Uint8Array([iv.length]);
  const saltLength = new Uint8Array([salt.length]);
  
  return concatBuffers(
    ivLength.buffer,
    iv.buffer,
    saltLength.buffer,
    salt.buffer,
    encrypted
  );
}

export function unpackageEncryptedData(packagedData: ArrayBuffer): EncryptedPackage {
  const view = new Uint8Array(packagedData);
  let offset = 0;
  
  const ivLength = view[offset];
  offset += 1;
  
  const iv = view.slice(offset, offset + ivLength);
  offset += ivLength;
  
  const saltLength = view[offset];
  offset += 1;
  
  const salt = view.slice(offset, offset + saltLength);
  offset += saltLength;
  
  const data = view.slice(offset).buffer;
  
  return { iv, salt, data };
}
