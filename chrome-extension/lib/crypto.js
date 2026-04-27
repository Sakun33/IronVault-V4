// Byte-compatible with client/src/lib/crypto.ts (PBKDF2 600k SHA-256 → AES-GCM-256).
// Used by the extension's background service worker to decrypt cloud vault blobs
// produced by VaultStorage.exportVault().

const PBKDF2_ITERATIONS = 600000; // matches CryptoService.KDF_PRESETS.standard
const PBKDF2_HASH = 'SHA-256';

export function generateBytes(n) {
  return crypto.getRandomValues(new Uint8Array(n));
}

export async function deriveMasterKey(password, salt, iterations = PBKDF2_ITERATIONS) {
  const passwordBuffer = new TextEncoder().encode(password);
  const keyMaterial = await crypto.subtle.importKey(
    'raw', passwordBuffer, 'PBKDF2', false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: PBKDF2_HASH },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable — never leaves WebCrypto
    ['encrypt', 'decrypt'],
  );
}

export async function generateSessionKey() {
  // Extractable so we can persist raw bytes to chrome.storage.session
  // (browser-protected, in-memory only, cleared on browser close).
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'],
  );
}

export async function exportRawKey(key) {
  return new Uint8Array(await crypto.subtle.exportKey('raw', key));
}

export async function importSessionKey(rawBytes) {
  return crypto.subtle.importKey(
    'raw', rawBytes, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

export async function aesGcmEncrypt(plaintext, key, iv) {
  const ivBytes = iv || generateBytes(12);
  const data = typeof plaintext === 'string'
    ? new TextEncoder().encode(plaintext)
    : plaintext;
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ivBytes }, key, data);
  return { ciphertext: new Uint8Array(ct), iv: ivBytes };
}

export async function aesGcmDecrypt(ciphertext, key, iv) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new Uint8Array(pt);
}

export function b64Encode(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function b64Decode(b64) {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

export async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Decrypt the wire-format cloud vault blob produced by VaultStorage.exportVault().
// Returns the parsed JSON payload: { passwords, subscriptions, notes, ... }.
export async function decryptCloudBlob(blobJsonString, masterPassword) {
  const parsed = JSON.parse(blobJsonString);
  if (!parsed || !parsed.salt || !parsed.iv || !parsed.data) {
    throw new Error('Vault blob is malformed');
  }
  const salt = b64Decode(parsed.salt);
  const iv = b64Decode(parsed.iv);
  const ciphertext = b64Decode(parsed.data);
  const key = await deriveMasterKey(masterPassword, salt);
  let plaintext;
  try {
    plaintext = await aesGcmDecrypt(ciphertext, key, iv);
  } catch {
    throw new Error('WRONG_MASTER_PASSWORD');
  }
  return JSON.parse(new TextDecoder().decode(plaintext));
}

// Re-encrypt a payload back into the same wire format the web app produces
// (multi-vault-storage.ts → exportVault). Fresh salt + IV each call so the
// blob is never reused. Byte-compatible: the web app will accept the result
// the next time it pulls from cloud.
export async function encryptCloudBlob(payload, masterPassword) {
  const salt = generateBytes(16);
  const key = await deriveMasterKey(masterPassword, salt);
  const json = JSON.stringify(payload);
  const { ciphertext, iv } = await aesGcmEncrypt(json, key);
  return JSON.stringify({
    version: 3,
    salt: b64Encode(salt),
    iv: b64Encode(iv),
    data: b64Encode(ciphertext),
  });
}
