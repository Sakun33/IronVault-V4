//
//  WidgetBridgePlugin.m
//  App
//
//  Capacitor needs an Objective-C macro registry so the bridge can wire
//  the JS plugin name "WidgetBridge" to the Swift @objc(WidgetBridgePlugin)
//  class. The .m file lives next to the .swift file in the App target —
//  it is NOT part of the widget or AutoFill extension targets.
//

#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(WidgetBridgePlugin, "WidgetBridge",
    CAP_PLUGIN_METHOD(setItem,                   CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getItem,                   CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(removeItem,                CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(reloadAll,                 CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(syncCredentialIdentities,  CAPPluginReturnPromise);
)
