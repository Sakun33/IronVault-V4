import { WebPlugin } from '@capacitor/core';

import type {
  IronvaultIapPlugin,
  GetProductsOptions,
  GetProductsResult,
  PurchaseOptions,
  PurchaseResult,
  RestoreResult,
  EntitlementsResult,
  SubscriptionStatusResult,
  IntroOfferOptions,
  IntroOfferResult,
  Entitlements,
  Product,
} from './definitions';

/**
 * Web Implementation - Mock for development/testing
 * 
 * In production, web purchases should use Stripe instead.
 * This implementation provides mock data for development.
 */
export class IronvaultIapWeb extends WebPlugin implements IronvaultIapPlugin {
  
  private mockProducts: Product[] = [
    {
      id: 'com.ironvault.pro.monthly',
      localizedTitle: 'IronVault Pro Monthly',
      localizedDescription: 'Full access to all premium features, billed monthly',
      localizedPrice: '$2.99',
      price: 2.99,
      currencyCode: 'USD',
      productType: 'subscription',
      subscriptionPeriod: 'P1M',
      subscriptionPeriodUnit: 'month',
      subscriptionPeriodCount: 1,
      introOffer: {
        price: 0,
        localizedPrice: 'Free',
        periodUnit: 'day',
        periodCount: 14,
        cycles: 1,
        type: 'freeTrial',
      },
    },
    {
      id: 'com.ironvault.pro.yearly',
      localizedTitle: 'IronVault Pro Yearly',
      localizedDescription: 'Full access to all premium features, billed yearly. Save 17%!',
      localizedPrice: '$29.99',
      price: 29.99,
      currencyCode: 'USD',
      productType: 'subscription',
      subscriptionPeriod: 'P1Y',
      subscriptionPeriodUnit: 'year',
      subscriptionPeriodCount: 1,
      introOffer: {
        price: 0,
        localizedPrice: 'Free',
        periodUnit: 'day',
        periodCount: 14,
        cycles: 1,
        type: 'freeTrial',
      },
    },
    {
      id: 'com.ironvault.lifetime',
      localizedTitle: 'IronVault Lifetime',
      localizedDescription: 'One-time payment for lifetime access to all features',
      localizedPrice: '$99.99',
      price: 99.99,
      currencyCode: 'USD',
      productType: 'nonConsumable',
    },
  ];

  private mockEntitlements: Entitlements = {
    plan: 'FREE',
    isActive: true,
    isTrial: false,
    willRenew: false,
    platform: 'web',
    store: 'app_store', // Will be overridden for actual platform
  };

  async getProducts(options: GetProductsOptions): Promise<GetProductsResult> {
    console.log('[IronvaultIapWeb] getProducts:', options.productIds);
    
    const products = this.mockProducts.filter(p => 
      options.productIds.includes(p.id)
    );
    
    return { products };
  }

  async purchase(options: PurchaseOptions): Promise<PurchaseResult> {
    console.log('[IronvaultIapWeb] purchase:', options.productId);
    
    // Web should use Stripe - return error directing to web checkout
    return {
      success: false,
      error: {
        code: 'BILLING_UNAVAILABLE',
        message: 'In-app purchases are not available on web. Please use the web checkout.',
        userCancelled: false,
      },
    };
  }

  async restorePurchases(): Promise<RestoreResult> {
    console.log('[IronvaultIapWeb] restorePurchases');
    
    // Web can check Stripe subscriptions
    return {
      success: true,
      restoredCount: 0,
      entitlements: this.mockEntitlements,
    };
  }

  async getCustomerEntitlements(): Promise<EntitlementsResult> {
    console.log('[IronvaultIapWeb] getCustomerEntitlements');
    
    return {
      entitlements: this.mockEntitlements,
    };
  }

  async getActiveSubscriptionStatus(): Promise<SubscriptionStatusResult> {
    console.log('[IronvaultIapWeb] getActiveSubscriptionStatus');
    
    return {
      hasActiveSubscription: false,
    };
  }

  async getIntroOfferStatus(options: IntroOfferOptions): Promise<IntroOfferResult> {
    console.log('[IronvaultIapWeb] getIntroOfferStatus:', options.productId);
    
    const product = this.mockProducts.find(p => p.id === options.productId);
    
    return {
      eligible: true, // Always eligible in mock
      offer: product?.introOffer,
    };
  }

  async openManageSubscriptions(): Promise<void> {
    console.log('[IronvaultIapWeb] openManageSubscriptions');
    
    // On web, redirect to Stripe customer portal
    // This URL should be configured in your app
    const portalUrl = 'https://billing.stripe.com/p/login/test';
    window.open(portalUrl, '_blank');
  }
}
