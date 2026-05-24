/**
 * Password share links — end-to-end encrypted, zero-knowledge.
 *
 * The plaintext credential is encrypted on the sender's device with a
 * freshly-generated AES-256-GCM key. The ciphertext + IV are uploaded
 * via /api/share/create; the raw key goes only into the URL fragment
 * (#k=…) which browsers never include in HTTP requests, so the server
 * cannot decrypt the payload no matter what.
 *
 * Server enforces TTL and view-count caps (not confidentiality — that's
 * the AES key's job).
 */

import { apiBase } from '@/native/platform';
import { getCloudToken } from '@/lib/cloud-vault-sync';

export interface SharePayload {
  /** What was shared — e.g. password name. Stored alongside the blob server-side as a label. */
  itemLabel?: string;
  itemKind?: 'password' | 'card' | 'note' | 'wifi' | 'other';
  /** The actual credential. Any JSON-serialisable object — receiver sees this verbatim. */
  data: unknown;
}

export interface CreatedShareLink {
  id: string;
  expiresAt: string;
  maxViews: number;
  /** The full URL to send. Includes #k= fragment with the AES key. */
  url: string;
}

function authHeaders(): HeadersInit {
  const token = getCloudToken();
  return token
    ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

function ab2b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64url2ab(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function createShareLink(
  payload: SharePayload,
  opts: { maxViews?: number; ttlSeconds?: number },
): Promise<{ ok: true; link: CreatedShareLink } | { ok: false; error: string }> {
  try {
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(payload.data));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);

    const res = await fetch(`${apiBase()}/api/share/create`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        encryptedPayload: ab2b64url(ciphertext),
        iv: ab2b64url(iv),
        itemLabel: payload.itemLabel,
        itemKind: payload.itemKind,
        maxViews: opts.maxViews ?? 1,
        ttlSeconds: opts.ttlSeconds ?? 24 * 3600,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body?.error || `HTTP ${res.status}` };
    }
    const body = await res.json();
    const rawKey = await crypto.subtle.exportKey('raw', key);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/share/${body.id}#k=${ab2b64url(rawKey)}`;
    return {
      ok: true,
      link: {
        id: body.id,
        expiresAt: body.expiresAt,
        maxViews: body.maxViews,
        url,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Encryption failed' };
  }
}

export async function redeemShareLink(
  id: string,
  rawKeyB64: string,
): Promise<{ ok: true; payload: SharePayload; meta: { viewCount: number; maxViews: number; expiresAt: string } } | { ok: false; error: string; status?: number }> {
  try {
    const res = await fetch(`${apiBase()}/api/share/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body?.error || `HTTP ${res.status}`, status: res.status };
    }
    const body = await res.json();
    // WebCrypto APIs want BufferSource; cast through `unknown` to bypass
    // the over-strict SharedArrayBuffer union TypeScript infers from
    // `Uint8Array.buffer`. The runtime values are plain ArrayBuffers.
    const keyBytes = b64url2ab(rawKeyB64);
    const ivBytes = b64url2ab(body.iv);
    const ctBytes = b64url2ab(body.encryptedPayload);
    const key = await crypto.subtle.importKey(
      'raw',
      keyBytes as unknown as BufferSource,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    );
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes as unknown as BufferSource },
      key,
      ctBytes as unknown as BufferSource,
    );
    const data = JSON.parse(new TextDecoder().decode(plain));
    return {
      ok: true,
      payload: { itemLabel: body.itemLabel, itemKind: body.itemKind, data },
      meta: { viewCount: body.viewCount, maxViews: body.maxViews, expiresAt: body.expiresAt },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Decryption failed' };
  }
}

export interface ListedShareLink {
  id: string;
  itemLabel: string | null;
  itemKind: string | null;
  maxViews: number;
  viewCount: number;
  createdAt: string;
  expiresAt: string;
}

export async function listShareLinks(): Promise<ListedShareLink[]> {
  try {
    const res = await fetch(`${apiBase()}/api/share/list`, { headers: authHeaders() });
    if (!res.ok) return [];
    const body = await res.json();
    return body.links || [];
  } catch {
    return [];
  }
}

export async function revokeShareLink(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${apiBase()}/api/share/revoke`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ id }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
