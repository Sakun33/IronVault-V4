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
  const tasks: Array<{ label: string; run: () => Promise<Finding | null> }> = [
    // Browser
    { label: 'HTTPS', run: () => C.checkHttps() },
    { label: 'Secure context', run: () => C.checkSecureContext() },
    { label: 'SubtleCrypto', run: () => C.checkSubtleCrypto() },
    { label: 'Credential Mgmt', run: () => C.checkCredentialMgmt() },
    { label: 'Service worker', run: () => C.checkServiceWorker() },
    { label: 'localStorage', run: () => C.checkLocalStorageHygiene() },
    { label: 'Cookies', run: () => C.checkCookies() },
    { label: 'Private mode', run: () => C.checkPrivateMode() },
    { label: 'WebRTC leak', run: () => C.checkWebrtcLeak() },
    { label: 'Clipboard perm', run: () => C.checkClipboardPermission() },
    { label: 'Mixed content', run: () => C.checkMixedContent() },
    // Device
    { label: 'Biometric hardware', run: () => C.checkBiometricAvailable() },
    { label: 'Biometric vault', run: () => C.checkBiometricEnrolledForVault(input.currentVaultId) },
    { label: 'OS version', run: () => C.checkPlatformOs() },
    { label: 'Screen lock', run: () => C.checkScreenLockHint() },
    { label: 'Jailbreak/root', run: () => C.checkJailbreakRoot() },
    { label: 'Secure storage', run: () => C.checkSecureStorageHint() },
    // Vault
    { label: 'Master password', run: async () => C.checkMasterPasswordStrength(input.masterPassword) },
    { label: 'Password reuse', run: async () => C.checkPasswordReuse(input.passwords) },
    { label: 'Weak passwords', run: async () => C.checkWeakPasswords(input.passwords) },
    { label: 'Stale passwords', run: async () => C.checkStalePasswords(input.passwords) },
    { label: 'Auto-lock', run: async () => C.checkAutoLock() },
    { label: 'Clipboard clear', run: async () => C.checkClipboardAutoClear() },
    { label: 'Lock on bg', run: async () => C.checkLockOnBackground() },
    { label: '2FA', run: () => C.checkTwoFactor(input.accountEmail) },
    // Network
    { label: 'Online', run: () => C.checkOnline() },
    { label: 'Connection', run: () => C.checkConnectionType() },
    { label: 'HSTS', run: () => C.checkHstsProbe() },
    { label: 'DNS info', run: () => C.checkDnsLeakInfo() },
  ];

  const findings: Finding[] = [];
  let done = 0;
  await Promise.all(
    tasks.map(async (task) => {
      try {
        const r = await task.run();
        if (r) findings.push(r);
      } catch (e: any) {
        // A check threw — record as info rather than crash the whole scan.
        findings.push({
          id: `error.${task.label.toLowerCase().replace(/\s+/g, '-')}`,
          category: 'browser',
          severity: 'info',
          title: `Check error: ${task.label}`,
          description: 'This check did not complete on your environment.',
          passed: false,
          detail: e?.message,
        });
      } finally {
        done += 1;
        input.onProgress?.(done, tasks.length, task.label);
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
    score -= SEVERITY_WEIGHTS[f.severity];
  }
  return Math.max(0, Math.min(100, score));
}
