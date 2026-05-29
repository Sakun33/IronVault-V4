import type { CapacitorConfig } from '@capacitor/cli';

const isDev = process.env.CAPACITOR_SERVER_URL !== undefined;

const config: CapacitorConfig = {
  appId: 'app.ironvault.ios',
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
      // Use the app's launcher icon as the notification small-icon by default.
      // The previous reference to `ic_stat_icon_config_sample` pointed at a
      // resource that does not exist in this project, which can crash the
      // notification subsystem on first dispatch. Falling back to the default
      // `ic_launcher` is supported by Android 26+ and is the safe default.
      iconColor: '#4F46E5',
    },
    Preferences: {
      group: 'NativeStorage',
    },
    // @capgo/capacitor-social-login is configured programmatically via
    // SocialLogin.initialize() at runtime (see client/src/lib/google-auth.ts).
    // Android additionally needs:
    //   - SHA-1 fingerprint of the signing key registered against an
    //     Android OAuth client in Google Cloud Console.
    // iOS additionally needs:
    //   - REVERSED_CLIENT_ID URL scheme added to Info.plist so Google can
    //     redirect back into the app.
    // No static block required here.
  },
};

export default config;
