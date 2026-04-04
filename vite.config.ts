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
    rollupOptions: {
      external: ['@revenuecat/purchases-capacitor'],
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
