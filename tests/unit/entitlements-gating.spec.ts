/**
 * Unit Tests for Entitlements Gating Helpers
 * 
 * Tests all feature gating logic to ensure correct behavior
 * for Free, Trial, Premium, and Lifetime plans.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  canCreateVault,
  canAccessVault,
  isVaultLockedByPlan,
  isWithinLimit,
  getRemainingCount,
  getLimitDisplay,
  canExport,
  canUseAnalytics,
  canUseBiometric,
  isTrialExpired,
  getTrialDaysRemaining,
  hasActiveSubscription,
  getDefaultEntitlements,
  mergeCapabilities,
  PLAN_CAPABILITIES,
} from '../../client/src/lib/entitlements';
import type { Entitlements } from '../../client/src/lib/entitlements';

// Helper to create test entitlements
function createEntitlements(overrides: Partial<Entitlements> = {}): Entitlements {
  return {
    ...getDefaultEntitlements('FREE'),
    ...overrides,
  };
}

describe('Entitlements Gating', () => {
  describe('canCreateVault', () => {
    it('should allow free users to create first vault', () => {
      const entitlements = createEntitlements({ plan: 'FREE' });
      expect(canCreateVault(0, entitlements)).toBe(true);
    });

    it('should block free users from creating second vault', () => {
      const entitlements = createEntitlements({ plan: 'FREE' });
      expect(canCreateVault(1, entitlements)).toBe(false);
    });

    it('should allow premium users to create up to 5 vaults', () => {
      const entitlements = createEntitlements({
        plan: 'PREMIUM',
        capabilities: PLAN_CAPABILITIES.PREMIUM,
      });
      
      expect(canCreateVault(0, entitlements)).toBe(true);
      expect(canCreateVault(1, entitlements)).toBe(true);
      expect(canCreateVault(4, entitlements)).toBe(true);
      expect(canCreateVault(5, entitlements)).toBe(false);
    });

    it('should allow trial users to create up to 5 vaults', () => {
      const entitlements = createEntitlements({
        plan: 'TRIAL',
        isTrial: true,
        capabilities: PLAN_CAPABILITIES.TRIAL,
      });
      
      expect(canCreateVault(0, entitlements)).toBe(true);
      expect(canCreateVault(4, entitlements)).toBe(true);
      expect(canCreateVault(5, entitlements)).toBe(false);
    });

    it('should allow lifetime users to create up to 5 vaults', () => {
      const entitlements = createEntitlements({
        plan: 'LIFETIME',
        capabilities: PLAN_CAPABILITIES.LIFETIME,
      });
      
      expect(canCreateVault(4, entitlements)).toBe(true);
      expect(canCreateVault(5, entitlements)).toBe(false);
    });
  });

  describe('canAccessVault', () => {
    const defaultVaultId = 'default-vault-123';
    const otherVaultId = 'other-vault-456';

    it('should allow free users to access only default vault', () => {
      const entitlements = createEntitlements({ plan: 'FREE', status: 'active' });
      
      expect(canAccessVault(defaultVaultId, defaultVaultId, entitlements)).toBe(true);
      expect(canAccessVault(otherVaultId, defaultVaultId, entitlements)).toBe(false);
    });

    it('should allow premium users to access all vaults', () => {
      const entitlements = createEntitlements({
        plan: 'PREMIUM',
        status: 'active',
        capabilities: PLAN_CAPABILITIES.PREMIUM,
      });
      
      expect(canAccessVault(defaultVaultId, defaultVaultId, entitlements)).toBe(true);
      expect(canAccessVault(otherVaultId, defaultVaultId, entitlements)).toBe(true);
    });

    it('should allow trial users to access all vaults', () => {
      const entitlements = createEntitlements({
        plan: 'TRIAL',
        status: 'active',
        isTrial: true,
        capabilities: PLAN_CAPABILITIES.TRIAL,
      });
      
      expect(canAccessVault(otherVaultId, defaultVaultId, entitlements)).toBe(true);
    });

    it('should block expired users from non-default vaults', () => {
      const entitlements = createEntitlements({
        plan: 'FREE',
        status: 'expired',
        trialUsed: true,
      });
      
      expect(canAccessVault(defaultVaultId, defaultVaultId, entitlements)).toBe(true);
      expect(canAccessVault(otherVaultId, defaultVaultId, entitlements)).toBe(false);
    });
  });

  describe('isVaultLockedByPlan', () => {
    it('should return true for non-default vaults on free plan', () => {
      const entitlements = createEntitlements({ plan: 'FREE', status: 'active' });
      
      expect(isVaultLockedByPlan('other-vault', 'default-vault', entitlements)).toBe(true);
    });

    it('should return false for default vault on free plan', () => {
      const entitlements = createEntitlements({ plan: 'FREE', status: 'active' });
      
      expect(isVaultLockedByPlan('default-vault', 'default-vault', entitlements)).toBe(false);
    });

    it('should return false for any vault on premium plan', () => {
      const entitlements = createEntitlements({
        plan: 'PREMIUM',
        status: 'active',
        capabilities: PLAN_CAPABILITIES.PREMIUM,
      });
      
      expect(isVaultLockedByPlan('any-vault', 'default-vault', entitlements)).toBe(false);
    });
  });

  describe('isWithinLimit', () => {
    it('should enforce password limits for free users', () => {
      const entitlements = createEntitlements({ plan: 'FREE' });
      
      expect(isWithinLimit('passwords', 0, entitlements)).toBe(true);
      expect(isWithinLimit('passwords', 49, entitlements)).toBe(true);
      expect(isWithinLimit('passwords', 50, entitlements)).toBe(false);
    });

    it('should allow unlimited for premium users', () => {
      const entitlements = createEntitlements({
        plan: 'PREMIUM',
        capabilities: PLAN_CAPABILITIES.PREMIUM,
      });
      
      expect(isWithinLimit('passwords', 0, entitlements)).toBe(true);
      expect(isWithinLimit('passwords', 1000, entitlements)).toBe(true);
    });

    it('should enforce document limits for free users', () => {
      const entitlements = createEntitlements({ plan: 'FREE' });
      
      expect(isWithinLimit('documents', 4, entitlements)).toBe(true);
      expect(isWithinLimit('documents', 5, entitlements)).toBe(false);
    });

    it('should enforce notes limits for free users', () => {
      const entitlements = createEntitlements({ plan: 'FREE' });
      
      expect(isWithinLimit('notes', 9, entitlements)).toBe(true);
      expect(isWithinLimit('notes', 10, entitlements)).toBe(false);
    });
  });

  describe('getRemainingCount', () => {
    it('should return remaining count for free users', () => {
      const entitlements = createEntitlements({ plan: 'FREE' });
      
      expect(getRemainingCount('passwords', 10, entitlements)).toBe(40);
      expect(getRemainingCount('passwords', 50, entitlements)).toBe(0);
      expect(getRemainingCount('vaults', 0, entitlements)).toBe(1);
      expect(getRemainingCount('vaults', 1, entitlements)).toBe(0);
    });

    it('should return -1 for unlimited', () => {
      const entitlements = createEntitlements({
        plan: 'PREMIUM',
        capabilities: PLAN_CAPABILITIES.PREMIUM,
      });
      
      expect(getRemainingCount('passwords', 100, entitlements)).toBe(-1);
      expect(getRemainingCount('documents', 50, entitlements)).toBe(-1);
    });
  });

  describe('getLimitDisplay', () => {
    it('should format limits correctly for free users', () => {
      const entitlements = createEntitlements({ plan: 'FREE' });
      
      expect(getLimitDisplay('passwords', 10, entitlements)).toBe('10/50');
      expect(getLimitDisplay('vaults', 1, entitlements)).toBe('1/1');
      expect(getLimitDisplay('documents', 3, entitlements)).toBe('3/5');
    });

    it('should show infinity for premium users', () => {
      const entitlements = createEntitlements({
        plan: 'PREMIUM',
        capabilities: PLAN_CAPABILITIES.PREMIUM,
      });
      
      expect(getLimitDisplay('passwords', 100, entitlements)).toBe('100/∞');
      expect(getLimitDisplay('vaults', 3, entitlements)).toBe('3/5');
    });
  });

  describe('Feature Checks', () => {
    it('should disable export for free users', () => {
      const entitlements = createEntitlements({ plan: 'FREE' });
      expect(canExport(entitlements)).toBe(false);
    });

    it('should enable export for premium users', () => {
      const entitlements = createEntitlements({
        plan: 'PREMIUM',
        capabilities: PLAN_CAPABILITIES.PREMIUM,
      });
      expect(canExport(entitlements)).toBe(true);
    });

    it('should disable analytics for free users', () => {
      const entitlements = createEntitlements({ plan: 'FREE' });
      expect(canUseAnalytics(entitlements)).toBe(false);
    });

    it('should enable analytics for premium users', () => {
      const entitlements = createEntitlements({
        plan: 'PREMIUM',
        capabilities: PLAN_CAPABILITIES.PREMIUM,
      });
      expect(canUseAnalytics(entitlements)).toBe(true);
    });

    it('should disable biometric for free users', () => {
      const entitlements = createEntitlements({ plan: 'FREE' });
      expect(canUseBiometric(entitlements)).toBe(false);
    });

    it('should enable biometric for trial users', () => {
      const entitlements = createEntitlements({
        plan: 'TRIAL',
        capabilities: PLAN_CAPABILITIES.TRIAL,
      });
      expect(canUseBiometric(entitlements)).toBe(true);
    });
  });

  describe('Trial Logic', () => {
    it('should detect active trial', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      
      const entitlements = createEntitlements({
        plan: 'TRIAL',
        isTrial: true,
        trialEndsAt: futureDate,
      });
      
      expect(isTrialExpired(entitlements)).toBe(false);
    });

    it('should detect expired trial', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      
      const entitlements = createEntitlements({
        plan: 'TRIAL',
        isTrial: true,
        trialEndsAt: pastDate,
      });
      
      expect(isTrialExpired(entitlements)).toBe(true);
    });

    it('should calculate days remaining correctly', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      
      const entitlements = createEntitlements({
        plan: 'TRIAL',
        isTrial: true,
        trialEndsAt: futureDate,
      });
      
      const remaining = getTrialDaysRemaining(entitlements);
      expect(remaining).toBeGreaterThanOrEqual(6);
      expect(remaining).toBeLessThanOrEqual(8);
    });

    it('should return null for non-trial users', () => {
      const entitlements = createEntitlements({ plan: 'FREE' });
      expect(getTrialDaysRemaining(entitlements)).toBe(null);
    });

    it('should return 0 for expired trial', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      
      const entitlements = createEntitlements({
        plan: 'TRIAL',
        isTrial: true,
        trialEndsAt: pastDate,
      });
      
      expect(getTrialDaysRemaining(entitlements)).toBe(0);
    });
  });

  describe('hasActiveSubscription', () => {
    it('should return true for active premium', () => {
      const entitlements = createEntitlements({
        plan: 'PREMIUM',
        status: 'active',
      });
      expect(hasActiveSubscription(entitlements)).toBe(true);
    });

    it('should return true for lifetime', () => {
      const entitlements = createEntitlements({
        plan: 'LIFETIME',
        status: 'active',
      });
      expect(hasActiveSubscription(entitlements)).toBe(true);
    });

    it('should return false for free', () => {
      const entitlements = createEntitlements({
        plan: 'FREE',
        status: 'active',
      });
      expect(hasActiveSubscription(entitlements)).toBe(false);
    });

    it('should return false for cancelled premium', () => {
      const entitlements = createEntitlements({
        plan: 'PREMIUM',
        status: 'cancelled',
      });
      expect(hasActiveSubscription(entitlements)).toBe(false);
    });
  });

  describe('getDefaultEntitlements', () => {
    it('should return free entitlements by default', () => {
      const entitlements = getDefaultEntitlements();
      
      expect(entitlements.plan).toBe('FREE');
      expect(entitlements.capabilities.maxVaults).toBe(1);
      expect(entitlements.capabilities.maxPasswords).toBe(50);
      expect(entitlements.isTrial).toBe(false);
    });

    it('should return trial entitlements with proper dates', () => {
      const entitlements = getDefaultEntitlements('TRIAL');
      
      expect(entitlements.plan).toBe('TRIAL');
      expect(entitlements.isTrial).toBe(true);
      expect(entitlements.trialEndsAt).toBeInstanceOf(Date);
      expect(entitlements.capabilities.maxVaults).toBe(5);
    });

    it('should set correct platform', () => {
      const iosEntitlements = getDefaultEntitlements('FREE', 'ios');
      expect(iosEntitlements.platform).toBe('ios');
      
      const webEntitlements = getDefaultEntitlements('FREE', 'web');
      expect(webEntitlements.platform).toBe('web');
    });
  });

  describe('mergeCapabilities', () => {
    it('should take higher vault limit', () => {
      const free = PLAN_CAPABILITIES.FREE;
      const premium = PLAN_CAPABILITIES.PREMIUM;
      
      const merged = mergeCapabilities(free, premium);
      expect(merged.maxVaults).toBe(5);
    });

    it('should prefer unlimited (-1)', () => {
      const free = PLAN_CAPABILITIES.FREE;
      const premium = PLAN_CAPABILITIES.PREMIUM;
      
      const merged = mergeCapabilities(free, premium);
      expect(merged.maxPasswords).toBe(-1);
    });

    it('should enable features if either has them', () => {
      const a = { ...PLAN_CAPABILITIES.FREE, exportEnabled: false };
      const b = { ...PLAN_CAPABILITIES.FREE, exportEnabled: true };
      
      const merged = mergeCapabilities(a, b);
      expect(merged.exportEnabled).toBe(true);
    });
  });
});
