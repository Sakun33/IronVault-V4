/**
 * Unified Entitlements Types
 * 
 * Source of truth for subscription plans and feature gating across
 * iOS (StoreKit 2), Android (Play Billing), and Web (Stripe).
 */

export type PlanType = 'FREE' | 'PREMIUM' | 'LIFETIME' | 'TRIAL';

export type EntitlementStatus = 'active' | 'expired' | 'cancelled' | 'inGrace';

export type Platform = 'ios' | 'android' | 'web';

export type Store = 'app_store' | 'play_store' | 'stripe' | 'promotional';

/**
 * Feature capabilities that differ by plan
 */
export interface Capabilities {
  maxVaults: number;          // FREE=1, PREMIUM/TRIAL=5
  maxPasswords: number;       // FREE=50, PREMIUM=-1 (unlimited)
  maxDocuments: number;       // FREE=5, PREMIUM=-1 (unlimited)
  maxNotes: number;           // FREE=10, PREMIUM=-1 (unlimited)
  maxSubscriptions: number;   // FREE=10, PREMIUM=-1 (unlimited)
  maxReminders: number;       // FREE=10, PREMIUM=-1 (unlimited)
  documentsEnabled: boolean;
  exportEnabled: boolean;
  analyticsEnabled: boolean;
  prioritySupportEnabled: boolean;
  biometricEnabled: boolean;
  cloudBackupEnabled: boolean;
  documentScannerEnabled: boolean;
  expenseTrackingEnabled: boolean;
  bankStatementsEnabled: boolean;
  investmentTrackingEnabled: boolean;
}

/**
 * Full entitlements payload used throughout the app
 */
export interface Entitlements {
  plan: PlanType;
  isTrial: boolean;
  trialEndsAt: Date | null;
  trialUsed: boolean;
  renewsAt: Date | null;
  expiresAt: Date | null;
  status: EntitlementStatus;
  platform: Platform;
  store: Store | null;
  capabilities: Capabilities;
  productId: string | null;
  originalPurchaseDate: Date | null;
  lastVerifiedAt: Date;
  isOffline: boolean;
}

/**
 * Cached entitlements with integrity check
 */
export interface CachedEntitlements {
  entitlements: Entitlements;
  cachedAt: number;           // Timestamp
  checksum: string;           // HMAC of entitlements for integrity
  version: number;            // Schema version for migrations
}

/**
 * Product information from app stores
 */
export interface Product {
  id: string;
  localizedTitle: string;
  localizedDescription: string;
  localizedPrice: string;
  price: number;
  currencyCode: string;
  period: 'monthly' | 'yearly' | 'lifetime';
  hasIntroOffer: boolean;
  introOfferPrice?: string;
  introOfferPeriod?: string;  // e.g., "14 days"
}

/**
 * Purchase result from stores
 */
export interface PurchaseResult {
  success: boolean;
  entitlements?: Entitlements;
  error?: {
    code: string;
    message: string;
    userCancelled: boolean;
  };
}

/**
 * Restore result from stores
 */
export interface RestoreResult {
  success: boolean;
  entitlements?: Entitlements;
  restoredCount: number;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Constants for product IDs
 */
export const PRODUCT_IDS = {
  // iOS/Android (configured in App Store Connect / Play Console)
  PREMIUM_MONTHLY: 'com.ironvault.pro.monthly',
  PREMIUM_YEARLY: 'com.ironvault.pro.yearly',
  LIFETIME: 'com.ironvault.lifetime',
  
  // Stripe (configured in Stripe Dashboard)
  STRIPE_PREMIUM_MONTHLY: 'price_ironvault_pro_monthly',
  STRIPE_PREMIUM_YEARLY: 'price_ironvault_pro_yearly',
  STRIPE_LIFETIME: 'price_ironvault_lifetime',
} as const;

/**
 * Default capabilities for each plan
 */
export const PLAN_CAPABILITIES: Record<PlanType, Capabilities> = {
  FREE: {
    maxVaults: 1,
    maxPasswords: 50,
    maxDocuments: 5,
    maxNotes: 10,
    maxSubscriptions: 10,
    maxReminders: 10,
    documentsEnabled: true,
    exportEnabled: false,
    analyticsEnabled: false,
    prioritySupportEnabled: false,
    biometricEnabled: true,
    cloudBackupEnabled: false,
    documentScannerEnabled: false,
    expenseTrackingEnabled: false,
    bankStatementsEnabled: false,
    investmentTrackingEnabled: false,
  },
  TRIAL: {
    maxVaults: 5,
    maxPasswords: -1,  // unlimited
    maxDocuments: -1,
    maxNotes: -1,
    maxSubscriptions: -1,
    maxReminders: -1,
    documentsEnabled: true,
    exportEnabled: true,
    analyticsEnabled: true,
    prioritySupportEnabled: true,
    biometricEnabled: true,
    cloudBackupEnabled: true,
    documentScannerEnabled: true,
    expenseTrackingEnabled: true,
    bankStatementsEnabled: true,
    investmentTrackingEnabled: true,
  },
  PREMIUM: {
    maxVaults: 5,
    maxPasswords: -1,
    maxDocuments: -1,
    maxNotes: -1,
    maxSubscriptions: -1,
    maxReminders: -1,
    documentsEnabled: true,
    exportEnabled: true,
    analyticsEnabled: true,
    prioritySupportEnabled: true,
    biometricEnabled: true,
    cloudBackupEnabled: true,
    documentScannerEnabled: true,
    expenseTrackingEnabled: true,
    bankStatementsEnabled: true,
    investmentTrackingEnabled: true,
  },
  LIFETIME: {
    maxVaults: 5,
    maxPasswords: -1,
    maxDocuments: -1,
    maxNotes: -1,
    maxSubscriptions: -1,
    maxReminders: -1,
    documentsEnabled: true,
    exportEnabled: true,
    analyticsEnabled: true,
    prioritySupportEnabled: true,
    biometricEnabled: true,
    cloudBackupEnabled: true,
    documentScannerEnabled: true,
    expenseTrackingEnabled: true,
    bankStatementsEnabled: true,
    investmentTrackingEnabled: true,
  },
};

/**
 * Trial duration in days
 */
export const TRIAL_DURATION_DAYS = 14;

/**
 * Offline grace period in days
 */
export const OFFLINE_GRACE_PERIOD_DAYS = 7;

/**
 * Cache validity in hours
 */
export const CACHE_VALIDITY_HOURS = 24;
