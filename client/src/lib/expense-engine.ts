// Pure functions for the Splitwise-style expense feature. No React, no IDB
// — keep this side-effect free so the engine can be exercised in isolation.

import { SharedExpense, Settlement, ExpenseContact, SharedExpenseSplit } from '@shared/schema';

/**
 * For one expense, compute each participant's share. We respect the
 * provided `splits` when they're present and well-formed; otherwise we
 * fall back to an even split across the listed participants. The "self"
 * key always means the vault owner.
 */
export function computeShares(expense: SharedExpense): SharedExpenseSplit[] {
  if (expense.splits && expense.splits.length > 0) {
    const total = expense.splits.reduce((s, x) => s + (x.amount || 0), 0);
    if (total > 0) return expense.splits;
  }
  return [{ contactId: 'self', amount: expense.amount }];
}

/**
 * Given a single expense, return the per-contact net effect from the
 * vault owner's perspective. Positive = the owner is owed money,
 * negative = the owner owes that contact.
 */
export function expenseDelta(expense: SharedExpense): Map<string, number> {
  const map = new Map<string, number>();
  const splits = computeShares(expense);
  const payer = expense.paidBy || 'self';

  for (const s of splits) {
    if (s.contactId === payer) continue;
    add(map, payer, s.amount);
    add(map, s.contactId, -s.amount);
  }
  return map;
}

/**
 * A settlement transfers money from `fromContact` to `toContact`.
 */
export function settlementDelta(s: Settlement): Map<string, number> {
  const map = new Map<string, number>();
  add(map, s.fromContact, s.amount);
  add(map, s.toContact, -s.amount);
  return map;
}

/**
 * Aggregate every expense + settlement into a single balance vector
 * keyed by contactId. Drops the 'self' aggregate from the output.
 * For UI: positive value = "they owe you", negative = "you owe them".
 */
export function calculateBalances(
  expenses: SharedExpense[],
  settlements: Settlement[],
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const e of expenses) {
    const d = expenseDelta(e);
    d.forEach((v, k) => add(totals, k, v));
  }
  for (const s of settlements) {
    const d = settlementDelta(s);
    d.forEach((v, k) => add(totals, k, v));
  }
  const out = new Map<string, number>();
  totals.forEach((v, k) => {
    if (k === 'self') return;
    if (Math.abs(v) < 0.005) return;
    out.set(k, round2(v));
  });
  return out;
}

/**
 * Same as calculateBalances but scoped to a single group.
 */
export function calculateGroupBalances(
  groupId: string,
  expenses: SharedExpense[],
  settlements: Settlement[],
): Map<string, number> {
  return calculateBalances(
    expenses.filter(e => e.groupId === groupId),
    settlements.filter(s => s.groupId === groupId),
  );
}

/**
 * Greedy debt simplification: pair the biggest creditor with the biggest
 * debtor, settle as much as possible between them, repeat.
 */
export function simplifyDebts(
  balances: Map<string, number>,
): Array<{ from: string; to: string; amount: number }> {
  const creditors: Array<{ id: string; amt: number }> = [];
  const debtors: Array<{ id: string; amt: number }> = [];
  balances.forEach((v, k) => {
    if (v > 0.005) creditors.push({ id: k, amt: v });
    else if (v < -0.005) debtors.push({ id: k, amt: -v });
  });
  creditors.sort((a, b) => b.amt - a.amt);
  debtors.sort((a, b) => b.amt - a.amt);

  const out: Array<{ from: string; to: string; amount: number }> = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const pay = Math.min(d.amt, c.amt);
    out.push({ from: d.id, to: c.id, amount: round2(pay) });
    d.amt = round2(d.amt - pay);
    c.amt = round2(c.amt - pay);
    if (d.amt < 0.005) i++;
    if (c.amt < 0.005) j++;
  }
  return out;
}

/**
 * Sums each category's totals over a date range.
 */
export function calculateCategoryTotals(
  expenses: SharedExpense[],
  from?: Date,
  to?: Date,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const e of expenses) {
    const d = new Date(e.date);
    if (from && d < from) continue;
    if (to && d > to) continue;
    add(totals, e.category || 'Other', e.amount);
  }
  return new Map(Array.from(totals.entries()).sort((a, b) => b[1] - a[1]));
}

/**
 * Returns one entry per month for the last `months` months.
 */
export function calculateMonthlyTotals(
  expenses: SharedExpense[],
  months = 6,
): Array<{ month: string; total: number; label: string }> {
  const now = new Date();
  const buckets: Array<{ month: string; total: number; label: string }> = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets.push({ month: key, total: 0, label: d.toLocaleString(undefined, { month: 'short' }) });
  }
  const idx = new Map(buckets.map((b, i) => [b.month, i]));
  for (const e of expenses) {
    const d = new Date(e.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const i = idx.get(key);
    if (i != null) buckets[i].total = round2(buckets[i].total + e.amount);
  }
  return buckets;
}

/**
 * Display name for a contact id. 'self' renders as "You". Falls back to
 * a short id slice if the contact has been deleted but a record still
 * references it.
 */
export function contactName(id: string, contacts: ExpenseContact[]): string {
  if (id === 'self') return 'You';
  const c = contacts.find(x => x.id === id);
  return c ? c.name : `(${id.slice(0, 6)})`;
}

/**
 * Two-letter initials from a name.
 */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_PALETTE = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b',
  '#10b981', '#0ea5e9', '#14b8a6', '#22c55e',
];
export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

export interface ActivityFeedItem {
  id: string;
  kind: string;
  title: string;
  amount?: number;
  currency?: string;
  groupId?: string;
  at: Date;
}

export function buildActivityFeed(
  expenses: SharedExpense[],
  settlements: Settlement[],
  activity: Array<{ id: string; kind: string; title: string; amount?: number; currency?: string; groupId?: string; createdAt: Date | string }>,
): ActivityFeedItem[] {
  if (activity.length > 0) {
    return [...activity]
      .map(a => ({ ...a, at: new Date(a.createdAt) }))
      .sort((a, b) => b.at.getTime() - a.at.getTime());
  }
  const synth: ActivityFeedItem[] = [];
  for (const e of expenses) {
    synth.push({
      id: `e-${e.id}`,
      kind: 'expense_added',
      title: e.title || 'Expense',
      amount: e.amount,
      currency: e.currency,
      groupId: e.groupId,
      at: new Date(e.createdAt),
    });
  }
  for (const s of settlements) {
    synth.push({
      id: `s-${s.id}`,
      kind: 'settlement_added',
      title: 'Settlement',
      amount: s.amount,
      currency: s.currency,
      groupId: s.groupId,
      at: new Date(s.createdAt),
    });
  }
  return synth.sort((a, b) => b.at.getTime() - a.at.getTime());
}

function add(map: Map<string, number>, key: string, val: number) {
  map.set(key, round2((map.get(key) || 0) + val));
}
function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Format an amount with the currency code/symbol the user stored on the
 * expense. Falls back to a plain number if the locale doesn't recognize
 * the code.
 */
export function formatAmount(amount: number, currency: string = 'USD'): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * Compute the user's headline summary numbers from a balance map.
 *   youAreOwed: sum of positive balances (others owe you)
 *   youOwe:     sum of |negative balances| (you owe others)
 *   net:        youAreOwed - youOwe
 */
export function summarizeBalances(balances: Map<string, number>): { youAreOwed: number; youOwe: number; net: number } {
  let youAreOwed = 0;
  let youOwe = 0;
  balances.forEach(v => {
    if (v > 0) youAreOwed += v;
    else if (v < 0) youOwe += -v;
  });
  return {
    youAreOwed: round2(youAreOwed),
    youOwe: round2(youOwe),
    net: round2(youAreOwed - youOwe),
  };
}

/**
 * Distributes `amount` evenly across `n` participants, distributing the
 * rounding remainder one cent at a time.
 */
export function evenShares(amount: number, n: number): number[] {
  if (n <= 0) return [];
  const cents = Math.round(amount * 100);
  const base = Math.floor(cents / n);
  const remainder = cents - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i < remainder ? 1 : 0)) / 100);
}
