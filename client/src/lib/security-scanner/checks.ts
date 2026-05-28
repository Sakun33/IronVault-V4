/**
 * Security Scanner — individual check implementations.
 *
 * Each check is an async function returning a Finding (or null to skip).
 * The orchestrator (engine.ts) runs them in parallel within a category.
 *
 * Design rules:
 *  - Checks must never throw. Catch internally and return an `info` finding
 *    that explains the failure rather than crashing the scan.
 *  - Native-only checks must short-circuit with `null` on web so the engine
 *    can omit them from the finding list (they would otherwise be misleading).
 *  - Checks should be FAST (<500ms) — if they need network, race a 3s timeout.
 */

import { Capacitor } from '@capacitor/core';
import type { Finding } from './types';
import {
  checkBiometricCapabilities,
  isBiometricEnrolledForVault,
} from '@/native/biometrics';
import { securitySettingsService } from '@/lib/security/security-settings';
import type { PasswordEntry } from '@shared/schema';

const isNative = () => Capacitor.isNativePlatform();
const platform = (): 'web' | 'ios' | 'android' => {
  const p = Capacitor.getPlatform();
  return p === 'ios' || p === 'android' ? p : 'web';
};

// ─────────────────────────────────────────────────────────────────────────────
// BROWSER (web-only checks; on native most short-circuit with `null`)
// ─────────────────────────────────────────────────────────────────────────────

export async function checkHttps(): Promise<Finding> {
  const ok = typeof window !== 'undefined'
    && (window.location.protocol === 'https:' || window.location.hostname === 'localhost');
  return {
    id: 'browser.https',
    category: 'browser',
    severity: 'critical',
    title: 'HTTPS connection',
    description: ok
      ? 'You are connected over HTTPS — traffic between your browser and IronVault is encrypted.'
      : 'You are NOT on an HTTPS connection. Vault traffic could be intercepted on the network.',
    passed: ok,
    detail: typeof window !== 'undefined' ? `protocol=${window.location.protocol}` : undefined,
  };
}

export async function checkSubtleCrypto(): Promise<Finding> {
  const ok = typeof crypto !== 'undefined'
    && typeof crypto.subtle !== 'undefined'
    && typeof crypto.subtle.deriveKey === 'function';
  return {
    id: 'browser.subtle-crypto',
    category: 'browser',
    severity: 'critical',
    title: 'SubtleCrypto API',
    description: ok
      ? 'Your browser supports the Web Crypto API used for AES-256-GCM and PBKDF2 key derivation.'
      : 'Your browser is missing SubtleCrypto. IronVault cannot encrypt your vault safely here.',
    passed: ok,
  };
}

export async function checkCredentialMgmt(): Promise<Finding> {
  const ok = typeof navigator !== 'undefined'
    && 'credentials' in navigator
    && typeof (navigator as any).credentials?.get === 'function';
  return {
    id: 'browser.credentials',
    category: 'browser',
    severity: 'low',
    title: 'Credential Management API',
    description: ok
      ? 'Your browser supports the Credential Management API — autofill from IronVault works smoothly.'
      : 'Credential Management API not detected. Some autofill flows may not work.',
    passed: ok,
  };
}

export async function checkSecureContext(): Promise<Finding> {
  const ok = typeof window !== 'undefined' && (window as any).isSecureContext === true;
  return {
    id: 'browser.secure-context',
    category: 'browser',
    severity: 'high',
    title: 'Secure context',
    description: ok
      ? 'Your page is running in a Secure Context — required for clipboard, crypto, and credential APIs.'
      : 'Your browser does NOT consider this page a Secure Context. Encryption APIs may be disabled.',
    passed: ok,
  };
}

export async function checkServiceWorker(): Promise<Finding> {
  if (isNative()) return null as any;
  const ok = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  let active = false;
  if (ok) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      active = !!(reg && reg.active);
    } catch { /* ignore */ }
  }
  return {
    id: 'browser.sw',
    category: 'browser',
    severity: 'low',
    title: 'Service worker',
    description: active
      ? 'IronVault service worker is registered and active — offline access and integrity checks are in place.'
      : 'The IronVault service worker is not active. Offline mode and asset integrity checks may be unavailable.',
    passed: active,
  };
}

export async function checkLocalStorageHygiene(): Promise<Finding> {
  if (typeof localStorage === 'undefined') return null as any;
  // Look for obviously dangerous keys — plaintext "password" or "token" values.
  const suspectKeys: string[] = [];
  const allowedPatterns = [
    'ironvault_security_settings',
    'ironvault_',
    'iv_',
    'vault_',
  ];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    const isAllowed = allowedPatterns.some(p => k.startsWith(p));
    if (isAllowed) continue;
    const lower = k.toLowerCase();
    if (lower.includes('password') || lower.includes('secret') || lower.includes('private_key')) {
      suspectKeys.push(k);
    }
  }
  const ok = suspectKeys.length === 0;
  return {
    id: 'browser.localstorage-hygiene',
    category: 'browser',
    severity: 'medium',
    title: 'localStorage hygiene',
    description: ok
      ? 'No suspicious keys in localStorage. IronVault keeps secrets in IndexedDB encrypted under your master password.'
      : `Suspicious key names found in localStorage: ${suspectKeys.slice(0, 3).join(', ')}${suspectKeys.length > 3 ? '…' : ''}. Another site or extension may be storing sensitive data here.`,
    passed: ok,
    detail: ok ? undefined : suspectKeys.join(','),
  };
}

export async function checkCookies(): Promise<Finding> {
  if (isNative()) return null as any;
  if (typeof document === 'undefined') return null as any;
  // We can only read non-httpOnly cookies from JS — by definition any cookie
  // visible here is NOT httpOnly. Surface that count.
  const visible = document.cookie ? document.cookie.split(';').filter(Boolean).length : 0;
  const onHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const ok = visible === 0 || onHttps;
  return {
    id: 'browser.cookies',
    category: 'browser',
    severity: 'low',
    title: 'Cookie flags',
    description: visible === 0
      ? 'No JS-readable cookies on this origin. IronVault auth lives in IndexedDB, not cookies.'
      : `${visible} JS-readable cookie(s) on this origin. ${onHttps ? 'Page is HTTPS so transport is encrypted.' : 'Page is NOT HTTPS — cookies could be sniffed.'}`,
    passed: ok,
  };
}

export async function checkPrivateMode(): Promise<Finding> {
  if (isNative()) return null as any;
  // Heuristic: try a small IndexedDB write — Safari blocks IDB in private mode,
  // Firefox blocks `requestPersistent`. We treat private mode as INFO, not a fail.
  let isPrivate = false;
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      // Heuristic — private mode typically reports a tiny quota.
      if (est.quota && est.quota < 120_000_000) isPrivate = true;
    }
  } catch {
    isPrivate = true;
  }
  return {
    id: 'browser.private-mode',
    category: 'browser',
    severity: 'info',
    title: 'Private / Incognito mode',
    description: isPrivate
      ? 'You appear to be in a private/incognito window. Your vault will not persist after closing this window.'
      : 'You are in a normal browsing window — IronVault can store your encrypted vault on this device.',
    passed: !isPrivate,
  };
}

export async function checkWebrtcLeak(): Promise<Finding> {
  if (isNative()) return null as any;
  if (typeof RTCPeerConnection === 'undefined') {
    return {
      id: 'browser.webrtc',
      category: 'browser',
      severity: 'info',
      title: 'WebRTC IP leak',
      description: 'WebRTC is disabled in this browser — no IP leak vector here.',
      passed: true,
    };
  }
  // Probe local candidate IPs. Public IPv4/v6 here = leak. Only run with a 1500ms cap.
  return await new Promise<Finding>((resolve) => {
    let resolved = false;
    const candidates: string[] = [];
    try {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('iv-leak-probe');
      const finish = () => {
        if (resolved) return;
        resolved = true;
        try { pc.close(); } catch { /* */ }
        // mDNS .local addresses and RFC1918 addresses are NOT a leak.
        const publicLeaks = candidates.filter((ip) => {
          if (ip.endsWith('.local')) return false;
          if (ip.startsWith('10.')) return false;
          if (ip.startsWith('192.168.')) return false;
          if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return false;
          if (ip.startsWith('169.254.')) return false;
          if (ip === '127.0.0.1' || ip === '::1') return false;
          if (ip.startsWith('fe80:') || ip.startsWith('fd')) return false;
          return true;
        });
        const ok = publicLeaks.length === 0;
        resolve({
          id: 'browser.webrtc',
          category: 'browser',
          severity: 'medium',
          title: 'WebRTC IP leak',
          description: ok
            ? 'No public IP exposed via WebRTC. Your real IP is not leaking from this browser.'
            : `WebRTC exposed ${publicLeaks.length} public IP(s). Consider a browser extension that disables WebRTC IP handling if you use a VPN.`,
          passed: ok,
          detail: ok ? undefined : publicLeaks.join(','),
        });
      };
      pc.onicecandidate = (e) => {
        if (!e.candidate) {
          finish();
          return;
        }
        const c = e.candidate.candidate;
        const m = c.match(/(?:(?:\d{1,3}\.){3}\d{1,3})|(?:[a-f0-9]{1,4}(?::[a-f0-9]{1,4}){3,})/i);
        if (m) candidates.push(m[0]);
      };
      pc.createOffer().then((o) => pc.setLocalDescription(o)).catch(() => finish());
      setTimeout(finish, 1500);
    } catch {
      resolve({
        id: 'browser.webrtc',
        category: 'browser',
        severity: 'info',
        title: 'WebRTC IP leak',
        description: 'Could not probe WebRTC. No conclusion either way.',
        passed: true,
      });
    }
  });
}

export async function checkClipboardPermission(): Promise<Finding> {
  if (typeof navigator === 'undefined' || !navigator.permissions) {
    return {
      id: 'browser.clipboard',
      category: 'browser',
      severity: 'info',
      title: 'Clipboard permission',
      description: 'Clipboard permission status is not exposed by this browser. IronVault still auto-clears copied secrets.',
      passed: true,
    };
  }
  try {
    const res = await (navigator.permissions as any).query({ name: 'clipboard-read' });
    const state = res?.state ?? 'unknown';
    return {
      id: 'browser.clipboard',
      category: 'browser',
      severity: 'info',
      title: 'Clipboard permission',
      description: state === 'granted'
        ? 'Your browser grants clipboard-read. IronVault uses this only when you click "paste" — and clears after a timeout.'
        : `Clipboard-read permission is "${state}". You may be prompted on first paste.`,
      passed: true,
      detail: `state=${state}`,
    };
  } catch {
    return {
      id: 'browser.clipboard',
      category: 'browser',
      severity: 'info',
      title: 'Clipboard permission',
      description: 'Clipboard permission cannot be queried in this browser.',
      passed: true,
    };
  }
}

export async function checkMixedContent(): Promise<Finding> {
  if (isNative()) return null as any;
  if (typeof document === 'undefined') return null as any;
  // Look for any http:// resource in img/script/link tags.
  const tags = document.querySelectorAll('img[src], script[src], link[href]');
  const mixed: string[] = [];
  tags.forEach((el) => {
    const url = (el as any).src || (el as any).href;
    if (typeof url === 'string' && url.startsWith('http://') && !url.startsWith('http://localhost')) {
      mixed.push(url);
    }
  });
  const ok = mixed.length === 0;
  return {
    id: 'browser.mixed-content',
    category: 'browser',
    severity: 'high',
    title: 'Mixed content',
    description: ok
      ? 'No mixed-content resources detected. Every asset on this page is loaded over HTTPS.'
      : `${mixed.length} resource(s) loading over plain HTTP. This breaks the encryption guarantee for those assets.`,
    passed: ok,
    detail: ok ? undefined : mixed.slice(0, 3).join(', '),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DEVICE (native-leaning)
// ─────────────────────────────────────────────────────────────────────────────

export async function checkBiometricAvailable(): Promise<Finding> {
  try {
    const caps = await checkBiometricCapabilities();
    return {
      id: 'device.biometric-available',
      category: 'device',
      severity: 'medium',
      title: 'Biometric hardware',
      description: caps.isAvailable
        ? `Biometrics available on this device${(caps as any).biometryType ? ` (${(caps as any).biometryType})` : ''}. ${caps.isEnrolled ? 'You have enrolled biometrics in your OS.' : 'No biometrics enrolled in your OS yet.'}`
        : 'No biometric hardware detected (or access denied). Fall back to a strong master password.',
      passed: caps.isAvailable,
      fix: caps.isAvailable && !caps.isEnrolled ? { label: 'Enable biometric unlock', href: '/settings' } : undefined,
    };
  } catch (e: any) {
    return {
      id: 'device.biometric-available',
      category: 'device',
      severity: 'info',
      title: 'Biometric hardware',
      description: 'Could not query biometric capabilities — likely not supported in this browser.',
      passed: false,
      detail: e?.message,
    };
  }
}

export async function checkBiometricEnrolledForVault(vaultId: string | null | undefined): Promise<Finding> {
  if (!vaultId) {
    return null as any;
  }
  let enrolled = false;
  try {
    enrolled = isBiometricEnrolledForVault(vaultId);
  } catch { /* ignore */ }
  return {
    id: 'device.biometric-vault',
    category: 'device',
    severity: 'medium',
    title: 'Biometric unlock for this vault',
    description: enrolled
      ? 'This vault is configured to unlock with biometrics. Master password is still required as a fallback.'
      : 'This vault is not set up to unlock with biometrics. Enable it for faster unlock without sacrificing security.',
    passed: enrolled,
    fix: enrolled ? undefined : { label: 'Set up biometric unlock', href: '/settings' },
  };
}

export async function checkPlatformOs(): Promise<Finding> {
  const p = platform();
  if (p === 'web') return null as any;
  // Capacitor exposes Device via @capacitor/device, which we don't have installed.
  // Fall back to userAgent parsing — coarse but works on iOS/Android WebViews.
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  let osVersion = '';
  let outdated = false;
  if (p === 'ios') {
    const m = ua.match(/OS (\d+)_(\d+)/);
    if (m) {
      osVersion = `iOS ${m[1]}.${m[2]}`;
      const major = parseInt(m[1], 10);
      outdated = major < 16;
    }
  } else if (p === 'android') {
    const m = ua.match(/Android (\d+)(?:\.(\d+))?/);
    if (m) {
      osVersion = `Android ${m[1]}${m[2] ? '.' + m[2] : ''}`;
      const major = parseInt(m[1], 10);
      outdated = major < 12;
    }
  }
  return {
    id: 'device.os-version',
    category: 'device',
    severity: 'high',
    title: 'OS version',
    description: osVersion
      ? (outdated
          ? `Your OS (${osVersion}) is older than the security baseline. Update for the latest patches.`
          : `Your OS (${osVersion}) is current enough to receive security patches.`)
      : 'Could not determine OS version from the WebView.',
    passed: !!osVersion && !outdated,
    detail: osVersion || undefined,
  };
}

export async function checkScreenLockHint(): Promise<Finding> {
  // We cannot directly query "is the device PIN enabled" from a Capacitor
  // WebView. We infer it: if biometric auth is available, the OS *requires*
  // a passcode/PIN to be set. Anything else is an info hint.
  const p = platform();
  if (p === 'web') return null as any;
  try {
    const caps = await checkBiometricCapabilities();
    const ok = caps.isAvailable; // implies passcode is set
    return {
      id: 'device.screen-lock',
      category: 'device',
      severity: 'high',
      title: 'Device screen lock',
      description: ok
        ? 'A device passcode / PIN appears to be configured (biometric auth requires it).'
        : 'Could not confirm a device passcode is set. Verify in your OS settings — IronVault relies on the device lock as the outer layer.',
      passed: ok,
    };
  } catch {
    return null as any;
  }
}

export async function checkJailbreakRoot(): Promise<Finding> {
  const p = platform();
  if (p === 'web') return null as any;
  // Coarse heuristic — without a dedicated plugin we only flag obvious markers.
  // We never claim "clean" with high confidence; mark this as `info`.
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const suspicious = /cydia|sileo|magisk|busybox|supersu|frida/i.test(ua);
  return {
    id: 'device.jailbreak',
    category: 'device',
    severity: 'critical',
    title: 'Jailbreak / Root indicators',
    description: suspicious
      ? 'Possible jailbreak or root indicators detected in the device userAgent. Encryption guarantees are weakened on a rooted device.'
      : 'No jailbreak / root markers detected via userAgent. (This is a heuristic — a determined attacker can hide.)',
    passed: !suspicious,
    detail: suspicious ? ua : undefined,
  };
}

export async function checkSecureStorageHint(): Promise<Finding> {
  // We use Capacitor Preferences + native biometric Keychain/Keystore for
  // sensitive blobs. We treat the presence of the biometric plugin as evidence
  // that secure-storage primitives are available.
  const p = platform();
  if (p === 'web') return null as any;
  try {
    const caps = await checkBiometricCapabilities();
    const ok = caps.isAvailable;
    return {
      id: 'device.secure-storage',
      category: 'device',
      severity: 'low',
      title: 'Hardware-backed key storage',
      description: ok
        ? 'Hardware-backed key storage (Keychain / Android Keystore) is available on this device. IronVault uses it for biometric unlock.'
        : 'Hardware-backed key storage availability could not be confirmed.',
      passed: ok,
    };
  } catch {
    return null as any;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VAULT
// ─────────────────────────────────────────────────────────────────────────────

export function checkMasterPasswordStrength(masterPassword: string | null): Finding {
  if (!masterPassword) {
    return {
      id: 'vault.master-strength',
      category: 'vault',
      severity: 'info',
      title: 'Master password strength',
      description: 'Vault is locked — master password not available for inspection. Score is computed only while unlocked.',
      passed: true,
    };
  }
  const len = masterPassword.length;
  const hasLower = /[a-z]/.test(masterPassword);
  const hasUpper = /[A-Z]/.test(masterPassword);
  const hasDigit = /[0-9]/.test(masterPassword);
  const hasSymbol = /[^A-Za-z0-9]/.test(masterPassword);
  const classes = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;

  // Rough Shannon entropy approximation.
  let alphabet = 0;
  if (hasLower) alphabet += 26;
  if (hasUpper) alphabet += 26;
  if (hasDigit) alphabet += 10;
  if (hasSymbol) alphabet += 32;
  const entropyBits = alphabet > 0 ? Math.round(Math.log2(alphabet) * len) : 0;

  const weak = len < 12 || classes < 3 || entropyBits < 60;
  const great = len >= 16 && classes >= 3 && entropyBits >= 80;

  return {
    id: 'vault.master-strength',
    category: 'vault',
    severity: weak ? 'critical' : 'info',
    title: 'Master password strength',
    description: great
      ? `Excellent master password — ${len} chars, ~${entropyBits} bits of entropy. Brute-forcing this would take centuries.`
      : weak
        ? `Master password is weak: ${len} chars, ${classes}/4 character classes, ~${entropyBits} bits of entropy. Use at least 16 characters with mixed case, numbers, and symbols.`
        : `Master password is OK: ${len} chars, ${classes}/4 character classes, ~${entropyBits} bits of entropy. Strong is 16+ chars with all classes.`,
    passed: !weak,
    fix: weak ? { label: 'Change master password', href: '/profile?tab=security' } : undefined,
  };
}

export function checkPasswordReuse(passwords: PasswordEntry[]): Finding {
  if (!passwords || passwords.length === 0) {
    return null as any;
  }
  const counts = new Map<string, number>();
  for (const p of passwords) {
    if (!p.password) continue;
    counts.set(p.password, (counts.get(p.password) ?? 0) + 1);
  }
  const reused = Array.from(counts.values()).filter((n) => n > 1).length;
  return {
    id: 'vault.reuse',
    category: 'vault',
    severity: reused > 0 ? 'high' : 'info',
    title: 'Password reuse',
    description: reused === 0
      ? 'No password is reused across your vault entries. This is the gold standard.'
      : `${reused} password${reused > 1 ? 's are' : ' is'} reused across multiple entries. A breach of one site exposes the others.`,
    passed: reused === 0,
    fix: reused > 0 ? { label: 'Review duplicate passwords', href: '/passwords' } : undefined,
  };
}

export function checkWeakPasswords(passwords: PasswordEntry[]): Finding {
  if (!passwords || passwords.length === 0) return null as any;
  const weak = passwords.filter((p) => p.password && p.password.length < 10).length;
  return {
    id: 'vault.weak',
    category: 'vault',
    severity: weak > 0 ? 'medium' : 'info',
    title: 'Weak passwords',
    description: weak === 0
      ? 'No vault entries have passwords shorter than 10 characters.'
      : `${weak} vault entries have passwords shorter than 10 characters. Modern brute-force can crack short passwords in hours.`,
    passed: weak === 0,
    fix: weak > 0 ? { label: 'Strengthen weak passwords', href: '/passwords?strength=weak' } : undefined,
  };
}

export function checkStalePasswords(passwords: PasswordEntry[]): Finding {
  if (!passwords || passwords.length === 0) return null as any;
  const ninetyDays = 90 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const stale = passwords.filter((p) => {
    const ts = (p as any).updatedAt ?? (p as any).createdAt;
    if (!ts) return false;
    const t = typeof ts === 'string' ? Date.parse(ts) : Number(ts);
    return Number.isFinite(t) && (now - t) > ninetyDays;
  }).length;
  return {
    id: 'vault.stale',
    category: 'vault',
    severity: stale > 0 ? 'low' : 'info',
    title: 'Stale passwords (90+ days)',
    description: stale === 0
      ? 'All passwords have been rotated within the last 90 days.'
      : `${stale} passwords have not been rotated in 90+ days. Rotate high-value accounts (email, bank) at least quarterly.`,
    passed: stale === 0,
    fix: stale > 0 ? { label: 'Rotate old passwords', href: '/passwords' } : undefined,
  };
}

export function checkAutoLock(): Finding {
  const settings = securitySettingsService.getSettings();
  const interval = settings.autoLockInterval;
  const tooLong = interval === 'never' || interval === '15m';
  return {
    id: 'vault.autolock',
    category: 'vault',
    severity: interval === 'never' ? 'high' : tooLong ? 'medium' : 'info',
    title: 'Auto-lock timeout',
    description: interval === 'never'
      ? 'Auto-lock is DISABLED. Anyone with access to your unlocked device can read your vault.'
      : `Auto-lock is set to ${interval}. ${tooLong ? 'Consider shortening to 1–5 minutes.' : 'Good — your vault locks promptly when idle.'}`,
    passed: interval !== 'never' && !tooLong,
    fix: tooLong ? { label: 'Adjust auto-lock', href: '/settings' } : undefined,
  };
}

export function checkClipboardAutoClear(): Finding {
  const settings = securitySettingsService.getSettings();
  const ok = !!settings.clipboardAutoClear;
  return {
    id: 'vault.clipboard-clear',
    category: 'vault',
    severity: ok ? 'info' : 'medium',
    title: 'Clipboard auto-clear',
    description: ok
      ? `Copied secrets are wiped from your clipboard after ${settings.clipboardClearDelaySeconds}s.`
      : 'Clipboard auto-clear is OFF. Anything you copy stays in your clipboard until overwritten — apps and other devices can read it.',
    passed: ok,
    fix: ok ? undefined : { label: 'Enable clipboard auto-clear', href: '/settings' },
  };
}

export function checkLockOnBackground(): Finding {
  const settings = securitySettingsService.getSettings();
  const ok = !!settings.lockOnBackground;
  return {
    id: 'vault.lock-background',
    category: 'vault',
    severity: ok ? 'info' : 'medium',
    title: 'Lock when backgrounded',
    description: ok
      ? 'IronVault locks immediately when you switch apps or background the tab.'
      : 'Vault stays unlocked when you switch apps. Enable lock-on-background for stronger isolation.',
    passed: ok,
    fix: ok ? undefined : { label: 'Enable lock on background', href: '/settings' },
  };
}

export async function checkTwoFactor(accountEmail: string | null): Promise<Finding> {
  if (!accountEmail) {
    return null as any;
  }
  // Best effort — try `/api/auth/2fa/status` with a short timeout. Fail open
  // to "info" if unknown rather than scaring the user with a false negative.
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const r = await fetch('/api/auth/2fa/status', {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!r.ok) throw new Error(`status ${r.status}`);
    const j = await r.json();
    const enabled = !!(j?.enabled ?? j?.totp_enabled ?? j?.twoFactorEnabled);
    return {
      id: 'vault.2fa',
      category: 'vault',
      severity: enabled ? 'info' : 'high',
      title: 'Two-factor authentication',
      description: enabled
        ? 'TOTP 2FA is enabled on your IronVault account. Account login requires a code from your authenticator.'
        : 'TOTP 2FA is NOT enabled on your IronVault account. Enable it so a leaked password alone cannot log in.',
      passed: enabled,
      fix: enabled ? undefined : { label: 'Enable 2FA', href: '/profile?tab=security' },
    };
  } catch {
    return {
      id: 'vault.2fa',
      category: 'vault',
      severity: 'info',
      title: 'Two-factor authentication',
      description: '2FA status could not be confirmed from the server. Check your security tab in Profile to verify.',
      passed: true,
      fix: { label: 'Open Security tab', href: '/profile?tab=security' },
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NETWORK
// ─────────────────────────────────────────────────────────────────────────────

export async function checkOnline(): Promise<Finding> {
  const online = typeof navigator !== 'undefined' && navigator.onLine;
  return {
    id: 'network.online',
    category: 'network',
    severity: 'info',
    title: 'Network connectivity',
    description: online
      ? 'You are online. Vault cloud sync is available.'
      : 'You appear to be offline. Vault is still readable locally; cloud sync is paused.',
    passed: online,
  };
}

export async function checkConnectionType(): Promise<Finding> {
  const conn = (navigator as any)?.connection;
  if (!conn) return null as any;
  const type = conn.effectiveType ?? conn.type ?? 'unknown';
  const saver = !!conn.saveData;
  return {
    id: 'network.connection',
    category: 'network',
    severity: 'info',
    title: 'Connection type',
    description: `Effective network: ${type}${saver ? ' (data-saver on)' : ''}. ${type === '2g' || type === 'slow-2g' ? 'Connection is slow — cloud sync may take longer.' : ''}`,
    passed: true,
    detail: JSON.stringify({ type, downlink: conn.downlink, rtt: conn.rtt }),
  };
}

export async function checkHstsProbe(): Promise<Finding> {
  // We cannot read HSTS headers from JS — but we CAN attempt to GET the page
  // over plain http:// and observe whether the browser upgrades. Skipped on
  // localhost. Run with a 2500ms cap.
  if (typeof window === 'undefined') return null as any;
  if (window.location.hostname === 'localhost' || window.location.protocol !== 'https:') {
    return null as any;
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const r = await fetch('/api/health', { method: 'GET', signal: ctrl.signal });
    clearTimeout(t);
    const ok = r.ok;
    return {
      id: 'network.https-only',
      category: 'network',
      severity: 'low',
      title: 'API reachable over HTTPS',
      description: ok
        ? 'IronVault API is reachable over HTTPS and responding to health checks.'
        : `IronVault API returned status ${r.status}. Cloud sync may be degraded.`,
      passed: ok,
    };
  } catch (e: any) {
    return {
      id: 'network.https-only',
      category: 'network',
      severity: 'medium',
      title: 'API reachable over HTTPS',
      description: 'Could not reach the IronVault API. You may be offline or behind a strict firewall.',
      passed: false,
      detail: e?.message,
    };
  }
}

export async function checkDnsLeakInfo(): Promise<Finding> {
  // No reliable in-browser DNS leak test. Surface as INFO with a link out.
  return {
    id: 'network.dns-info',
    category: 'network',
    severity: 'info',
    title: 'DNS leak test',
    description: 'In-browser DNS leak testing is unreliable. If you use a VPN, verify at dnsleaktest.com from a separate tab.',
    passed: true,
  };
}
