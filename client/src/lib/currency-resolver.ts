/**
 * Currency Resolution Utility
 * Resolves user currency based on device locale/region
 * Supports INR base pricing with multi-currency conversion
 */

export type SupportedCurrency = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AUD' | 'CAD';

export interface CurrencyConfig {
  code: SupportedCurrency;
  symbol: string;
  name: string;
  locale: string;
}

export interface PricePoint {
  monthly: number;
  yearly: number;
  lifetime: number;
}

// Base pricing in INR
const BASE_PRICING_INR: PricePoint = {
  monthly: 149,
  yearly: 1499,
  lifetime: 9999,
};

// Approximate conversion rates (should be fetched from API in production)
const CONVERSION_RATES: Record<SupportedCurrency, number> = {
  INR: 1,
  USD: 0.012,   // ~₹83 per $1
  EUR: 0.011,   // ~₹90 per €1
  GBP: 0.0095,  // ~₹105 per £1
  AUD: 0.018,   // ~₹55 per A$1
  CAD: 0.016,   // ~₹62 per C$1
};

// Currency configurations
const CURRENCY_CONFIGS: Record<SupportedCurrency, CurrencyConfig> = {
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', locale: 'en-IN' },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', locale: 'en-EU' },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB' },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU' },
  CAD: { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', locale: 'en-CA' },
};

// Locale to currency mapping
const LOCALE_TO_CURRENCY: Record<string, SupportedCurrency> = {
  'en-IN': 'INR',
  'hi-IN': 'INR',
  'en-US': 'USD',
  'en-GB': 'GBP',
  'en-EU': 'EUR',
  'en-AU': 'AUD',
  'en-CA': 'CAD',
  'fr-FR': 'EUR',
  'de-DE': 'EUR',
  'es-ES': 'EUR',
  'it-IT': 'EUR',
};

// Country code to currency mapping
const COUNTRY_TO_CURRENCY: Record<string, SupportedCurrency> = {
  IN: 'INR',
  US: 'USD',
  GB: 'GBP',
  UK: 'GBP',
  EU: 'EUR',
  FR: 'EUR',
  DE: 'EUR',
  ES: 'EUR',
  IT: 'EUR',
  AU: 'AUD',
  CA: 'CAD',
};

/**
 * Detect currency from device locale
 */
export function detectCurrencyFromLocale(): SupportedCurrency {
  try {
    // Try to get locale from navigator
    const locale = navigator.language || navigator.languages?.[0] || 'en-US';
    
    // Direct locale match
    if (LOCALE_TO_CURRENCY[locale]) {
      return LOCALE_TO_CURRENCY[locale];
    }
    
    // Try country code from locale (e.g., en-US -> US)
    const countryCode = locale.split('-')[1]?.toUpperCase();
    if (countryCode && COUNTRY_TO_CURRENCY[countryCode]) {
      return COUNTRY_TO_CURRENCY[countryCode];
    }
    
    // Default to USD for unknown locales
    return 'USD';
  } catch {
    return 'USD';
  }
}

/**
 * Get currency from Capacitor Device plugin (for mobile)
 */
export async function detectCurrencyFromDevice(): Promise<SupportedCurrency> {
  try {
    // Dynamic import to avoid breaking web builds
    // @ts-ignore - @capacitor/device is optional for web builds
    const { Device } = await import('@capacitor/device');
    const info = await Device.getLanguageTag();
    
    const locale = info.value || 'en-US';
    
    if (LOCALE_TO_CURRENCY[locale]) {
      return LOCALE_TO_CURRENCY[locale];
    }
    
    const countryCode = locale.split('-')[1]?.toUpperCase();
    if (countryCode && COUNTRY_TO_CURRENCY[countryCode]) {
      return COUNTRY_TO_CURRENCY[countryCode];
    }
    
    return 'USD';
  } catch {
    // Fallback to browser detection
    return detectCurrencyFromLocale();
  }
}

/**
 * Convert INR price to target currency
 */
export function convertPrice(inrAmount: number, targetCurrency: SupportedCurrency): number {
  const rate = CONVERSION_RATES[targetCurrency];
  const converted = Math.round(inrAmount * rate);
  
  // Round to sensible increments
  if (targetCurrency === 'USD' || targetCurrency === 'CAD' || targetCurrency === 'AUD') {
    // Round to .99
    return Math.floor(converted) + 0.99;
  } else if (targetCurrency === 'EUR' || targetCurrency === 'GBP') {
    // Round to .99
    return Math.floor(converted) + 0.99;
  }
  
  return converted;
}

/**
 * Get pricing for a specific currency
 */
export function getPricingForCurrency(currency: SupportedCurrency): PricePoint {
  if (currency === 'INR') {
    return BASE_PRICING_INR;
  }
  
  return {
    monthly: convertPrice(BASE_PRICING_INR.monthly, currency),
    yearly: convertPrice(BASE_PRICING_INR.yearly, currency),
    lifetime: convertPrice(BASE_PRICING_INR.lifetime, currency),
  };
}

/**
 * Format price with Intl.NumberFormat
 */
export function formatPrice(amount: number, currency: SupportedCurrency): string {
  const config = CURRENCY_CONFIGS[currency];
  
  try {
    return new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: config.code,
      minimumFractionDigits: currency === 'INR' ? 0 : 2,
      maximumFractionDigits: currency === 'INR' ? 0 : 2,
    }).format(amount);
  } catch {
    // Fallback to manual formatting
    return `${config.symbol}${amount.toFixed(currency === 'INR' ? 0 : 2)}`;
  }
}

/**
 * Get currency configuration
 */
export function getCurrencyConfig(currency: SupportedCurrency): CurrencyConfig {
  return CURRENCY_CONFIGS[currency];
}

/**
 * Get all supported currencies
 */
export function getSupportedCurrencies(): CurrencyConfig[] {
  return Object.values(CURRENCY_CONFIGS);
}

/**
 * Get Stripe Price ID for currency/interval
 * These should match your Stripe dashboard Price IDs
 */
export function getStripePriceId(
  currency: SupportedCurrency,
  interval: 'monthly' | 'yearly' | 'lifetime'
): string {
  // Format: price_{currency}_{interval}
  // Example: price_inr_monthly, price_usd_yearly, etc.
  // Replace these with actual Stripe Price IDs from your dashboard
  
  const priceIds: Record<SupportedCurrency, Record<string, string>> = {
    INR: {
      monthly: 'price_inr_monthly_ironvault_pro',
      yearly: 'price_inr_yearly_ironvault_pro',
      lifetime: 'price_inr_lifetime_ironvault_pro',
    },
    USD: {
      monthly: 'price_usd_monthly_ironvault_pro',
      yearly: 'price_usd_yearly_ironvault_pro',
      lifetime: 'price_usd_lifetime_ironvault_pro',
    },
    EUR: {
      monthly: 'price_eur_monthly_ironvault_pro',
      yearly: 'price_eur_yearly_ironvault_pro',
      lifetime: 'price_eur_lifetime_ironvault_pro',
    },
    GBP: {
      monthly: 'price_gbp_monthly_ironvault_pro',
      yearly: 'price_gbp_yearly_ironvault_pro',
      lifetime: 'price_gbp_lifetime_ironvault_pro',
    },
    AUD: {
      monthly: 'price_aud_monthly_ironvault_pro',
      yearly: 'price_aud_yearly_ironvault_pro',
      lifetime: 'price_aud_lifetime_ironvault_pro',
    },
    CAD: {
      monthly: 'price_cad_monthly_ironvault_pro',
      yearly: 'price_cad_yearly_ironvault_pro',
      lifetime: 'price_cad_lifetime_ironvault_pro',
    },
  };
  
  return priceIds[currency][interval];
}
