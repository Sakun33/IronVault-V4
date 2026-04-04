/**
 * Multi-Vault Context
 * 
 * This context provides access to the active vault's data and operations.
 * It works with the MultiVaultAuthContext to access the current vault's storage.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useMultiVaultAuth } from './multi-vault-auth-context';
import { PasswordEntry, SubscriptionEntry, NoteEntry, ExpenseEntry, ReminderEntry, BankStatement, BankTransaction, Investment, InvestmentGoal } from '@shared/schema';

interface VaultStats {
  totalPasswords: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
  totalNotes: number;
  totalExpenses: number;
  totalReminders: number;
  totalBankStatements: number;
  totalInvestments: number;
  totalInvestmentGoals: number;
  monthlySpend: number;
  upcomingPayments: number;
}

interface MultiVaultContextType {
  // Stats
  stats: VaultStats;
  refreshStats: () => Promise<void>;
  
  // Passwords
  passwords: PasswordEntry[];
  savePassword: (password: PasswordEntry) => Promise<void>;
  deletePassword: (id: string) => Promise<void>;
  refreshPasswords: () => Promise<void>;
  
  // Subscriptions
  subscriptions: SubscriptionEntry[];
  saveSubscription: (subscription: SubscriptionEntry) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;
  refreshSubscriptions: () => Promise<void>;
  
  // Notes
  notes: NoteEntry[];
  saveNote: (note: NoteEntry) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  refreshNotes: () => Promise<void>;
  
  // Expenses
  expenses: ExpenseEntry[];
  saveExpense: (expense: ExpenseEntry) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  refreshExpenses: () => Promise<void>;
  
  // Reminders
  reminders: ReminderEntry[];
  saveReminder: (reminder: ReminderEntry) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;
  refreshReminders: () => Promise<void>;
  
  // Bank Statements
  bankStatements: BankStatement[];
  saveBankStatement: (statement: BankStatement) => Promise<void>;
  deleteBankStatement: (id: string) => Promise<void>;
  refreshBankStatements: () => Promise<void>;
  
  // Bank Transactions
  bankTransactions: BankTransaction[];
  saveBankTransaction: (transaction: BankTransaction) => Promise<void>;
  deleteBankTransaction: (id: string) => Promise<void>;
  refreshBankTransactions: () => Promise<void>;
  
  // Investments
  investments: Investment[];
  saveInvestment: (investment: Investment) => Promise<void>;
  deleteInvestment: (id: string) => Promise<void>;
  refreshInvestments: () => Promise<void>;
  
  // Investment Goals
  investmentGoals: InvestmentGoal[];
  saveInvestmentGoal: (goal: InvestmentGoal) => Promise<void>;
  deleteInvestmentGoal: (id: string) => Promise<void>;
  refreshInvestmentGoals: () => Promise<void>;
  
  // Export
  exportVault: (password: string) => Promise<string>;
  
  // Loading state
  isLoading: boolean;
}

const defaultStats: VaultStats = {
  totalPasswords: 0,
  totalSubscriptions: 0,
  activeSubscriptions: 0,
  totalNotes: 0,
  totalExpenses: 0,
  totalReminders: 0,
  totalBankStatements: 0,
  totalInvestments: 0,
  totalInvestmentGoals: 0,
  monthlySpend: 0,
  upcomingPayments: 0,
};

const MultiVaultContext = createContext<MultiVaultContextType | undefined>(undefined);

interface Props {
  children: React.ReactNode;
}

export function MultiVaultProvider({ children }: Props) {
  const { isUnlocked, activeVault, getActiveStorage } = useMultiVaultAuth();
  
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<VaultStats>(defaultStats);
  const [passwords, setPasswords] = useState<PasswordEntry[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionEntry[]>([]);
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [reminders, setReminders] = useState<ReminderEntry[]>([]);
  const [bankStatements, setBankStatements] = useState<BankStatement[]>([]);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [investmentGoals, setInvestmentGoals] = useState<InvestmentGoal[]>([]);

  // Get storage helper
  const getStorage = useCallback(() => {
    const storage = getActiveStorage();
    if (!storage) {
      throw new Error('No active vault');
    }
    return storage;
  }, [getActiveStorage]);

  // Refresh all data when vault changes
  useEffect(() => {
    if (isUnlocked && activeVault) {
      refreshAll();
    } else {
      // Clear data when logged out
      setStats(defaultStats);
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
  }, [isUnlocked, activeVault?.id]);

  // Refresh all data
  const refreshAll = useCallback(async () => {
    if (!isUnlocked) return;
    
    setIsLoading(true);
    try {
      await Promise.all([
        refreshPasswords(),
        refreshSubscriptions(),
        refreshNotes(),
        refreshExpenses(),
        refreshReminders(),
        refreshBankStatements(),
        refreshBankTransactions(),
        refreshInvestments(),
        refreshInvestmentGoals(),
      ]);
      await refreshStats();
    } catch (error) {
      console.error('Failed to refresh vault data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isUnlocked]);

  // Stats
  const refreshStats = useCallback(async () => {
    try {
      const storage = getStorage();
      const [pwds, subs, nts, exps, rmds, stmts, invs, goals] = await Promise.all([
        storage.getAllPasswords(),
        storage.getAllSubscriptions(),
        storage.getAllNotes(),
        storage.getAllExpenses(),
        storage.getAllReminders(),
        storage.getAllBankStatements(),
        storage.getAllInvestments(),
        storage.getAllInvestmentGoals(),
      ]);
      
      const activeSubs = subs.filter(s => s.isActive !== false);
      const monthlySpend = activeSubs.reduce((sum, s) => {
        if (s.billingCycle === 'monthly') return sum + s.cost;
        if (s.billingCycle === 'yearly') return sum + s.cost / 12;
        return sum;
      }, 0);
      
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
      const upcomingPayments = activeSubs.filter(s => {
        const nextPayment = new Date(s.nextBillingDate);
        return nextPayment >= now && nextPayment <= nextMonth;
      }).length;
      
      setStats({
        totalPasswords: pwds.length,
        totalSubscriptions: subs.length,
        activeSubscriptions: activeSubs.length,
        totalNotes: nts.length,
        totalExpenses: exps.length,
        totalReminders: rmds.length,
        totalBankStatements: stmts.length,
        totalInvestments: invs.length,
        totalInvestmentGoals: goals.length,
        monthlySpend,
        upcomingPayments,
      });
    } catch (error) {
      console.error('Failed to refresh stats:', error);
    }
  }, [getStorage]);

  // Passwords
  const refreshPasswords = useCallback(async () => {
    try {
      const storage = getStorage();
      const data = await storage.getAllPasswords();
      setPasswords(data);
    } catch (error) {
      console.error('Failed to refresh passwords:', error);
    }
  }, [getStorage]);

  const savePassword = useCallback(async (password: PasswordEntry) => {
    const storage = getStorage();
    await storage.savePassword(password);
    await refreshPasswords();
    await refreshStats();
  }, [getStorage, refreshPasswords, refreshStats]);

  const deletePassword = useCallback(async (id: string) => {
    const storage = getStorage();
    await storage.deletePassword(id);
    await refreshPasswords();
    await refreshStats();
  }, [getStorage, refreshPasswords, refreshStats]);

  // Subscriptions
  const refreshSubscriptions = useCallback(async () => {
    try {
      const storage = getStorage();
      const data = await storage.getAllSubscriptions();
      setSubscriptions(data);
    } catch (error) {
      console.error('Failed to refresh subscriptions:', error);
    }
  }, [getStorage]);

  const saveSubscription = useCallback(async (subscription: SubscriptionEntry) => {
    const storage = getStorage();
    await storage.saveSubscription(subscription);
    await refreshSubscriptions();
    await refreshStats();
  }, [getStorage, refreshSubscriptions, refreshStats]);

  const deleteSubscription = useCallback(async (id: string) => {
    const storage = getStorage();
    await storage.deleteSubscription(id);
    await refreshSubscriptions();
    await refreshStats();
  }, [getStorage, refreshSubscriptions, refreshStats]);

  // Notes
  const refreshNotes = useCallback(async () => {
    try {
      const storage = getStorage();
      const data = await storage.getAllNotes();
      setNotes(data);
    } catch (error) {
      console.error('Failed to refresh notes:', error);
    }
  }, [getStorage]);

  const saveNote = useCallback(async (note: NoteEntry) => {
    const storage = getStorage();
    await storage.saveNote(note);
    await refreshNotes();
    await refreshStats();
  }, [getStorage, refreshNotes, refreshStats]);

  const deleteNote = useCallback(async (id: string) => {
    const storage = getStorage();
    await storage.deleteNote(id);
    await refreshNotes();
    await refreshStats();
  }, [getStorage, refreshNotes, refreshStats]);

  // Expenses
  const refreshExpenses = useCallback(async () => {
    try {
      const storage = getStorage();
      const data = await storage.getAllExpenses();
      setExpenses(data);
    } catch (error) {
      console.error('Failed to refresh expenses:', error);
    }
  }, [getStorage]);

  const saveExpense = useCallback(async (expense: ExpenseEntry) => {
    const storage = getStorage();
    await storage.saveExpense(expense);
    await refreshExpenses();
    await refreshStats();
  }, [getStorage, refreshExpenses, refreshStats]);

  const deleteExpense = useCallback(async (id: string) => {
    const storage = getStorage();
    await storage.deleteExpense(id);
    await refreshExpenses();
    await refreshStats();
  }, [getStorage, refreshExpenses, refreshStats]);

  // Reminders
  const refreshReminders = useCallback(async () => {
    try {
      const storage = getStorage();
      const data = await storage.getAllReminders();
      setReminders(data);
    } catch (error) {
      console.error('Failed to refresh reminders:', error);
    }
  }, [getStorage]);

  const saveReminder = useCallback(async (reminder: ReminderEntry) => {
    const storage = getStorage();
    await storage.saveReminder(reminder);
    await refreshReminders();
    await refreshStats();
  }, [getStorage, refreshReminders, refreshStats]);

  const deleteReminder = useCallback(async (id: string) => {
    const storage = getStorage();
    await storage.deleteReminder(id);
    await refreshReminders();
    await refreshStats();
  }, [getStorage, refreshReminders, refreshStats]);

  // Bank Statements
  const refreshBankStatements = useCallback(async () => {
    try {
      const storage = getStorage();
      const data = await storage.getAllBankStatements();
      setBankStatements(data);
    } catch (error) {
      console.error('Failed to refresh bank statements:', error);
    }
  }, [getStorage]);

  const saveBankStatement = useCallback(async (statement: BankStatement) => {
    const storage = getStorage();
    await storage.saveBankStatement(statement);
    await refreshBankStatements();
    await refreshStats();
  }, [getStorage, refreshBankStatements, refreshStats]);

  const deleteBankStatement = useCallback(async (id: string) => {
    const storage = getStorage();
    await storage.deleteBankStatement(id);
    await refreshBankStatements();
    await refreshStats();
  }, [getStorage, refreshBankStatements, refreshStats]);

  // Bank Transactions
  const refreshBankTransactions = useCallback(async () => {
    try {
      const storage = getStorage();
      const data = await storage.getAllBankTransactions();
      setBankTransactions(data);
    } catch (error) {
      console.error('Failed to refresh bank transactions:', error);
    }
  }, [getStorage]);

  const saveBankTransaction = useCallback(async (transaction: BankTransaction) => {
    const storage = getStorage();
    await storage.saveBankTransaction(transaction);
    await refreshBankTransactions();
  }, [getStorage, refreshBankTransactions]);

  const deleteBankTransaction = useCallback(async (id: string) => {
    const storage = getStorage();
    await storage.deleteBankTransaction(id);
    await refreshBankTransactions();
  }, [getStorage, refreshBankTransactions]);

  // Investments
  const refreshInvestments = useCallback(async () => {
    try {
      const storage = getStorage();
      const data = await storage.getAllInvestments();
      setInvestments(data);
    } catch (error) {
      console.error('Failed to refresh investments:', error);
    }
  }, [getStorage]);

  const saveInvestment = useCallback(async (investment: Investment) => {
    const storage = getStorage();
    await storage.saveInvestment(investment);
    await refreshInvestments();
    await refreshStats();
  }, [getStorage, refreshInvestments, refreshStats]);

  const deleteInvestment = useCallback(async (id: string) => {
    const storage = getStorage();
    await storage.deleteInvestment(id);
    await refreshInvestments();
    await refreshStats();
  }, [getStorage, refreshInvestments, refreshStats]);

  // Investment Goals
  const refreshInvestmentGoals = useCallback(async () => {
    try {
      const storage = getStorage();
      const data = await storage.getAllInvestmentGoals();
      setInvestmentGoals(data);
    } catch (error) {
      console.error('Failed to refresh investment goals:', error);
    }
  }, [getStorage]);

  const saveInvestmentGoal = useCallback(async (goal: InvestmentGoal) => {
    const storage = getStorage();
    await storage.saveInvestmentGoal(goal);
    await refreshInvestmentGoals();
    await refreshStats();
  }, [getStorage, refreshInvestmentGoals, refreshStats]);

  const deleteInvestmentGoal = useCallback(async (id: string) => {
    const storage = getStorage();
    await storage.deleteInvestmentGoal(id);
    await refreshInvestmentGoals();
    await refreshStats();
  }, [getStorage, refreshInvestmentGoals, refreshStats]);

  // Export
  const exportVault = useCallback(async (password: string): Promise<string> => {
    const storage = getStorage();
    return storage.exportVault(password);
  }, [getStorage]);

  const value: MultiVaultContextType = {
    stats,
    refreshStats,
    passwords,
    savePassword,
    deletePassword,
    refreshPasswords,
    subscriptions,
    saveSubscription,
    deleteSubscription,
    refreshSubscriptions,
    notes,
    saveNote,
    deleteNote,
    refreshNotes,
    expenses,
    saveExpense,
    deleteExpense,
    refreshExpenses,
    reminders,
    saveReminder,
    deleteReminder,
    refreshReminders,
    bankStatements,
    saveBankStatement,
    deleteBankStatement,
    refreshBankStatements,
    bankTransactions,
    saveBankTransaction,
    deleteBankTransaction,
    refreshBankTransactions,
    investments,
    saveInvestment,
    deleteInvestment,
    refreshInvestments,
    investmentGoals,
    saveInvestmentGoal,
    deleteInvestmentGoal,
    refreshInvestmentGoals,
    exportVault,
    isLoading,
  };

  return (
    <MultiVaultContext.Provider value={value}>
      {children}
    </MultiVaultContext.Provider>
  );
}

export function useMultiVault() {
  const context = useContext(MultiVaultContext);
  if (context === undefined) {
    throw new Error('useMultiVault must be used within a MultiVaultProvider');
  }
  return context;
}
