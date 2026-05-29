import { apiBase } from '@/native/platform';
import { getCloudToken } from '@/lib/cloud-vault-sync';

export interface CouplePair {
  id: string;
  partnerEmail: string;
  partnerName: string;
  sharedSections: string[];
  message: string | null;
  status: 'invited' | 'accepted' | 'paused';
  invitedAt: string;
  acceptedAt: string | null;
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

export function getCoupleStatus(): Promise<{ success: boolean; pair: CouplePair | null }> {
  return call('/api/couple/status');
}

export function inviteCouple(input: {
  partnerEmail: string;
  partnerName: string;
  sharedSections: string[];
  message?: string;
}): Promise<{ success: boolean; inviteId: string; status: string }> {
  return call('/api/couple/invite', { method: 'POST', body: JSON.stringify(input) });
}

export function unpairCouple(): Promise<{ success: boolean }> {
  return call('/api/couple/invite', { method: 'DELETE' });
}

export async function acceptCoupleInvite(token: string): Promise<{ success: boolean }> {
  const res = await fetch(`${apiBase()}/api/couple/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || `HTTP ${res.status}`);
  return data;
}
