/**
 * Stripe Service for Web Subscriptions
 * 
 * Handles Stripe Checkout and Customer Portal for web-only purchases.
 * iOS/Android use native in-app purchases via the IAP plugin.
 */

import type { Entitlements, PlanType } from '../entitlements/types';
import { PLAN_CAPABILITIES } from '../entitlements/types';

// Stripe product IDs (configured in Stripe Dashboard)
export const STRIPE_PRODUCTS = {
  PREMIUM_MONTHLY: 'price_ironvault_pro_monthly',
  PREMIUM_YEARLY: 'price_ironvault_pro_yearly',
  LIFETIME: 'price_ironvault_lifetime',
} as const;

export interface StripeCheckoutOptions {
  priceId: string;
  successUrl?: string;
  cancelUrl?: string;
  customerEmail?: string;
  trialDays?: number;
}

export interface StripeSubscription {
  id: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete';
  priceId: string;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialEnd?: Date;
}

export interface StripeCustomer {
  id: string;
  email: string;
  subscriptions: StripeSubscription[];
}

class StripeService {
  private publishableKey: string | null = null;
  private apiBaseUrl: string;

  constructor() {
    this.publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || null;
    this.apiBaseUrl = import.meta.env.VITE_API_URL || '/api';
  }

  /**
   * Check if Stripe is configured
   */
  isConfigured(): boolean {
    return !!this.publishableKey;
  }

  /**
   * Create a Stripe Checkout session for subscription
   */
  async createCheckoutSession(options: StripeCheckoutOptions): Promise<{ url: string }> {
    const response = await fetch(`${this.apiBaseUrl}/stripe/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        priceId: options.priceId,
        successUrl: options.successUrl || `${window.location.origin}/subscription/success`,
        cancelUrl: options.cancelUrl || `${window.location.origin}/pricing`,
        customerEmail: options.customerEmail,
        trialDays: options.trialDays ?? 14, // Default 14-day trial
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create checkout session');
    }

    return response.json();
  }

  /**
   * Redirect to Stripe Checkout
   */
  async redirectToCheckout(options: StripeCheckoutOptions): Promise<void> {
    const { url } = await this.createCheckoutSession(options);
    window.location.href = url;
  }

  /**
   * Open Stripe Customer Portal for subscription management
   */
  async openCustomerPortal(returnUrl?: string): Promise<void> {
    const response = await fetch(`${this.apiBaseUrl}/stripe/create-portal-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        returnUrl: returnUrl || window.location.href,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create portal session');
    }

    const { url } = await response.json();
    window.location.href = url;
  }

  /**
   * Get current subscription status from backend
   */
  async getSubscriptionStatus(): Promise<StripeSubscription | null> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/stripe/subscription-status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for session
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null; // No subscription
        }
        throw new Error('Failed to get subscription status');
      }

      const data = await response.json();
      return {
        ...data,
        currentPeriodEnd: new Date(data.currentPeriodEnd),
        trialEnd: data.trialEnd ? new Date(data.trialEnd) : undefined,
      };
    } catch (error) {
      console.error('[Stripe] Failed to get subscription status:', error);
      return null;
    }
  }

  /**
   * Convert Stripe subscription to app entitlements
   */
  subscriptionToEntitlements(subscription: StripeSubscription | null): Entitlements {
    if (!subscription) {
      return this.getFreeEntitlements();
    }

    const isTrialing = subscription.status === 'trialing';
    const isActive = subscription.status === 'active' || isTrialing;
    const isLifetime = subscription.priceId === STRIPE_PRODUCTS.LIFETIME;

    let plan: PlanType;
    if (isLifetime) {
      plan = 'LIFETIME';
    } else if (isTrialing) {
      plan = 'TRIAL';
    } else if (isActive) {
      plan = 'PREMIUM';
    } else {
      plan = 'FREE';
    }

    const capabilities = PLAN_CAPABILITIES[plan];

    return {
      plan,
      isTrial: isTrialing,
      trialEndsAt: subscription.trialEnd || null,
      trialUsed: isTrialing || subscription.trialEnd !== undefined,
      renewsAt: !subscription.cancelAtPeriodEnd ? subscription.currentPeriodEnd : null,
      expiresAt: subscription.currentPeriodEnd,
      status: this.mapStripeStatus(subscription.status),
      platform: 'web',
      store: 'stripe',
      capabilities,
      productId: subscription.priceId,
      originalPurchaseDate: null, // Would need to track separately
      lastVerifiedAt: new Date(),
      isOffline: false,
    };
  }

  /**
   * Get free tier entitlements
   */
  getFreeEntitlements(): Entitlements {
    return {
      plan: 'FREE',
      isTrial: false,
      trialEndsAt: null,
      trialUsed: false,
      renewsAt: null,
      expiresAt: null,
      status: 'active',
      platform: 'web',
      store: null,
      capabilities: PLAN_CAPABILITIES.FREE,
      productId: null,
      originalPurchaseDate: null,
      lastVerifiedAt: new Date(),
      isOffline: false,
    };
  }

  /**
   * Map Stripe subscription status to app status
   */
  private mapStripeStatus(stripeStatus: string): 'active' | 'expired' | 'cancelled' | 'inGrace' {
    switch (stripeStatus) {
      case 'active':
      case 'trialing':
        return 'active';
      case 'canceled':
        return 'cancelled';
      case 'past_due':
        return 'inGrace';
      default:
        return 'expired';
    }
  }

  /**
   * Cancel subscription (via portal or API)
   */
  async cancelSubscription(): Promise<void> {
    // Redirect to customer portal for cancellation
    await this.openCustomerPortal();
  }
}

export const stripeService = new StripeService();
