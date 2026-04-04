import type {
  BillingProvider,
  BillingConfig,
  BillingPackage,
  CustomerInfo,
  PurchaseResult,
  RestoreResult,
  BillingProduct,
} from './billing-types';
import { PRODUCT_IDS, ENTITLEMENT_IDS } from './billing-types';

const MOCK_PACKAGES: BillingPackage[] = [
  {
    identifier: 'monthly',
    packageType: 'monthly',
    offeringIdentifier: 'default',
    product: {
      identifier: PRODUCT_IDS.PRO_MONTHLY,
      localizedTitle: 'IronVault Pro Monthly',
      localizedDescription: 'Monthly subscription to IronVault Pro',
      localizedPriceString: '$2.99',
      currencyCode: 'USD',
      price: 2.99,
      period: 'monthly',
      productType: 'subscription',
    },
  },
  {
    identifier: 'annual',
    packageType: 'annual',
    offeringIdentifier: 'default',
    product: {
      identifier: PRODUCT_IDS.PRO_YEARLY,
      localizedTitle: 'IronVault Pro Yearly',
      localizedDescription: 'Annual subscription to IronVault Pro',
      localizedPriceString: '$29.99',
      currencyCode: 'USD',
      price: 29.99,
      period: 'yearly',
      productType: 'subscription',
    },
  },
  {
    identifier: 'lifetime',
    packageType: 'lifetime',
    offeringIdentifier: 'default',
    product: {
      identifier: PRODUCT_IDS.LIFETIME,
      localizedTitle: 'IronVault Lifetime',
      localizedDescription: 'One-time purchase for lifetime access',
      localizedPriceString: '$99.99',
      currencyCode: 'USD',
      price: 99.99,
      period: 'lifetime',
      productType: 'non-consumable',
    },
  },
];

const MOCK_CUSTOMER_INFO: CustomerInfo = {
  activeSubscriptions: [],
  allPurchasedProductIdentifiers: [],
  entitlements: {},
  originalAppUserId: 'web-user',
  requestDate: new Date().toISOString(),
  firstSeen: new Date().toISOString(),
};

export class WebBillingProvider implements BillingProvider {
  private configured = false;
  private customerInfo: CustomerInfo = { ...MOCK_CUSTOMER_INFO };

  async configure(config: BillingConfig): Promise<void> {
    console.log('Web billing provider configured (mock mode)');
    this.configured = true;
    
    const stored = localStorage.getItem('web_customer_info');
    if (stored) {
      try {
        this.customerInfo = JSON.parse(stored);
      } catch (error) {
        console.error('Failed to parse stored customer info:', error);
      }
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async getPackages(): Promise<BillingPackage[]> {
    if (!this.configured) {
      throw new Error('Web billing not configured. Call configure() first.');
    }
    
    return [...MOCK_PACKAGES];
  }

  async getCustomerInfo(): Promise<CustomerInfo> {
    if (!this.configured) {
      throw new Error('Web billing not configured. Call configure() first.');
    }
    
    return { ...this.customerInfo };
  }

  async purchasePackage(packageIdentifier: string): Promise<PurchaseResult> {
    if (!this.configured) {
      throw new Error('Web billing not configured. Call configure() first.');
    }

    console.log('Web purchase (mock) - redirecting to Stripe or showing message');
    
    return {
      success: false,
      error: {
        code: 'WEB_NOT_SUPPORTED',
        message: 'In-app purchases are only available on iOS and Android apps. Please download the mobile app to subscribe.',
        userCancelled: true,
      },
    };
  }

  async restorePurchases(): Promise<RestoreResult> {
    if (!this.configured) {
      throw new Error('Web billing not configured. Call configure() first.');
    }

    return {
      success: true,
      customerInfo: { ...this.customerInfo },
      restoredCount: 0,
    };
  }

  async syncPurchases(): Promise<CustomerInfo> {
    return this.getCustomerInfo();
  }

  async getManagementURL(): Promise<string | null> {
    return null;
  }

  setMockEntitlement(entitlementId: string, isActive: boolean) {
    if (isActive) {
      this.customerInfo.entitlements[entitlementId] = {
        identifier: entitlementId,
        isActive: true,
        willRenew: true,
        store: 'promotional',
        isSandbox: true,
        latestPurchaseDate: new Date().toISOString(),
        originalPurchaseDate: new Date().toISOString(),
      };
    } else {
      delete this.customerInfo.entitlements[entitlementId];
    }
    
    localStorage.setItem('web_customer_info', JSON.stringify(this.customerInfo));
  }
}

export const webBillingProvider = new WebBillingProvider();
