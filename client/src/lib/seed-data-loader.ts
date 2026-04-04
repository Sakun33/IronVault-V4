import seedData from '@/data/seed-data.json';
import { vaultStorage } from './storage';
import type { PasswordEntry, SubscriptionEntry, NoteEntry, ExpenseEntry, ReminderEntry, Investment, InvestmentGoal, BankStatement, BankTransaction } from '@shared/schema';

export interface SeedDataStats {
  passwords: number;
  subscriptions: number;
  notes: number;
  expenses: number;
  reminders: number;
  investments: number;
  investmentGoals: number;
  bankTransactions: number;
}

/**
 * Load seed data into the vault storage
 * This populates all sections with realistic demo data
 */
export async function loadSeedData(): Promise<SeedDataStats> {
  const stats: SeedDataStats = {
    passwords: 0,
    subscriptions: 0,
    notes: 0,
    expenses: 0,
    reminders: 0,
    investments: 0,
    investmentGoals: 0,
    bankTransactions: 0,
  };

  try {
    // Load passwords
    for (const pwd of seedData.passwords) {
      const password: PasswordEntry = {
        id: pwd.id,
        name: pwd.name,
        url: pwd.url,
        username: pwd.username,
        password: pwd.password,
        category: pwd.category,
        notes: pwd.notes,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await vaultStorage.savePassword(password);
      stats.passwords++;
    }
    console.log(`✅ Loaded ${stats.passwords} passwords`);

    // Load subscriptions
    for (const sub of seedData.subscriptions) {
      const subscription: SubscriptionEntry = {
        id: sub.id,
        name: sub.name,
        plan: sub.plan,
        cost: sub.cost,
        currency: sub.currency,
        billingCycle: sub.billingCycle as 'monthly' | 'yearly' | 'weekly' | 'daily',
        nextBillingDate: new Date(sub.nextBillingDate),
        reminderDays: 7,
        category: sub.category,
        subscriptionType: (sub.subscriptionType || 'other') as any,
        autoRenew: sub.autoRenew,
        isActive: sub.isActive,
        notes: sub.notes,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await vaultStorage.saveSubscription(subscription);
      stats.subscriptions++;
    }
    console.log(`✅ Loaded ${stats.subscriptions} subscriptions`);

    // Load notes
    for (const note of seedData.notes) {
      const noteEntry: NoteEntry = {
        id: note.id,
        title: note.title,
        content: note.content,
        notebook: note.notebook,
        tags: note.tags || [],
        isPinned: note.isPinned,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await vaultStorage.saveNote(noteEntry);
      stats.notes++;
    }
    console.log(`✅ Loaded ${stats.notes} notes`);

    // Load expenses
    for (const exp of seedData.expenses) {
      const expense: ExpenseEntry = {
        id: exp.id,
        title: exp.title,
        amount: exp.amount,
        currency: exp.currency,
        category: exp.category,
        date: new Date(exp.date),
        isRecurring: exp.isRecurring,
        recurringFrequency: exp.recurringFrequency as 'monthly' | 'yearly' | 'weekly' | 'daily' | undefined,
        tags: exp.tags || [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await vaultStorage.saveExpense(expense);
      stats.expenses++;
    }
    console.log(`✅ Loaded ${stats.expenses} expenses`);

    // Load reminders
    for (const rem of seedData.reminders) {
      const reminder: ReminderEntry = {
        id: rem.id,
        title: rem.title,
        description: rem.description,
        dueDate: new Date(rem.dueDate),
        dueTime: rem.dueTime,
        priority: rem.priority as 'low' | 'medium' | 'high' | 'urgent',
        category: rem.category,
        isCompleted: false,
        isRecurring: rem.isRecurring,
        recurringFrequency: rem.recurringFrequency as 'daily' | 'weekly' | 'monthly' | 'yearly' | undefined,
        tags: [],
        color: rem.color,
        notificationEnabled: true,
        alarmEnabled: false,
        alertMinutesBefore: 15,
        preAlertEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await vaultStorage.saveReminder(reminder);
      stats.reminders++;
    }
    console.log(`✅ Loaded ${stats.reminders} reminders`);

    // Load investments
    for (const inv of seedData.investments) {
      const investment: Investment = {
        id: inv.id,
        name: inv.name,
        type: inv.type as any,
        institution: inv.institution,
        ticker: inv.ticker,
        purchaseDate: new Date(inv.purchaseDate),
        purchasePrice: inv.purchasePrice,
        quantity: inv.quantity,
        currentPrice: inv.currentPrice,
        currentValue: (inv.currentPrice || inv.purchasePrice) * inv.quantity,
        currency: inv.currency,
        interestRate: inv.interestRate,
        maturityDate: inv.maturityDate ? new Date(inv.maturityDate) : undefined,
        tags: [],
        fees: 0,
        isActive: inv.isActive,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await vaultStorage.saveInvestment(investment);
      stats.investments++;
    }
    console.log(`✅ Loaded ${stats.investments} investments`);

    // Load investment goals
    for (const goal of seedData.investmentGoals) {
      const investmentGoal: InvestmentGoal = {
        id: goal.id,
        name: goal.name,
        description: goal.description,
        targetAmount: goal.targetAmount,
        targetDate: new Date(goal.targetDate),
        currentAmount: goal.currentAmount,
        currency: goal.currency,
        priority: goal.priority as 'low' | 'medium' | 'high',
        category: goal.category,
        investmentIds: [],
        isAchieved: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await vaultStorage.saveInvestmentGoal(investmentGoal);
      stats.investmentGoals++;
    }
    console.log(`✅ Loaded ${stats.investmentGoals} investment goals`);

    // Load bank transactions (create a statement first)
    const statementId = 'stmt-001';
    const bankStatement: BankStatement = {
      id: statementId,
      bankName: 'Chase Bank',
      accountName: 'Primary Checking',
      accountNumber: '****4521',
      statementPeriod: {
        startDate: new Date('2024-09-01'),
        endDate: new Date('2024-09-30'),
      },
      currency: 'USD',
      openingBalance: 15000,
      closingBalance: 18500,
      totalCredits: 17000,
      totalDebits: 13500,
      transactionCount: seedData.bankTransactions.length,
      fileType: 'csv',
      importDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await vaultStorage.saveBankStatement(bankStatement);

    for (const txn of seedData.bankTransactions) {
      const transaction: BankTransaction = {
        id: txn.id,
        statementId: txn.statementId,
        date: new Date(txn.date),
        description: txn.description,
        amount: txn.amount,
        transactionType: txn.transactionType as 'credit' | 'debit' | 'transfer',
        category: txn.category,
        merchant: txn.merchant,
        currency: 'USD',
        tags: [],
        isRecurring: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await vaultStorage.saveBankTransaction(transaction);
      stats.bankTransactions++;
    }
    console.log(`✅ Loaded ${stats.bankTransactions} bank transactions`);

    console.log('🎉 All seed data loaded successfully!');
    return stats;

  } catch (error) {
    console.error('❌ Error loading seed data:', error);
    throw error;
  }
}

/**
 * Check if seed data has already been loaded
 */
export async function isSeedDataLoaded(): Promise<boolean> {
  try {
    const passwords = await vaultStorage.getAllPasswords();
    return passwords.length >= 10; // If we have 10+ passwords, likely seeded
  } catch {
    return false;
  }
}

/**
 * Get seed data statistics without loading
 */
export function getSeedDataInfo(): { totalItems: number; categories: string[] } {
  const totalItems = 
    seedData.passwords.length +
    seedData.subscriptions.length +
    seedData.notes.length +
    seedData.expenses.length +
    seedData.reminders.length +
    seedData.investments.length +
    seedData.investmentGoals.length +
    seedData.bankTransactions.length;

  return {
    totalItems,
    categories: [
      `${seedData.passwords.length} passwords`,
      `${seedData.subscriptions.length} subscriptions`,
      `${seedData.notes.length} notes`,
      `${seedData.expenses.length} expenses`,
      `${seedData.reminders.length} reminders`,
      `${seedData.investments.length} investments`,
      `${seedData.investmentGoals.length} goals`,
      `${seedData.bankTransactions.length} transactions`,
    ],
  };
}
