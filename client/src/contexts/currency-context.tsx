import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';

export interface CurrencySettings {
  baseCurrency: string;
  exchangeRates: { [key: string]: number };
}

const CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', flag: '🇨🇦' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', flag: '🇨🇭' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', flag: '🇨🇳' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', flag: '🇧🇷' },
  { code: 'MXN', name: 'Mexican Peso', symbol: '$', flag: '🇲🇽' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', flag: '🇰🇷' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', flag: '🇸🇬' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', flag: '🇭🇰' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', flag: '🇳🇿' },
];

// Country code to currency mapping
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  US: 'USD', USA: 'USD',
  IN: 'INR', IND: 'INR', India: 'INR',
  GB: 'GBP', UK: 'GBP', 'United Kingdom': 'GBP',
  AU: 'AUD', Australia: 'AUD',
  CA: 'CAD', Canada: 'CAD',
  JP: 'JPY', Japan: 'JPY',
  CN: 'CNY', China: 'CNY',
  BR: 'BRL', Brazil: 'BRL',
  MX: 'MXN', Mexico: 'MXN',
  KR: 'KRW', 'South Korea': 'KRW',
  SG: 'SGD', Singapore: 'SGD',
  HK: 'HKD', 'Hong Kong': 'HKD',
  NZ: 'NZD', 'New Zealand': 'NZD',
  CH: 'CHF', Switzerland: 'CHF',
  DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR', PT: 'EUR', IE: 'EUR', FI: 'EUR',
  Germany: 'EUR', France: 'EUR', Italy: 'EUR', Spain: 'EUR', Netherlands: 'EUR',
};

interface CurrencyContextType {
  currency: string;
  setCurrency: (currency: string) => void;
  getCurrencySymbol: (code?: string) => string;
  getCurrencyFlag: (code?: string) => string;
  formatCurrency: (amount: number, code?: string, showSymbol?: boolean) => string;
  convertCurrency: (amount: number, fromCode: string, toCode?: string) => number;
  currencies: typeof CURRENCIES;
  isLoading: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<string>('INR'); // Default to INR as requested
  const [isLoading, setIsLoading] = useState(false);

  // Enhanced exchange rates (more realistic rates)
  const exchangeRates: { [key: string]: number } = {
    USD: 1,
    EUR: 0.85,
    GBP: 0.73,
    JPY: 110,
    CAD: 1.25,
    AUD: 1.35,
    CHF: 0.92,
    CNY: 6.45,
    INR: 83.5, // Updated INR rate
    BRL: 5.2,
    MXN: 20,
    KRW: 1180,
    SGD: 1.35,
    HKD: 7.8,
    NZD: 1.45,
  };

  // Load currency from localStorage on mount, or default based on customer's country
  useEffect(() => {
    // One-time migration: clear stale 'USD' default set before INR was the default
    if (!localStorage.getItem('securevault-currency-v2')) {
      const old = localStorage.getItem('securevault-currency');
      if (old === 'USD') localStorage.removeItem('securevault-currency');
      localStorage.setItem('securevault-currency-v2', '1');
    }
    const savedCurrency = localStorage.getItem('securevault-currency');
    if (savedCurrency && CURRENCIES.find(c => c.code === savedCurrency)) {
      setCurrency(savedCurrency);
    } else {
      // Try to get currency from customer profile's country
      try {
        const customerProfile = localStorage.getItem('customerProfile');
        if (customerProfile) {
          const profile = JSON.parse(customerProfile);
          const country = profile.country;
          if (country && COUNTRY_TO_CURRENCY[country]) {
            const defaultCurrency = COUNTRY_TO_CURRENCY[country];
            setCurrency(defaultCurrency);
            localStorage.setItem('securevault-currency', defaultCurrency);
          }
        }
      } catch (error) {
        console.error('Error reading customer profile for currency:', error);
      }
    }
  }, []);

  // Save currency to localStorage when changed
  useEffect(() => {
    localStorage.setItem('securevault-currency', currency);
  }, [currency]);

  const getCurrencySymbol = (code?: string) => {
    const targetCode = code || currency;
    const currencyInfo = CURRENCIES.find(c => c.code === targetCode);
    return currencyInfo?.symbol || '₹';
  };

  const getCurrencyFlag = (code?: string) => {
    const targetCode = code || currency;
    const currencyInfo = CURRENCIES.find(c => c.code === targetCode);
    return currencyInfo?.flag || '🇮🇳';
  };

  const formatCurrency = (amount: number, code?: string, showSymbol: boolean = true) => {
    const targetCode = code || currency;
    const symbol = getCurrencySymbol(targetCode);
    const convertedAmount = convertCurrency(amount, code || 'USD', targetCode);
    
    // Format based on currency
    if (targetCode === 'JPY' || targetCode === 'KRW') {
      return showSymbol ? `${symbol}${Math.round(convertedAmount).toLocaleString()}` : `${Math.round(convertedAmount).toLocaleString()}`;
    }
    
    // For most currencies, show 2 decimal places
    const formattedAmount = convertedAmount.toFixed(2);
    return showSymbol ? `${symbol}${formattedAmount}` : formattedAmount;
  };

  const convertCurrency = (amount: number, fromCode: string, toCode?: string) => {
    const targetCode = toCode || currency;
    if (fromCode === targetCode) return amount;
    
    const fromRate = exchangeRates[fromCode] || 1;
    const toRate = exchangeRates[targetCode] || 1;
    
    // Convert to USD first, then to target currency
    const usdAmount = amount / fromRate;
    return usdAmount * toRate;
  };

  return (
    <CurrencyContext.Provider value={{
      currency,
      setCurrency,
      getCurrencySymbol,
      getCurrencyFlag,
      formatCurrency,
      convertCurrency,
      currencies: CURRENCIES,
      isLoading,
    }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
