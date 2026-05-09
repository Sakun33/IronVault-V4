// Teams API client — wraps fetch calls to /api/teams/* with the cloud bearer
// token. Native (Capacitor) builds use absolute URLs via apiBase(); web uses
// relative URLs.

import { apiBase } from '@/native/platform';
import { getCloudToken } from '@/lib/cloud-vault-sync';

function url(path: string): string {
  const base = apiBase() || '';
  return `${base}${path}`;
}

function authHeaders(): HeadersInit {
  const token = getCloudToken();
  const h: Record<string, string> = { 'content-type': 'application/json' };
  if (token) h.authorization = `Bearer ${token}`;
  return h;
}

export interface Team {
  id: string;
  name: string;
  plan: string;
  owner_user_id: string;
  created_at: string;
  role?: string;
}

export interface TeamMember {
  email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: 'active' | 'pending';
  invited_at: string;
  accepted_at: string | null;
  user_id: string | null;
}

export interface SharedVault {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export async function listTeams(): Promise<Team[]> {
  const r = await fetch(url('/api/teams'), { headers: authHeaders() });
  if (!r.ok) throw new Error(`listTeams ${r.status}`);
  const j = await r.json();
  return j.teams || [];
}

export async function createTeam(name: string): Promise<Team> {
  const r = await fetch(url('/api/teams/create'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'createTeam failed');
  return j.team;
}

export async function inviteMember(teamId: string, email: string, role: 'admin' | 'member' | 'viewer'): Promise<void> {
  const r = await fetch(url(`/api/teams/${encodeURIComponent(teamId)}/invite`), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email, role }),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.error || `inviteMember ${r.status}`);
  }
}

export async function removeMember(teamId: string, email: string): Promise<void> {
  const r = await fetch(url(`/api/teams/${encodeURIComponent(teamId)}/remove`), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email }),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.error || `removeMember ${r.status}`);
  }
}

export async function listMembers(teamId: string): Promise<TeamMember[]> {
  const r = await fetch(url(`/api/teams/${encodeURIComponent(teamId)}/members`), { headers: authHeaders() });
  if (!r.ok) throw new Error(`listMembers ${r.status}`);
  const j = await r.json();
  return j.members || [];
}

export async function listSharedVaults(teamId: string): Promise<SharedVault[]> {
  const r = await fetch(url(`/api/teams/${encodeURIComponent(teamId)}/shared-vault`), { headers: authHeaders() });
  if (!r.ok) throw new Error(`listSharedVaults ${r.status}`);
  const j = await r.json();
  return j.sharedVaults || [];
}

export async function createSharedVault(teamId: string, name: string): Promise<SharedVault> {
  const r = await fetch(url(`/api/teams/${encodeURIComponent(teamId)}/shared-vault`), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'createSharedVault failed');
  return j.sharedVault;
}
