export interface PricingTier {
  id: string;
  name: string;
  description: string;
  price: {
    monthly: number;
    yearly: number;
    lifetime?: number;
  };
  currency: string;
  features: string[];
  limits: {
    passwords: number;
    subscriptions: number;
    notes: number;
    expenses: number;
    reminders: number;
    bankStatements: number;
    investments: number;
    vaults: number;
    documents: number;
  };
  trialDays?: number;
  popular?: boolean;
  color: string;
}

export interface SubscriptionPlan {
  id: string;
  tierId: string;
  userId: string;
  status: 'active' | 'cancelled' | 'expired' | 'trial';
  startDate: Date;
  endDate: Date;
  billingCycle: 'monthly' | 'yearly';
  amount: number;
  currency: string;
  paymentMethod?: string;
  lastPaymentDate?: Date;
  nextPaymentDate?: Date;
  trialEndsAt?: Date;
  cancelledAt?: Date;
}

export interface LicenseInfo {
  tier: 'free' | 'pro' | 'family' | 'monthly' | 'yearly' | 'lifetime';
  status: 'active' | 'expired' | 'cancelled' | 'trial';
  startDate: Date;
  endDate?: Date;
  billingCycle?: 'monthly' | 'yearly' | 'lifetime';
  amount?: number;
  currency?: string;
  features: string[];
  limits: {
    passwords: number;
    subscriptions: number;
    notes: number;
    expenses: number;
    reminders: number;
    bankStatements: number;
    investments: number;
    vaults: number;
    documents: number;
  };
  trialActive?: boolean;
  trialEndsAt?: Date;
  trialUsed?: boolean;
  lastVerifiedAt?: string;
}

// Base pricing in INR - will be converted to user's currency
// Monthly: ₹149, Yearly: ₹1,499
const BASE_PRICING_TIERS_INR = {
  monthly: 149,
  yearly: 1499,
  lifetime: 9999, // Lifetime one-time payment
};

// Convert INR to USD for base pricing
const INR_TO_USD = 1 / 83.5; // 1 USD = 83.5 INR
const BASE_PRICING_TIERS: Omit<PricingTier, 'currency'>[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Basic features to get started',
    price: {
      monthly: 0,
      yearly: 0,
    },
    features: [
      '1 Vault per Device',
      'Password Management (50)',
      'Subscription Tracking (10)',
      'Notes (10)',
      'Reminders (10)',
      'Documents (5)',
      'Local Storage Only',
      'Basic Support',
    ],
    limits: {
      passwords: 50,
      subscriptions: 10,
      notes: 10,
      expenses: 0,
      reminders: 10,
      bankStatements: 0,
      investments: 0,
      vaults: 1,
      documents: 5,
    },
    color: 'gray',
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Full access with 14-day free trial',
    price: {
      monthly: BASE_PRICING_TIERS_INR.monthly * INR_TO_USD, // ₹199 -> ~$2.38 USD
      yearly: BASE_PRICING_TIERS_INR.yearly * INR_TO_USD,   // ₹1,999 -> ~$23.94 USD
    },
    features: [
      '14-Day Free Trial',
      'Up to 5 Vaults per Device',
      'Unlimited Passwords',
      'Unlimited Subscriptions',
      'Unlimited Notes',
      'Unlimited Reminders',
      'Unlimited Documents',
      'Document Scanner',
      'Expense Tracking',
      'Bank Statement Import',
      'Spending Analytics',
      'Investment Tracking',
      'Biometric Authentication',
      'Priority Support',
      'Export/Import Tools',
    ],
    limits: {
      passwords: -1, // unlimited
      subscriptions: -1,
      notes: -1,
      expenses: -1,
      reminders: -1,
      bankStatements: -1,
      investments: -1,
      vaults: 5,
      documents: -1,
    },
    trialDays: 14,
    popular: true,
    color: 'blue',
  },
  {
    id: 'lifetime',
    name: 'Lifetime',
    description: 'One-time payment, lifetime access',
    price: {
      monthly: BASE_PRICING_TIERS_INR.lifetime * INR_TO_USD, // ₹9,999 -> ~$119.74 USD
      yearly: BASE_PRICING_TIERS_INR.lifetime * INR_TO_USD,
      lifetime: BASE_PRICING_TIERS_INR.lifetime * INR_TO_USD,
    },
    features: [
      'Everything in Pro',
      'Up to 5 Vaults per Device',
      'Lifetime Access',
      'No Recurring Payments',
      'Future Updates Included',
      'Premium Support',
      'Early Access to New Features',
    ],
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
    color: 'purple',
  },
];

// Currency conversion rates (USD as base currency - matching currency context)
const CURRENCY_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.85,
  GBP: 0.73,
  JPY: 110,
  CAD: 1.25,
  AUD: 1.35,
  CHF: 0.92,
  CNY: 6.45,
  INR: 83.5, // Updated to match currency context
  BRL: 5.2,
  MXN: 20,
  KRW: 1180,
  SGD: 1.35,
  HKD: 7.8,
  NZD: 1.45,
};

export class PricingService {
  static getTiersForCurrency(currency: string = 'USD'): PricingTier[] {
    const rate = CURRENCY_RATES[currency] || 1.0;
    
    return BASE_PRICING_TIERS.map(tier => ({
      ...tier,
      currency,
      price: {
        monthly: Math.round(tier.price.monthly * rate),
        yearly: Math.round(tier.price.yearly * rate),
        ...(tier.price.lifetime !== undefined && { lifetime: Math.round(tier.price.lifetime * rate) }),
      },
    }));
  }

  static getTierById(tierId: string, currency: string = 'USD'): PricingTier | undefined {
    return this.getTiersForCurrency(currency).find(tier => tier.id === tierId);
  }

  static getAllTiers(currency: string = 'USD'): PricingTier[] {
    return this.getTiersForCurrency(currency);
  }

  static calculateSavings(monthlyPrice: number, yearlyPrice: number): number {
    const monthlyYearlyTotal = monthlyPrice * 12;
    const savings = monthlyYearlyTotal - yearlyPrice;
    return Math.round((savings / monthlyYearlyTotal) * 100);
  }

  static formatPrice(amount: number, currency: string = 'USD'): string {
    // Get currency symbol
    const currencySymbols: Record<string, string> = {
      USD: '$', EUR: '€', GBP: '£', JPY: '¥', CAD: 'C$', AUD: 'A$',
      CHF: 'CHF', CNY: '¥', INR: '₹', BRL: 'R$', MXN: '$', KRW: '₩',
      SGD: 'S$', HKD: 'HK$', NZD: 'NZ$',
    };
    
    const symbol = currencySymbols[currency] || currency;
    // Round to nearest integer
    const rounded = Math.round(amount);
    
    // Format with locale-specific number formatting
    return `${symbol}${rounded.toLocaleString()}`;
  }

  static getFeatureComparison(currency: string = 'USD'): { feature: string; tiers: { [key: string]: boolean | number | string } }[] {
    const tiers = this.getTiersForCurrency(currency);
    
    return [
      {
        feature: 'Vaults per Device',
        tiers: {
          free: '1',
          pro: '5',
          lifetime: '5',
        },
      },
      {
        feature: 'Passwords',
        tiers: {
          free: '50',
          pro: 'Unlimited',
          lifetime: 'Unlimited',
        },
      },
      {
        feature: 'Documents',
        tiers: {
          free: '5',
          pro: 'Unlimited',
          lifetime: 'Unlimited',
        },
      },
      {
        feature: 'Document Scanner',
        tiers: {
          free: false,
          pro: true,
          lifetime: true,
        },
      },
      {
        feature: 'Subscriptions',
        tiers: {
          free: '10',
          pro: 'Unlimited',
          lifetime: 'Unlimited',
        },
      },
      {
        feature: 'Notes',
        tiers: {
          free: '10',
          pro: 'Unlimited',
          lifetime: 'Unlimited',
        },
      },
      {
        feature: 'Reminders',
        tiers: {
          free: '10',
          pro: 'Unlimited',
          lifetime: 'Unlimited',
        },
      },
      {
        feature: 'Expense Tracking',
        tiers: {
          free: false,
          pro: true,
          lifetime: true,
        },
      },
      {
        feature: 'Bank Statement Import',
        tiers: {
          free: false,
          pro: true,
          lifetime: true,
        },
      },
      {
        feature: 'Spending Analytics',
        tiers: {
          free: false,
          pro: true,
          lifetime: true,
        },
      },
      {
        feature: 'Investment Tracking',
        tiers: {
          free: false,
          pro: true,
          lifetime: true,
        },
      },
      {
        feature: 'Biometric Authentication',
        tiers: {
          free: false,
          pro: true,
          lifetime: true,
        },
      },
      {
        feature: '14-Day Free Trial',
        tiers: {
          free: false,
          pro: true,
          lifetime: false,
        },
      },
      {
        feature: 'Priority Support',
        tiers: {
          free: false,
          pro: true,
          lifetime: true,
        },
      },
    ];
  }

  static validateUpgrade(currentTier: string, targetTier: string): boolean {
    const tierOrder = ['free', 'pro', 'lifetime'];
    const currentIndex = tierOrder.indexOf(currentTier);
    const targetIndex = tierOrder.indexOf(targetTier);
    
    return targetIndex > currentIndex;
  }

  static getUpgradeOptions(currentTier: string, currency: string = 'USD'): PricingTier[] {
    const tierOrder = ['free', 'pro', 'lifetime'];
    const currentIndex = tierOrder.indexOf(currentTier);
    
    return this.getTiersForCurrency(currency).filter(tier => {
      const tierIndex = tierOrder.indexOf(tier.id);
      return tierIndex > currentIndex;
    });
  }

  static checkFeatureAccess(license: LicenseInfo, feature: string): boolean {
    switch (feature) {
      case 'expenses':
        return license.limits.expenses !== 0;
      case 'bank_statements':
      case 'bankStatements':
        return license.limits.bankStatements !== 0;
      case 'investments':
        return license.limits.investments !== 0;
      case 'documents':
        return license.limits.documents !== 0;
      case 'scanner':
      case 'document_scanner':
        return license.tier !== 'free';
      case 'spending_analytics':
        return license.tier !== 'free';
      case 'cloud_backup':
        return license.tier !== 'free';
      case 'advanced_analytics':
        return license.tier !== 'free';
      case 'biometric':
      case 'biometric_auth':
        return license.tier !== 'free';
      case 'priority_support':
        return license.tier !== 'free';
      case 'multi_vault':
        return license.limits.vaults > 1;
      default:
        return true;
    }
  }

  static checkLimit(license: LicenseInfo, section: string, currentCount: number): boolean {
    const limits = license.limits;
    
    switch (section) {
      case 'passwords':
        return limits.passwords === -1 || currentCount < limits.passwords;
      case 'subscriptions':
        return limits.subscriptions === -1 || currentCount < limits.subscriptions;
      case 'notes':
        return limits.notes === -1 || currentCount < limits.notes;
      case 'expenses':
        return limits.expenses === -1 || currentCount < limits.expenses;
      case 'reminders':
        return limits.reminders === -1 || currentCount < limits.reminders;
      case 'bankStatements':
        return limits.bankStatements === -1 || currentCount < limits.bankStatements;
      case 'investments':
        return limits.investments === -1 || currentCount < limits.investments;
      case 'vaults':
        return limits.vaults === -1 || currentCount < limits.vaults;
      case 'documents':
        return limits.documents === -1 || currentCount < limits.documents;
      default:
        return true;
    }
  }

  static getDefaultLicense(): LicenseInfo {
    return {
      tier: 'free',
      status: 'active',
      startDate: new Date(),
      features: ['passwords', 'subscriptions', 'notes', 'reminders', 'documents'],
      limits: {
        passwords: 50,
        subscriptions: 10,
        notes: 10,
        expenses: 0,
        reminders: 10,
        bankStatements: 0,
        investments: 0,
        vaults: 1,
        documents: 5,
      },
      trialActive: false,
    };
  }

  static getTrialLicense(): LicenseInfo {
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);
    
    return {
      tier: 'pro',
      status: 'trial',
      startDate: new Date(),
      endDate: trialEndsAt,
      features: ['passwords', 'subscriptions', 'notes', 'reminders', 'expenses', 'bankStatements', 'investments', 'documents', 'scanner'],
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
      trialActive: true,
      trialEndsAt,
    };
  }
}
