import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, jsonb, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// CRM Users table - stores user profile for backend CRM (NOT vault data)
export const crmUsers = pgTable("crm_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email", { length: 255 }).notNull().unique(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  country: varchar("country", { length: 2 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  marketingConsent: boolean("marketing_consent").default(false),
  supportConsent: boolean("support_consent").notNull().default(true),
  vaultCreatedAt: timestamp("vault_created_at"),
  lastActiveAt: timestamp("last_active_at"),
  appVersion: varchar("app_version", { length: 50 }),
  platform: varchar("platform", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  accountPasswordHash: varchar("account_password_hash", { length: 255 }),
});

// Entitlements table - unified subscription status across all platforms
export const entitlements = pgTable("entitlements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => crmUsers.id, { onDelete: "cascade" }),
  plan: varchar("plan", { length: 50 }).notNull().default("free"), // free, premium, lifetime
  status: varchar("status", { length: 50 }).notNull().default("active"), // active, cancelled, expired, trial
  trialActive: boolean("trial_active").default(false),
  trialEndsAt: timestamp("trial_ends_at"),
  subscriptionPlatform: varchar("subscription_platform", { length: 20 }), // stripe, app_store, play_store, admin
  subscriptionId: varchar("subscription_id", { length: 255 }),
  productId: varchar("product_id", { length: 255 }),
  currentPeriodEndsAt: timestamp("current_period_ends_at"),
  willRenew: boolean("will_renew").default(true),
  cancelledAt: timestamp("cancelled_at"),
  adminOverride: boolean("admin_override").default(false),
  adminOverrideBy: varchar("admin_override_by"),
  adminOverrideReason: text("admin_override_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Billing Events table - audit trail for all billing events
export const billingEvents = pgTable("billing_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => crmUsers.id, { onDelete: "set null" }),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  platform: varchar("platform", { length: 20 }).notNull(),
  subscriptionId: varchar("subscription_id", { length: 255 }),
  productId: varchar("product_id", { length: 255 }),
  amount: decimal("amount", { precision: 10, scale: 2 }),
  currency: varchar("currency", { length: 3 }),
  rawEvent: jsonb("raw_event"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Support Tickets table
export const supportTickets = pgTable("support_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => crmUsers.id, { onDelete: "set null" }),
  subject: varchar("subject", { length: 255 }).notNull(),
  description: text("description").notNull(),
  status: varchar("status", { length: 50 }).default("open"), // open, in_progress, resolved, closed
  priority: varchar("priority", { length: 20 }).default("normal"), // low, normal, high, urgent
  assignedTo: varchar("assigned_to"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Ticket Replies table
export const ticketReplies = pgTable("ticket_replies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").references(() => supportTickets.id, { onDelete: "cascade" }),
  userId: varchar("user_id"),
  adminId: varchar("admin_id"),
  message: text("message").notNull(),
  isInternal: boolean("is_internal").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Admin Users table
export const adminUsers = pgTable("admin_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).default("support"), // super_admin, admin, support
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Audit Log table
export const auditLog = pgTable("audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminId: varchar("admin_id").references(() => adminUsers.id, { onDelete: "set null" }),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entity_type", { length: 50 }),
  entityId: varchar("entity_id"),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Deletion Requests table - for account deletion compliance
export const deletionRequests = pgTable("deletion_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => crmUsers.id, { onDelete: "set null" }),
  email: varchar("email", { length: 255 }).notNull(),
  reason: text("reason"),
  status: varchar("status", { length: 50 }).default("pending"), // pending, processing, completed
  requestedAt: timestamp("requested_at").defaultNow(),
  processedAt: timestamp("processed_at"),
  processedBy: varchar("processed_by"),
});

// Cloud Vaults table - stores encrypted vault blobs server-side
export const cloudVaults = pgTable("cloud_vaults", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => crmUsers.id, { onDelete: "cascade" }),
  vaultId: varchar("vault_id", { length: 255 }).notNull(),
  vaultName: varchar("vault_name", { length: 255 }).notNull(),
  encryptedBlob: text("encrypted_blob").notNull(),
  isDefault: boolean("is_default").default(false),
  clientModifiedAt: timestamp("client_modified_at").notNull(),
  serverUpdatedAt: timestamp("server_updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Legacy users table (preserved for backward compatibility)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// Zod schemas for CRM validation (manual definitions for better type safety)
export const insertCrmUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1, "Full name is required"),
  country: z.string().length(2, "Country must be 2-letter code"),
  phone: z.string().optional(),
  marketingConsent: z.boolean().optional().default(false),
  supportConsent: z.boolean().default(true),
  vaultCreatedAt: z.date().optional(),
  lastActiveAt: z.date().optional(),
  appVersion: z.string().optional(),
  platform: z.string().optional(),
});

export const insertEntitlementSchema = z.object({
  userId: z.string().optional(),
  plan: z.enum(["free", "premium", "lifetime"]).default("free"),
  status: z.enum(["active", "cancelled", "expired", "trial"]).default("active"),
  trialActive: z.boolean().optional().default(false),
  trialEndsAt: z.date().optional(),
  subscriptionPlatform: z.enum(["stripe", "app_store", "play_store", "admin"]).optional(),
  subscriptionId: z.string().optional(),
  productId: z.string().optional(),
  currentPeriodEndsAt: z.date().optional(),
  willRenew: z.boolean().optional().default(true),
  cancelledAt: z.date().optional(),
  adminOverride: z.boolean().optional().default(false),
  adminOverrideBy: z.string().optional(),
  adminOverrideReason: z.string().optional(),
});

export const insertBillingEventSchema = z.object({
  userId: z.string().optional(),
  eventType: z.string(),
  platform: z.string(),
  subscriptionId: z.string().optional(),
  productId: z.string().optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  rawEvent: z.any().optional(),
});

export const insertSupportTicketSchema = z.object({
  userId: z.string().optional(),
  subject: z.string().min(1, "Subject is required"),
  description: z.string().min(1, "Description is required"),
  status: z.enum(["open", "in_progress", "resolved", "closed"]).optional().default("open"),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional().default("normal"),
  assignedTo: z.string().optional(),
});

export const insertTicketReplySchema = z.object({
  ticketId: z.string(),
  userId: z.string().optional(),
  adminId: z.string().optional(),
  message: z.string().min(1, "Message is required"),
  isInternal: z.boolean().optional().default(false),
});

export const insertAdminUserSchema = z.object({
  email: z.string().email(),
  passwordHash: z.string(),
  fullName: z.string().min(1, "Full name is required"),
  role: z.enum(["super_admin", "admin", "support"]).optional().default("support"),
  isActive: z.boolean().optional().default(true),
  lastLoginAt: z.date().optional(),
});

export const insertAuditLogSchema = z.object({
  adminId: z.string().optional(),
  action: z.string(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  oldValue: z.any().optional(),
  newValue: z.any().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

export const insertDeletionRequestSchema = z.object({
  userId: z.string().optional(),
  email: z.string().email(),
  reason: z.string().optional(),
  status: z.enum(["pending", "processing", "completed"]).optional().default("pending"),
  processedAt: z.date().optional(),
  processedBy: z.string().optional(),
});

export const insertCloudVaultSchema = z.object({
  userId: z.string().optional(),
  vaultId: z.string().min(1),
  vaultName: z.string().min(1),
  encryptedBlob: z.string().min(1),
  isDefault: z.boolean().optional().default(false),
  clientModifiedAt: z.date(),
});
export type CloudVault = typeof cloudVaults.$inferSelect;
export type InsertCloudVault = z.infer<typeof insertCloudVaultSchema>;

// Types for CRM tables
export type CrmUser = typeof crmUsers.$inferSelect;
export type InsertCrmUser = z.infer<typeof insertCrmUserSchema>;
export type Entitlement = typeof entitlements.$inferSelect;
export type InsertEntitlement = z.infer<typeof insertEntitlementSchema>;
export type BillingEvent = typeof billingEvents.$inferSelect;
export type InsertBillingEvent = z.infer<typeof insertBillingEventSchema>;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type TicketReply = typeof ticketReplies.$inferSelect;
export type InsertTicketReply = z.infer<typeof insertTicketReplySchema>;
export type AdminUser = typeof adminUsers.$inferSelect;
export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type DeletionRequest = typeof deletionRequests.$inferSelect;
export type InsertDeletionRequest = z.infer<typeof insertDeletionRequestSchema>;

// Feature capabilities for plan gating
export const planCapabilities = {
  free: {
    maxPasswords: 50,
    maxSubscriptions: 10,
    maxNotes: 10,
    maxReminders: 3,
    documentsEnabled: false,
    bankStatementsEnabled: false,
    analyticsEnabled: false,
    prioritySupportEnabled: false,
    syncEnabled: false,
  },
  premium: {
    maxPasswords: -1, // unlimited
    maxSubscriptions: -1,
    maxNotes: -1,
    maxReminders: -1,
    documentsEnabled: true,
    bankStatementsEnabled: true,
    analyticsEnabled: true,
    prioritySupportEnabled: true,
    syncEnabled: true,
  },
  lifetime: {
    maxPasswords: -1,
    maxSubscriptions: -1,
    maxNotes: -1,
    maxReminders: -1,
    documentsEnabled: true,
    bankStatementsEnabled: true,
    analyticsEnabled: true,
    prioritySupportEnabled: true,
    syncEnabled: true,
  },
} as const;

export type PlanCapabilities = typeof planCapabilities[keyof typeof planCapabilities];

// Password entries stored in IndexedDB (client-side only)
export const passwordEntrySchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Site name is required"),
  url: z.string().url().optional().or(z.literal("")),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  category: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
  lastUsed: z.date().optional(),
});

// Subscription entries stored in IndexedDB (client-side only)
export const subscriptionEntrySchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Service name is required"),
  plan: z.string().optional(),
  cost: z.number().positive("Cost must be positive"),
  currency: z.string().default("USD"),
  billingCycle: z.enum(["monthly", "yearly", "weekly", "daily"]).default("monthly"),
  nextBillingDate: z.date(),
  reminderDays: z.number().default(7),
  category: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
  // Enhanced fields
  subscriptionType: z.enum(["streaming", "software", "cloud", "gaming", "news", "fitness", "productivity", "security", "education", "other"]).default("other"),
  credentials: z.object({
    username: z.string().optional(),
    email: z.string().email().optional(),
    accountId: z.string().optional(),
    password: z.string().optional(),
  }).optional(),
  platformLink: z.string().url().optional().or(z.literal("")),
  expiryDate: z.date().optional(),
  autoRenew: z.boolean().default(true),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

// Notes entries stored in IndexedDB (client-side only)
export const noteEntrySchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Title is required"),
  content: z.string(), // Rich markdown content
  notebook: z.string().default("Default"), // Organization folder/notebook
  tags: z.array(z.string()).default([]), // Tags for filtering/searching
  isPinned: z.boolean().default(false),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

// Expense entries stored in IndexedDB (client-side only)
export const expenseEntrySchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Title is required"),
  amount: z.number().positive("Amount must be positive"),
  currency: z.string().default("USD"),
  category: z.string().min(1, "Category is required"),
  date: z.date().default(() => new Date()),
  notes: z.string().optional(),
  isRecurring: z.boolean().default(false),
  recurringFrequency: z.enum(["daily", "weekly", "monthly", "yearly"]).optional(),
  nextDueDate: z.date().optional(),
  tags: z.array(z.string()).default([]),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

// Reminder entries stored in IndexedDB (client-side only)
export const reminderEntrySchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  dueDate: z.date(),
  dueTime: z.string().optional(), // HH:MM format
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  category: z.string().default("Personal"),
  isCompleted: z.boolean().default(false),
  completedAt: z.date().optional(),
  isRecurring: z.boolean().default(false),
  recurringFrequency: z.enum(["daily", "weekly", "monthly", "yearly"]).optional(),
  nextReminderDate: z.date().optional(),
  tags: z.array(z.string()).default([]),
  color: z.string().default("#6366f1"), // Color for calendar display
  notificationEnabled: z.boolean().default(true),
  // Alarm/pre-alert functionality
  alarmEnabled: z.boolean().default(false),
  alarmTime: z.string().optional(), // HH:MM format for alarm
  alertMinutesBefore: z.number().default(15), // Alert X minutes before due time
  preAlertEnabled: z.boolean().default(false),
  subscriptionId: z.string().optional(), // Link to subscription for renewal reminders
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

// KDF configuration schema
export const kdfConfigSchema = z.object({
  algorithm: z.literal("PBKDF2"),
  iterations: z.number().positive(),
  hash: z.enum(["SHA-256", "SHA-512"]),
});

// Vault metadata stored in IndexedDB
export const vaultMetadataSchema = z.object({
  id: z.string().default("vault"),
  encryptionSalt: z.string(),
  kdfConfig: kdfConfigSchema.optional(), // KDF configuration for this vault
  createdAt: z.date(),
  lastUnlocked: z.date(),
  passwordCount: z.number().default(0),
  subscriptionCount: z.number().default(0),
  noteCount: z.number().default(0),
  expenseCount: z.number().default(0),
  reminderCount: z.number().default(0),
  bankStatementCount: z.number().default(0),
  bankTransactionCount: z.number().default(0),
  investmentCount: z.number().default(0),
  investmentGoalCount: z.number().default(0),
});

export const insertUserSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type PasswordEntry = z.infer<typeof passwordEntrySchema>;
export type SubscriptionEntry = z.infer<typeof subscriptionEntrySchema>;
export type NoteEntry = z.infer<typeof noteEntrySchema>;
export type ExpenseEntry = z.infer<typeof expenseEntrySchema>;
export type ReminderEntry = z.infer<typeof reminderEntrySchema>;
export type KDFConfig = z.infer<typeof kdfConfigSchema>;
export type VaultMetadata = z.infer<typeof vaultMetadataSchema>;

// Categories for passwords and subscriptions
export const PASSWORD_CATEGORIES = [
  "Social Media",
  "Finance",
  "Work",
  "Personal",
  "Shopping",
  "Entertainment",
  "Email",
  "Gaming",
  "Education",
  "Other"
] as const;

export const SUBSCRIPTION_CATEGORIES = [
  "Streaming",
  "Software",
  "Cloud Storage",
  "Music",
  "Productivity",
  "Gaming",
  "News",
  "Finance",
  "Fitness",
  "Other"
] as const;

export const SUBSCRIPTION_TYPES = [
  "streaming",
  "software", 
  "cloud",
  "gaming",
  "news",
  "fitness",
  "productivity",
  "security",
  "education",
  "other"
] as const;

export const NOTE_NOTEBOOKS = [
  "Default",
  "Work",
  "Personal",
  "Ideas",
  "Projects",
  "Research",
  "Meeting Notes",
  "Travel",
  "Recipes",
  "Other"
] as const;

export const EXPENSE_CATEGORIES = [
  "Food & Dining",
  "Transportation",
  "Shopping",
  "Entertainment",
  "Bills & Utilities",
  "Healthcare",
  "Travel",
  "Education",
  "Business",
  "Home & Garden",
  "Personal Care",
  "Insurance",
  "Investments",
  "Gifts & Donations",
  "Other"
] as const;

export const REMINDER_CATEGORIES = [
  "Personal",
  "Work",
  "Healthcare",
  "Bills & Payments",
  "Appointments",
  "Events",
  "Travel",
  "Shopping",
  "Subscriptions",
  "Tasks",
  "Birthdays",
  "Maintenance",
  "Education",
  "Fitness",
  "Other"
] as const;

export const REMINDER_COLORS = [
  "#6366f1", // Indigo
  "#8b5cf6", // Violet  
  "#06b6d4", // Cyan
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#ec4899", // Pink
  "#84cc16", // Lime
  "#f97316", // Orange
  "#6b7280"  // Gray
] as const;

// Bank Statement Transaction entries stored in IndexedDB (client-side only)
export const bankTransactionSchema = z.object({
  id: z.string(),
  statementId: z.string(), // Reference to the statement this transaction belongs to
  date: z.date(),
  description: z.string().min(1, "Description is required"),
  amount: z.number(), // Can be positive (credit) or negative (debit)
  currency: z.string().default("USD"),
  transactionType: z.enum(["debit", "credit", "transfer"]),
  category: z.string().optional(), // Auto-categorized or user-assigned
  subcategory: z.string().optional(),
  account: z.string().optional(), // Account name/number
  balance: z.number().optional(), // Running balance if available
  reference: z.string().optional(), // Transaction reference number
  merchant: z.string().optional(), // Extracted merchant name
  isRecurring: z.boolean().default(false),
  recurringPattern: z.string().optional(), // Pattern like "monthly", "weekly"
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

// Bank Statement entries stored in IndexedDB (client-side only)
export const bankStatementSchema = z.object({
  id: z.string(),
  bankName: z.string().min(1, "Bank name is required"),
  accountName: z.string().optional(),
  accountNumber: z.string().optional(),
  statementPeriod: z.object({
    startDate: z.date(),
    endDate: z.date(),
  }),
  currency: z.string().default("USD"),
  openingBalance: z.number().optional(),
  closingBalance: z.number().optional(),
  totalCredits: z.number().default(0),
  totalDebits: z.number().default(0),
  transactionCount: z.number().default(0),
  fileName: z.string().optional(), // Original file name
  fileType: z.enum(["pdf", "csv", "xlsx", "xls", "ofx", "qif"]),
  importDate: z.date().default(() => new Date()),
  parsingRules: z.object({
    dateColumn: z.string().optional(),
    descriptionColumn: z.string().optional(),
    amountColumn: z.string().optional(),
    balanceColumn: z.string().optional(),
    creditIndicator: z.string().optional(),
    debitIndicator: z.string().optional(),
  }).optional(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

// Investment entries stored in IndexedDB (client-side only)
export const investmentSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Investment name is required"),
  type: z.enum([
    "fixed_deposit", "recurring_deposit", "mutual_fund", "stocks", 
    "bonds", "crypto", "nft", "futures", "debt", "real_estate", "other"
  ]),
  institution: z.string().optional(), // Bank, broker, platform name
  ticker: z.string().optional(), // Stock ticker, crypto symbol, etc.
  purchaseDate: z.date(),
  purchasePrice: z.number().positive("Purchase price must be positive"),
  quantity: z.number().positive("Quantity must be positive").default(1),
  currentPrice: z.number().optional(), // Current market price per unit
  currentValue: z.number().optional(), // Total current value
  currency: z.string().default("USD"),
  interestRate: z.number().optional(), // For FDs, bonds
  maturityDate: z.date().optional(), // For FDs, bonds
  dividendYield: z.number().optional(), // Annual dividend yield %
  fees: z.number().default(0), // Management fees, transaction costs
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

// Investment Goal entries stored in IndexedDB (client-side only)
export const investmentGoalSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Goal name is required"),
  description: z.string().optional(),
  targetAmount: z.number().positive("Target amount must be positive"),
  targetDate: z.date(),
  currentAmount: z.number().default(0), // Current progress
  currency: z.string().default("USD"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  category: z.string().optional(), // Retirement, House, Education, etc.
  investmentIds: z.array(z.string()).default([]), // Which investments contribute to this goal
  monthlyContribution: z.number().optional(), // Suggested monthly contribution
  isAchieved: z.boolean().default(false),
  achievedDate: z.date().optional(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

// Investment Performance History entries stored in IndexedDB (client-side only)
export const investmentPerformanceSchema = z.object({
  id: z.string(),
  investmentId: z.string(),
  date: z.date(),
  value: z.number().positive("Value must be positive"),
  price: z.number().optional(), // Price per unit if applicable
  notes: z.string().optional(),
  createdAt: z.date().default(() => new Date()),
});

export type BankTransaction = z.infer<typeof bankTransactionSchema>;
export type BankStatement = z.infer<typeof bankStatementSchema>;
export type Investment = z.infer<typeof investmentSchema>;
export type InvestmentGoal = z.infer<typeof investmentGoalSchema>;
export type InvestmentPerformance = z.infer<typeof investmentPerformanceSchema>;

// Categories for bank transactions
export const BANK_TRANSACTION_CATEGORIES = [
  "Income",
  "Food & Dining",
  "Transportation",
  "Shopping",
  "Entertainment",
  "Bills & Utilities",
  "Healthcare",
  "Travel",
  "Education",
  "Business",
  "Home & Garden",
  "Personal Care",
  "Insurance",
  "Investments",
  "Gifts & Donations",
  "ATM Withdrawal",
  "Transfer",
  "Interest & Fees",
  "Refunds",
  "Other"
] as const;

// Subcategories for more detailed categorization
export const BANK_TRANSACTION_SUBCATEGORIES = {
  "Income": ["Salary", "Freelance", "Investment Returns", "Interest", "Refunds", "Other"],
  "Food & Dining": ["Groceries", "Restaurants", "Coffee", "Fast Food", "Alcohol", "Other"],
  "Transportation": ["Gas", "Public Transit", "Rideshare", "Parking", "Car Maintenance", "Other"],
  "Shopping": ["Clothing", "Electronics", "Books", "Online Shopping", "Department Stores", "Other"],
  "Entertainment": ["Movies", "Streaming", "Games", "Sports", "Concerts", "Other"],
  "Bills & Utilities": ["Electricity", "Water", "Internet", "Phone", "Rent", "Other"],
  "Healthcare": ["Doctor", "Pharmacy", "Dental", "Vision", "Insurance", "Other"],
  "Travel": ["Flights", "Hotels", "Car Rental", "Travel Insurance", "Activities", "Other"],
  "Education": ["Tuition", "Books", "Supplies", "Courses", "Certifications", "Other"],
  "Business": ["Office Supplies", "Software", "Marketing", "Professional Services", "Other"],
  "Home & Garden": ["Furniture", "Appliances", "Maintenance", "Gardening", "Tools", "Other"],
  "Personal Care": ["Hair", "Skincare", "Gym", "Spa", "Cosmetics", "Other"],
  "Insurance": ["Health", "Auto", "Home", "Life", "Travel", "Other"],
  "Investments": ["Stocks", "Bonds", "Mutual Funds", "Crypto", "Real Estate", "Other"],
  "Gifts & Donations": ["Birthday", "Holiday", "Charity", "Wedding", "Anniversary", "Other"],
  "ATM Withdrawal": ["Cash", "ATM Fee", "Other"],
  "Transfer": ["Between Accounts", "To Savings", "To Investment", "Other"],
  "Interest & Fees": ["Bank Interest", "Credit Card Interest", "Fees", "Penalties", "Other"],
  "Refunds": ["Purchase Return", "Service Refund", "Tax Refund", "Other"],
  "Other": ["Miscellaneous", "Unknown", "Other"]
} as const;

// Investment types with their specific fields
export const INVESTMENT_TYPES = [
  { value: "fixed_deposit", label: "Fixed Deposit (FD)", icon: "🏦" },
  { value: "recurring_deposit", label: "Recurring Deposit (RD)", icon: "💰" },
  { value: "mutual_fund", label: "Mutual Fund", icon: "📈" },
  { value: "stocks", label: "Stocks/Equity", icon: "📊" },
  { value: "bonds", label: "Bonds", icon: "📋" },
  { value: "crypto", label: "Cryptocurrency", icon: "₿" },
  { value: "nft", label: "NFT", icon: "🎨" },
  { value: "futures", label: "Futures/Derivatives", icon: "⚡" },
  { value: "debt", label: "Debt Instruments", icon: "📄" },
  { value: "real_estate", label: "Real Estate", icon: "🏠" },
  { value: "other", label: "Other", icon: "📦" }
] as const;

// Investment goal categories
export const INVESTMENT_GOAL_CATEGORIES = [
  "Retirement",
  "House Purchase",
  "Education",
  "Emergency Fund",
  "Vacation",
  "Car Purchase",
  "Wedding",
  "Business Investment",
  "Child's Future",
  "Healthcare",
  "Debt Repayment",
  "Other"
] as const;
