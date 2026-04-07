const ACCOUNT_KEY = 'iv_account';

interface AccountRecord {
  email: string;
  passwordHash: string;
}

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function saveAccountCredentials(email: string, password: string): Promise<void> {
  const passwordHash = await sha256(password);
  const record: AccountRecord = { email: email.toLowerCase().trim(), passwordHash };
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(record));
}

export function hasAccountCredentials(): boolean {
  return !!localStorage.getItem(ACCOUNT_KEY);
}

export async function verifyAccountCredentials(email: string, password: string): Promise<boolean> {
  const stored = localStorage.getItem(ACCOUNT_KEY);
  if (!stored) return false;
  try {
    const record: AccountRecord = JSON.parse(stored);
    const inputHash = await sha256(password);
    return record.email === email.toLowerCase().trim() && record.passwordHash === inputHash;
  } catch {
    return false;
  }
}

export function getAccountEmail(): string | null {
  const stored = localStorage.getItem(ACCOUNT_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored).email;
  } catch {
    return null;
  }
}
