import { useState, useEffect, useCallback } from 'react';
import { billingService } from './billing-service';
import type { BillingPackage, PurchaseResult, RestoreResult } from './billing-types';

export interface UseBillingPackagesResult {
  packages: BillingPackage[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  monthlyPackage: BillingPackage | null;
  yearlyPackage: BillingPackage | null;
  lifetimePackage: BillingPackage | null;
  savingsPercent: number | null;
}

export function useBillingPackages(): UseBillingPackagesResult {
  const [packages, setPackages] = useState<BillingPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPackages = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const pkgs = await billingService.getPackages();
      setPackages(pkgs);
    } catch (err) {
      console.error('Failed to load billing packages:', err);
      setError(err instanceof Error ? err.message : 'Failed to load packages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPackages();
  }, [loadPackages]);

  const monthlyPackage = packages.find(p => p.packageType === 'monthly') || null;
  const yearlyPackage = packages.find(p => p.packageType === 'annual') || null;
  const lifetimePackage = packages.find(p => p.packageType === 'lifetime') || null;

  const savingsPercent = monthlyPackage && yearlyPackage && 
    monthlyPackage.product.currencyCode === yearlyPackage.product.currencyCode
    ? billingService.computeSavings(monthlyPackage.product.price, yearlyPackage.product.price)
    : null;

  return {
    packages,
    loading,
    error,
    refresh: loadPackages,
    monthlyPackage,
    yearlyPackage,
    lifetimePackage,
    savingsPercent,
  };
}

export interface UsePurchaseResult {
  purchasing: boolean;
  purchase: (packageIdentifier: string) => Promise<PurchaseResult>;
  restoring: boolean;
  restore: () => Promise<RestoreResult>;
  openManagement: () => Promise<boolean>;
}

export function usePurchase(): UsePurchaseResult {
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const purchase = useCallback(async (packageIdentifier: string): Promise<PurchaseResult> => {
    setPurchasing(true);
    try {
      const result = await billingService.purchasePackage(packageIdentifier);
      return result;
    } finally {
      setPurchasing(false);
    }
  }, []);

  const restore = useCallback(async (): Promise<RestoreResult> => {
    setRestoring(true);
    try {
      const result = await billingService.restorePurchases();
      return result;
    } finally {
      setRestoring(false);
    }
  }, []);

  const openManagement = useCallback(async (): Promise<boolean> => {
    return billingService.openManagementURL();
  }, []);

  return {
    purchasing,
    purchase,
    restoring,
    restore,
    openManagement,
  };
}
