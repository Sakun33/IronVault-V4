import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { PasswordEntry, SubscriptionEntry, NoteEntry, ExpenseEntry, ReminderEntry, KDFConfig, BankStatement, BankTransaction, Investment, InvestmentGoal } from '@shared/schema';
import { vaultStorage } from '@/lib/storage';
import { KDFConfig as CryptoKDFConfig } from '@/lib/crypto';
import { useAuth } from './auth-context';
import { useLogging } from './logging-context';
import type { ParserConfig } from '@/lib/csv-parsers';
import { isNoteEditing } from '@/lib/note-editing-guard';
import { useSearch } from './search-context';

// Date fields that need hydration from JSON strings back to Date objects after decryption
const DATE_FIELDS = ['createdAt', 'updatedAt', 'lastUsed', 'date', 'nextBillingDate', 'expiryDate', 'dueDate', 'completedAt', 'nextReminderDate', 'nextDueDate', 'purchaseDate', 'maturityDate', 'importDate', 'achievedDate', 'targetDate'];
const NESTED_DATE_FIELDS: Record<string, string[]> = {
  statementPeriod: ['startDate', 'endDate'],
};

function hydrateDates<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  const result = { ...obj } as any;
  for (const key of DATE_FIELDS) {
    if (key in result && result[key] && typeof result[key] === 'string') {
      result[key] = new Date(result[key]);
    }
  }
  for (const [parentKey, childKeys] of Object.entries(NESTED_DATE_FIELDS)) {
    if (parentKey in result && result[parentKey] && typeof result[parentKey] === 'object') {
      result[parentKey] = { ...result[parentKey] };
      for (const childKey of childKeys) {
        if (childKey in result[parentKey] && typeof result[parentKey][childKey] === 'string') {
          result[parentKey][childKey] = new Date(result[parentKey][childKey]);
        }
      }
    }
  }
  return result as T;
}

interface VaultContextType {
  passwords: PasswordEntry[];
  subscriptions: SubscriptionEntry[];
  notes: NoteEntry[];
  expenses: ExpenseEntry[];
  reminders: ReminderEntry[];
  bankStatements: BankStatement[];
  bankTransactions: BankTransaction[];
  investments: Investment[];
  investmentGoals: InvestmentGoal[];
  stats: {
    totalPasswords: number;
    activeSubscriptions: number;
    totalNotes: number;
    totalExpenses: number;
    totalReminders: number;
    upcomingReminders: number;
    overdueReminders: number;
    monthlySpend: number;
    monthlyExpenses: number;
    weakPasswords: number;
    totalBankStatements: number;
    totalBankTransactions: number;
    totalInvestments: number;
    totalInvestmentGoals: number;
  };
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  refreshData: () => Promise<void>;
  addPassword: (password: Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updatePassword: (id: string, updates: Partial<PasswordEntry>) => Promise<void>;
  deletePassword: (id: string) => Promise<void>;
  bulkDeletePasswords: (ids: string[]) => Promise<number>;
  addSubscription: (subscription: Omit<SubscriptionEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateSubscription: (id: string, updates: Partial<SubscriptionEntry>) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;
  bulkDeleteSubscriptions: (ids: string[]) => Promise<number>;
  addNote: (note: Omit<NoteEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<NoteEntry>;
  updateNote: (id: string, updates: Partial<NoteEntry>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  bulkDeleteNotes: (ids: string[]) => Promise<number>;
  addExpense: (expense: Omit<ExpenseEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateExpense: (id: string, updates: Partial<ExpenseEntry>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  bulkDeleteExpenses: (ids: string[]) => Promise<number>;
  addReminder: (reminder: Omit<ReminderEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateReminder: (id: string, updates: Partial<ReminderEntry>) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;
  bulkDeleteReminders: (ids: string[]) => Promise<number>;
  // Bank Statements CRUD
  addBankStatement: (statement: Omit<BankStatement, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateBankStatement: (id: string, updates: Partial<BankStatement>) => Promise<void>;
  deleteBankStatement: (id: string) => Promise<void>;
  bulkDeleteBankStatements: (ids: string[]) => Promise<number>;
  addBankTransaction: (transaction: Omit<BankTransaction, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateBankTransaction: (id: string, updates: Partial<BankTransaction>) => Promise<void>;
  deleteBankTransaction: (id: string) => Promise<void>;
  // Investments CRUD
  addInvestment: (investment: Omit<Investment, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateInvestment: (id: string, updates: Partial<Investment>) => Promise<void>;
  deleteInvestment: (id: string) => Promise<void>;
  bulkDeleteInvestments: (ids: string[]) => Promise<number>;
  addInvestmentGoal: (goal: Omit<InvestmentGoal, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateInvestmentGoal: (id: string, updates: Partial<InvestmentGoal>) => Promise<void>;
  deleteInvestmentGoal: (id: string) => Promise<void>;
  // API Keys CRUD (encrypted vault storage)
  apiKeys: any[];
  addApiKey: (key: any) => Promise<void>;
  updateApiKey: (id: string, updates: any) => Promise<void>;
  deleteApiKey: (id: string) => Promise<void>;
  bulkDeleteApiKeys: (ids: string[]) => Promise<number>;
  importBankStatementsFromCSV: (csvContent: string, currency?: string) => Promise<{ statements: number; transactions: number }>;
  exportVault: (password: string) => Promise<string>;
  importVault: (data: string, password?: string) => Promise<void>;
  importPasswordsFromCSV: (csvContent: string, parserId: string) => Promise<{ imported: number; skipped: number }>;
  bulkImportPasswords: (
    entries: Array<Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>>,
    onProgress?: (done: number, total: number) => void,
  ) => Promise<{
    imported: number;
    skipped: number;
    duplicates: number;
    /** Whether the post-import cloud push completed before this returned. */
    cloudSync: 'success' | 'failed' | 'skipped';
    /** Server-confirmed blob length, when cloudSync === 'success'. */
    cloudBlobLength?: number;
    /** Reason for failure when cloudSync === 'failed'. */
    cloudError?: string;
  }>;
  getAvailableCSVParsers: () => ParserConfig[];
  getKDFConfig: () => Promise<CryptoKDFConfig | null>;
  updateKDFConfig: (masterPassword: string, newKdfConfig: CryptoKDFConfig, onProgress?: (progress: number) => void) => Promise<void>;

  // Security features
  failedAttempts: number;
  isLockedOut: boolean;
  lockoutTimeRemaining: number;
  hasRecentBackup: boolean;
  getBackupMetadata: () => Promise<any>;

  isLoading: boolean;
  isCloudSyncing: boolean;
  /** Per-mutation push status. 'idle' → no recent activity; 'syncing' →
      push or pull in flight; 'synced' → most recent push succeeded
      (auto-clears after a few seconds); 'failed' → most recent push
      failed (sticks until next push or manual retry). */
  cloudSyncStatus: 'idle' | 'syncing' | 'synced' | 'failed';
  /** Last push error message, when cloudSyncStatus === 'failed'. */
  lastSyncError: string | null;
  /** Manually retry the last failed push. */
  retryCloudSync: () => void;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const { isUnlocked, masterPassword } = useAuth();
  const { addLog } = useLogging();
  const { toast } = useToast();
  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; }, [toast]);
  const [passwords, setPasswords] = useState<PasswordEntry[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionEntry[]>([]);
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [reminders, setReminders] = useState<ReminderEntry[]>([]);
  const [bankStatements, setBankStatements] = useState<BankStatement[]>([]);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [investmentGoals, setInvestmentGoals] = useState<InvestmentGoal[]>([]);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  // QA-R2 H3: searchQuery moved out to its own SearchProvider so its
  // updates no longer rebuild the entire vault context value (which was
  // re-rendering every consumer of useVault() on every keystroke).
  // The fields stay on the public type as a backwards-compat shim — they
  // forward to the search context. Direct consumers should prefer the
  // useSearch() hook so they only re-render on actual search changes.
  const [isLoading, setIsLoading] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'failed'>('idle');
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);

  // Security state
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [lockoutTimeRemaining, setLockoutTimeRemaining] = useState(0);
  const [hasRecentBackup, setHasRecentBackup] = useState(false);

  useEffect(() => {
    if (isUnlocked) {
      refreshData();
    } else {
      setPasswords([]);
      setSubscriptions([]);
      setNotes([]);
      setExpenses([]);
      setReminders([]);
      setBankStatements([]);
      setBankTransactions([]);
      setInvestments([]);
      setInvestmentGoals([]);
    }
  }, [isUnlocked]);

  // Pull refresh: when cloud-sync hook replaces vault data from a remote device.
  // We also gate the syncing flag with a 15-second safety timeout — even if the
  // `cloud:replaced` event is somehow missed (silent throw, race, lost listener),
  // the spinner is guaranteed to clear so the user never sees a stuck indicator.
  useEffect(() => {
    let safety: ReturnType<typeof setTimeout> | null = null;
    const clearSafety = () => { if (safety) { clearTimeout(safety); safety = null; } };
    const handleCloudReplace = () => {
      clearSafety();
      setIsCloudSyncing(false);
      if (isUnlocked) refreshData();
    };
    const handleCloudSyncing = () => {
      setIsCloudSyncing(true);
      clearSafety();
      safety = setTimeout(() => { setIsCloudSyncing(false); safety = null; }, 15000);
    };
    // Push-side status events from use-cloud-auto-sync. Drives the
    // header indicator (Syncing… / Synced ✓ / Sync failed ⚠ + retry).
    let syncedClearTimer: ReturnType<typeof setTimeout> | null = null;
    const handlePushStart = () => {
      if (syncedClearTimer) { clearTimeout(syncedClearTimer); syncedClearTimer = null; }
      setCloudSyncStatus('syncing');
      setLastSyncError(null);
    };
    const handlePushDone = () => {
      setCloudSyncStatus('synced');
      setLastSyncError(null);
      // Auto-revert to idle after 3s so the indicator doesn't stay green
      // forever on a quiet vault.
      if (syncedClearTimer) clearTimeout(syncedClearTimer);
      syncedClearTimer = setTimeout(() => {
        setCloudSyncStatus('idle');
        syncedClearTimer = null;
      }, 3000);
    };
    const handlePushFailed = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      setCloudSyncStatus('failed');
      setLastSyncError(detail.error || 'Sync failed');
      // Plan-error: surface a one-time toast prompting upgrade. Subsequent
      // saves won't retry (auto-sync hook flags vault as local-only) so the
      // toast is bounded.
      if (detail.planError) {
        toastRef.current({
          title: 'Cloud sync requires Pro',
          description: 'Upgrade to enable cross-device sync. Your data is still safe on this device.',
          variant: 'destructive',
        });
      }
    };
    window.addEventListener('vault:cloud:replaced', handleCloudReplace);
    window.addEventListener('vault:cloud:syncing', handleCloudSyncing);
    window.addEventListener('vault:cloud:push:start', handlePushStart);
    window.addEventListener('vault:cloud:push:done', handlePushDone);
    window.addEventListener('vault:cloud:push:failed', handlePushFailed);
    return () => {
      clearSafety();
      if (syncedClearTimer) clearTimeout(syncedClearTimer);
      window.removeEventListener('vault:cloud:replaced', handleCloudReplace);
      window.removeEventListener('vault:cloud:syncing', handleCloudSyncing);
      window.removeEventListener('vault:cloud:push:start', handlePushStart);
      window.removeEventListener('vault:cloud:push:done', handlePushDone);
      window.removeEventListener('vault:cloud:push:failed', handlePushFailed);
    };
  }, [isUnlocked]);

  // Monitor security state
  useEffect(() => {
    const updateSecurityState = async () => {
      if (isUnlocked) {
        setFailedAttempts(0);
        setIsLockedOut(false);
        setLockoutTimeRemaining(0);

        // Check for recent backup
        const hasBackup = await vaultStorage.hasRecentBackup();
        setHasRecentBackup(hasBackup);
      } else {
        // Check lockout status
        const lockedOut = vaultStorage.isLockedOut();
        setIsLockedOut(lockedOut);

        if (lockedOut) {
          const remaining = vaultStorage.getLockoutTimeRemaining();
          setLockoutTimeRemaining(remaining);
        }
      }
    };

    updateSecurityState();

    // Update lockout timer every second when locked out
    let interval: NodeJS.Timeout | null = null;
    if (isLockedOut) {
      interval = setInterval(() => {
        const remaining = vaultStorage.getLockoutTimeRemaining();
        setLockoutTimeRemaining(remaining);

        if (remaining === 0) {
          setIsLockedOut(false);
        }
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isUnlocked, isLockedOut]);

  // Push the current encrypted vault blob to the server. Returns a structured
  // result so callers can decide whether to surface a hard error to the user.
  // The dirty flag (iv_dirty_<vaultId>) is set BEFORE the push and only
  // cleared after a confirmed-success server response — so a logout race
  // leaves the dirty flag set for next-login recovery.
  type PushResult =
    | { ok: true; blobLength: number }
    | { ok: false; reason: string; status?: number };

  const pushToCloudNow = async (): Promise<PushResult> => {
    const token = localStorage.getItem('iv_cloud_token');
    if (!token) {
      const reason = 'No cloud token — local-only vault, push skipped';
      return { ok: false, reason };
    }
    if (!masterPassword) {
      const reason = 'No master password in memory';
      console.error('[CLOUD-PUSH]', reason);
      return { ok: false, reason };
    }
    const mp = masterPassword;
    try {
      const { vaultManager } = await import('@/lib/vault-manager');
      const vaultId = vaultManager.getActiveVaultId();
      if (!vaultId) return { ok: false, reason: 'No active vault' };
      // Local vault check: a local-only vault has no cloud entry — pushing
      // would either silently fail or unexpectedly create one. Skip cleanly.
      const { isVaultCloudSynced } = await import('@/lib/cloud-vault-sync');
      if (!isVaultCloudSynced(vaultId)) {
        const reason = 'Active vault is local-only — cloud push skipped';
        return { ok: false, reason };
      }
      // Vault isolation: the open DB must belong to this vault. If it
      // doesn't, exporting would read another vault's data and pushing
      // would overwrite this vault's cloud entry with that wrong data.
      if (vaultStorage.getCurrentVaultId() !== vaultId) {
        const reason =
          `Storage on vault "${vaultStorage.getCurrentVaultId()}" but expected "${vaultId}" — ` +
          `refusing to push (vault isolation guard).`;
        console.error('[CLOUD-PUSH]', reason);
        return { ok: false, reason };
      }
      localStorage.setItem(`iv_dirty_${vaultId}`, '1');
      const blob = await vaultStorage.exportVault(mp);
      const vaultMeta = vaultManager.getExistingVaults().find((v: any) => v.id === vaultId);
      const vaultName = vaultMeta?.name ?? 'My Vault';
      const clientModifiedAt = new Date().toISOString();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };
      const res = await fetch(`https://www.ironvault.app/api/vaults/cloud/${vaultId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ encryptedBlob: blob, vaultName, isDefault: false, clientModifiedAt }),
      });
      let ok = false;
      let status = res.status;
      let serverNewer = false;
      if (res.status === 404) {
        const { getOrCreateDeviceId } = await import('@/lib/cloud-vault-sync');
        const postRes = await fetch(`https://www.ironvault.app/api/vaults/cloud`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            vaultId, vaultName, encryptedBlob: blob, isDefault: false,
            clientModifiedAt, sourceDeviceId: getOrCreateDeviceId(),
          }),
        });
        ok = postRes.ok;
        status = postRes.status;
      } else if (res.ok) {
        // Server may indicate a conflict (its data is newer than ours) — that
        // counts as a push failure; do NOT clear the dirty flag.
        try {
          const body = await res.json();
          if (body && body.serverNewer === true) serverNewer = true;
        } catch { /* body not JSON */ }
        ok = !serverNewer;
      } else {
        ok = false;
      }
      if (ok) {
        localStorage.removeItem(`iv_dirty_${vaultId}`);
        // Advance lastPull so the 60-s doPull poll doesn't immediately
        // re-download what we just pushed (and trigger a no-op
        // replaceVaultFromBlob, which wipes encrypted_data mid-session).
        localStorage.setItem(`iv_last_pull_${vaultId}`, new Date().toISOString());
        // Sync success is intentionally silent — the user reported the
        // "Synced" banner as noise that pushed content down. Errors
        // (further down) still toast so failed pushes are visible.
        return { ok: true, blobLength: blob.length };
      }
      const reason = serverNewer
        ? 'Server has newer data — please pull before retrying'
        : `Server error ${status}`;
      console.error('[CLOUD-PUSH]', reason);
      toastRef.current({
        title: '⚠️ Cloud sync failed',
        description: reason,
        variant: 'destructive',
        duration: 5000,
      });
      return { ok: false, reason, status };
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      console.error('[CLOUD-PUSH]', e);
      toastRef.current({
        title: '⚠️ Cloud sync error',
        description: reason,
        variant: 'destructive',
        duration: 5000,
      });
      return { ok: false, reason };
    }
  };

  // Fire-and-forget wrapper used by every CRUD mutation — keeps existing
  // call sites unchanged while routing through the same hardened logic.
  const pushToCloud = () => { void pushToCloudNow(); };

  const refreshData = async () => {
    if (!isUnlocked) return;
    // Hard guard: never refresh while the user is actively editing a note.
    // A mid-edit refresh re-hydrates `notes` from storage, which races
    // with the editor's own typing/autosave and was repeatedly closing the
    // editor when a cloud sync landed during a session. The editor is the
    // source of truth while open; the next refresh will run after close.
    if (isNoteEditing()) {
      console.debug('[VAULT] Skipping refresh — note editor is open');
      return;
    }

    setIsLoading(true);
    try {

      // Check if database schema is correct
      const schemaValid = await vaultStorage.checkSchema();
      if (!schemaValid) {
        await vaultStorage.recreateDatabase();
      }

      // Always refresh data to ensure we have the latest from storage

      const [passwordsData, subscriptionsData, notesData, expensesData, remindersData, bankStatementsData, bankTransactionsData, investmentsData, investmentGoalsData, apiKeysData] = await Promise.all([
        vaultStorage.getAllPasswords(),
        vaultStorage.getAllSubscriptions(),
        vaultStorage.getAllNotes(),
        vaultStorage.getAllExpenses(),
        vaultStorage.getAllReminders(),
        vaultStorage.getAllBankStatements(),
        vaultStorage.getAllBankTransactions(),
        vaultStorage.getAllInvestments(),
        vaultStorage.getAllInvestmentGoals(),
        vaultStorage.getAllApiKeys(),
      ]);


      // Hydrate date strings back to Date objects (JSON.parse loses Date types)
      setPasswords(passwordsData.map(hydrateDates));
      setSubscriptions(subscriptionsData.map(hydrateDates));
      setNotes(notesData.map(hydrateDates));
      setExpenses(expensesData.map(hydrateDates));
      setReminders(remindersData.map(hydrateDates));
      setBankStatements(bankStatementsData.map(hydrateDates));
      setBankTransactions(bankTransactionsData.map(hydrateDates));
      setInvestments(investmentsData.map(hydrateDates));
      setInvestmentGoals(investmentGoalsData.map(hydrateDates));
      setApiKeys(apiKeysData.map(hydrateDates));

    } catch (error) {
      console.error('Failed to refresh vault data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addPassword = async (passwordData: Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    const password: PasswordEntry = {
      ...passwordData,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await vaultStorage.savePassword(password);
    // Update state directly instead of refreshing all data
    setPasswords(prev => [...prev, password]);

    // Log the activity
    addLog('Add Password', 'password', `Added password for "${passwordData.name}"`);
    pushToCloud();
  };

  const updatePassword = async (id: string, updates: Partial<PasswordEntry>) => {
    const existing = passwords.find(p => p.id === id);
    if (!existing) return;

    const updated: PasswordEntry = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    await vaultStorage.savePassword(updated);
    // Update state directly instead of refreshing all data
    setPasswords(prev => prev.map(p => p.id === id ? updated : p));

    // Log the activity
    addLog('Update Password', 'password', `Updated password for "${existing.name}"`);
    pushToCloud();
  };

  const deletePassword = async (id: string) => {
    const existing = passwords.find(p => p.id === id);
    await vaultStorage.deletePassword(id);
    // Update state directly instead of refreshing all data
    setPasswords(prev => prev.filter(p => p.id !== id));

    // Log the activity
    if (existing) {
      addLog('Delete Password', 'password', `Deleted password for "${existing.name}"`);
    }
    pushToCloud();
  };

  const addSubscription = async (subscriptionData: Omit<SubscriptionEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    const subscription: SubscriptionEntry = {
      ...subscriptionData,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await vaultStorage.saveSubscription(subscription);
    // Update state directly instead of refreshing all data
    setSubscriptions(prev => [...prev, subscription]);

    // Log the activity
    addLog('Add Subscription', 'subscription', `Added subscription "${subscriptionData.name}"`);
    pushToCloud();
  };

  const updateSubscription = async (id: string, updates: Partial<SubscriptionEntry>) => {
    const existing = subscriptions.find(s => s.id === id);
    if (!existing) return;

    const updated: SubscriptionEntry = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    await vaultStorage.saveSubscription(updated);
    // Update state directly instead of refreshing all data
    setSubscriptions(prev => prev.map(s => s.id === id ? updated : s));

    // Log the activity
    addLog('Update Subscription', 'subscription', `Updated subscription "${existing.name}"`);
    pushToCloud();
  };

  const deleteSubscription = async (id: string) => {
    const existing = subscriptions.find(s => s.id === id);
    await vaultStorage.deleteSubscription(id);
    // Update state directly instead of refreshing all data
    setSubscriptions(prev => prev.filter(s => s.id !== id));

    // Log the activity
    if (existing) {
      addLog('Delete Subscription', 'subscription', `Deleted subscription "${existing.name}"`);
    }
    pushToCloud();
  };

  const addNote = async (noteData: Omit<NoteEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<NoteEntry> => {
    const note: NoteEntry = {
      ...noteData,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await vaultStorage.saveNote(note);
    // Update state directly instead of refreshing all data
    setNotes(prev => [...prev, note]);

    // Log the activity
    addLog('Add Note', 'note', `Added note "${noteData.title}"`);
    pushToCloud();
    return note;
  };

  const updateNote = async (id: string, updates: Partial<NoteEntry>) => {
    const existing = notes.find(n => n.id === id);
    if (!existing) return;

    const updated: NoteEntry = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    await vaultStorage.saveNote(updated);
    // Update state directly instead of refreshing all data
    setNotes(prev => prev.map(n => n.id === id ? updated : n));

    // Log the activity
    addLog('Update Note', 'note', `Updated note "${existing.title}"`);
    pushToCloud();
  };

  const deleteNote = async (id: string) => {
    const existing = notes.find(n => n.id === id);
    await vaultStorage.deleteNote(id);
    // Update state directly instead of refreshing all data
    setNotes(prev => prev.filter(n => n.id !== id));

    // Log the activity
    if (existing) {
      addLog('Delete Note', 'note', `Deleted note "${existing.title}"`);
    }
    pushToCloud();
  };

  const addExpense = async (expenseData: Omit<ExpenseEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    const expense: ExpenseEntry = {
      ...expenseData,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await vaultStorage.saveExpense(expense);
    // Update state directly instead of refreshing all data
    setExpenses(prev => [...prev, expense]);
    pushToCloud();
  };

  const updateExpense = async (id: string, updates: Partial<ExpenseEntry>) => {
    const existing = expenses.find(e => e.id === id);
    if (!existing) return;

    const updated: ExpenseEntry = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    await vaultStorage.saveExpense(updated);
    // Update state directly instead of refreshing all data
    setExpenses(prev => prev.map(e => e.id === id ? updated : e));
    pushToCloud();
  };

  const deleteExpense = async (id: string) => {
    await vaultStorage.deleteExpense(id);
    // Update state directly instead of refreshing all data
    setExpenses(prev => prev.filter(e => e.id !== id));
    pushToCloud();
  };

  // Bulk delete helpers — batch storage deletes, single state update, single cloud push.
  // Returns the number actually removed (storage deletes that did not throw).
  const bulkDeletePasswords = async (ids: string[]): Promise<number> => {
    if (ids.length === 0) return 0;
    const idSet = new Set(ids);
    const targets = passwords.filter(p => idSet.has(p.id));
    const results = await Promise.allSettled(ids.map(id => vaultStorage.deletePassword(id)));
    const ok = results.filter(r => r.status === 'fulfilled').length;
    setPasswords(prev => prev.filter(p => !idSet.has(p.id)));
    if (targets.length > 0) {
      addLog('Bulk Delete Passwords', 'password', `Deleted ${ok} password${ok === 1 ? '' : 's'}`);
    }
    pushToCloud();
    return ok;
  };

  const bulkDeleteSubscriptions = async (ids: string[]): Promise<number> => {
    if (ids.length === 0) return 0;
    const idSet = new Set(ids);
    const results = await Promise.allSettled(ids.map(id => vaultStorage.deleteSubscription(id)));
    const ok = results.filter(r => r.status === 'fulfilled').length;
    setSubscriptions(prev => prev.filter(s => !idSet.has(s.id)));
    addLog('Bulk Delete Subscriptions', 'subscription', `Deleted ${ok} subscription${ok === 1 ? '' : 's'}`);
    pushToCloud();
    return ok;
  };

  const bulkDeleteNotes = async (ids: string[]): Promise<number> => {
    if (ids.length === 0) return 0;
    const idSet = new Set(ids);
    const results = await Promise.allSettled(ids.map(id => vaultStorage.deleteNote(id)));
    const ok = results.filter(r => r.status === 'fulfilled').length;
    setNotes(prev => prev.filter(n => !idSet.has(n.id)));
    addLog('Bulk Delete Notes', 'note', `Deleted ${ok} note${ok === 1 ? '' : 's'}`);
    pushToCloud();
    return ok;
  };

  const bulkDeleteExpenses = async (ids: string[]): Promise<number> => {
    if (ids.length === 0) return 0;
    const idSet = new Set(ids);
    const results = await Promise.allSettled(ids.map(id => vaultStorage.deleteExpense(id)));
    const ok = results.filter(r => r.status === 'fulfilled').length;
    setExpenses(prev => prev.filter(e => !idSet.has(e.id)));
    if (ok > 0) addLog('Bulk Delete Expenses', 'expense', `Deleted ${ok} expense${ok === 1 ? '' : 's'}`);
    pushToCloud();
    return ok;
  };

  const bulkDeleteReminders = async (ids: string[]): Promise<number> => {
    if (ids.length === 0) return 0;
    const idSet = new Set(ids);
    const results = await Promise.allSettled(ids.map(id => vaultStorage.deleteReminder(id)));
    const ok = results.filter(r => r.status === 'fulfilled').length;
    setReminders(prev => prev.filter(r => !idSet.has(r.id)));
    if (ok > 0) addLog('Bulk Delete Reminders', 'reminder', `Deleted ${ok} reminder${ok === 1 ? '' : 's'}`);
    pushToCloud();
    return ok;
  };

  const bulkDeleteApiKeys = async (ids: string[]): Promise<number> => {
    if (ids.length === 0) return 0;
    const idSet = new Set(ids);
    const results = await Promise.allSettled(ids.map(id => vaultStorage.deleteApiKey(id)));
    const ok = results.filter(r => r.status === 'fulfilled').length;
    setApiKeys(prev => prev.filter(k => !idSet.has(k.id)));
    if (ok > 0) addLog('Bulk Delete API Keys', 'apikey', `Deleted ${ok} API key${ok === 1 ? '' : 's'}`);
    pushToCloud();
    return ok;
  };

  const bulkDeleteInvestments = async (ids: string[]): Promise<number> => {
    if (ids.length === 0) return 0;
    const idSet = new Set(ids);
    const results = await Promise.allSettled(ids.map(id => vaultStorage.deleteInvestment(id)));
    const ok = results.filter(r => r.status === 'fulfilled').length;
    setInvestments(prev => prev.filter(i => !idSet.has(i.id)));
    if (ok > 0) addLog('Bulk Delete Investments', 'investment', `Deleted ${ok} investment${ok === 1 ? '' : 's'}`);
    pushToCloud();
    return ok;
  };

  const bulkDeleteBankStatements = async (ids: string[]): Promise<number> => {
    if (ids.length === 0) return 0;
    const idSet = new Set(ids);
    const results = await Promise.allSettled(ids.map(id => vaultStorage.deleteBankStatement(id)));
    const ok = results.filter(r => r.status === 'fulfilled').length;
    setBankStatements(prev => prev.filter(s => !idSet.has(s.id)));
    if (ok > 0) addLog('Bulk Delete Bank Statements', 'bank_statement', `Deleted ${ok} statement${ok === 1 ? '' : 's'}`);
    pushToCloud();
    return ok;
  };

  const addReminder = async (reminderData: Omit<ReminderEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    const reminder: ReminderEntry = {
      ...reminderData,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await vaultStorage.saveReminder(reminder);
    // Update state directly instead of refreshing all data
    setReminders(prev => [...prev, reminder]);
    pushToCloud();
  };

  const updateReminder = async (id: string, updates: Partial<ReminderEntry>) => {
    const existing = reminders.find(r => r.id === id);
    if (!existing) return;

    const updated: ReminderEntry = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    await vaultStorage.saveReminder(updated);
    // Update state directly instead of refreshing all data
    setReminders(prev => prev.map(r => r.id === id ? updated : r));
    pushToCloud();
  };

  const deleteReminder = async (id: string) => {
    await vaultStorage.deleteReminder(id);
    // Update state directly instead of refreshing all data
    setReminders(prev => prev.filter(r => r.id !== id));
    pushToCloud();
  };

  // Bank Statements CRUD
  const addBankStatement = async (statement: Omit<BankStatement, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newStatement: BankStatement = {
      ...statement,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await vaultStorage.saveBankStatement(newStatement);
    // Update state directly instead of refreshing all data
    setBankStatements(prev => [...prev, newStatement]);
    pushToCloud();
  };

  const updateBankStatement = async (id: string, updates: Partial<BankStatement>) => {
    const existing = await vaultStorage.getBankStatement(id);
    if (!existing) throw new Error('Bank statement not found');

    const updated: BankStatement = {
      ...existing,
      ...updates,
      id,
      updatedAt: new Date(),
    };
    await vaultStorage.saveBankStatement(updated);
    // Update state directly instead of refreshing all data
    setBankStatements(prev => prev.map(bs => bs.id === id ? updated : bs));
    pushToCloud();
  };

  const deleteBankStatement = async (id: string) => {
    await vaultStorage.deleteBankStatement(id);
    // Update state directly instead of refreshing all data
    setBankStatements(prev => prev.filter(bs => bs.id !== id));
    pushToCloud();
  };

  const addBankTransaction = async (transaction: Omit<BankTransaction, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newTransaction: BankTransaction = {
      ...transaction,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await vaultStorage.saveBankTransaction(newTransaction);
    // Update state directly instead of refreshing all data
    setBankTransactions(prev => [...prev, newTransaction]);
    pushToCloud();
  };

  const updateBankTransaction = async (id: string, updates: Partial<BankTransaction>) => {
    const existing = await vaultStorage.getBankTransaction(id);
    if (!existing) throw new Error('Bank transaction not found');

    const updated: BankTransaction = {
      ...existing,
      ...updates,
      id,
      updatedAt: new Date(),
    };
    await vaultStorage.saveBankTransaction(updated);
    // Update state directly instead of refreshing all data
    setBankTransactions(prev => prev.map(bt => bt.id === id ? updated : bt));
    pushToCloud();
  };

  const deleteBankTransaction = async (id: string) => {
    await vaultStorage.deleteBankTransaction(id);
    // Update state directly instead of refreshing all data
    setBankTransactions(prev => prev.filter(bt => bt.id !== id));
    pushToCloud();
  };

  // Investments CRUD
  const addInvestment = async (investment: Omit<Investment, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newInvestment: Investment = {
      ...investment,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await vaultStorage.saveInvestment(newInvestment);
    // Update state directly instead of refreshing all data
    setInvestments(prev => [...prev, newInvestment]);
    pushToCloud();
  };

  const updateInvestment = async (id: string, updates: Partial<Investment>) => {
    const existing = await vaultStorage.getInvestment(id);
    if (!existing) throw new Error('Investment not found');

    const updated: Investment = {
      ...existing,
      ...updates,
      id,
      updatedAt: new Date(),
    };
    await vaultStorage.saveInvestment(updated);
    // Update state directly instead of refreshing all data
    setInvestments(prev => prev.map(inv => inv.id === id ? updated : inv));
    pushToCloud();
  };

  const deleteInvestment = async (id: string) => {
    await vaultStorage.deleteInvestment(id);
    // Update state directly instead of refreshing all data
    setInvestments(prev => prev.filter(inv => inv.id !== id));
    pushToCloud();
  };

  const addInvestmentGoal = async (goal: Omit<InvestmentGoal, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newGoal: InvestmentGoal = {
      ...goal,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await vaultStorage.saveInvestmentGoal(newGoal);
    // Update state directly instead of refreshing all data
    setInvestmentGoals(prev => [...prev, newGoal]);
    pushToCloud();
  };

  const updateInvestmentGoal = async (id: string, updates: Partial<InvestmentGoal>) => {
    const existing = await vaultStorage.getInvestmentGoal(id);
    if (!existing) throw new Error('Investment goal not found');

    const updated: InvestmentGoal = {
      ...existing,
      ...updates,
      id,
      updatedAt: new Date(),
    };
    await vaultStorage.saveInvestmentGoal(updated);
    // Update state directly instead of refreshing all data
    setInvestmentGoals(prev => prev.map(ig => ig.id === id ? updated : ig));
    pushToCloud();
  };

  const deleteInvestmentGoal = async (id: string) => {
    await vaultStorage.deleteInvestmentGoal(id);
    // Update state directly instead of refreshing all data
    setInvestmentGoals(prev => prev.filter(ig => ig.id !== id));
    pushToCloud();
  };

  // ── API Keys CRUD ────────────────────────────────────────────────────────────
  const addApiKey = async (key: any) => {
    const newKey = { ...key, id: key.id || crypto.randomUUID(), createdAt: key.createdAt || new Date(), updatedAt: new Date() };
    await vaultStorage.saveApiKey(newKey);
    setApiKeys(prev => [...prev, newKey]);
    pushToCloud();
  };

  const updateApiKey = async (id: string, updates: any) => {
    const existing = apiKeys.find(k => k.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    await vaultStorage.saveApiKey(updated);
    setApiKeys(prev => prev.map(k => k.id === id ? updated : k));
    pushToCloud();
  };

  const deleteApiKeyFromVault = async (id: string) => {
    await vaultStorage.deleteApiKey(id);
    setApiKeys(prev => prev.filter(k => k.id !== id));
    pushToCloud();
  };

  const importBankStatementsFromCSV = async (csvContent: string, currency?: string) => {
    try {
      const result = await vaultStorage.importBankStatementsFromCSV(csvContent, currency);

      // Log the import activity
      addLog('Import Bank Statements', 'system', `Imported ${result.statements} statements and ${result.transactions} transactions from CSV`);

      await refreshData();
      return result;
    } catch (error) {
      console.error('VaultContext: Import failed:', error);
      addLog('Import Failed', 'system', `Failed to import bank statements: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Don't throw the error, return a safe result
      return { statements: 0, transactions: 0 };
    }
  };

  const exportVault = async (password: string): Promise<string> => {
    return await vaultStorage.exportVault(password);
  };

  const importVault = async (data: string, password?: string): Promise<void> => {
    await vaultStorage.importVault(data, password);
    addLog('Import Vault', 'system', `Imported complete vault data${password ? ' with password protection' : ' (plaintext)'}`);
    await refreshData();

    // Blocking cloud push — awaited before this function returns so logout
    // cannot race ahead and discard imported data before it reaches the server.
    if (masterPassword) {
      try {
        const [{ getCloudToken, pushCloudVault, markVaultAsCloudSynced }, { vaultManager }] = await Promise.all([
          import('@/lib/cloud-vault-sync'),
          import('@/lib/vault-manager'),
        ]);
        const cloudToken = getCloudToken();
        const vaultId = vaultManager.getActiveVaultId();
        if (cloudToken && vaultId) {
          // Vault isolation: refuse to publish if the open DB doesn't
          // belong to this vault.
          if (vaultStorage.getCurrentVaultId() !== vaultId) {
            console.error(
              `[IMPORT] Storage on vault "${vaultStorage.getCurrentVaultId()}" but expected "${vaultId}" — ` +
              `skipping cloud push to avoid cross-vault leak.`,
            );
            window.dispatchEvent(new CustomEvent('vault:import:complete'));
            return;
          }
          const blob = await vaultStorage.exportVault(masterPassword);
          const vaultMeta = vaultManager.getExistingVaults().find((v: any) => v.id === vaultId);
          const vaultName = vaultMeta?.name ?? 'My Vault';
          const result = await pushCloudVault(vaultId, vaultName, blob, false);
          if (result.success) {
            markVaultAsCloudSynced(vaultId);
            localStorage.setItem(`iv_last_pull_${vaultId}`, new Date().toISOString());
            localStorage.removeItem(`iv_dirty_${vaultId}`);
          }
        }
      } catch (e) {
        console.error('[IMPORT] Cloud push failed:', e);
      }
    }

    window.dispatchEvent(new CustomEvent('vault:import:complete'));
  };

  const getKDFConfig = async (): Promise<CryptoKDFConfig | null> => {
    const config = await vaultStorage.getKDFConfig();
    return config || null;
  };

  const updateKDFConfig = async (masterPassword: string, newKdfConfig: CryptoKDFConfig, onProgress?: (progress: number) => void): Promise<void> => {
    await vaultStorage.reencryptVault(masterPassword, newKdfConfig, onProgress);
    // Refresh data after re-encryption
    await refreshData();
  };

  const importPasswordsFromCSV = async (csvContent: string, parserId: string): Promise<{ imported: number; skipped: number }> => {
    const result = await vaultStorage.importPasswordsFromCSV(csvContent, parserId);

    // Log the import activity
    addLog('Import Passwords', 'password', `Imported ${result.imported} passwords from CSV (${result.skipped} skipped)`);

    await refreshData();
    // Await the cloud push so a logout race doesn't lose the import. The
    // dirty flag stays set on failure for next-login recovery.
    if (result.imported > 0 && localStorage.getItem('iv_cloud_token')) {
      await pushToCloudNow();
    }
    return result;
  };

  // Batch import: writes each entry directly via vaultStorage.savePassword and
  // dispatches a single cloud push at the end. Avoids the N×fetch storm that
  // would happen if we routed every entry through addPassword (which fires
  // pushToCloud on every call).
  const bulkImportPasswords = async (
    entries: Array<Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>>,
    onProgress?: (done: number, total: number) => void,
  ): Promise<{
    imported: number; skipped: number; duplicates: number;
    cloudSync: 'success' | 'failed' | 'skipped';
    cloudBlobLength?: number;
    cloudError?: string;
  }> => {
    if (!entries.length) {
      return { imported: 0, skipped: 0, duplicates: 0, cloudSync: 'skipped' };
    }

    const existing = await vaultStorage.getAllPasswords();
    const existingKeys = new Set(
      existing.map(p => `${(p.name || '').toLowerCase()}::${(p.username || '').toLowerCase()}::${(p.url || '').toLowerCase()}`),
    );

    const fresh: PasswordEntry[] = [];
    let imported = 0;
    let skipped = 0;
    let duplicates = 0;
    const total = entries.length;

    for (let i = 0; i < entries.length; i++) {
      const data = entries[i];
      try {
        const key = `${(data.name || '').toLowerCase()}::${(data.username || '').toLowerCase()}::${(data.url || '').toLowerCase()}`;
        if (existingKeys.has(key)) {
          duplicates++;
          if (onProgress) onProgress(i + 1, total);
          continue;
        }
        const password: PasswordEntry = {
          ...data,
          id: crypto.randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await vaultStorage.savePassword(password);
        existingKeys.add(key);
        fresh.push(password);
        imported++;
      } catch (e) {
        skipped++;
      }
      if (onProgress) onProgress(i + 1, total);
    }

    if (fresh.length === 0) {
      return { imported, skipped, duplicates, cloudSync: 'skipped' };
    }

    setPasswords(prev => [...prev, ...fresh]);
    addLog(
      'Import Passwords',
      'password',
      `Bulk imported ${imported} passwords (${duplicates} duplicates, ${skipped} errors)`,
    );

    // Cloud push must complete BEFORE this returns, otherwise the user can
    // close the import modal / log out before the encrypted blob lands on
    // the server — and the next cloud-vault unlock will overwrite the
    // unsynced local data with the stale cloud blob, silently losing the
    // import. (See use-cloud-auto-sync's handleCloudUnlock.)
    if (!localStorage.getItem('iv_cloud_token')) {
      // Local-only vault — no cloud to push to.
      return { imported, skipped, duplicates, cloudSync: 'skipped' };
    }
    const result = await pushToCloudNow();
    if (result.ok) {
      return {
        imported, skipped, duplicates,
        cloudSync: 'success',
        cloudBlobLength: result.blobLength,
      };
    }
    return {
      imported, skipped, duplicates,
      cloudSync: 'failed',
      cloudError: result.reason,
    };
  };

  const getAvailableCSVParsers = () => {
    return vaultStorage.getAvailableCSVParsers();
  };

  // Calculate stats
  const stats = {
    totalPasswords: passwords.length,
    activeSubscriptions: subscriptions.filter(s => s.isActive).length,
    totalNotes: notes.length,
    totalExpenses: expenses.length,
    totalReminders: reminders.length,
    totalBankStatements: bankStatements.length,
    totalBankTransactions: bankTransactions.length,
    totalInvestments: investments.length,
    totalInvestmentGoals: investmentGoals.length,
    upcomingReminders: reminders.filter(r => {
      if (r.isCompleted) return false;
      const now = new Date();
      const dueDate = new Date(r.dueDate);
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      return dueDate >= now && dueDate <= weekFromNow;
    }).length,
    overdueReminders: reminders.filter(r => {
      if (r.isCompleted) return false;
      const now = new Date();
      const dueDate = new Date(r.dueDate);
      return dueDate < now;
    }).length,
    monthlySpend: subscriptions
      .filter(s => s.isActive)
      .reduce((total, s) => {
        let monthlyAmount = s.cost;
        if (s.billingCycle === 'yearly') monthlyAmount /= 12;
        else if (s.billingCycle === 'weekly') monthlyAmount *= 4.33;
        else if (s.billingCycle === 'daily') monthlyAmount *= 30;
        return total + monthlyAmount;
      }, 0),
    monthlyExpenses: expenses
      .filter(e => {
        const expenseDate = new Date(e.date);
        const currentMonth = new Date();
        return expenseDate.getMonth() === currentMonth.getMonth() &&
               expenseDate.getFullYear() === currentMonth.getFullYear();
      })
      .reduce((total, e) => total + e.amount, 0),
    weakPasswords: passwords.filter(p => {
      // Basic weak password detection
      return p.password.length < 8 ||
             !/[A-Z]/.test(p.password) ||
             !/[a-z]/.test(p.password) ||
             !/[0-9]/.test(p.password);
    }).length,
  };

  // Internal value (without searchQuery) — see useVault() below for how the
  // public API still exposes searchQuery via the SearchContext.
  const value: Omit<VaultContextType, 'searchQuery' | 'setSearchQuery'> = {
    passwords,
    subscriptions,
    notes,
    expenses,
    reminders,
    bankStatements,
    bankTransactions,
    investments,
    investmentGoals,
    stats,
    refreshData,
    addPassword,
    updatePassword,
    deletePassword,
    bulkDeletePasswords,
    addSubscription,
    updateSubscription,
    deleteSubscription,
    bulkDeleteSubscriptions,
    addNote,
    updateNote,
    deleteNote,
    bulkDeleteNotes,
    addExpense,
    updateExpense,
    deleteExpense,
    bulkDeleteExpenses,
    addReminder,
    updateReminder,
    deleteReminder,
    bulkDeleteReminders,
    addBankStatement,
    updateBankStatement,
    deleteBankStatement,
    bulkDeleteBankStatements,
    addBankTransaction,
    updateBankTransaction,
    deleteBankTransaction,
    addInvestment,
    updateInvestment,
    deleteInvestment,
    bulkDeleteInvestments,
    addInvestmentGoal,
    updateInvestmentGoal,
    deleteInvestmentGoal,
    apiKeys,
    addApiKey,
    updateApiKey,
    deleteApiKey: deleteApiKeyFromVault,
    bulkDeleteApiKeys,
    importBankStatementsFromCSV,
    exportVault,
    importVault,
    importPasswordsFromCSV,
    bulkImportPasswords,
    getAvailableCSVParsers,
    getKDFConfig,
    updateKDFConfig,

    // Security features
    failedAttempts,
    isLockedOut,
    lockoutTimeRemaining,
    hasRecentBackup,
    getBackupMetadata: async () => await vaultStorage.getBackupMetadata(),

    isLoading,
    isCloudSyncing,
    cloudSyncStatus,
    lastSyncError,
    retryCloudSync: () => {
      window.dispatchEvent(new CustomEvent('vault:force-cloud-push'));
    },
  };

  return (
    <VaultContext.Provider value={value as VaultContextType}>
      {children}
    </VaultContext.Provider>
  );
}

export function useVault(): VaultContextType {
  const context = useContext(VaultContext);
  if (context === undefined) {
    throw new Error('useVault must be used within a VaultProvider');
  }
  // QA-R2 H3: searchQuery/setSearchQuery are sourced from the separate
  // SearchContext so vault state changes don't bust their identity (and
  // search keystrokes don't bust vault consumers). Merge here so the
  // public API stays unchanged.
  const search = useSearch();
  return { ...context, searchQuery: search.searchQuery, setSearchQuery: search.setSearchQuery };
}
