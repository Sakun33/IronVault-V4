import { useCallback, useEffect, useState } from 'react';
import { vaultStorage } from '@/lib/storage';
import {
  SharedExpense, ExpenseGroup, ExpenseContact, Settlement, ExpenseActivity,
  ExpenseEntry,
} from '@shared/schema';

/**
 * Adapt a legacy ExpenseEntry (the old personal-only schema) into the
 * Splitwise-style SharedExpense shape so it can render in the new All
 * tab and Reports without a separate code path. Marked with a synthetic
 * `_legacy` flag so list/edit handlers can route mutations back through
 * the vault-context's expense API instead of the new shared-expense API.
 */
function legacyToShared(e: ExpenseEntry): SharedExpense & { _legacy?: true } {
  return {
    id: e.id,
    title: e.title,
    amount: e.amount,
    currency: e.currency || 'USD',
    paidBy: 'self',
    splitType: 'equal',
    splits: [{ contactId: 'self', amount: e.amount }],
    groupId: undefined,
    category: e.category || 'Other',
    date: new Date(e.date),
    notes: e.notes,
    receiptDataUrl: undefined,
    recurrence: e.isRecurring
      ? (e.recurringFrequency === 'weekly' ? 'weekly'
        : e.recurringFrequency === 'yearly' ? 'yearly'
          : 'monthly')
      : 'none',
    createdAt: new Date(e.createdAt),
    updatedAt: new Date(e.updatedAt),
    _legacy: true,
  } as SharedExpense & { _legacy?: true };
}

/**
 * Owns the Splitwise-style state outside vault-context to keep that file
 * focused on the legacy entries other surfaces depend on. Reads from the
 * encrypted IDB on mount + on `vault:item:saved` events, then exposes
 * thin add / update / delete helpers that wrap the storage layer and log
 * an entry to the activity feed where appropriate.
 *
 * The `expenses` array merges both the new SharedExpense entries AND the
 * legacy ExpenseEntry rows from the original /expenses page, so users
 * with hundreds of pre-existing expenses see them in the new UI without
 * any migration step.
 */
export function useSharedExpenses() {
  const [expenses, setExpenses] = useState<SharedExpense[]>([]);
  const [groups, setGroups] = useState<ExpenseGroup[]>([]);
  const [contacts, setContacts] = useState<ExpenseContact[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [activity, setActivity] = useState<ExpenseActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [e, g, c, s, a, legacy] = await Promise.all([
        vaultStorage.getAllSharedExpenses(),
        vaultStorage.getAllExpenseGroups(),
        vaultStorage.getAllExpenseContacts(),
        vaultStorage.getAllSettlements(),
        vaultStorage.getAllExpenseActivity(),
        vaultStorage.getAllExpenses().catch(() => [] as ExpenseEntry[]),
      ]);
      // Normalize Date fields — storage round-trips through JSON.
      const reviveDate = <T extends { createdAt?: any; updatedAt?: any; date?: any }>(x: T): T => ({
        ...x,
        createdAt: x.createdAt ? new Date(x.createdAt) : new Date(),
        updatedAt: x.updatedAt ? new Date(x.updatedAt) : new Date(),
        ...((x as any).date ? { date: new Date((x as any).date) } : {}),
      });
      const merged: SharedExpense[] = [
        ...e.map(reviveDate),
        ...legacy.map(le => legacyToShared(reviveDate(le))),
      ];
      setExpenses(merged);
      setGroups(g.map(reviveDate));
      setContacts(c.map(reviveDate));
      setSettlements(s.map(reviveDate));
      setActivity(a.map(reviveDate));
    } catch {
      // vault may not be unlocked yet — silently no-op until the next event
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const handler = () => { void refresh(); };
    window.addEventListener('vault:item:saved', handler);
    window.addEventListener('vault:unlocked', handler);
    return () => {
      window.removeEventListener('vault:item:saved', handler);
      window.removeEventListener('vault:unlocked', handler);
    };
  }, [refresh]);

  const newId = () => crypto.randomUUID();

  const logActivity = async (entry: Omit<ExpenseActivity, 'id' | 'createdAt'>) => {
    const a: ExpenseActivity = { id: newId(), createdAt: new Date(), ...entry };
    await vaultStorage.saveExpenseActivity(a);
    setActivity(prev => [a, ...prev].slice(0, 200));
  };

  const addContact = async (data: Omit<ExpenseContact, 'id' | 'createdAt' | 'updatedAt'>): Promise<ExpenseContact> => {
    const c: ExpenseContact = {
      id: newId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    };
    await vaultStorage.saveExpenseContact(c);
    setContacts(prev => [...prev, c]);
    await logActivity({ kind: 'contact_added', refId: c.id, title: `Added ${c.name}` });
    return c;
  };
  const updateContact = async (id: string, updates: Partial<ExpenseContact>): Promise<void> => {
    const existing = contacts.find(x => x.id === id);
    if (!existing) return;
    const next: ExpenseContact = { ...existing, ...updates, updatedAt: new Date() };
    await vaultStorage.saveExpenseContact(next);
    setContacts(prev => prev.map(x => x.id === id ? next : x));
  };
  const deleteContact = async (id: string): Promise<void> => {
    await vaultStorage.deleteExpenseContact(id);
    setContacts(prev => prev.filter(x => x.id !== id));
  };

  const addGroup = async (data: Omit<ExpenseGroup, 'id' | 'createdAt' | 'updatedAt'>): Promise<ExpenseGroup> => {
    const g: ExpenseGroup = {
      id: newId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    };
    await vaultStorage.saveExpenseGroup(g);
    setGroups(prev => [...prev, g]);
    await logActivity({ kind: 'group_added', refId: g.id, title: `Created group "${g.name}"`, groupId: g.id });
    return g;
  };
  const updateGroup = async (id: string, updates: Partial<ExpenseGroup>): Promise<void> => {
    const existing = groups.find(x => x.id === id);
    if (!existing) return;
    const next: ExpenseGroup = { ...existing, ...updates, updatedAt: new Date() };
    await vaultStorage.saveExpenseGroup(next);
    setGroups(prev => prev.map(x => x.id === id ? next : x));
  };
  const deleteGroup = async (id: string): Promise<void> => {
    await vaultStorage.deleteExpenseGroup(id);
    setGroups(prev => prev.filter(x => x.id !== id));
  };

  const addSharedExpense = async (data: Omit<SharedExpense, 'id' | 'createdAt' | 'updatedAt'>): Promise<SharedExpense> => {
    const e: SharedExpense = {
      id: newId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    };
    await vaultStorage.saveSharedExpense(e);
    setExpenses(prev => [...prev, e]);
    await logActivity({
      kind: 'expense_added',
      refId: e.id,
      title: `Added "${e.title}"`,
      amount: e.amount,
      currency: e.currency,
      groupId: e.groupId,
    });
    return e;
  };
  const updateSharedExpense = async (id: string, updates: Partial<SharedExpense>): Promise<void> => {
    const existing = expenses.find(x => x.id === id) as (SharedExpense & { _legacy?: true }) | undefined;
    if (!existing) return;
    const next: SharedExpense = { ...existing, ...updates, updatedAt: new Date() };
    if (existing._legacy) {
      // Legacy ExpenseEntry — write to the original `expenses` store so
      // any other surface that reads ExpenseEntry (dashboard tile,
      // recurring detection, exports) sees the update.
      const legacyPatch: Partial<ExpenseEntry> = {
        title: next.title,
        amount: next.amount,
        currency: next.currency,
        category: next.category,
        date: next.date instanceof Date ? next.date : new Date(next.date),
        notes: next.notes,
        isRecurring: next.recurrence !== 'none',
        recurringFrequency: next.recurrence !== 'none' ? next.recurrence : undefined,
        updatedAt: new Date(),
      };
      const allLegacy = await vaultStorage.getAllExpenses();
      const legacyExisting = allLegacy.find(x => x.id === id);
      if (legacyExisting) {
        await vaultStorage.saveExpense({ ...legacyExisting, ...legacyPatch });
      }
    } else {
      await vaultStorage.saveSharedExpense(next);
    }
    setExpenses(prev => prev.map(x => x.id === id ? next : x));
    await logActivity({
      kind: 'expense_edited',
      refId: id,
      title: `Edited "${next.title}"`,
      amount: next.amount,
      currency: next.currency,
      groupId: next.groupId,
    });
  };
  const deleteSharedExpense = async (id: string): Promise<void> => {
    const existing = expenses.find(x => x.id === id) as (SharedExpense & { _legacy?: true }) | undefined;
    if (existing?._legacy) {
      await vaultStorage.deleteExpense(id);
    } else {
      await vaultStorage.deleteSharedExpense(id);
    }
    setExpenses(prev => prev.filter(x => x.id !== id));
    if (existing) {
      await logActivity({
        kind: 'expense_deleted',
        refId: id,
        title: `Deleted "${existing.title}"`,
        amount: existing.amount,
        currency: existing.currency,
        groupId: existing.groupId,
      });
    }
  };

  const addSettlement = async (data: Omit<Settlement, 'id' | 'createdAt'>): Promise<Settlement> => {
    const s: Settlement = { id: newId(), createdAt: new Date(), ...data };
    await vaultStorage.saveSettlement(s);
    setSettlements(prev => [...prev, s]);
    await logActivity({
      kind: 'settlement_added',
      refId: s.id,
      title: `Settled · ${s.fromContact === 'self' ? 'You paid' : `${s.fromContact} paid`}`,
      amount: s.amount,
      currency: s.currency,
      groupId: s.groupId,
    });
    return s;
  };
  const deleteSettlement = async (id: string): Promise<void> => {
    await vaultStorage.deleteSettlement(id);
    setSettlements(prev => prev.filter(x => x.id !== id));
  };

  return {
    loading,
    expenses, groups, contacts, settlements, activity,
    refresh,
    addContact, updateContact, deleteContact,
    addGroup, updateGroup, deleteGroup,
    addSharedExpense, updateSharedExpense, deleteSharedExpense,
    addSettlement, deleteSettlement,
  };
}
