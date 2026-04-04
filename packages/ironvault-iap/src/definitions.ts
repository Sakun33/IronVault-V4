/**
 * IronVault IAP Plugin - TypeScript Definitions
 * 
 * Unified API for In-App Purchases across iOS (StoreKit 2) and Android (Play Billing)
 */

export interface IronvaultIapPlugin {
  /**
   * Get available products from the store
   * @param options - Product IDs to fetch
   * @returns Array of available products with localized pricing
   */
  getProducts(options: GetProductsOptions): Promise<GetProductsResult>;

  /**
   * Purchase a product
   * @param options - Product ID to purchase
   * @returns Purchase result with entitlements
   */
  purchase(options: PurchaseOptions): Promise<PurchaseResult>;

  /**
   * Restore previous purchases
   * @returns Restored entitlements
   */
  restorePurchases(): Promise<RestoreResult>;

  /**
   * Get current customer entitlements
   * @returns Current entitlements based on purchases
   */
  getCustomerEntitlements(): Promise<EntitlementsResult>;

  /**
   * Get active subscription status
   * @returns Details about active subscription if any
   */
  getActiveSubscriptionStatus(): Promise<SubscriptionStatusResult>;

  /**
   * Get introductory offer status (free trial eligibility)
   * @param options - Product ID to check
   * @returns Whether user is eligible for intro offer
   */
  getIntroOfferStatus(options: IntroOfferOptions): Promise<IntroOfferResult>;

  /**
   * Open the OS subscription management page
   */
  openManageSubscriptions(): Promise<void>;

  /**
   * Add listener for transaction updates
   */
  addListener(
    eventName: 'transactionUpdate',
    listenerFunc: (event: TransactionUpdateEvent) => void
  ): Promise<PluginListenerHandle>;

  /**
   * Remove all listeners
   */
  removeAllListeners(): Promise<void>;
}

// Options interfaces
export interface GetProductsOptions {
  productIds: string[];
}

export interface PurchaseOptions {
  productId: string;
  /** Optional: quantity for consumables */
  quantity?: number;
  /** Optional: offer ID for promotional offers (iOS) */
  offerId?: string;
}

export interface IntroOfferOptions {
  productId: string;
}

// Result interfaces
export interface Product {
  id: string;
  localizedTitle: string;
  localizedDescription: string;
  localizedPrice: string;
  price: number;
  currencyCode: string;
  productType: 'subscription' | 'nonConsumable' | 'consumable';
  /** Subscription period (e.g., "P1M" for monthly, "P1Y" for yearly) */
  subscriptionPeriod?: string;
  /** Human-readable period (e.g., "month", "year") */
  subscriptionPeriodUnit?: 'day' | 'week' | 'month' | 'year';
  subscriptionPeriodCount?: number;
  /** Introductory offer details */
  introOffer?: IntroOffer;
}

export interface IntroOffer {
  price: number;
  localizedPrice: string;
  periodUnit: 'day' | 'week' | 'month' | 'year';
  periodCount: number;
  cycles: number;
  type: 'freeTrial' | 'payUpFront' | 'payAsYouGo';
}

export interface GetProductsResult {
  products: Product[];
}

export interface PurchaseResult {
  success: boolean;
  transactionId?: string;
  productId?: string;
  purchaseDate?: string;
  expirationDate?: string;
  entitlements?: Entitlements;
  error?: PurchaseError;
}

export interface PurchaseError {
  code: PurchaseErrorCode;
  message: string;
  userCancelled: boolean;
}

export type PurchaseErrorCode =
  | 'USER_CANCELLED'
  | 'PRODUCT_NOT_FOUND'
  | 'PURCHASE_PENDING'
  | 'PURCHASE_INVALID'
  | 'NETWORK_ERROR'
  | 'BILLING_UNAVAILABLE'
  | 'ITEM_ALREADY_OWNED'
  | 'ITEM_NOT_OWNED'
  | 'UNKNOWN';

export interface RestoreResult {
  success: boolean;
  restoredCount: number;
  entitlements?: Entitlements;
  error?: {
    code: string;
    message: string;
  };
}

export interface Entitlements {
  plan: 'FREE' | 'PREMIUM' | 'LIFETIME' | 'TRIAL';
  isActive: boolean;
  isTrial: boolean;
  trialEndsAt?: string;
  expirationDate?: string;
  willRenew: boolean;
  productId?: string;
  platform: 'ios' | 'android' | 'web';
  store: 'app_store' | 'play_store';
  originalPurchaseDate?: string;
  latestPurchaseDate?: string;
}

export interface EntitlementsResult {
  entitlements: Entitlements;
}

export interface SubscriptionStatusResult {
  hasActiveSubscription: boolean;
  subscription?: {
    productId: string;
    expirationDate: string;
    willRenew: boolean;
    isInGracePeriod: boolean;
    isInBillingRetry: boolean;
    isTrial: boolean;
    trialEndsAt?: string;
  };
}

export interface IntroOfferResult {
  eligible: boolean;
  offer?: IntroOffer;
}

export interface TransactionUpdateEvent {
  type: 'purchased' | 'restored' | 'failed' | 'deferred' | 'expired' | 'revoked';
  transactionId?: string;
  productId?: string;
  entitlements?: Entitlements;
  error?: PurchaseError;
}

export interface PluginListenerHandle {
  remove: () => Promise<void>;
}

// Product ID constants
export const PRODUCT_IDS = {
  PREMIUM_MONTHLY: 'com.ironvault.pro.monthly',
  PREMIUM_YEARLY: 'com.ironvault.pro.yearly',
  LIFETIME: 'com.ironvault.lifetime',
} as const;
