import type {
  BillingProvider,
  BillingPackage,
  CustomerInfo,
  PurchaseResult,
  RestoreResult,
} from './billing-types';
import { isNativePlatform, getPlatform } from './platform';
import { webBillingProvider } from './billing-web';
import { Preferences } from '@capacitor/preferences';

class BillingService {
  private provider: BillingProvider | null = null;
  private configuring = false;
  private configurePromise: Promise<void> | null = null;

  async initialize(appUserID?: string): Promise<void> {
    if (this.provider?.isConfigured()) {
      return;
    }

    if (this.configuring && this.configurePromise) {
      return this.configurePromise;
    }

    this.configuring = true;

    this.configurePromise = this._doInitialize(appUserID);
    
    try {
      await this.configurePromise;
    } finally {
      this.configuring = false;
      this.configurePromise = null;
    }
  }

  private async _doInitialize(appUserID?: string): Promise<void> {
    const platform = getPlatform();
    
    if (isNativePlatform()) {
      // Native platforms use RevenueCat - dynamically import at runtime only
      // This prevents Vite from bundling the native SDK for web builds
      try {
        // Use eval to prevent Vite static analysis from bundling the native module
        const modulePath = './billing-native-revenuecat';
        const nativeModule = await (Function('p', 'return import(p)')(modulePath));
        this.provider = nativeModule.revenueCatProvider;
        
        const apiKey = platform === 'ios' 
          ? import.meta.env.VITE_REVENUECAT_API_KEY_IOS
          : import.meta.env.VITE_REVENUECAT_API_KEY_ANDROID;

        if (!apiKey) {
          console.error(`RevenueCat API key not found for ${platform}`);
          throw new Error(`RevenueCat API key not configured for ${platform}`);
        }

        if (this.provider) {
          await this.provider.configure({
            apiKey,
            appUserID: appUserID || await this.generateAnonymousUserId(),
            observerMode: false,
          });
        }
      } catch (error) {
        console.error('Failed to load native billing provider:', error);
        // Fallback to web billing if native fails
        this.provider = webBillingProvider;
        await this.provider.configure({
          apiKey: 'web',
          appUserID: appUserID || 'web-user',
        });
      }
    } else {
      this.provider = webBillingProvider;
      await this.provider.configure({
        apiKey: 'web',
        appUserID: appUserID || 'web-user',
      });
    }
  }

  private async generateAnonymousUserId(): Promise<string> {
    const { value } = await Preferences.get({ key: 'billing_anonymous_user_id' });

    if (value) {
      return value;
    }

    const userId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await Preferences.set({ key: 'billing_anonymous_user_id', value: userId });
    return userId;
  }

  async getPackages(): Promise<BillingPackage[]> {
    await this.ensureInitialized();
    return this.provider!.getPackages();
  }

  async getCustomerInfo(): Promise<CustomerInfo> {
    await this.ensureInitialized();
    return this.provider!.getCustomerInfo();
  }

  async purchasePackage(packageIdentifier: string): Promise<PurchaseResult> {
    await this.ensureInitialized();
    return this.provider!.purchasePackage(packageIdentifier);
  }

  async restorePurchases(): Promise<RestoreResult> {
    await this.ensureInitialized();
    return this.provider!.restorePurchases();
  }

  async syncPurchases(): Promise<CustomerInfo> {
    await this.ensureInitialized();
    return this.provider!.syncPurchases();
  }

  async getManagementURL(): Promise<string | null> {
    await this.ensureInitialized();
    return this.provider!.getManagementURL();
  }

  async openManagementURL(productId?: string): Promise<boolean> {
    const platform = getPlatform();
    
    try {
      if (platform === 'ios') {
        const deepLink = 'itms-apps://apps.apple.com/account/subscriptions';
        
        try {
          const { App } = await import('@capacitor/app');
          // @ts-ignore - openUrl may not be available in Capacitor 7
          await App.openUrl({ url: deepLink });
          return true;
        } catch (error) {
          const fallbackURL = 'https://apps.apple.com/account/subscriptions';
          const { Browser } = await import('@capacitor/browser');
          await Browser.open({ url: fallbackURL });
          return true;
        }
      } else if (platform === 'android') {
        let url = 'https://play.google.com/store/account/subscriptions';
        
        if (productId && productId.includes('monthly')) {
          url = 'https://play.google.com/store/account/subscriptions?sku=com.ironvault.pro.monthly&package=com.ironvault.app';
        } else if (productId && productId.includes('yearly')) {
          url = 'https://play.google.com/store/account/subscriptions?sku=com.ironvault.pro.yearly&package=com.ironvault.app';
        }
        
        const { Browser } = await import('@capacitor/browser');
        await Browser.open({ url });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to open management URL:', error);
      return false;
    }
  }

  isConfigured(): boolean {
    return this.provider?.isConfigured() || false;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.provider?.isConfigured()) {
      await this.initialize();
    }
  }

  computeSavings(monthlyPrice: number, yearlyPrice: number): number | null {
    if (!monthlyPrice || !yearlyPrice || monthlyPrice <= 0 || yearlyPrice <= 0) {
      return null;
    }

    const annualEquivalent = monthlyPrice * 12;
    const savings = Math.round(((annualEquivalent - yearlyPrice) / annualEquivalent) * 100);
    
    return savings > 0 ? savings : null;
  }
}

export const billingService = new BillingService();
