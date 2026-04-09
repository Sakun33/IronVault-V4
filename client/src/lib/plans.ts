/**
 * Canonical plan definitions — single source of truth for all pricing UI.
 *
 * Import from here in: landing.tsx, pricing.tsx, signup.tsx, profile.tsx,
 * customer-info-dialog.tsx, and any other place that shows plan names or prices.
 *
 * Canonical plan set (4 plans):
 *   1. Free
 *   2. Pro Monthly
 *   3. Pro Family   (coming soon)
 *   4. Lifetime     (single user, one-time)
 */

export type PlanId = 'free' | 'pro' | 'family' | 'lifetime';

export interface Plan {
  /** Machine-readable id — matches the license `tier` field */
  id: PlanId;
  /** Display name shown in all UI */
  name: string;
  /** Short subtitle for plan cards */
  description: string;
  /** Monthly INR price (null = free) */
  priceMonthly: number | null;
  /** Yearly INR price (null = no yearly option) */
  priceYearly: number | null;
  /** One-time INR price (only for lifetime) */
  priceOneTime: number | null;
  /** Number of seats (null = single user) */
  seats: number | null;
  /** Max local vaults allowed for this plan (-1 = unlimited) */
  localVaultLimit: number;
  /** Whether this plan is available for purchase right now */
  available: boolean;
  /** Optional badge text */
  badge: string | null;
  features: string[];
  /** Features NOT included (shown with ✗ on Free card) */
  notIncluded?: string[];
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'All the essentials, free forever.',
    priceMonthly: 0,
    priceYearly: 0,
    priceOneTime: null,
    seats: 1,
    localVaultLimit: 1,
    available: true,
    badge: null,
    features: [
      '50 passwords',
      '10 subscriptions',
      '10 secure notes',
      '10 reminders',
      '5 documents',
      '1 vault per device',
      'Local storage only',
      'Basic support',
    ],
    notIncluded: ['Cloud sync', 'Bank statement import', 'Expense tracking'],
  },
  {
    id: 'pro',
    name: 'Pro Monthly',
    description: 'Full access. 14-day free trial.',
    priceMonthly: 149,
    priceYearly: 1499,
    priceOneTime: null,
    seats: 1,
    localVaultLimit: 5,
    available: true,
    badge: 'Most Popular',
    features: [
      '14-day free trial',
      'Unlimited passwords',
      'Unlimited subscriptions',
      'Unlimited notes & reminders',
      'Unlimited documents',
      'Up to 5 vaults per device',
      'Bank statement import (OCR)',
      'Expense tracking & analytics',
      'Investment tracking',
      'Biometric authentication',
      'Cross-device cloud sync',
      'Priority support',
    ],
  },
  {
    id: 'family',
    name: 'Pro Family',
    description: 'Everything in Pro, for the whole family.',
    priceMonthly: 299,
    priceYearly: 2999,
    priceOneTime: null,
    seats: 6,
    localVaultLimit: 5,
    available: false, // Coming soon
    badge: 'Coming Soon',
    features: [
      'Everything in Pro',
      'Up to 6 family members',
      'Shared family vault',
      'Individual private vaults',
      'Family spending dashboard',
      'Priority support',
    ],
  },
  {
    id: 'lifetime',
    name: 'Lifetime',
    description: 'Pay once, use forever. No recurring fees.',
    priceMonthly: null,
    priceYearly: null,
    priceOneTime: 9999,
    seats: 1,
    localVaultLimit: 5,
    available: true,
    badge: null,
    features: [
      'Everything in Pro',
      'Up to 5 vaults per device',
      'Lifetime access',
      'No recurring payments',
      'All future updates',
      'Early access to new features',
      'Premium support',
    ],
  },
];

/** Lookup a plan by id — returns undefined if not found */
export function getPlan(id: PlanId | string): Plan | undefined {
  return PLANS.find(p => p.id === id);
}

/** Format a price in INR for display */
export function formatINR(amount: number): string {
  if (amount === 0) return '₹0';
  return `₹${amount.toLocaleString('en-IN')}`;
}

/** Return the display price string for a plan (e.g. "₹149/mo", "₹9,999", "Free") */
export function planPriceLabel(plan: Plan, billing: 'monthly' | 'yearly' = 'monthly'): string {
  if (plan.priceOneTime !== null) {
    return `${formatINR(plan.priceOneTime)} one-time`;
  }
  if (plan.priceMonthly === 0) return 'Free forever';
  if (plan.priceMonthly === null) return '—';
  if (billing === 'yearly' && plan.priceYearly !== null) {
    return `${formatINR(plan.priceYearly)}/yr`;
  }
  return `${formatINR(plan.priceMonthly)}/mo`;
}
