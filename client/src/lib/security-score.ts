import { PasswordGenerator } from '@/lib/password-generator';

export interface SecurityBreakdown {
  totalScore: number; // 0-100
  categories: {
    passwordStrength: { score: number; max: 30; detail: string };
    uniquePasswords: { score: number; max: 20; detail: string };
    twoFactorEnabled: { score: number; max: 15; detail: string };
    recentlyChanged: { score: number; max: 15; detail: string };
    masterPasswordStrength: { score: number; max: 10; detail: string };
    autoLockEnabled: { score: number; max: 10; detail: string };
  };
  tips: string[];
  level: 'Critical' | 'Needs Work' | 'Good' | 'Excellent';
  levelColor: string;
}

interface PasswordEntry {
  password?: string;
  updatedAt?: string | number | Date;
  [key: string]: unknown;
}

function calcPasswordStrength(passwords: PasswordEntry[]): {
  score: number;
  max: 30;
  detail: string;
} {
  if (passwords.length === 0) {
    return { score: 0, max: 30, detail: 'No passwords stored yet' };
  }

  let strongCount = 0;
  for (const entry of passwords) {
    if (!entry.password) continue;
    const { level } = PasswordGenerator.calculateStrength(entry.password);
    if (level === 'strong' || level === 'very-strong') {
      strongCount++;
    }
  }

  const ratio = strongCount / passwords.length;
  const score = Math.round(ratio * 30);
  const pct = Math.round(ratio * 100);
  const detail = `${strongCount}/${passwords.length} passwords are strong (${pct}%)`;

  return { score, max: 30, detail };
}

function calcUniquePasswords(passwords: PasswordEntry[]): {
  score: number;
  max: 20;
  detail: string;
} {
  if (passwords.length === 0) {
    return { score: 0, max: 20, detail: 'No passwords stored yet' };
  }

  const seen = new Set<string>();
  let duplicateCount = 0;

  for (const entry of passwords) {
    if (!entry.password) continue;
    if (seen.has(entry.password)) {
      duplicateCount++;
    } else {
      seen.add(entry.password);
    }
  }

  const uniqueRatio = passwords.length > 0
    ? (passwords.length - duplicateCount) / passwords.length
    : 1;
  const score = Math.round(uniqueRatio * 20);
  const detail = duplicateCount === 0
    ? 'All passwords are unique'
    : `${duplicateCount} duplicate password${duplicateCount > 1 ? 's' : ''} found`;

  return { score, max: 20, detail };
}

function calcTwoFactorEnabled(): {
  score: number;
  max: 15;
  detail: string;
} {
  try {
    const stored = localStorage.getItem('iv_2fa_enabled_emails');
    if (stored) {
      const emails = JSON.parse(stored);
      if (Array.isArray(emails) && emails.length > 0) {
        return { score: 15, max: 15, detail: 'Two-factor authentication is enabled' };
      }
    }
  } catch {
    // Ignore parse errors
  }

  return { score: 0, max: 15, detail: 'Two-factor authentication is not enabled' };
}

function calcRecentlyChanged(passwords: PasswordEntry[]): {
  score: number;
  max: 15;
  detail: string;
} {
  if (passwords.length === 0) {
    return { score: 0, max: 15, detail: 'No passwords stored yet' };
  }

  const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
  let recentCount = 0;

  for (const entry of passwords) {
    if (!entry.updatedAt) continue;
    const updatedTime = new Date(entry.updatedAt).getTime();
    if (updatedTime >= ninetyDaysAgo) {
      recentCount++;
    }
  }

  const ratio = recentCount / passwords.length;
  const score = Math.round(ratio * 15);
  const pct = Math.round(ratio * 100);
  const detail = `${recentCount}/${passwords.length} passwords updated in the last 90 days (${pct}%)`;

  return { score, max: 15, detail };
}

function calcMasterPasswordStrength(masterPassword: string): {
  score: number;
  max: 10;
  detail: string;
} {
  if (!masterPassword) {
    return { score: 0, max: 10, detail: 'Master password not provided' };
  }

  let score = 0;

  // Length checks
  if (masterPassword.length >= 8) score += 2;
  if (masterPassword.length >= 12) score += 2;
  if (masterPassword.length >= 16) score += 2;

  // Complexity checks
  if (/[a-z]/.test(masterPassword) && /[A-Z]/.test(masterPassword)) score += 1;
  if (/[0-9]/.test(masterPassword)) score += 1;
  if (/[^A-Za-z0-9]/.test(masterPassword)) score += 2;

  score = Math.min(score, 10);

  let detail: string;
  if (score <= 3) {
    detail = 'Master password is weak — consider a longer, more complex password';
  } else if (score <= 6) {
    detail = 'Master password has moderate strength';
  } else {
    detail = 'Master password is strong';
  }

  return { score, max: 10, detail };
}

function calcAutoLockEnabled(): {
  score: number;
  max: 10;
  detail: string;
} {
  try {
    const autoLock = localStorage.getItem('iv_auto_lock') ||
      localStorage.getItem('iv_auto_lock_timeout') ||
      localStorage.getItem('iv_settings_auto_lock');

    if (autoLock && autoLock !== 'false' && autoLock !== '0' && autoLock !== 'off') {
      return { score: 10, max: 10, detail: 'Auto-lock is enabled' };
    }
  } catch {
    // Ignore storage errors
  }

  return { score: 0, max: 10, detail: 'Auto-lock is not configured' };
}

function generateTips(categories: SecurityBreakdown['categories']): string[] {
  const tips: string[] = [];

  if (categories.passwordStrength.score < 20) {
    tips.push('Strengthen weak passwords — use the password generator for 16+ character passwords with mixed character types');
  }

  if (categories.uniquePasswords.score < 16) {
    tips.push('Replace duplicate passwords — reusing passwords puts multiple accounts at risk if one is compromised');
  }

  if (categories.twoFactorEnabled.score === 0) {
    tips.push('Enable two-factor authentication for an extra layer of security on your vault');
  }

  if (categories.recentlyChanged.score < 8) {
    tips.push('Rotate old passwords — update passwords that have not been changed in over 90 days');
  }

  if (categories.masterPasswordStrength.score < 7) {
    tips.push('Strengthen your master password — use at least 16 characters with uppercase, lowercase, numbers, and symbols');
  }

  if (categories.autoLockEnabled.score === 0) {
    tips.push('Enable auto-lock to automatically secure your vault after a period of inactivity');
  }

  if (tips.length === 0) {
    tips.push('Your security posture is excellent — keep it up!');
  }

  return tips;
}

function getLevel(score: number): SecurityBreakdown['level'] {
  if (score < 30) return 'Critical';
  if (score < 50) return 'Needs Work';
  if (score < 80) return 'Good';
  return 'Excellent';
}

function getLevelColor(level: SecurityBreakdown['level']): string {
  switch (level) {
    case 'Critical':
      return 'red';
    case 'Needs Work':
      return 'amber';
    case 'Good':
    case 'Excellent':
      return 'emerald';
  }
}

export function calculateSecurityScore(
  passwords: PasswordEntry[],
  masterPassword: string = ''
): SecurityBreakdown {
  const categories = {
    passwordStrength: calcPasswordStrength(passwords),
    uniquePasswords: calcUniquePasswords(passwords),
    twoFactorEnabled: calcTwoFactorEnabled(),
    recentlyChanged: calcRecentlyChanged(passwords),
    masterPasswordStrength: calcMasterPasswordStrength(masterPassword),
    autoLockEnabled: calcAutoLockEnabled(),
  };

  const totalScore =
    categories.passwordStrength.score +
    categories.uniquePasswords.score +
    categories.twoFactorEnabled.score +
    categories.recentlyChanged.score +
    categories.masterPasswordStrength.score +
    categories.autoLockEnabled.score;

  const tips = generateTips(categories);
  const level = getLevel(totalScore);
  const levelColor = getLevelColor(level);

  return {
    totalScore,
    categories,
    tips,
    level,
    levelColor,
  };
}
