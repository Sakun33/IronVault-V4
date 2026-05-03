import type {
  BillingProvider,
  BillingConfig,
  BillingPackage,
  CustomerInfo,
  PurchaseResult,
  RestoreResult,
  BillingProduct,
  BillingPeriod,
} from './billing-types';
import { OFFERING_ID, PRODUCT_IDS, ENTITLEMENT_IDS } from './billing-types';

let Purchases: any = null;
let configured = false;

async function loadPurchases(): Promise<any> {
  if (Purchases) return Purchases;
  
  try {
    // @ts-ignore - RevenueCat package may not be installed
    const module = await import('@revenuecat/purchases-capacitor');
    Purchases = module.Purchases;
    return Purchases;
  } catch (error) {
    console.error('Failed to load RevenueCat SDK:', error);
    throw new Error('RevenueCat SDK not available. Please install @revenuecat/purchases-capacitor');
  }
}

function mapPeriod(identifier: string): BillingPeriod {
  if (identifier.includes('monthly')) return 'monthly';
  if (identifier.includes('yearly') || identifier.includes('annual')) return 'yearly';
  if (identifier.includes('lifetime')) return 'lifetime';
  return 'monthly';
}

function mapRevenueCatProduct(rcProduct: any, packageType: string): BillingProduct {
  const period = mapPeriod(rcProduct.identifier);
  
  return {
    identifier: rcProduct.identifier,
    localizedTitle: rcProduct.title || rcProduct.localizedTitle || 'IronVault Pro',
    localizedDescription: rcProduct.description || rcProduct.localizedDescription || '',
    localizedPriceString: rcProduct.priceString || rcProduct.localizedPriceString || '',
    currencyCode: rcProduct.currencyCode || 'USD',
    price: rcProduct.price || 0,
    period,
    productType: period === 'lifetime' ? 'non-consumable' : 'subscription',
  };
}

function mapRevenueCatPackage(rcPackage: any): BillingPackage {
  return {
    identifier: rcPackage.identifier,
    packageType: rcPackage.packageType?.toLowerCase() || 'custom',
    product: mapRevenueCatProduct(rcPackage.product, rcPackage.packageType),
    offeringIdentifier: rcPackage.offeringIdentifier || OFFERING_ID,
  };
}

function mapRevenueCatEntitlement(rcEntitlement: any) {
  return {
    identifier: rcEntitlement.identifier,
    isActive: rcEntitlement.isActive || false,
    willRenew: rcEntitlement.willRenew || false,
    periodType: rcEntitlement.periodType || 'normal',
    latestPurchaseDate: rcEntitlement.latestPurchaseDate,
    originalPurchaseDate: rcEntitlement.originalPurchaseDate,
    expirationDate: rcEntitlement.expirationDate,
    store: rcEntitlement.store || 'unknown',
    isSandbox: rcEntitlement.isSandbox || false,
    unsubscribeDetectedAt: rcEntitlement.unsubscribeDetectedAt,
    billingIssueDetectedAt: rcEntitlement.billingIssueDetectedAt,
  };
}

function mapRevenueCatCustomerInfo(rcCustomerInfo: any): CustomerInfo {
  const entitlements: Record<string, any> = {};
  
  if (rcCustomerInfo.entitlements?.all) {
    for (const [key, value] of Object.entries(rcCustomerInfo.entitlements.all)) {
      entitlements[key] = mapRevenueCatEntitlement(value);
    }
  }
  
  return {
    activeSubscriptions: rcCustomerInfo.activeSubscriptions || [],
    allPurchasedProductIdentifiers: rcCustomerInfo.allPurchasedProductIdentifiers || [],
    entitlements,
    latestExpirationDate: rcCustomerInfo.latestExpirationDate,
    originalAppUserId: rcCustomerInfo.originalAppUserId || '',
    requestDate: rcCustomerInfo.requestDate || new Date().toISOString(),
    firstSeen: rcCustomerInfo.firstSeen || new Date().toISOString(),
    originalApplicationVersion: rcCustomerInfo.originalApplicationVersion,
    managementURL: rcCustomerInfo.managementURL,
  };
}

export class RevenueCatBillingProvider implements BillingProvider {
  private purchasesInstance: any = null;

  async configure(config: BillingConfig): Promise<void> {
    if (configured) {
      return;
    }

    try {
      const PurchasesSDK = await loadPurchases();
      
      await PurchasesSDK.configure({
        apiKey: config.apiKey,
        appUserID: config.appUserID,
        observerMode: config.observerMode || false,
        useAmazon: config.useAmazon || false,
      });

      this.purchasesInstance = PurchasesSDK;
      configured = true;
      
    } catch (error) {
      console.error('Failed to configure RevenueCat:', error);
      throw new Error(`RevenueCat configuration failed: ${error}`);
    }
  }

  isConfigured(): boolean {
    return configured;
  }

  async getPackages(): Promise<BillingPackage[]> {
    if (!configured) {
      throw new Error('RevenueCat not configured. Call configure() first.');
    }

    try {
      const offerings = await this.purchasesInstance.getOfferings();
      
      if (!offerings?.current?.availablePackages) {
        return [];
      }

      const packages = offerings.current.availablePackages.map(mapRevenueCatPackage);
      
      packages.sort((a: any, b: any) => {
        const order: Record<string, number> = { monthly: 1, annual: 2, lifetime: 3 };
        return (order[a.packageType] || 99) - (order[b.packageType] || 99);
      });

      return packages;
    } catch (error) {
      console.error('Failed to get packages:', error);
      throw new Error(`Failed to fetch packages: ${error}`);
    }
  }

  async getCustomerInfo(): Promise<CustomerInfo> {
    if (!configured) {
      throw new Error('RevenueCat not configured. Call configure() first.');
    }

    try {
      const customerInfo = await this.purchasesInstance.getCustomerInfo();
      return mapRevenueCatCustomerInfo(customerInfo.customerInfo);
    } catch (error) {
      console.error('Failed to get customer info:', error);
      throw new Error(`Failed to get customer info: ${error}`);
    }
  }

  async purchasePackage(packageIdentifier: string): Promise<PurchaseResult> {
    if (!configured) {
      throw new Error('RevenueCat not configured. Call configure() first.');
    }

    try {
      const offerings = await this.purchasesInstance.getOfferings();
      const currentOffering = offerings?.current;
      
      if (!currentOffering) {
        return {
          success: false,
          error: {
            code: 'NO_OFFERING',
            message: 'No offering available',
            userCancelled: false,
          },
        };
      }

      const pkg = currentOffering.availablePackages.find(
        (p: any) => p.identifier === packageIdentifier
      );

      if (!pkg) {
        return {
          success: false,
          error: {
            code: 'PACKAGE_NOT_FOUND',
            message: `Package ${packageIdentifier} not found`,
            userCancelled: false,
          },
        };
      }

      const result = await this.purchasesInstance.purchasePackage({ aPackage: pkg });

      if (result.customerInfo) {
        return {
          success: true,
          customerInfo: mapRevenueCatCustomerInfo(result.customerInfo),
          productIdentifier: pkg.product.identifier,
        };
      }

      return {
        success: false,
        error: {
          code: 'PURCHASE_FAILED',
          message: 'Purchase completed but no customer info returned',
          userCancelled: false,
        },
      };
    } catch (error: any) {
      console.error('Purchase failed:', error);
      
      const userCancelled = 
        error.code === '1' || 
        error.message?.toLowerCase().includes('user cancel') ||
        error.message?.toLowerCase().includes('user cancelled');

      return {
        success: false,
        error: {
          code: error.code || 'UNKNOWN',
          message: error.message || 'Purchase failed',
          userCancelled,
        },
      };
    }
  }

  async restorePurchases(): Promise<RestoreResult> {
    if (!configured) {
      throw new Error('RevenueCat not configured. Call configure() first.');
    }

    try {
      const result = await this.purchasesInstance.restorePurchases();
      
      if (result.customerInfo) {
        const customerInfo = mapRevenueCatCustomerInfo(result.customerInfo);
        const restoredCount = customerInfo.activeSubscriptions.length + 
                             customerInfo.allPurchasedProductIdentifiers.length;
        
        return {
          success: true,
          customerInfo,
          restoredCount,
        };
      }

      return {
        success: true,
        restoredCount: 0,
      };
    } catch (error: any) {
      console.error('Restore failed:', error);
      
      return {
        success: false,
        restoredCount: 0,
        error: {
          code: error.code || 'UNKNOWN',
          message: error.message || 'Restore failed',
        },
      };
    }
  }

  async syncPurchases(): Promise<CustomerInfo> {
    return this.getCustomerInfo();
  }

  async getManagementURL(): Promise<string | null> {
    if (!configured) {
      return null;
    }

    try {
      const customerInfo = await this.getCustomerInfo();
      return customerInfo.managementURL || null;
    } catch (error) {
      console.error('Failed to get management URL:', error);
      return null;
    }
  }
}

export const revenueCatProvider = new RevenueCatBillingProvider();
