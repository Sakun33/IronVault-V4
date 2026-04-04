#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Define the plugin using the CAP_PLUGIN Macro, and
// each method the plugin supports using the CAP_PLUGIN_METHOD macro.
CAP_PLUGIN(IronvaultIapPlugin, "IronvaultIap",
           CAP_PLUGIN_METHOD(getProducts, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(purchase, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(restorePurchases, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getCustomerEntitlements, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getActiveSubscriptionStatus, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getIntroOfferStatus, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(openManageSubscriptions, CAPPluginReturnPromise);
)
