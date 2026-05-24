/**
 * Smart Form Filler — collects fillable field data from the unlocked vault.
 *
 * Three sources are combined:
 *   - identities: name, email, phone, address fields
 *   - credit cards: card number, cardholder, expiry, CVV
 *   - passwords: username/email + password matched on URL host
 *
 * The output is a flat `FillProfile` plus a per-host `FillCredential[]`
 * lookup that the Chrome extension / future iOS AutoFill QuickType bar
 * can consume directly. Nothing leaves the device.
 */

import type { Identity, CreditCard, PasswordEntry } from '@shared/schema';

export interface FillProfile {
  /** Primary identity used for default fills (first identity with type='personal', else first identity). */
  fullName: string;
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface FillCard {
  id: string;
  cardName: string;
  cardholderName: string;
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  brand: string;
  type: string;
}

export interface FillCredential {
  id: string;
  host: string;
  url?: string;
  username: string;
  password: string;
  name: string;
}

export interface FillSnapshot {
  profile: FillProfile | null;
  cards: FillCard[];
  credentials: FillCredential[];
  /** Keyed by lowercase host suffix → array of credentials. Suffix matches: `login.x.com` → `login.x.com`, `x.com`. */
  credentialsByHost: Record<string, FillCredential[]>;
  /** Keyed by lowercase host suffix → array of identities applicable on that host (almost always: all of them). */
  identities: Identity[];
  updatedAt: string;
}

const EMPTY_PROFILE: FillProfile = {
  fullName: '',
  firstName: '',
  middleName: '',
  lastName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
};

function pickPrimaryIdentity(identities: Identity[]): Identity | null {
  if (identities.length === 0) return null;
  const personal = identities.find(i => i.type === 'personal');
  return personal || identities[0];
}

function identityToProfile(identity: Identity | null): FillProfile {
  if (!identity) return EMPTY_PROFILE;
  const fullName = [identity.firstName, identity.middleName, identity.lastName].filter(Boolean).join(' ');
  return {
    fullName,
    firstName: identity.firstName || '',
    middleName: identity.middleName || '',
    lastName: identity.lastName || '',
    email: identity.email || '',
    phone: identity.phone || '',
    dateOfBirth: identity.dateOfBirth || '',
    addressLine1: identity.addressLine1 || '',
    addressLine2: identity.addressLine2 || '',
    city: identity.city || '',
    state: identity.state || '',
    postalCode: identity.postalCode || '',
    country: identity.country || '',
  };
}

function hostOf(rawUrl: string): string {
  if (!rawUrl) return '';
  try {
    const u = new URL(rawUrl.includes('://') ? rawUrl : `https://${rawUrl}`);
    return u.hostname.toLowerCase();
  } catch {
    return rawUrl.toLowerCase();
  }
}

function hostSuffixes(host: string): string[] {
  const parts = host.split('.').filter(Boolean);
  const suffixes: string[] = [];
  for (let i = 0; i < parts.length - 1; i++) {
    suffixes.push(parts.slice(i).join('.'));
  }
  return suffixes.length > 0 ? suffixes : [host];
}

export function buildFillSnapshot(
  identities: Identity[],
  cards: CreditCard[],
  passwords: PasswordEntry[],
): FillSnapshot {
  const profile = identityToProfile(pickPrimaryIdentity(identities));

  const fillCards: FillCard[] = cards.map(c => ({
    id: c.id,
    cardName: c.cardName,
    cardholderName: c.cardholderName,
    cardNumber: c.cardNumber,
    expiryMonth: c.expiryMonth,
    expiryYear: c.expiryYear,
    cvv: c.cvv || '',
    brand: c.brand,
    type: c.type,
  }));

  const credentials: FillCredential[] = passwords
    .filter(p => p.password && p.url)
    .map(p => {
      const host = hostOf(p.url!);
      return {
        id: p.id,
        host,
        url: p.url,
        username: p.username || (p as any).email || '',
        password: p.password!,
        name: p.name,
      };
    });

  const credentialsByHost: Record<string, FillCredential[]> = {};
  for (const c of credentials) {
    for (const s of hostSuffixes(c.host)) {
      (credentialsByHost[s] = credentialsByHost[s] || []).push(c);
    }
  }

  return {
    profile,
    cards: fillCards,
    credentials,
    credentialsByHost,
    identities,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Public helper for the form-filler page / Chrome extension: look up
 * matching credentials for a target URL using endsWith matching.
 */
export function matchCredentialsForUrl(
  snapshot: FillSnapshot,
  targetUrl: string,
): FillCredential[] {
  const host = hostOf(targetUrl);
  if (!host) return [];
  for (const s of hostSuffixes(host)) {
    if (snapshot.credentialsByHost[s]?.length) return snapshot.credentialsByHost[s];
  }
  return [];
}
