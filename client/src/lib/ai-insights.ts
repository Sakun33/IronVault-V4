// Pattern-based vault insights. Pure client-side — no AI API calls.
// Each generator inspects vault data and returns zero or more insights.
// Insights are deduped, prioritized, and cached for 5 minutes per vault.
import type { PasswordEntry, SubscriptionEntry, ExpenseEntry } from '@shared/schema';

export type InsightCategory = 'security' | 'finance' | 'productivity';
export type InsightPriority = 'high' | 'medium' | 'low';

export interface Insight {
  id: string;
  icon: string;            // lucide name, resolved by the renderer
  title: string;
  description: string;
  actionUrl?: string;
  priority: InsightPriority;
  category: InsightCategory;
}

const ONE_DAY = 24 * 60 * 60 * 1000;
const DISMISSED_KEY = 'iv_insights_dismissed_v1';

function safeDate(d: any): Date | null {
  if (!d) return null;
  const t = d instanceof Date ? d : new Date(d);
  return isNaN(t.getTime()) ? null : t;
}

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as Record<string, number>;
    const now = Date.now();
    // Dismissals expire after 30 days so insights resurface if still relevant.
    return new Set(Object.entries(parsed).filter(([, ts]) => now - ts < 30 * ONE_DAY).map(([k]) => k));
  } catch {
    return new Set();
  }
}

export function dismissInsight(id: string): void {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    map[id] = Date.now();
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(map));
  } catch { /* best-effort */ }
}

export function clearDismissedInsights(): void {
  try { localStorage.removeItem(DISMISSED_KEY); } catch { /* best-effort */ }
}

// ── Security insights ────────────────────────────────────────────────────────

function oldPasswordsInsight(passwords: PasswordEntry[]): Insight | null {
  const cutoff = Date.now() - 365 * ONE_DAY;
  const old = passwords.filter((p) => {
    const u = safeDate(p.updatedAt) || safeDate(p.createdAt);
    return u && u.getTime() < cutoff;
  });
  if (old.length < 5) return null;
  return {
    id: 'security:old-passwords',
    icon: 'Clock',
    title: `${old.length} passwords older than 1 year`,
    description: `Consider rotating these — older passwords are more likely to have been exposed in past breaches.`,
    actionUrl: '/passwords',
    priority: old.length > 20 ? 'high' : 'medium',
    category: 'security',
  };
}

function reusedEmailInsight(passwords: PasswordEntry[]): Insight | null {
  const byEmail = new Map<string, number>();
  for (const p of passwords) {
    const u = (p.username || '').trim().toLowerCase();
    if (!u || !u.includes('@')) continue;
    byEmail.set(u, (byEmail.get(u) || 0) + 1);
  }
  let maxEmail = '';
  let maxCount = 0;
  for (const [e, c] of byEmail.entries()) {
    if (c > maxCount) { maxCount = c; maxEmail = e; }
  }
  if (maxCount < 3) return null;
  return {
    id: 'security:reused-email',
    icon: 'Mail',
    title: `${maxCount} accounts share the same email`,
    description: `${maxEmail} is reused across many sites. Consider using email aliases (e.g. you+site@gmail.com) so a leak on one account can't be linked to others.`,
    actionUrl: '/passwords',
    priority: 'low',
    category: 'security',
  };
}

function duplicatePasswordsInsight(passwords: PasswordEntry[]): Insight | null {
  const seen = new Map<string, number>();
  for (const p of passwords) {
    const v = (p.password || '').trim();
    if (!v) continue;
    seen.set(v, (seen.get(v) || 0) + 1);
  }
  let dupGroups = 0;
  let dupAccounts = 0;
  for (const c of seen.values()) {
    if (c > 1) { dupGroups += 1; dupAccounts += c; }
  }
  if (dupGroups === 0) return null;
  return {
    id: 'security:duplicate-passwords',
    icon: 'Copy',
    title: `${dupAccounts} accounts use a duplicated password`,
    description: `Across ${dupGroups} reused password${dupGroups > 1 ? 's' : ''}. One leak compromises all of them.`,
    actionUrl: '/passwords',
    priority: 'high',
    category: 'security',
  };
}

function shortPasswordsInsight(passwords: PasswordEntry[]): Insight | null {
  const weak = passwords.filter((p) => (p.password || '').length > 0 && (p.password || '').length < 10);
  if (weak.length === 0) return null;
  return {
    id: 'security:weak-length',
    icon: 'ShieldAlert',
    title: `${weak.length} short password${weak.length > 1 ? 's' : ''} (under 10 chars)`,
    description: `Modern attacks crack short passwords in seconds. Aim for 14+ characters with the built-in generator.`,
    actionUrl: '/passwords?strength=weak',
    priority: weak.length > 3 ? 'high' : 'medium',
    category: 'security',
  };
}

// ── Finance insights ─────────────────────────────────────────────────────────

function topSpendingCategoryInsight(expenses: ExpenseEntry[]): Insight | null {
  const cutoff = Date.now() - 90 * ONE_DAY;
  const recent = expenses.filter((e) => {
    const d = safeDate(e.date) || safeDate(e.createdAt);
    return d && d.getTime() >= cutoff;
  });
  if (recent.length < 5) return null;
  const byCat = new Map<string, number>();
  for (const e of recent) {
    const cat = (e.category || 'Uncategorized').trim();
    byCat.set(cat, (byCat.get(cat) || 0) + (e.amount || 0));
  }
  let topCat = ''; let topAmt = 0;
  for (const [c, a] of byCat.entries()) {
    if (a > topAmt) { topAmt = a; topCat = c; }
  }
  if (!topCat) return null;
  const monthly = topAmt / 3;
  const symbol = (recent[0]?.currency || 'INR') === 'USD' ? '$' : '₹';
  return {
    id: `finance:top-cat:${topCat}`,
    icon: 'TrendingUp',
    title: `${topCat} is your biggest spending category`,
    description: `You're spending around ${symbol}${monthly.toFixed(0)}/mo on ${topCat.toLowerCase()} (last 90 days).`,
    actionUrl: '/expenses',
    priority: 'low',
    category: 'finance',
  };
}

function subscriptionPriceIncreaseInsight(subscriptions: SubscriptionEntry[]): Insight | null {
  // Without historical price tracking we approximate "increased recently" as
  // "subscription updated in last 60d AND cost is in the upper half of all
  // active subs". This avoids false positives on freshly-added entries.
  const cutoff = Date.now() - 60 * ONE_DAY;
  const active = subscriptions.filter((s) => s.isActive);
  if (active.length < 3) return null;
  const sorted = [...active].sort((a, b) => (a.cost || 0) - (b.cost || 0));
  const median = sorted[Math.floor(sorted.length / 2)]?.cost || 0;
  const recentlyUpdatedExpensive = active
    .filter((s) => {
      const u = safeDate(s.updatedAt);
      const c = safeDate(s.createdAt);
      return u && c && u.getTime() > c.getTime() && u.getTime() >= cutoff && (s.cost || 0) > median;
    })
    .sort((a, b) => (b.cost || 0) - (a.cost || 0));
  const top = recentlyUpdatedExpensive[0];
  if (!top) return null;
  const symbol = top.currency === 'USD' ? '$' : '₹';
  return {
    id: `finance:sub-changed:${top.id}`,
    icon: 'CreditCard',
    title: `${top.name} was recently updated`,
    description: `Confirm the new ${symbol}${(top.cost || 0).toFixed(0)}/${top.billingCycle} charge is what you expect — pricing changes often go unnoticed.`,
    actionUrl: '/subscriptions',
    priority: 'medium',
    category: 'finance',
  };
}

function unusedSubscriptionInsight(subscriptions: SubscriptionEntry[]): Insight | null {
  const stale = subscriptions.filter((s) => {
    if (!s.isActive) return false;
    const u = safeDate(s.updatedAt);
    return u && Date.now() - u.getTime() > 180 * ONE_DAY;
  });
  if (stale.length === 0) return null;
  return {
    id: 'finance:stale-subs',
    icon: 'PauseCircle',
    title: `${stale.length} subscription${stale.length > 1 ? 's' : ''} not touched in 6+ months`,
    description: `Review whether you still use them. Unused subscriptions add up.`,
    actionUrl: '/subscriptions',
    priority: stale.length > 3 ? 'medium' : 'low',
    category: 'finance',
  };
}

// ── Productivity / wins ──────────────────────────────────────────────────────

function recentActivityWin(passwords: PasswordEntry[]): Insight | null {
  const cutoff = Date.now() - 30 * ONE_DAY;
  const added = passwords.filter((p) => {
    const c = safeDate(p.createdAt);
    return c && c.getTime() >= cutoff;
  }).length;
  if (added < 3) return null;
  return {
    id: 'productivity:recent-add',
    icon: 'Sparkles',
    title: `You added ${added} passwords this month`,
    description: `Your vault is staying current. Keep it up — a complete vault is a useful vault.`,
    priority: 'low',
    category: 'productivity',
  };
}

function backupReminderInsight(): Insight | null {
  try {
    const last = localStorage.getItem('iv_last_backup_at');
    const lastTs = last ? Number(last) : 0;
    if (lastTs > 0 && Date.now() - lastTs < 60 * ONE_DAY) return null;
    return {
      id: 'productivity:backup',
      icon: 'Download',
      title: lastTs === 0 ? 'You haven\'t exported a backup yet' : 'Backup is over 60 days old',
      description: `An offline encrypted backup protects you against rare cloud-sync edge cases. Export from Settings → Data Management.`,
      actionUrl: '/settings',
      priority: 'medium',
      category: 'productivity',
    };
  } catch { return null; }
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface VaultInsightsInput {
  passwords: PasswordEntry[];
  subscriptions: SubscriptionEntry[];
  expenses: ExpenseEntry[];
  securityScore?: number;
  previousSecurityScore?: number;
}

export function generateInsights(input: VaultInsightsInput): Insight[] {
  const out: Insight[] = [];
  const push = (i: Insight | null) => { if (i) out.push(i); };

  push(duplicatePasswordsInsight(input.passwords));
  push(shortPasswordsInsight(input.passwords));
  push(oldPasswordsInsight(input.passwords));
  push(reusedEmailInsight(input.passwords));
  push(topSpendingCategoryInsight(input.expenses));
  push(subscriptionPriceIncreaseInsight(input.subscriptions));
  push(unusedSubscriptionInsight(input.subscriptions));
  push(recentActivityWin(input.passwords));
  push(backupReminderInsight());

  // Security score change (positive only — negatives appear in alerts)
  if (typeof input.securityScore === 'number' && typeof input.previousSecurityScore === 'number') {
    const delta = input.securityScore - input.previousSecurityScore;
    if (delta >= 5) {
      out.push({
        id: 'security:score-up',
        icon: 'TrendingUp',
        title: `Security score improved by ${delta} points`,
        description: `Your vault is more secure than last time you checked. Nice work.`,
        actionUrl: '/security-health',
        priority: 'low',
        category: 'security',
      });
    }
  }

  // Filter dismissed and sort by priority.
  const dismissed = loadDismissed();
  const order: Record<InsightPriority, number> = { high: 0, medium: 1, low: 2 };
  return out.filter((i) => !dismissed.has(i.id)).sort((a, b) => order[a.priority] - order[b.priority]);
}

// Track last/previous security score across reloads so the score-change insight works.
const SCORE_KEY = 'iv_last_security_score_v1';
export function recordSecurityScore(score: number): number | undefined {
  try {
    const prevRaw = localStorage.getItem(SCORE_KEY);
    const prev = prevRaw ? Number(prevRaw) : undefined;
    localStorage.setItem(SCORE_KEY, String(score));
    return prev;
  } catch { return undefined; }
}
