/**
 * Feature Gating Helpers
 * 
 * Centralized functions to check feature access and limits based on entitlements.
 * These are the source of truth for all feature gating in the app.
 */

import type { Entitlements, Capabilities, PlanType } from './types';
import { PLAN_CAPABILITIES } from './types';

/**
 * Check if user can create a new vault
 * @param currentVaultCount - Number of vaults user currently has
 * @param entitlements - User's entitlements
 * @returns true if user can create another vault
 */
export function canCreateVault(
  currentVaultCount: number,
  entitlements: Entitlements
): boolean {
  const maxVaults = entitlements.capabilities.maxVaults;
  
  // -1 means unlimited (shouldn't happen for vaults, but handle it)
  if (maxVaults === -1) return true;
  
  return currentVaultCount < maxVaults;
}

/**
 * Get reason why vault creation is blocked
 */
export function getVaultLimitMessage(entitlements: Entitlements): string {
  const maxVaults = entitlements.capabilities.maxVaults;
  if (entitlements.plan === 'FREE') {
    return `Free plan allows only ${maxVaults} vault. Upgrade to Premium for up to 5 vaults.`;
  }
  return `Maximum vault limit (${maxVaults}) reached.`;
}

/**
 * Check if user can access a specific vault
 * Free users can only access the default vault
 * Premium/Trial users can access all vaults
 * 
 * @param vaultId - ID of the vault to access
 * @param defaultVaultId - ID of the user's default vault
 * @param entitlements - User's entitlements
 * @returns true if user can access this vault
 */
export function canAccessVault(
  vaultId: string,
  defaultVaultId: string | null,
  entitlements: Entitlements
): boolean {
  // Premium, Lifetime, and Trial users can access all vaults
  if (entitlements.plan !== 'FREE' && entitlements.status === 'active') {
    return true;
  }
  
  // Free users can only access their default vault
  return vaultId === defaultVaultId;
}

/**
 * Check if a vault is locked due to plan restrictions
 */
export function isVaultLockedByPlan(
  vaultId: string,
  defaultVaultId: string | null,
  entitlements: Entitlements
): boolean {
  return !canAccessVault(vaultId, defaultVaultId, entitlements);
}

/**
 * Get message for locked vault
 */
export function getVaultLockedMessage(entitlements: Entitlements): string {
  if (entitlements.plan === 'FREE' && entitlements.trialUsed) {
    return 'Your trial has ended. Upgrade to Premium to access all your vaults.';
  }
  return 'Upgrade to Premium to access this vault.';
}

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(
  feature: keyof Omit<Capabilities, 'maxVaults' | 'maxPasswords' | 'maxDocuments' | 'maxNotes' | 'maxSubscriptions' | 'maxReminders'>,
  entitlements: Entitlements
): boolean {
  return entitlements.capabilities[feature] === true;
}

/**
 * Check if user is within a specific limit
 * @param limitType - Type of limit to check
 * @param currentCount - Current count
 * @param entitlements - User's entitlements
 * @returns true if user is under the limit
 */
export function isWithinLimit(
  limitType: 'passwords' | 'documents' | 'notes' | 'subscriptions' | 'reminders',
  currentCount: number,
  entitlements: Entitlements
): boolean {
  const limitMap: Record<string, keyof Capabilities> = {
    passwords: 'maxPasswords',
    documents: 'maxDocuments',
    notes: 'maxNotes',
    subscriptions: 'maxSubscriptions',
    reminders: 'maxReminders',
  };
  
  const capabilityKey = limitMap[limitType];
  const limit = entitlements.capabilities[capabilityKey] as number;
  
  // -1 means unlimited
  if (limit === -1) return true;
  
  return currentCount < limit;
}

/**
 * Get remaining count for a limit
 * @returns -1 for unlimited, or remaining count
 */
export function getRemainingCount(
  limitType: 'passwords' | 'documents' | 'notes' | 'subscriptions' | 'reminders' | 'vaults',
  currentCount: number,
  entitlements: Entitlements
): number {
  const limitMap: Record<string, keyof Capabilities> = {
    passwords: 'maxPasswords',
    documents: 'maxDocuments',
    notes: 'maxNotes',
    subscriptions: 'maxSubscriptions',
    reminders: 'maxReminders',
    vaults: 'maxVaults',
  };
  
  const capabilityKey = limitMap[limitType];
  const limit = entitlements.capabilities[capabilityKey] as number;
  
  if (limit === -1) return -1; // unlimited
  
  return Math.max(0, limit - currentCount);
}

/**
 * Get limit display string (e.g., "3/50" or "∞")
 */
export function getLimitDisplay(
  limitType: 'passwords' | 'documents' | 'notes' | 'subscriptions' | 'reminders' | 'vaults',
  currentCount: number,
  entitlements: Entitlements
): string {
  const limitMap: Record<string, keyof Capabilities> = {
    passwords: 'maxPasswords',
    documents: 'maxDocuments',
    notes: 'maxNotes',
    subscriptions: 'maxSubscriptions',
    reminders: 'maxReminders',
    vaults: 'maxVaults',
  };
  
  const capabilityKey = limitMap[limitType];
  const limit = entitlements.capabilities[capabilityKey] as number;
  
  if (limit === -1) {
    return `${currentCount}/∞`;
  }
  
  return `${currentCount}/${limit}`;
}

/**
 * Check if export feature is available
 */
export function canExport(entitlements: Entitlements): boolean {
  return entitlements.capabilities.exportEnabled;
}

/**
 * Check if analytics feature is available
 */
export function canUseAnalytics(entitlements: Entitlements): boolean {
  return entitlements.capabilities.analyticsEnabled;
}

/**
 * Check if biometric authentication is available
 */
export function canUseBiometric(entitlements: Entitlements): boolean {
  return entitlements.capabilities.biometricEnabled;
}

/**
 * Check if document scanner is available
 */
export function canUseDocumentScanner(entitlements: Entitlements): boolean {
  return entitlements.capabilities.documentScannerEnabled;
}

/**
 * Check if expense tracking is available
 */
export function canUseExpenseTracking(entitlements: Entitlements): boolean {
  return entitlements.capabilities.expenseTrackingEnabled;
}

/**
 * Check if bank statements feature is available
 */
export function canUseBankStatements(entitlements: Entitlements): boolean {
  return entitlements.capabilities.bankStatementsEnabled;
}

/**
 * Check if investment tracking is available
 */
export function canUseInvestmentTracking(entitlements: Entitlements): boolean {
  return entitlements.capabilities.investmentTrackingEnabled;
}

/**
 * Check if trial is expired
 */
export function isTrialExpired(entitlements: Entitlements): boolean {
  if (!entitlements.isTrial || !entitlements.trialEndsAt) {
    return false;
  }
  return new Date() > entitlements.trialEndsAt;
}

/**
 * Get days remaining in trial
 * @returns null if not in trial, 0 if expired, or days remaining
 */
export function getTrialDaysRemaining(entitlements: Entitlements): number | null {
  if (!entitlements.isTrial || !entitlements.trialEndsAt) {
    return null;
  }
  
  const now = new Date();
  const trialEnd = entitlements.trialEndsAt;
  
  if (now > trialEnd) return 0;
  
  const diffMs = trialEnd.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Check if subscription is about to expire (within 7 days)
 */
export function isSubscriptionExpiringSoon(entitlements: Entitlements): boolean {
  if (!entitlements.expiresAt || entitlements.status !== 'active') {
    return false;
  }
  
  const now = new Date();
  const expiresAt = entitlements.expiresAt;
  const diffMs = expiresAt.getTime() - now.getTime();
  const daysRemaining = diffMs / (1000 * 60 * 60 * 24);
  
  return daysRemaining <= 7 && daysRemaining > 0;
}

/**
 * Check if entitlements indicate an active subscription
 */
export function hasActiveSubscription(entitlements: Entitlements): boolean {
  return (
    entitlements.status === 'active' &&
    (entitlements.plan === 'PREMIUM' || entitlements.plan === 'LIFETIME')
  );
}

/**
 * Check if entitlements indicate a grace period (payment issue)
 */
export function isInGracePeriod(entitlements: Entitlements): boolean {
  return entitlements.status === 'inGrace';
}

/**
 * Get default entitlements for a plan type
 */
export function getDefaultEntitlements(
  plan: PlanType = 'FREE',
  platform: 'ios' | 'android' | 'web' = 'web'
): Entitlements {
  const now = new Date();
  
  const baseEntitlements: Entitlements = {
    plan,
    isTrial: plan === 'TRIAL',
    trialEndsAt: plan === 'TRIAL' 
      ? new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
      : null,
    trialUsed: false,
    renewsAt: null,
    expiresAt: null,
    status: 'active',
    platform,
    store: null,
    capabilities: PLAN_CAPABILITIES[plan],
    productId: null,
    originalPurchaseDate: null,
    lastVerifiedAt: now,
    isOffline: false,
  };
  
  return baseEntitlements;
}

/**
 * Merge capabilities (used when combining store entitlements)
 * Takes the more permissive of two capability sets
 */
export function mergeCapabilities(a: Capabilities, b: Capabilities): Capabilities {
  const mergeValue = (valA: number | boolean, valB: number | boolean): number | boolean => {
    if (typeof valA === 'boolean') {
      return valA || (valB as boolean);
    }
    // For numbers, -1 (unlimited) wins, otherwise take the higher value
    if (valA === -1 || valB === -1) return -1;
    return Math.max(valA as number, valB as number);
  };
  
  return {
    maxVaults: mergeValue(a.maxVaults, b.maxVaults) as number,
    maxPasswords: mergeValue(a.maxPasswords, b.maxPasswords) as number,
    maxDocuments: mergeValue(a.maxDocuments, b.maxDocuments) as number,
    maxNotes: mergeValue(a.maxNotes, b.maxNotes) as number,
    maxSubscriptions: mergeValue(a.maxSubscriptions, b.maxSubscriptions) as number,
    maxReminders: mergeValue(a.maxReminders, b.maxReminders) as number,
    documentsEnabled: mergeValue(a.documentsEnabled, b.documentsEnabled) as boolean,
    exportEnabled: mergeValue(a.exportEnabled, b.exportEnabled) as boolean,
    analyticsEnabled: mergeValue(a.analyticsEnabled, b.analyticsEnabled) as boolean,
    prioritySupportEnabled: mergeValue(a.prioritySupportEnabled, b.prioritySupportEnabled) as boolean,
    biometricEnabled: mergeValue(a.biometricEnabled, b.biometricEnabled) as boolean,
    cloudBackupEnabled: mergeValue(a.cloudBackupEnabled, b.cloudBackupEnabled) as boolean,
    documentScannerEnabled: mergeValue(a.documentScannerEnabled, b.documentScannerEnabled) as boolean,
    expenseTrackingEnabled: mergeValue(a.expenseTrackingEnabled, b.expenseTrackingEnabled) as boolean,
    bankStatementsEnabled: mergeValue(a.bankStatementsEnabled, b.bankStatementsEnabled) as boolean,
    investmentTrackingEnabled: mergeValue(a.investmentTrackingEnabled, b.investmentTrackingEnabled) as boolean,
  };
}
