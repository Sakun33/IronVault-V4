import type { CapacitorConfig } from '@capacitor/cli';

const isDev = process.env.CAPACITOR_SERVER_URL !== undefined;

const config: CapacitorConfig = {
  appId: 'com.ironvault.app',
  appName: 'IronVault',
  webDir: 'dist/public',
  ios: {
    // 'never' tells WKWebView NOT to auto-adjust content insets so the
    // page is fully edge-to-edge. We control top/bottom spacing with
    // CSS `env(safe-area-inset-*)` values for predictable layout on
    // notch / Dynamic Island devices.
    contentInset: 'never',
    allowsLinkPreview: false,
    scrollEnabled: true,
    limitsNavigationsToAppBoundDomains: false,
    preferredContentMode: 'mobile',
  },
  android: {
    allowMixedContent: false,
  },
  server: isDev ? {
    url: process.env.CAPACITOR_SERVER_URL,
    cleartext: true,
    iosScheme: 'capacitor',
    androidScheme: 'https',
  } : {
    iosScheme: 'capacitor',
    androidScheme: 'https',
    cleartext: false,
    hostname: 'localhost',
  },
  plugins: {
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
      style: 'dark',
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#4F46E5',
    },
    Preferences: {
      group: 'NativeStorage',
    },
  },
};

export default config;
