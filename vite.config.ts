import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from 'url';

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Virtual module plugin for native-only packages not available in web/dev
function nativeExternalsPlugin() {
  const nativePackages = ['@revenuecat/purchases-capacitor'];
  return {
    name: 'native-externals',
    resolveId(id: string) {
      if (nativePackages.some(pkg => id === pkg || id.startsWith(pkg + '/'))) {
        return id;
      }
    },
    load(id: string) {
      if (nativePackages.some(pkg => id === pkg || id.startsWith(pkg + '/'))) {
        return 'export default {}; export const Purchases = {};';
      }
    },
  };
}

export default defineConfig({
  plugins: [
    nativeExternalsPlugin(),
    // Disable Fast Refresh (Hot Module Replacement) is not needed here; default
    // settings are sufficient.
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  root: path.resolve(__dirname, "client"),
  // Load .env files from the project root (not from client/)
  envDir: path.resolve(__dirname),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    // Hidden sourcemaps: emitted to disk so server-side error reporters
    // can resolve stack traces, but `//# sourceMappingURL` is omitted so
    // browsers don't expose them publicly. Lighthouse warns when
    // sourcemaps aren't generated for production builds — this also
    // fixes that audit.
    sourcemap: 'hidden',
    // esbuild is the default minifier; explicitly opt in so it stays
    // documented. Console statements are stripped in prod via the
    // `esbuild.drop` option below — keeps `[CLOUD-PUSH]`-style debug
    // logs out of release bundles.
    minify: 'esbuild',
    // The main app shell was hitting ~1.1 MB raw / ~315 KB gzipped, which made
    // the initial paint feel sluggish on slower networks. Splitting the heavy
    // long-lived vendor libs into their own chunks lets the browser cache them
    // across deploys and keeps the page-level lazy chunks tiny.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      external: ['@revenuecat/purchases-capacitor'],
      output: {
        // Tighter chunk splits — every heavy library lives in its own
        // chunk so a route that doesn't use it never downloads it.
        // The landing page in particular only needs react + router +
        // its own page chunk. Motion is now CSS-only on landing, so
        // `vendor-motion` is fetched only when an authenticated page
        // (which uses framer-motion for transitions) opens.
        manualChunks(id: string) {
          // Manual chunking with a function so we can split heavy
          // first-party files (storage.ts, vault-manager.ts) out of
          // the main bundle in addition to the third-party vendor
          // splits below. The main entry was 729 KB pre-split — most
          // of it was the encrypted-storage layer, which the LANDING
          // page never touches.
          if (id.includes('node_modules')) {
            // ORDER MATTERS — `lucide-react` etc. have "react" in their
            // package name, so the icon/motion/etc. checks must run
            // BEFORE the generic `react`/`react-dom` catch-all.
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('framer-motion') || id.includes('/motion/')) return 'vendor-motion';
            if (id.includes('wouter')) return 'vendor-router';
            if (id.includes('zod')) return 'vendor-zod';
            if (id.includes('dompurify')) return 'vendor-dompurify';
            if (id.includes('date-fns')) return 'vendor-datefns';
            if (id.includes('otplib') || id.includes('qrcode')) return 'vendor-totp';
            if (id.includes('recharts')) return 'vendor-recharts';
            if (id.includes('@radix-ui')) return 'vendor-radix';
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/scheduler/') ||
              id.includes('/react@') ||
              id.includes('/react-dom@')
            ) return 'vendor-react';
          }
          // Heavy first-party modules that landing doesn't need.
          if (id.includes('client/src/lib/storage')) return 'app-storage';
          if (id.includes('client/src/lib/crypto')) return 'app-crypto';
          if (id.includes('client/src/lib/vault-manager')) return 'app-vault-manager';
          if (id.includes('client/src/lib/csv-parsers')) return 'app-csv';
          if (id.includes('client/src/lib/expense-engine')) return 'app-expense-engine';
          return undefined;
        },
      },
    },
  },
  // Strip debug-level console output in production builds — keeps
  // bundles smaller and avoids leaking `[CLOUD-PUSH]`-style internal
  // logs to end users. `console.error` and `console.warn` are kept so
  // genuine errors still surface for users + monitoring.
  esbuild: {
    drop: ['debugger'],
    pure: ['console.log', 'console.info', 'console.debug', 'console.trace'],
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
