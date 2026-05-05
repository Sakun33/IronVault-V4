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
        manualChunks: {
          'vendor-react':     ['react', 'react-dom'],
          'vendor-router':    ['wouter'],
          'vendor-motion':    ['framer-motion'],
          'vendor-icons':     ['lucide-react'],
          'vendor-zod':       ['zod'],
          'vendor-dompurify': ['dompurify'],
          'vendor-datefns':   ['date-fns'],
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
