import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { PasswordEntry, SubscriptionEntry, NoteEntry, ExpenseEntry, ReminderEntry, KDFConfig, BankStatement, BankTransaction, Investment, InvestmentGoal } from '@shared/schema';
import { vaultStorage } from '@/lib/storage';
import { KDFConfig as CryptoKDFConfig } from '@/lib/crypto';
import { useAuth } from './auth-context';
import { useLogging } from './logging-context';
import type { ParserConfig } from '@/lib/csv-parsers';

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
  addSubscription: (subscription: Omit<SubscriptionEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateSubscription: (id: string, updates: Partial<SubscriptionEntry>) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;
  addNote: (note: Omit<NoteEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateNote: (id: string, updates: Partial<NoteEntry>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  addExpense: (expense: Omit<ExpenseEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateExpense: (id: string, updates: Partial<ExpenseEntry>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  addReminder: (reminder: Omit<ReminderEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateReminder: (id: string, updates: Partial<ReminderEntry>) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;
  // Bank Statements CRUD
  addBankStatement: (statement: Omit<BankStatement, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateBankStatement: (id: string, updates: Partial<BankStatement>) => Promise<void>;
  deleteBankStatement: (id: string) => Promise<void>;
  addBankTransaction: (transaction: Omit<BankTransaction, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateBankTransaction: (id: string, updates: Partial<BankTransaction>) => Promise<void>;
  deleteBankTransaction: (id: string) => Promise<void>;
  // Investments CRUD
  addInvestment: (investment: Omit<Investment, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateInvestment: (id: string, updates: Partial<Investment>) => Promise<void>;
  deleteInvestment: (id: string) => Promise<void>;
  addInvestmentGoal: (goal: Omit<InvestmentGoal, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateInvestmentGoal: (id: string, updates: Partial<InvestmentGoal>) => Promise<void>;
  deleteInvestmentGoal: (id: string) => Promise<void>;
  // API Keys CRUD (encrypted vault storage)
  apiKeys: any[];
  addApiKey: (key: any) => Promise<void>;
  updateApiKey: (id: string, updates: any) => Promise<void>;
  deleteApiKey: (id: string) => Promise<void>;
  importBankStatementsFromCSV: (csvContent: string) => Promise<{ statements: number; transactions: number }>;
  exportVault: (password: string) => Promise<string>;
  importVault: (data: string, password?: string) => Promise<void>;
  importPasswordsFromCSV: (csvContent: string, parserId: string) => Promise<{ imported: number; skipped: number }>;
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
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);

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

  // Pull refresh: when cloud-sync hook replaces vault data from a remote device
  useEffect(() => {
    const handleCloudReplace = () => {
      setIsCloudSyncing(false);
      if (isUnlocked) refreshData();
    };
    const handleCloudSyncing = () => setIsCloudSyncing(true);
    window.addEventListener('vault:cloud:replaced', handleCloudReplace);
    window.addEventListener('vault:cloud:syncing', handleCloudSyncing);
    return () => {
      window.removeEventListener('vault:cloud:replaced', handleCloudReplace);
      window.removeEventListener('vault:cloud:syncing', handleCloudSyncing);
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

  // Fire-and-forget cloud push after every vault mutation.
  // Bypasses the event system — directly exports and PUTs the encrypted blob.
  const pushToCloud = () => {
    const token = localStorage.getItem('iv_cloud_token');
    if (!token) {
      console.error('[CLOUD-PUSH] NO TOKEN — push skipped! iv_cloud_token not in localStorage');
      return;
    }
    if (!masterPassword) {
      console.error('[CLOUD-PUSH] No master password — push skipped');
      return;
    }
    const mp = masterPassword;
    (async () => {
      try {
        const { vaultManager } = await import('@/lib/vault-manager');
        const vaultId = vaultManager.getActiveVaultId();
        if (!vaultId) return;
        localStorage.setItem(`iv_dirty_${vaultId}`, '1');
        const blob = await vaultStorage.exportVault(mp);
        const vaultMeta = vaultManager.getExistingVaults().find((v: any) => v.id === vaultId);
        const vaultName = vaultMeta?.name ?? 'My Vault';
        const clientModifiedAt = new Date().toISOString();
        const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
        let ok = false;
        const res = await fetch(`https://www.ironvault.app/api/vaults/cloud/${vaultId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ encryptedBlob: blob, vaultName, isDefault: false, clientModifiedAt }),
        });
        if (res.status === 404) {
          const { getOrCreateDeviceId } = await import('@/lib/cloud-vault-sync');
          const postRes = await fetch(`https://www.ironvault.app/api/vaults/cloud`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ vaultId, vaultName, encryptedBlob: blob, isDefault: false, clientModifiedAt, sourceDeviceId: getOrCreateDeviceId() }),
          });
          ok = postRes.ok;
        } else {
          ok = res.ok;
        }
        if (ok) {
          localStorage.removeItem(`iv_dirty_${vaultId}`);
          toastRef.current({ title: '☁️ Synced', description: 'Vault saved to cloud', duration: 2000 });
        } else {
          console.error('[CLOUD-PUSH] Server returned not-ok:', res.status);
          toastRef.current({ title: '⚠️ Cloud sync failed', description: `Server error ${res.status}`, variant: 'destructive', duration: 3000 });
        }
      } catch (e) {
        console.error('[CLOUD-PUSH]', e);
        toastRef.current({ title: '⚠️ Cloud sync error', description: String(e), variant: 'destructive', duration: 3000 });
      }
    })();
  };

  const refreshData = async () => {
    if (!isUnlocked) return;

    setIsLoading(true);
    try {
      console.log('VaultContext: Starting data refresh...');

      // Check if database schema is correct
      const schemaValid = await vaultStorage.checkSchema();
      if (!schemaValid) {
        console.log('⚠️ Database schema invalid, recreating...');
        await vaultStorage.recreateDatabase();
        console.log('✅ Database recreated successfully');
      }

      // Always refresh data to ensure we have the latest from storage
      console.log('VaultContext: Refreshing all data from storage...');

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

      console.log('VaultContext: Data loaded:', {
        passwords: passwordsData.length,
        subscriptions: subscriptionsData.length,
        notes: notesData.length,
        expenses: expensesData.length,
        reminders: remindersData.length,
        bankStatements: bankStatementsData.length,
        bankTransactions: bankTransactionsData.length,
        investments: investmentsData.length,
        investmentGoals: investmentGoalsData.length,
      });

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

  const addNote = async (noteData: Omit<NoteEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
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

  const importBankStatementsFromCSV = async (csvContent: string) => {
    try {
      console.log('VaultContext: Starting bank statements import...');
      const result = await vaultStorage.importBankStatementsFromCSV(csvContent);
      console.log('VaultContext: Import completed:', result);

      // Log the import activity
      addLog('Import Bank Statements', 'system', `Imported ${result.statements} statements and ${result.transactions} transactions from CSV`);

      await refreshData();
      console.log('VaultContext: Data refreshed after import');
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
          const blob = await vaultStorage.exportVault(masterPassword);
          const vaultMeta = vaultManager.getExistingVaults().find((v: any) => v.id === vaultId);
          const vaultName = vaultMeta?.name ?? 'My Vault';
          console.log('[IMPORT] Blocking cloud push starting...');
          const result = await pushCloudVault(vaultId, vaultName, blob, false);
          if (result.success) {
            markVaultAsCloudSynced(vaultId);
            localStorage.setItem(`iv_last_pull_${vaultId}`, new Date().toISOString());
            localStorage.removeItem(`iv_dirty_${vaultId}`);
          }
          console.log('[IMPORT] Cloud push result:', result);
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
    return result;
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

  const value: VaultContextType = {
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
    searchQuery,
    setSearchQuery,
    refreshData,
    addPassword,
    updatePassword,
    deletePassword,
    addSubscription,
    updateSubscription,
    deleteSubscription,
    addNote,
    updateNote,
    deleteNote,
    addExpense,
    updateExpense,
    deleteExpense,
    addReminder,
    updateReminder,
    deleteReminder,
    addBankStatement,
    updateBankStatement,
    deleteBankStatement,
    addBankTransaction,
    updateBankTransaction,
    deleteBankTransaction,
    addInvestment,
    updateInvestment,
    deleteInvestment,
    addInvestmentGoal,
    updateInvestmentGoal,
    deleteInvestmentGoal,
    apiKeys,
    addApiKey,
    updateApiKey,
    deleteApiKey: deleteApiKeyFromVault,
    importBankStatementsFromCSV,
    exportVault,
    importVault,
    importPasswordsFromCSV,
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
  };

  return (
    <VaultContext.Provider value={value}>
      {children}
    </VaultContext.Provider>
  );
}

export function useVault() {
  const context = useContext(VaultContext);
  if (context === undefined) {
    throw new Error('useVault must be used within a VaultProvider');
  }
  return context;
}
