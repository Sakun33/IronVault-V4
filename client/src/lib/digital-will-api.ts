import { apiBase } from '@/native/platform';
import { getCloudToken } from '@/lib/cloud-vault-sync';

export interface WillBeneficiary {
  id: string;
  name: string;
  email: string;
  relationship: string | null;
  phone: string | null;
  accessLevel: 'full' | 'passwords_only' | 'documents_only' | 'selected';
  status: 'pending' | 'verified' | 'activated';
  verifiedAt: string | null;
  createdAt: string;
}

export interface WillStatus {
  isActive: boolean;
  inactivityPeriodDays: number;
  lastCheckinAt: string;
  personalMessage: string;
  activatedAt: string | null;
  daysSinceCheckin: number;
  daysRemaining: number;
}

export interface WillStatusResponse {
  success: boolean;
  will: WillStatus | null;
  beneficiaries: WillBeneficiary[];
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getCloudToken();
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || `HTTP ${res.status}`);
  return data as T;
}

export function getWillStatus(): Promise<WillStatusResponse> {
  return call<WillStatusResponse>('/api/digital-will/status');
}

export function configureWill(input: {
  isActive: boolean;
  inactivityPeriodDays: number;
  personalMessage: string;
}): Promise<{ success: boolean }> {
  return call('/api/digital-will/configure', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function addBeneficiary(input: {
  name: string;
  email: string;
  relationship?: string;
  phone?: string;
  accessLevel?: string;
}): Promise<{ success: boolean; beneficiary: WillBeneficiary }> {
  return call('/api/digital-will/beneficiaries', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function removeBeneficiary(id: string): Promise<{ success: boolean }> {
  return call(`/api/digital-will/beneficiaries/${id}`, { method: 'DELETE' });
}

export function checkInWill(): Promise<{ success: boolean; lastCheckinAt: string; daysRemaining: number }> {
  return call('/api/digital-will/checkin', { method: 'POST' });
}

export function activateWill(): Promise<{ success: boolean; activated: number; skipped: number }> {
  return call('/api/digital-will/activate', { method: 'POST' });
}

// Public — no auth required, hit by email links.
export async function verifyBeneficiary(token: string): Promise<{ success: boolean; beneficiary: { name: string; email: string } }> {
  const res = await fetch(`${apiBase()}/api/digital-will/verify-beneficiary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || `HTTP ${res.status}`);
  return data;
}

export async function fetchWillAccess(token: string): Promise<{
  success: boolean;
  beneficiary: { name: string; email: string };
  vault: { vault_id: string; encrypted_data: any; updated_at: string };
  expiresAt: string;
}> {
  const res = await fetch(`${apiBase()}/api/digital-will/access?token=${encodeURIComponent(token)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || `HTTP ${res.status}`);
  return data;
}
