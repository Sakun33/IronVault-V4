/**
 * Unified Entitlements Module
 * 
 * Central export for all entitlements-related functionality.
 * This is the source of truth for subscription plans and feature gating.
 */

// Types
export type {
  PlanType,
  EntitlementStatus,
  Platform,
  Store,
  Capabilities,
  Entitlements,
  CachedEntitlements,
  Product,
  PurchaseResult,
  RestoreResult,
} from './types';

export {
  PRODUCT_IDS,
  PLAN_CAPABILITIES,
  TRIAL_DURATION_DAYS,
  OFFLINE_GRACE_PERIOD_DAYS,
  CACHE_VALIDITY_HOURS,
} from './types';

// Gating helpers
export {
  canCreateVault,
  getVaultLimitMessage,
  canAccessVault,
  isVaultLockedByPlan,
  getVaultLockedMessage,
  isFeatureEnabled,
  isWithinLimit,
  getRemainingCount,
  getLimitDisplay,
  canExport,
  canUseAnalytics,
  canUseBiometric,
  canUseDocumentScanner,
  canUseExpenseTracking,
  canUseBankStatements,
  canUseInvestmentTracking,
  isTrialExpired,
  getTrialDaysRemaining,
  isSubscriptionExpiringSoon,
  hasActiveSubscription,
  isInGracePeriod,
  getDefaultEntitlements,
  mergeCapabilities,
} from './gating';

// Cache
export {
  cacheEntitlements,
  loadCachedEntitlements,
  isCacheValid,
  isWithinGracePeriod,
  getCacheAgeHours,
  clearCache,
  getEntitlementsWithFallback,
  markTrialUsed,
  hasTrialBeenUsed,
} from './cache';
