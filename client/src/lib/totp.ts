import { generateSync } from 'otplib';

// otplib v13 ships a functional API instead of the older `authenticator`
// singleton. `generateSync` returns the current TOTP for a given base32
// secret. We use sync since the noble crypto plugin (default in v13)
// supports synchronous HMAC and the UI needs the code on every tick.
//
// We intentionally don't expose verify/generateSecret here — IronVault
// stores secrets that the user pastes in from an authenticator setup
// screen, so we only need to *display* the current code.

/**
 * Pull the raw shared secret out of either a full `otpauth://` URI or a
 * plain base32 string. Trims whitespace and uppercases for parity with
 * otplib's expected input. Returns null on malformed input rather than
 * throwing so the UI can fall back to "—" instead of crashing the modal.
 */
export function parseSecret(input: string | undefined | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^otpauth:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const secret = url.searchParams.get('secret');
      return secret ? secret.replace(/\s+/g, '').toUpperCase() : null;
    } catch {
      return null;
    }
  }

  // Base32 — strip whitespace, dashes, underscores, dots; uppercase.
  return trimmed.replace(/[\s\-_.]/g, '').toUpperCase();
}

/** Returns the current 6-digit TOTP, or null if the secret is unparseable. */
export function generateTotp(input: string | undefined | null): string | null {
  const secret = parseSecret(input);
  if (!secret) return null;
  try {
    // RFC 6238 defaults: SHA-1, 6 digits, 30s period — Google Authenticator
    // compatible, which is what 99% of services hand out QR codes for.
    return generateSync({ secret });
  } catch {
    return null;
  }
}

/** Seconds remaining in the current 30s TOTP period (per RFC 6238). */
export function totpTimeRemaining(): number {
  const now = Math.floor(Date.now() / 1000);
  return 30 - (now % 30);
}
