/**
 * Security Scanner — orchestrator.
 *
 * Runs every check in parallel, groups by category, computes scores, and
 * returns a ScanResult. Persistence to IndexedDB is handled separately
 * (history.ts) so the engine stays pure.
 */

import { Capacitor } from '@capacitor/core';
import {
  type Finding,
  type ScanResult,
  type CategoryResult,
  type Category,
  SEVERITY_WEIGHTS,
  SEVERITY_RANK,
  gradeFromScore,
} from './types';
import * as C from './checks';
import type { PasswordEntry } from '@shared/schema';

interface ScanInput {
  masterPassword: string | null;
  accountEmail: string | null;
  currentVaultId: string | null;
  passwords: PasswordEntry[];
  /** Optional progress callback — fires after each check completes. */
  onProgress?: (done: number, total: number, label?: string) => void;
}

const CATEGORY_LABELS: Record<Category, string> = {
  browser: 'Browser Security',
  device: 'Device Security',
  vault: 'Vault Security',
  network: 'Network Security',
};

export async function runScan(input: ScanInput): Promise<ScanResult> {
  const t0 = performance.now();
  const platform: ScanResult['platform'] =
    Capacitor.getPlatform() === 'ios' ? 'ios' :
    Capacitor.getPlatform() === 'android' ? 'android' : 'web';

  // Each task returns a Finding or null (skipped — typically platform-gated).
  // `category` is preserved so that a thrown check still maps to the correct
  // category in the error fallback (otherwise device/network errors disappear).
  const tasks: Array<{ label: string; category: Category; run: () => Promise<Finding | null> }> = [
    // Browser
    { label: 'HTTPS',          category: 'browser', run: () => safeAsync(C.checkHttps) },
    { label: 'Secure context', category: 'browser', run: () => safeAsync(C.checkSecureContext) },
    { label: 'SubtleCrypto',   category: 'browser', run: () => safeAsync(C.checkSubtleCrypto) },
    { label: 'Credential Mgmt',category: 'browser', run: () => safeAsync(C.checkCredentialMgmt) },
    { label: 'Service worker', category: 'browser', run: () => safeAsync(C.checkServiceWorker) },
    { label: 'localStorage',   category: 'browser', run: () => safeAsync(C.checkLocalStorageHygiene) },
    { label: 'Cookies',        category: 'browser', run: () => safeAsync(C.checkCookies) },
    { label: 'Private mode',   category: 'browser', run: () => safeAsync(C.checkPrivateMode) },
    { label: 'WebRTC leak',    category: 'browser', run: () => safeAsync(C.checkWebrtcLeak) },
    { label: 'Clipboard perm', category: 'browser', run: () => safeAsync(C.checkClipboardPermission) },
    { label: 'Mixed content',  category: 'browser', run: () => safeAsync(C.checkMixedContent) },
    // Device
    { label: 'Biometric hardware', category: 'device', run: () => safeAsync(C.checkBiometricAvailable) },
    { label: 'Biometric vault',    category: 'device', run: () => safeAsync(() => C.checkBiometricEnrolledForVault(input.currentVaultId)) },
    { label: 'OS version',         category: 'device', run: () => safeAsync(C.checkPlatformOs) },
    { label: 'Screen lock',        category: 'device', run: () => safeAsync(C.checkScreenLockHint) },
    { label: 'Jailbreak/root',     category: 'device', run: () => safeAsync(C.checkJailbreakRoot) },
    { label: 'Secure storage',     category: 'device', run: () => safeAsync(C.checkSecureStorageHint) },
    // Vault
    { label: 'Master password',  category: 'vault', run: async () => safeSync(() => C.checkMasterPasswordStrength(input.masterPassword)) },
    { label: 'Password reuse',   category: 'vault', run: async () => safeSync(() => C.checkPasswordReuse(input.passwords ?? [])) },
    { label: 'Weak passwords',   category: 'vault', run: async () => safeSync(() => C.checkWeakPasswords(input.passwords ?? [])) },
    { label: 'Stale passwords',  category: 'vault', run: async () => safeSync(() => C.checkStalePasswords(input.passwords ?? [])) },
    { label: 'Auto-lock',        category: 'vault', run: async () => safeSync(() => C.checkAutoLock()) },
    { label: 'Clipboard clear',  category: 'vault', run: async () => safeSync(() => C.checkClipboardAutoClear()) },
    { label: 'Lock on bg',       category: 'vault', run: async () => safeSync(() => C.checkLockOnBackground()) },
    { label: '2FA',              category: 'vault', run: () => safeAsync(() => C.checkTwoFactor(input.accountEmail)) },
    // Network
    { label: 'Online',     category: 'network', run: () => safeAsync(C.checkOnline) },
    { label: 'Connection', category: 'network', run: () => safeAsync(C.checkConnectionType) },
    { label: 'HSTS',       category: 'network', run: () => safeAsync(C.checkHstsProbe) },
    { label: 'DNS info',   category: 'network', run: () => safeAsync(C.checkDnsLeakInfo) },
  ];

  const findings: Finding[] = [];
  let done = 0;
  // settleAll: never rejects. Each task is independently wrapped (above) AND
  // the outer Promise.all uses .catch on each task so one rogue check cannot
  // abort the whole scan. Errors become INFO findings in the correct category.
  await Promise.all(
    tasks.map(async (task) => {
      try {
        const r = await task.run();
        if (r) findings.push(r);
      } catch (e: any) {
        // Defense-in-depth: safeAsync/safeSync already swallow, but if they
        // ever leak we still want a sensible fallback rather than a crashed page.
        findings.push({
          id: `error.${task.category}.${task.label.toLowerCase().replace(/\s+/g, '-')}`,
          category: task.category,
          severity: 'info',
          title: `Check skipped: ${task.label}`,
          description: 'This check could not complete in your environment and was skipped.',
          passed: false,
          detail: e?.message,
        });
      } finally {
        done += 1;
        try { input.onProgress?.(done, tasks.length, task.label); } catch { /* progress callback must not crash scan */ }
      }
    })
  );

  // Group by category, sort within each by severity rank desc, then failed first.
  const categories: CategoryResult[] = (['browser', 'device', 'vault', 'network'] as Category[]).map((cat) => {
    const list = findings
      .filter((f) => f.category === cat)
      .sort((a, b) => {
        // Failed first, then by severity rank (critical first), then alphabetic.
        if (a.passed !== b.passed) return a.passed ? 1 : -1;
        const sr = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
        if (sr !== 0) return sr;
        return a.title.localeCompare(b.title);
      });
    const score = computeScore(list);
    return {
      category: cat,
      label: CATEGORY_LABELS[cat],
      findings: list,
      score,
      grade: gradeFromScore(score),
    };
  });

  const overall = computeScore(findings);
  const allSorted = [...findings].sort((a, b) => {
    if (a.passed !== b.passed) return a.passed ? 1 : -1;
    return SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
  });

  return {
    id: `scan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    scannedAt: new Date().toISOString(),
    durationMs: Math.round(performance.now() - t0),
    score: overall,
    grade: gradeFromScore(overall),
    categories,
    allFindings: allSorted,
    platform,
  };
}

function computeScore(findings: Finding[]): number {
  let score = 100;
  for (const f of findings) {
    if (f.passed) continue;
    const weight = SEVERITY_WEIGHTS[f.severity] ?? 1;
    score -= weight;
  }
  return Math.max(0, Math.min(100, score));
}

// Final safety net around an async check: never throws, never rejects.
// If a check (or any code it transitively calls — Capacitor plugin, network,
// IndexedDB) fails, we return null so the engine simply skips it.
async function safeAsync(
  fn: () => Promise<Finding | null>,
): Promise<Finding | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

// Sync variant for checks that don't return a promise.
function safeSync(fn: () => Finding | null): Finding | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
