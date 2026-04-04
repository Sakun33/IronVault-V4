export type BillingPeriod = 'monthly' | 'yearly' | 'lifetime';

export type BillingTier = 'free' | 'pro' | 'lifetime';

export interface BillingProduct {
  identifier: string;
  localizedTitle: string;
  localizedDescription: string;
  localizedPriceString: string;
  currencyCode: string;
  price: number;
  period: BillingPeriod;
  productType: 'subscription' | 'non-consumable';
}

export interface BillingPackage {
  identifier: string;
  packageType: 'monthly' | 'annual' | 'lifetime' | 'custom';
  product: BillingProduct;
  offeringIdentifier: string;
}

export interface BillingEntitlement {
  identifier: string;
  isActive: boolean;
  willRenew: boolean;
  periodType?: 'normal' | 'trial' | 'intro';
  latestPurchaseDate?: string;
  originalPurchaseDate?: string;
  expirationDate?: string;
  store: 'app_store' | 'play_store' | 'stripe' | 'promotional' | 'unknown';
  isSandbox: boolean;
  unsubscribeDetectedAt?: string;
  billingIssueDetectedAt?: string;
}

export interface CustomerInfo {
  activeSubscriptions: string[];
  allPurchasedProductIdentifiers: string[];
  entitlements: Record<string, BillingEntitlement>;
  latestExpirationDate?: string;
  originalAppUserId: string;
  requestDate: string;
  firstSeen: string;
  originalApplicationVersion?: string;
  managementURL?: string;
}

export interface PurchaseResult {
  success: boolean;
  customerInfo?: CustomerInfo;
  productIdentifier?: string;
  error?: {
    code: string;
    message: string;
    userCancelled: boolean;
  };
}

export interface RestoreResult {
  success: boolean;
  customerInfo?: CustomerInfo;
  restoredCount: number;
  error?: {
    code: string;
    message: string;
  };
}

export interface BillingProvider {
  configure(config: BillingConfig): Promise<void>;
  getPackages(): Promise<BillingPackage[]>;
  getCustomerInfo(): Promise<CustomerInfo>;
  purchasePackage(packageIdentifier: string): Promise<PurchaseResult>;
  restorePurchases(): Promise<RestoreResult>;
  syncPurchases(): Promise<CustomerInfo>;
  getManagementURL(): Promise<string | null>;
  isConfigured(): boolean;
}

export interface BillingConfig {
  apiKey: string;
  appUserID?: string;
  observerMode?: boolean;
  useAmazon?: boolean;
}

export const PRODUCT_IDS = {
  PRO_MONTHLY: 'com.ironvault.pro.monthly',
  PRO_YEARLY: 'com.ironvault.pro.yearly',
  LIFETIME: 'com.ironvault.lifetime',
} as const;

export const ENTITLEMENT_IDS = {
  PRO: 'pro',
  LIFETIME: 'lifetime',
} as const;

export const OFFERING_ID = 'default';
