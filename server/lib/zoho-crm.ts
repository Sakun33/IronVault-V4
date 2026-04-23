/**
 * Zoho CRM API integration.
 * Requires env vars: ZOHO_CRM_CLIENT_ID, ZOHO_CRM_CLIENT_SECRET, ZOHO_CRM_REFRESH_TOKEN
 */

const TOKEN_URL = 'https://accounts.zoho.in/oauth/v2/token';
const CRM_BASE = 'https://www.zohoapis.in/crm/v7';

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken;

  // Reuse the same Zoho OAuth client credentials used for Desk/CRM in api/index.ts
  const clientId = process.env.ZOHO_DESK_CLIENT_ID || process.env.ZOHO_CRM_CLIENT_ID;
  const clientSecret = process.env.ZOHO_DESK_CLIENT_SECRET || process.env.ZOHO_CRM_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_CRM_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Zoho CRM env vars not configured (ZOHO_DESK_CLIENT_ID + ZOHO_DESK_CLIENT_SECRET + ZOHO_CRM_REFRESH_TOKEN)');
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const res = await fetch(`${TOKEN_URL}?${params}`, { method: 'POST' });
  if (!res.ok) throw new Error(`Zoho token refresh failed: ${res.status}`);

  const data = await res.json();
  if (!data.access_token) throw new Error(`Zoho token response missing access_token: ${JSON.stringify(data)}`);

  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;
  return cachedToken!;
}

export interface CrmContactData {
  email: string;
  fullName: string;
  phone?: string | null;
  country?: string | null;
  company?: string | null;
  plan?: string | null;
  createdAt?: Date | null;
}

export async function createCrmContact(data: CrmContactData): Promise<{ id: string; action: 'insert' | 'update' }> {
  const token = await getAccessToken();

  const nameParts = (data.fullName || data.email.split('@')[0]).split(' ');
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : nameParts[0];
  const firstName = nameParts.length > 1 ? nameParts[0] : '';

  const contact: Record<string, unknown> = {
    Last_Name: lastName,
    ...(firstName && { First_Name: firstName }),
    Email: data.email,
    ...(data.phone && { Phone: data.phone }),
    ...(data.country && { Mailing_Country: data.country }),
    ...(data.company && { Account_Name: data.company }),
    Lead_Source: 'IronVault App',
    Description: data.plan ? `Plan: ${data.plan}` : 'IronVault user',
  };

  const res = await fetch(`${CRM_BASE}/Contacts/upsert`, {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: [contact],
      duplicate_check_fields: ['Email'],
      apply_feature_execution: [{ name: 'layout_rules' }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zoho CRM upsert failed (${res.status}): ${body}`);
  }

  const result = await res.json();
  const record = result.data?.[0];
  if (!record || record.code !== 'SUCCESS') {
    throw new Error(`Zoho CRM upsert error: ${JSON.stringify(record)}`);
  }

  return {
    id: record.details?.id ?? '',
    action: record.action === 'insert' ? 'insert' : 'update',
  };
}
