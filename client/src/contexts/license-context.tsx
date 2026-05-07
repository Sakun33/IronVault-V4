import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { PricingService, LicenseInfo } from '@/lib/pricing';
import { vaultStorage } from '@/lib/storage';
import { billingService } from '@/billing/billing-service';
import { isNativePlatform } from '@/billing/platform';
import { ENTITLEMENT_IDS } from '@/billing/billing-types';
import { getEntitlementStatus } from '@/lib/customer-registration';
import { clearPlanCache } from '@/hooks/use-plan-features';
import { useAuth } from '@/contexts/auth-context';
import { planService } from '@/lib/plan-service';

interface LicenseContextType {
  license: LicenseInfo;
  isLoading: boolean;
  upgradeLicense: (tier: 'pro' | 'lifetime', billingCycle: 'monthly' | 'yearly' | 'lifetime') => Promise<void>;
  changePlan: (tier: 'free' | 'pro' | 'family' | 'lifetime') => Promise<void>;
  startTrial: () => Promise<boolean>;
  checkFeatureAccess: (feature: string) => boolean;
  checkLimit: (section: string, currentCount: number) => boolean;
  refreshLicense: () => Promise<void>;
  syncEntitlements: () => Promise<void>;
  syncFromServer: () => Promise<void>;
  isTrialExpired: () => boolean;
}

const LicenseContext = createContext<LicenseContextType | undefined>(undefined);

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const { isUnlocked } = useAuth();
  const [license, setLicense] = useState<LicenseInfo>(PricingService.getDefaultLicense());
  const [isLoading, setIsLoading] = useState(true);

  // Centralized helper to persist license while always preserving trialUsed flag.
  // Also pushes the resolved tier into planService so every consumer (including
  // non-React modules) sees the same answer.
  const persistLicense = async (
    newLicense: LicenseInfo,
    opts: { authoritative?: boolean; reason?: string } = {},
  ): Promise<void> => {
    const storedLicense = await vaultStorage.getPersistentData('license');
    const trialUsed = storedLicense?.trialUsed || newLicense.trialUsed || false;
    const licenseToSave = { ...newLicense, trialUsed };
    await vaultStorage.savePersistentData('license', licenseToSave);
    setLicense(licenseToSave);
    // Single source of truth — the planService is the authoritative tier owner.
    // Default callers (loadLicense fresh-install, etc.) are non-authoritative
    // and cannot demote a paid user. Server-sync and explicit user actions
    // (upgradeLicense / changePlan) opt-in to authoritative.
    planService.setTier(newLicense.tier, opts);
  };

  const hasSyncedFromServer = useRef(false);

  useEffect(() => {
    if (isNativePlatform()) {
      syncEntitlements();
    }
  }, []);

  // Single owner of loadLicense + syncFromServer — fires on mount and on unlock.
  // Having two effects both call loadLicense races: Effect 1 upgrades vault to "lifetime"
  // then Effect 2's later loadLicense read overwrites React state back to "free".
  useEffect(() => {
    if (!isUnlocked) {
      setIsLoading(false);
      return;
    }
    hasSyncedFromServer.current = false;
    clearPlanCache();
    // Loading-state ownership: loadLicense no longer flips isLoading=false on
    // its own. syncFromServer's finally is the single point that drops the
    // loading gate, so the UI waits until both IDB read AND server/cache
    // resolution have completed before deciding free-vs-paid. The catch
    // ensures even a rejected promise can't leave isLoading stuck true.
    loadLicense()
      .then(() => syncFromServer())
      .catch((e) => {
        console.error('[LICENSE] load+sync chain failed:', e);
        setIsLoading(false);
      });
  }, [isUnlocked]);

  useEffect(() => {
    if (!isNativePlatform()) return;

    let appStateListener: any;

    const setupAppStateListener = async () => {
      try {
        const { App } = await import('@capacitor/app');
        
        appStateListener = await App.addListener('appStateChange', (state) => {
          if (state.isActive) {
            syncEntitlements();
          }
        });
      } catch (error) {
        console.error('Failed to setup app state listener:', error);
      }
    };

    setupAppStateListener();

    return () => {
      if (appStateListener) {
        appStateListener.remove();
      }
    };
  }, []);

  const loadLicense = async () => {
    try {
      setIsLoading(true);
      
      const storedLicense = await vaultStorage.getPersistentData('license');
      
      if (storedLicense && storedLicense.tier) {
        const parsedLicense: LicenseInfo = {
          ...storedLicense,
          startDate: new Date(storedLicense.startDate),
          endDate: storedLicense.endDate ? new Date(storedLicense.endDate) : undefined,
          trialEndsAt: storedLicense.trialEndsAt ? new Date(storedLicense.trialEndsAt) : undefined,
        };
        
        // Check if trial has expired
        if (parsedLicense.status === 'trial' && parsedLicense.trialEndsAt) {
          if (new Date() > parsedLicense.trialEndsAt) {
            // Trial expired - revert to free license but preserve trialUsed flag.
            // Authoritative: this is a deterministic, time-based expiry — not
            // stale cache — so demoting to free is correct.
            const freeLicense = PricingService.getDefaultLicense();
            freeLicense.trialActive = false;
            freeLicense.trialUsed = true; // Explicitly mark trial as used
            await persistLicense(freeLicense, { authoritative: true, reason: 'trial-expired' });
            return;
          }
        }
        
        // Ensure trialUsed is always included in the license state
        const licenseWithTrialUsed = {
          ...parsedLicense,
          trialUsed: storedLicense?.trialUsed || parsedLicense.trialUsed || false,
        };
        setLicense(licenseWithTrialUsed);
        // Non-authoritative: IDB is a floor. If a previous user (free) was
        // logged in here, do not demote a currently-paid planService back to
        // free until syncFromServer confirms.
        planService.setTier(licenseWithTrialUsed.tier, { reason: 'idb-restore' });
      } else {
        // First time - no stored license, use default (trialUsed=false is ok for fresh install)
        const defaultLicense = PricingService.getDefaultLicense();
        await persistLicense(defaultLicense);
      }
    } catch (error) {
      console.error('Failed to load license:', error);
      // Don't overwrite stored license on error - just set state to default
      setLicense(PricingService.getDefaultLicense());
    }
    // NOTE: do NOT setIsLoading(false) here. The IDB read is fast but only
    // gives us the LAST persisted tier. A Lifetime user on a freshly-cleared
    // browser would have storedLicense=null at this point and we'd flash the
    // "Upgrade to Pro" gate before syncFromServer arrives. Let syncFromServer
    // be the one that flips isLoading off — that way the UI waits for the
    // CRM/cache resolution before deciding free vs paid.
  };

  const syncFromServer = async () => {
    if (hasSyncedFromServer.current) {
      setIsLoading(false);
      return;
    }
    hasSyncedFromServer.current = true;

    try {
      const entitlement = await getEntitlementStatus();

      let resolvedPlan: 'free' | 'pro' | 'family' | 'lifetime' | null = null;

      if (entitlement?.plan) {
        const serverPlan = entitlement.plan.toLowerCase() as 'free' | 'pro' | 'premium' | 'lifetime' | 'family';
        // Normalize: server may store "premium" meaning "pro"
        resolvedPlan = serverPlan === 'premium' ? 'pro' : (serverPlan as 'free' | 'pro' | 'family' | 'lifetime');
      } else {
        // Fallback: read iv_plan_cache (written by use-plan-features.ts after CRM fetch).
        // crmUserId may be absent for users registered without the CRM flow, but the plan
        // cache is still authoritative enough to restore the correct tier locally.
        try {
          const raw = localStorage.getItem('iv_plan_cache');
          if (raw) {
            const cache = JSON.parse(raw) as { email: string; planId: string; fetchedAt: number };
            const planId = cache.planId as 'free' | 'pro' | 'family' | 'lifetime';
            if (planId && planId !== 'free') {
              resolvedPlan = planId;
            }
          }
        } catch {
          // ignore
        }
      }

      if (!resolvedPlan) return;

      // Push to planService immediately — the React state below is async but the
      // plan-service is sync and observable, so any UI mounted before changePlan
      // commits will already see the right tier. This call IS authoritative
      // (server response or saved iv_plan_cache), so it is allowed to demote.
      planService.setTier(resolvedPlan, { authoritative: true, reason: 'server-entitlement' });

      // Read current stored license to compare
      const storedLicense = await vaultStorage.getPersistentData('license');
      const currentTier = storedLicense?.tier || 'free';

      if (resolvedPlan !== currentTier) {
        await changePlan(resolvedPlan);
      }
    } catch (e) {
      // Silently fail — offline or no CRM registration is OK
    } finally {
      // Loading complete: even if the server call failed, we've done the
      // best we can — let the UI render its decision instead of getting
      // stuck on a loading spinner forever.
      setIsLoading(false);
    }
  };

  const startTrial = async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      // Check if user already had a trial
      const storedLicense = await vaultStorage.getPersistentData('license');
      if (storedLicense?.trialUsed) {
        return false;
      }
      
      const trialLicense = PricingService.getTrialLicense();
      trialLicense.trialUsed = true; // Mark trial as used

      // Use persistLicense to save (will preserve trialUsed). Authoritative —
      // user explicitly clicked "Start trial".
      await persistLicense(trialLicense, { authoritative: true, reason: 'user-start-trial' });
      
      const { NotificationService } = await import('@/lib/notifications');
      if (NotificationService.createTrialStarted) {
        await NotificationService.createTrialStarted('current-user');
      }
      
      return true;
    } catch (error) {
      console.error('Failed to start trial:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const isTrialExpired = (): boolean => {
    if (license.status !== 'trial' || !license.trialEndsAt) {
      return false;
    }
    return new Date() > license.trialEndsAt;
  };

  const upgradeLicense = async (tier: 'pro' | 'lifetime', billingCycle: 'monthly' | 'yearly' | 'lifetime') => {
    try {
      setIsLoading(true);
      
      const newLicense: LicenseInfo = {
        tier,
        status: 'active',
        startDate: new Date(),
        billingCycle,
        features: tier === 'pro' 
          ? ['passwords', 'subscriptions', 'notes', 'expenses', 'reminders', 'bank_statements', 'investments', 'documents', 'scanner', 'cloud_backup', 'advanced_analytics']
          : ['passwords', 'subscriptions', 'notes', 'expenses', 'reminders', 'bank_statements', 'investments', 'documents', 'scanner', 'cloud_backup', 'advanced_analytics', 'priority_support'],
        limits: {
          passwords: -1,
          subscriptions: -1,
          notes: -1,
          expenses: -1,
          reminders: -1,
          bankStatements: -1,
          investments: -1,
          vaults: 5,
          documents: -1,
        },
        trialActive: false,
      };

      // persistLicense automatically preserves trialUsed flag. Authoritative —
      // user explicitly upgraded.
      await persistLicense(newLicense, { authoritative: true, reason: 'user-upgrade' });

      // Create notification for successful upgrade
      const { NotificationService } = await import('@/lib/notifications');
      await NotificationService.createPlanUpgrade('current-user', tier);
      
    } catch (error) {
      console.error('Failed to upgrade license:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const changePlan = async (tier: 'free' | 'pro' | 'family' | 'lifetime') => {
    try {
      setIsLoading(true);

      if (tier === 'free') {
        // Authoritative downgrade — this code path is only hit by syncFromServer
        // when the server returns 'free', or by an admin/CRM-driven plan change.
        const freeLicense = PricingService.getDefaultLicense();
        await persistLicense(freeLicense, { authoritative: true, reason: 'change-plan-to-free' });
        return;
      }

      const paidFeatures = ['passwords', 'subscriptions', 'notes', 'expenses', 'reminders', 'bank_statements', 'investments', 'documents', 'scanner', 'cloud_backup', 'advanced_analytics'];
      const familyExtra = ['priority_support', 'shared_vaults', 'family_dashboard'];

      const newLicense: LicenseInfo = {
        tier,
        status: 'active',
        startDate: new Date(),
        billingCycle: tier === 'lifetime' ? 'lifetime' : 'monthly',
        features: tier === 'family' ? [...paidFeatures, ...familyExtra] : tier === 'lifetime' ? [...paidFeatures, 'priority_support'] : paidFeatures,
        limits: {
          passwords: -1,
          subscriptions: -1,
          notes: -1,
          expenses: -1,
          reminders: -1,
          bankStatements: -1,
          investments: -1,
          vaults: tier === 'family' ? 10 : 5,
          documents: -1,
        },
        trialActive: false,
      };

      // Authoritative — explicit changePlan call (server-resolved entitlement
      // or admin/CRM-driven update).
      await persistLicense(newLicense, { authoritative: true, reason: 'change-plan' });
    } catch (error) {
      console.error('Failed to change plan:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const checkFeatureAccess = (feature: string): boolean => {
    return PricingService.checkFeatureAccess(license, feature);
  };

  const checkLimit = (section: string, currentCount: number): boolean => {
    return PricingService.checkLimit(license, section, currentCount);
  };

  const refreshLicense = async () => {
    await loadLicense();
  };

  const syncEntitlements = async () => {
    if (!isNativePlatform()) {
      return;
    }

    try {
      setIsLoading(true);
      
      await billingService.initialize();
      const customerInfo = await billingService.getCustomerInfo();
      
      const lifetimeEntitlement = customerInfo.entitlements[ENTITLEMENT_IDS.LIFETIME];
      const proEntitlement = customerInfo.entitlements[ENTITLEMENT_IDS.PRO];
      
      let newLicense: LicenseInfo;
      
      if (lifetimeEntitlement?.isActive) {
        newLicense = {
          tier: 'lifetime',
          status: 'active',
          startDate: lifetimeEntitlement.originalPurchaseDate 
            ? new Date(lifetimeEntitlement.originalPurchaseDate)
            : new Date(),
          billingCycle: 'lifetime',
          features: ['passwords', 'subscriptions', 'notes', 'expenses', 'reminders', 'bank_statements', 'investments', 'documents', 'scanner', 'cloud_backup', 'advanced_analytics', 'priority_support'],
          limits: {
            passwords: -1,
            subscriptions: -1,
            notes: -1,
            expenses: -1,
            reminders: -1,
            bankStatements: -1,
            investments: -1,
            vaults: 5,
            documents: -1,
          },
          trialActive: false,
          lastVerifiedAt: new Date().toISOString(),
        };
      } else if (proEntitlement?.isActive) {
        const billingCycle = customerInfo.activeSubscriptions.some(id => id.includes('yearly') || id.includes('annual'))
          ? 'yearly' as const
          : 'monthly' as const;
        
        newLicense = {
          tier: 'pro',
          status: proEntitlement.willRenew ? 'active' : 'cancelled',
          startDate: proEntitlement.originalPurchaseDate 
            ? new Date(proEntitlement.originalPurchaseDate)
            : new Date(),
          endDate: proEntitlement.expirationDate 
            ? new Date(proEntitlement.expirationDate)
            : undefined,
          billingCycle,
          features: ['passwords', 'subscriptions', 'notes', 'expenses', 'reminders', 'bank_statements', 'investments', 'documents', 'scanner', 'cloud_backup', 'advanced_analytics'],
          limits: {
            passwords: -1,
            subscriptions: -1,
            notes: -1,
            expenses: -1,
            reminders: -1,
            bankStatements: -1,
            investments: -1,
            vaults: 5,
            documents: -1,
          },
          trialActive: false,
          lastVerifiedAt: new Date().toISOString(),
        };
      } else {
        // CRITICAL: RC has no active entitlement. This does NOT mean the user is free.
        // Web/Razorpay-purchased Lifetime users have no RevenueCat record but are still
        // paid. RC is one of multiple entitlement sources — only authoritative when it
        // SAYS something positive. Bail without demoting; let the server entitlement
        // endpoint (syncFromServer) be the source of truth for the absent case.
        try {
          // eslint-disable-next-line no-console
          console.info('[LICENSE] syncEntitlements: RC reported no active entitlements; not demoting (web/Razorpay user may still be paid)');
        } catch { /* ignore */ }
        return;
      }

      // persistLicense automatically preserves trialUsed flag. Authoritative —
      // this is RevenueCat / store-confirmed entitlement state.
      await persistLicense(newLicense, { authoritative: true, reason: 'revenuecat-entitlement' });

    } catch (error) {
      console.error('Failed to sync entitlements:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const value: LicenseContextType = {
    license,
    isLoading,
    upgradeLicense,
    changePlan,
    startTrial,
    checkFeatureAccess,
    checkLimit,
    refreshLicense,
    syncEntitlements,
    syncFromServer,
    isTrialExpired,
  };

  return (
    <LicenseContext.Provider value={value}>
      {children}
    </LicenseContext.Provider>
  );
}

export function useLicense() {
  const context = useContext(LicenseContext);
  if (context === undefined) {
    throw new Error('useLicense must be used within a LicenseProvider');
  }
  return context;
}
