// React import MUST be the first import in this file.
// Vite's CJS interop compiles `import React from "react"` to `const React = ...`
// at the physical location of the import statement (not hoisted). The
// `React.lazy()` calls below (LandingPage, Dashboard, etc.) run at module-init
// time and would hit the TDZ if this import appeared after them — breaking
// the entire app in dev mode.
import React, { useState, useEffect, useCallback } from "react";
import { Switch, Route, Link, useLocation } from "wouter";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { makeSlideUp } from "@/lib/design-system";
import { ErrorBoundary } from "@/components/error-boundary";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { VaultProvider, useVault } from "@/contexts/vault-context";
import { SearchProvider } from "@/contexts/search-context";
import { UIActionsProvider } from "@/contexts/ui-actions-context";
import { CurrencyProvider } from "@/contexts/currency-context";
import { LoggingProvider } from "@/contexts/logging-context";
import { ThemeProvider, useTheme } from "@/contexts/theme-context";
import { LicenseProvider } from "@/contexts/license-context";
import { VaultSelectionProvider, useVaultSelection } from "@/contexts/vault-selection-context";
import { useSubscription } from "@/hooks/use-subscription";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useCloudAutoSync } from "@/hooks/use-cloud-auto-sync";
import { CloudSyncBanner } from "@/components/cloud-sync-banner";
import { CloudSyncPill } from "@/components/cloud-sync-pill";
import { TravelModeBanner } from "@/components/travel-mode-banner";
import { resetNoteEditing } from "@/lib/note-editing-guard";
import { listCloudVaults, markVaultAsCloudSynced, pushCloudVault, acquireCloudToken, getCloudToken } from "@/lib/cloud-vault-sync";
import { getAccountEmail, getAccountPasswordHash } from "@/lib/account-auth";
import { vaultStorage } from "@/lib/storage";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
// Landing is lazy too — keeping it eager pinned ~746 KB of main-bundle
// contexts and vendor code into every first-paint, even though landing
// doesn't use any of them. Users now download a small landing chunk on
// demand; subsequent navigation still pre-warms via modulepreload hints.
const LandingPage = React.lazy(() => import("@/pages/landing"));
import VaultPickerPage from "@/pages/vault-picker";
// Heavy / less-frequently-visited pages are code-split so they don't bloat the
// initial bundle. The Suspense fallback inside <Router /> covers their loading.
const SignupPage = React.lazy(() => import("@/pages/signup"));
const ForgotPasswordPage = React.lazy(() => import("@/pages/forgot-password"));
const ResetPasswordPage = React.lazy(() => import("@/pages/reset-password"));
const VerifyEmailPage = React.lazy(() => import("@/pages/verify-email"));
const Dashboard = React.lazy(() => import("@/pages/dashboard"));
const SecurityHealth = React.lazy(() => import("@/pages/security-health"));
const Passwords = React.lazy(() => import("@/pages/passwords"));
const Subscriptions = React.lazy(() => import("@/pages/subscriptions"));
const Notes = React.lazy(() => import("@/pages/notes"));
const Expenses = React.lazy(() => import("@/pages/expenses"));
const Reminders = React.lazy(() => import("@/pages/reminders"));
const Logging = React.lazy(() => import("@/pages/logging"));
const ShareView = React.lazy(() => import("@/pages/share-view"));
const BankStatements = React.lazy(() => import("@/pages/bank-statements"));
const Investments = React.lazy(() => import("@/pages/investments"));
const Goals = React.lazy(() => import("@/pages/goals"));
const Documents = React.lazy(() => import("@/pages/documents"));
const APIKeys = React.lazy(() => import("@/pages/api-keys"));
const CreditCards = React.lazy(() => import("@/pages/credit-cards"));
const Identities = React.lazy(() => import("@/pages/identities"));
const CryptoVault = React.lazy(() => import("@/pages/crypto-vault"));
const WifiPasswords = React.lazy(() => import("@/pages/wifi-passwords"));
const SoftwareLicenses = React.lazy(() => import("@/pages/software-licenses"));
const InsuranceVault = React.lazy(() => import("@/pages/insurance-vault"));
const TaxDocuments = React.lazy(() => import("@/pages/tax-documents"));
const QRVault = React.lazy(() => import("@/pages/qr-vault"));
const SecureBookmarks = React.lazy(() => import("@/pages/secure-bookmarks"));
const DarkWebMonitor = React.lazy(() => import("@/pages/dark-web-monitor"));
const FamilyDashboard = React.lazy(() => import("@/pages/family-dashboard"));
const DigitalWill = React.lazy(() => import("@/pages/digital-will"));
const SmartFormFiller = React.lazy(() => import("@/pages/smart-form-filler"));
const PhishingShield = React.lazy(() => import("@/pages/phishing-shield"));
const CoupleVault = React.lazy(() => import("@/pages/couple-vault"));
const BreachTimeline = React.lazy(() => import("@/pages/breach-timeline"));
const ShareRedeem = React.lazy(() => import("@/pages/share-redeem"));
const Profile = React.lazy(() => import("@/pages/profile"));
const Settings = React.lazy(() => import("@/pages/settings"));
const Integrations = React.lazy(() => import("@/pages/integrations"));
const EmergencyAccess = React.lazy(() => import("@/pages/emergency-access"));
const ImportPasswords = React.lazy(() => import("@/components/import-passwords"));
const AboutPage = React.lazy(() => import("@/pages/info/about"));
const FAQPage = React.lazy(() => import("@/pages/info/faq"));
const FeaturesPage = React.lazy(() => import("@/pages/info/features"));
const SecurityPage = React.lazy(() => import("@/pages/info/security"));
const ContactPage = React.lazy(() => import("@/pages/info/contact"));
const DocsPage = React.lazy(() => import("@/pages/info/docs"));
const PrivacyPage = React.lazy(() => import("@/pages/info/privacy"));
const TermsPage = React.lazy(() => import("@/pages/info/terms"));
const DisclaimerPage = React.lazy(() => import("@/pages/info/disclaimer"));
const PricingPage = React.lazy(() => import("@/pages/info/pricing"));
const BlogPage = React.lazy(() => import("@/pages/info/blog"));
const ChangelogPage = React.lazy(() => import("@/pages/info/changelog"));
const StatusPage = React.lazy(() => import("@/pages/info/status"));
const UpgradePage = React.lazy(() => import("@/pages/pricing"));
const CreateVaultPage = React.lazy(() => import("@/pages/create-vault"));
const QAPage = React.lazy(() => import("@/pages/qa"));
const VaultsPage = React.lazy(() => import("@/pages/vaults"));
const TeamsPage = React.lazy(() => import("@/pages/teams"));

// BUG-09: Warm up the lazy-route chunks on idle so tab-switching doesn't
// flash a fallback while a chunk is fetched. Runs once per session,
// guarded by typeof window for SSR safety.
let __routesWarmed = false;
function warmRouteChunks() {
  if (__routesWarmed) return;
  __routesWarmed = true;
  const tasks: Array<() => Promise<unknown>> = [
    () => import("@/pages/dashboard"),
    () => import("@/pages/passwords"),
    () => import("@/pages/notes"),
    () => import("@/pages/subscriptions"),
    () => import("@/pages/expenses"),
    () => import("@/pages/reminders"),
    () => import("@/pages/api-keys"),
    () => import("@/pages/documents"),
    () => import("@/pages/security-health"),
    () => import("@/pages/investments"),
    () => import("@/pages/bank-statements"),
    () => import("@/pages/profile"),
    () => import("@/pages/settings"),
    () => import("@/pages/integrations"),
    () => import("@/pages/emergency-access"),
  ];
  const ric = (cb: () => void) => {
    const w = window as any;
    if (typeof w.requestIdleCallback === 'function') w.requestIdleCallback(cb, { timeout: 1500 });
    else setTimeout(cb, 800);
  };
  ric(() => {
    tasks.forEach(t => { void t().catch(() => {}); });
  });
}
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, RefreshCw, Settings as SettingsIcon, Bookmark, Key, BarChart3, Upload, Download, BookOpen, DollarSign, Bell, FileText, Building2, TrendingUp, Plus, Menu, X, Shield, ShieldAlert, Target, User, XCircle, ShieldCheck, Lock, Zap, ChevronDown, ChevronLeft, ChevronRight, Database, Check, MoreVertical, Sun, Moon, LogOut, CreditCard as CardIcon, UserCircle, Bitcoin, Wifi, KeyRound, Calculator, QrCode as QrCodeIcon, Heart, Users, Wand2, Clock, Siren, Sparkles } from "lucide-react";
import { AppLogo } from "@/components/app-logo";
import { BottomTabs, MoreSheet, HamburgerDrawer, SearchModal, type TabItem, type SectionItem } from "@/components/mobile";
// ── Modal/dialog components — these only render when their `open` state
// flips true. Lazy-importing them keeps the dialog code (and any heavy
// sub-deps they pull in) OUT of the main bundle that loads on first
// paint. The Suspense boundary inside MainLayout handles their loading
// without a visible flash because they render `null` until opened.
const PasswordGeneratorModal = React.lazy(() => import("@/components/password-generator-modal").then(m => ({ default: m.PasswordGeneratorModal })));
const ImportExportModal = React.lazy(() => import("@/components/import-export-modal").then(m => ({ default: m.ImportExportModal })));
const ExtensionPairingModal = React.lazy(() => import("@/components/extension-pairing-modal").then(m => ({ default: m.ExtensionPairingModal })));
// SecuritySettingsModal stays eagerly imported because its `trigger`
// pattern renders the trigger button inline — going lazy would make the
// button disappear during the chunk fetch.
import { SecuritySettingsModal } from "@/components/security-settings-modal";
const BrowserExtensionPrompt = React.lazy(() => import("@/components/browser-extension-prompt").then(m => ({ default: m.BrowserExtensionPrompt })));
const QuickAddMenu = React.lazy(() => import("@/components/quick-add-fab").then(m => ({ default: m.QuickAddMenu })));
const CommandPalette = React.lazy(() => import("@/components/command-palette").then(m => ({ default: m.CommandPalette })));
const BiometricSetupPrompt = React.lazy(() => import("@/components/biometric-setup-prompt").then(m => ({ default: m.BiometricSetupPrompt })));
import { PWAOfflineIndicator } from "@/components/pwa-offline-indicator";
import { SimpleThemeToggle, ThemeToggle } from "@/components/theme-toggle";
import { NotificationCenter } from "@/components/notification-center";
import { NotificationService } from "@/lib/notifications";
import { useNotificationEvents } from "@/hooks/use-notification-events";
import { startSubscriptionReminderLoop } from "@/lib/reminder-notifications";
import { SectionCard } from "@/components/StatCard";
import { ToolsMenu } from "@/components/tools-menu";
import { AnalyticsIntegration } from "@/components/analytics-integration";
import { Footer } from "@/components/footer";
import { ZohoSalesIQIdentity } from "@/components/zoho-salesiq-identity";

// Main Layout Component for authenticated users
function MainLayout({ children }: { children: React.ReactNode }) {
  const reducedMotion = useReducedMotion();
  const slideUp = makeSlideUp(reducedMotion);
  const { logout, masterPassword, isUnlocked, accountEmail } = useAuth();
  const notificationUserId = accountEmail || 'guest';
  const { searchQuery, setSearchQuery, stats, isCloudSyncing, cloudSyncStatus, lastSyncError, retryCloudSync, passwords, subscriptions, notes, expenses, reminders, creditCards, identities, cryptoWallets, wifiPasswords, softwareLicenses, insurancePolicies, taxDocuments, qrCodes, secureBookmarks, familyMembers } = useVault();
  const { getLimit, isPro } = useSubscription();
  const { vaults, activeVault, requestVaultSwitch } = useVaultSelection();
  const { toggleTheme, resolvedTheme } = useTheme();
  useCloudAutoSync(activeVault?.id, masterPassword);

  // Wire app-state changes (unlock / weak-passwords / sync / renewals) into
  // the notification center.
  useNotificationEvents({
    userId: notificationUserId,
    isUnlocked,
    passwordCount: passwords.length,
    weakPasswordCount: stats.weakPasswords,
    subscriptions,
    cloudSyncStatus,
  });

  // Hourly subscription-renewal scan — fires both notification-center entries
  // and (when permission is granted) browser/native notifications at the
  // 7/3/1-day thresholds. Closure captures the latest subscriptions via a
  // ref so the loop sees fresh data without resubscribing each render.
  const subsRef = React.useRef(subscriptions);
  subsRef.current = subscriptions;
  React.useEffect(() => {
    if (!isUnlocked || notificationUserId === 'guest') return;
    const stop = startSubscriptionReminderLoop(() => ({
      userId: notificationUserId,
      subscriptions: subsRef.current,
    }));
    return stop;
  }, [isUnlocked, notificationUserId]);

  // Auto-recover the cloud token whenever it's missing AND we have the
  // cached account credentials (email + password hash from localStorage's
  // `iv_account`). A Lifetime user who clears their browser cache lands
  // in a state where the account session is restored (cookie) but the
  // cloud-token JWT is gone — this effect re-acquires it silently so the
  // sync pill flips out of "Reconnecting…" without manual intervention.
  // Re-runs on unlock and on every vault switch in case the token expired
  // mid-session.
  useEffect(() => {
    if (!isUnlocked) return;
    if (getCloudToken()) return;
    const email = getAccountEmail();
    const hash = getAccountPasswordHash();
    if (!email || !hash) return;
    let cancelled = false;
    (async () => {
      const token = await acquireCloudToken(email, hash).catch(() => null);
      if (cancelled) return;
      if (token) {
        console.info('[CLOUD-TOKEN] auto-recovered after missing-token detection');
      } else {
        console.warn('[CLOUD-TOKEN] auto-recover failed — user will need to log in again');
      }
    })();
    return () => { cancelled = true; };
  }, [isUnlocked, activeVault?.id]);

  // On every unlock: heal pre-fix vaults by checking server for cloud entry and pushing current state
  useEffect(() => {
    if (!isUnlocked || !activeVault?.id || !masterPassword) return;
    let cancelled = false;
    (async () => {
      try {
        const remote = await listCloudVaults();
        if (cancelled) return;
        const cloudEntry = remote.find(v => v.vaultId === activeVault.id);
        if (!cloudEntry) return;
        // Vault exists in cloud — ensure local tracking flag is set
        markVaultAsCloudSynced(activeVault.id);
        // Vault isolation: only heal if the open DB belongs to this vault.
        // Healing while mis-routed would push another vault's data to
        // this vault's cloud entry.
        if (vaultStorage.getCurrentVaultId() !== activeVault.id) {
          return;
        }
        // Push current local items to cloud (heals empty/stale blobs)
        const blob = await vaultStorage.exportVault(masterPassword);
        if (cancelled) return;
        // Only push if we have actual content (> empty vault threshold of ~1000 bytes)
        if (blob.length > 1000) {
          await pushCloudVault(activeVault.id, activeVault.name ?? cloudEntry.vaultName, blob, false);
          if (!cancelled) {
            // Advance lastPull so the 60-s poll doesn't immediately re-download
            // the data we just uploaded.
            localStorage.setItem(`iv_last_pull_${activeVault.id}`, new Date().toISOString());
          }
        }
      } catch {
        // Best-effort; don't surface errors
      }
    })();
    return () => { cancelled = true; };
  }, [isUnlocked, activeVault?.id, masterPassword]);
  const [location, setLocation] = useLocation();
  // Belt-and-suspenders: any route change clears the note-editing guard.
  // Even if the NoteEditor's portal cleanup somehow misses (hot-reload
  // race, fast unmount, etc.), navigating to another page guarantees the
  // flag is reset and cloud sync can resume.
  useEffect(() => {
    resetNoteEditing();
  }, [location]);
  // Scroll-to-top on route change.
  //
  // The previous one-shot rAF fix was correct in intent but the AnimatePresence
  // mode="wait" wrapper around the route children adds a ~500ms cycle (exit
  // anim → unmount → mount → enter anim). So we'd set scrollTop=0 on the OLD
  // content's height, then the new content mounts and the section's own
  // useEffect / scroll-into-view code can restore a non-zero position.
  //
  // Nuclear approach: hit every scrollable element multiple times along the
  // AnimatePresence lifecycle. Cheap (scrollTop assignment on already-zero
  // elements is a no-op) and resilient.
  useEffect(() => {
    const resetAll = () => {
      // Every element that can scroll vertically. Excludes sidebar scroll
      // containers (data-sidebar-scroll) so the user can still see which
      // nav item is selected after route change.
      const els = document.querySelectorAll<HTMLElement>('main, [data-scroll-container], [class*="overflow-y-auto"], [class*="overflow-auto"]');
      els.forEach(el => {
        if (el.closest('[data-sidebar-scroll]') || el.hasAttribute('data-sidebar-scroll')) return;
        if (el.scrollTop !== 0) el.scrollTop = 0;
      });
      try { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }); } catch { /* ignore */ }
    };
    // After route change settles, scroll the active sidebar item into view.
    // Active nav items get the `text-emerald-200` class, so we use it as a marker.
    const focusActive = () => {
      try {
        document.querySelectorAll<HTMLElement>('[data-sidebar-scroll]').forEach(container => {
          const active = container.querySelector<HTMLElement>('.text-emerald-200');
          if (active) active.scrollIntoView({ block: 'nearest', behavior: 'auto' });
        });
      } catch { /* ignore */ }
    };
    resetAll();
    const raf1 = requestAnimationFrame(() => { resetAll(); focusActive(); });
    const t1 = setTimeout(() => { resetAll(); focusActive(); }, 350);
    return () => {
      cancelAnimationFrame(raf1);
      clearTimeout(t1);
    };
  }, [location]);
  const [showGenerator, setShowGenerator] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  const [showExtensionPairing, setShowExtensionPairing] = useState(false);
  const [showSecuritySettings, setShowSecuritySettings] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showQuickAccess, setShowQuickAccess] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const [hasSearchInteracted, setHasSearchInteracted] = useState(false);

  // Global keyboard shortcuts. Cmd/Ctrl+K (palette) was bound here long
  // before the other chords; the hook subsumes that handler so they all
  // share one keydown listener.
  //   Cmd/Ctrl+K → command palette
  //   Cmd/Ctrl+N → quick-add menu (context-aware new item)
  //   Cmd/Ctrl+L → lock vault (logout)
  //   Cmd/Ctrl+G → password generator
  //   Escape    → close topmost overlay
  useKeyboardShortcuts({
    onSearch: () => setShowCommandPalette(prev => !prev),
    onNew: () => setShowQuickAdd(true),
    onLock: () => { logout(); },
    onGenerator: () => setShowGenerator(true),
    onEscape: () => {
      if (showCommandPalette) { setShowCommandPalette(false); return; }
      if (showQuickAdd) { setShowQuickAdd(false); return; }
      if (showSearchModal) { setShowSearchModal(false); return; }
      if (showGenerator) { setShowGenerator(false); return; }
    },
  });

  // Collapsible sidebar — persists across reloads. Defaults to expanded.
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('iv_sidebar_collapsed') === '1';
  });
  useEffect(() => {
    try { localStorage.setItem('iv_sidebar_collapsed', sidebarCollapsed ? '1' : '0'); } catch {}
  }, [sidebarCollapsed]);

  // Surface the most-recent HIBP breach count as a red badge on the Security
  // Health nav link. Updated by the same-tab `BREACH_COUNT_EVENT` and the
  // cross-tab `storage` event so the badge stays live without polling.
  // Clamped to passwords.length so a stale cache from a prior vault can't
  // outlive password deletions or a vault switch.
  const [rawBreachedCount, setRawBreachedCount] = useState<number>(() => {
    try {
      const raw = localStorage.getItem('iv_breach_count');
      const n = raw ? parseInt(raw, 10) : 0;
      return Number.isFinite(n) && n > 0 ? n : 0;
    } catch { return 0; }
  });
  const breachedCount = Math.max(0, Math.min(rawBreachedCount, passwords?.length ?? 0));
  useEffect(() => {
    if (rawBreachedCount > (passwords?.length ?? 0)) {
      try { localStorage.removeItem('iv_breach_count'); } catch { /* noop */ }
      setRawBreachedCount(0);
    }
  }, [rawBreachedCount, passwords?.length]);
  useEffect(() => {
    const update = (val?: number) => {
      if (typeof val === 'number') {
        setRawBreachedCount(Number.isFinite(val) && val > 0 ? val : 0);
        return;
      }
      try {
        const raw = localStorage.getItem('iv_breach_count');
        const n = raw ? parseInt(raw, 10) : 0;
        setRawBreachedCount(Number.isFinite(n) && n > 0 ? n : 0);
      } catch { /* noop */ }
    };
    const onStorage = (e: StorageEvent) => { if (e.key === 'iv_breach_count') update(); };
    const onCustom = (e: Event) => update((e as CustomEvent<number>).detail);
    window.addEventListener('storage', onStorage);
    window.addEventListener('iv:breach-count-changed', onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('iv:breach-count-changed', onCustom);
    };
  }, []);

  const looksLikeEmail = useCallback((value: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }, []);

  // Debounced search to avoid excessive re-renders (reduced to 200ms for better responsiveness)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(localSearchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [localSearchQuery, setSearchQuery]);

  // Sync external changes to local state
  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  // Guard against browser/password-manager autofill hijacking this non-auth search box.
  // If an email-like value appears before user interaction, clear it.
  useEffect(() => {
    if (!hasSearchInteracted && localSearchQuery && looksLikeEmail(localSearchQuery)) {
      setLocalSearchQuery('');
      setSearchQuery('');
    }
  }, [hasSearchInteracted, localSearchQuery, looksLikeEmail, setSearchQuery]);

  const handleLockVault = () => {
    logout();
  };

  const clearSearch = () => {
    setHasSearchInteracted(false);
    setLocalSearchQuery('');
    setSearchQuery('');
  };

  // Core vault items (top section of sidebar)
  const coreNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3, count: null, limitLabel: null as string | null, color: 'text-primary', requiresPro: false, alertBadge: null as number | null },
    { id: 'vaults', label: 'Vaults', icon: ShieldCheck, count: null, limitLabel: null as string | null, color: 'text-violet-600', requiresPro: false, alertBadge: null },
    { id: 'passwords', label: 'Passwords', icon: Key, count: stats.totalPasswords, limitLabel: isPro ? null : `${stats.totalPasswords}/${getLimit('passwords')}`, color: 'text-primary', requiresPro: false, alertBadge: null },
    { id: 'security-health', label: 'Security Health', icon: ShieldAlert, count: null, limitLabel: null, color: 'text-rose-500', requiresPro: false, alertBadge: breachedCount > 0 ? breachedCount : null },
    { id: 'notes', label: 'Notes', icon: BookOpen, count: stats.totalNotes, limitLabel: isPro ? null : `${stats.totalNotes}/${getLimit('notes')}`, color: 'text-orange-600', requiresPro: false, alertBadge: null },
    { id: 'documents', label: 'Documents', icon: FileText, count: null, color: 'text-indigo-600', requiresPro: true, alertBadge: null },
    { id: 'api-keys', label: 'API Keys', icon: Shield, count: null, color: 'text-cyan-600', requiresPro: true, alertBadge: null },
    { id: 'cards', label: 'Cards', icon: CardIcon, count: null, color: 'text-sky-600', requiresPro: false, alertBadge: null },
    { id: 'identities', label: 'Identities', icon: UserCircle, count: null, color: 'text-violet-600', requiresPro: false, alertBadge: null },
    { id: 'crypto', label: 'Crypto Wallets', icon: Bitcoin, count: cryptoWallets?.length || null, color: 'text-amber-500', requiresPro: true, alertBadge: null },
    { id: 'wifi', label: 'Wi-Fi Passwords', icon: Wifi, count: wifiPasswords?.length || null, color: 'text-blue-500', requiresPro: false, alertBadge: null },
    { id: 'licenses', label: 'Software Licenses', icon: KeyRound, count: softwareLicenses?.length || null, color: 'text-teal-500', requiresPro: true, alertBadge: null },
    { id: 'bookmarks', label: 'Secure Bookmarks', icon: Bookmark, count: secureBookmarks?.length || null, color: 'text-fuchsia-500', requiresPro: false, alertBadge: null },
    { id: 'qr', label: 'QR Vault', icon: QrCodeIcon, count: qrCodes?.length || null, color: 'text-pink-500', requiresPro: true, alertBadge: null },
  ];
  // Finance items (second section)
  const financeNavItems = [
    { id: 'subscriptions', label: 'Subscriptions', icon: Bookmark, count: stats.activeSubscriptions, limitLabel: null as string | null, color: 'text-purple-600', requiresPro: true },
    { id: 'expenses', label: 'Expenses', icon: DollarSign, count: stats.totalExpenses, color: 'text-red-600', requiresPro: true },
    { id: 'bank-statements', label: 'Bank Statements', icon: Building2, count: null, color: 'text-indigo-600', requiresPro: true },
    { id: 'investments', label: 'Investments', icon: TrendingUp, count: null, color: 'text-emerald-600', requiresPro: true },
    { id: 'goals', label: 'Goals', icon: Target, count: null, color: 'text-emerald-700', requiresPro: true },
    { id: 'insurance', label: 'Insurance', icon: ShieldCheck, count: insurancePolicies?.length || null, color: 'text-blue-600', requiresPro: true },
    { id: 'tax', label: 'Tax Documents', icon: Calculator, count: taxDocuments?.length || null, color: 'text-amber-600', requiresPro: true },
    { id: 'reminders', label: 'Reminders', icon: Bell, count: stats.totalReminders, color: 'text-yellow-600', requiresPro: false },
  ];
  // Security & tools (third section)
  const toolsNavItems = [
    { id: 'dark-web', label: 'Dark Web Monitor', icon: ShieldAlert, count: null as number | null, color: 'text-red-500', requiresPro: true },
    { id: 'phishing', label: 'Phishing Shield', icon: ShieldCheck, count: null, color: 'text-emerald-500', requiresPro: true },
    { id: 'breach-timeline', label: 'Breach Timeline', icon: Clock, count: null, color: 'text-rose-500', requiresPro: true },
    { id: 'form-filler', label: 'Smart Form Filler', icon: Wand2, count: null, color: 'text-violet-500', requiresPro: true },
  ];
  // Family & sharing (fourth section)
  const familyNavItems = [
    { id: 'family', label: 'Family Dashboard', icon: Users, count: familyMembers?.length || null as number | null, color: 'text-pink-500', requiresPro: true },
    { id: 'couple', label: "Couple's Vault", icon: Heart, count: null, color: 'text-rose-500', requiresPro: true },
    { id: 'digital-will', label: 'Digital Will', icon: Sparkles, count: null, color: 'text-purple-500', requiresPro: true },
    { id: 'emergency-access', label: 'Emergency Access', icon: Siren, count: null, color: 'text-red-600', requiresPro: true },
  ];
  // Bottom pinned items (system/account)
  const bottomNavItems = [
    { id: 'profile', label: 'Profile', icon: User, count: null, color: 'text-primary', requiresPro: false },
    { id: 'logging', label: 'Activity Logs', icon: FileText, count: null, color: 'text-muted-foreground', requiresPro: false },
    { id: 'settings', label: 'Settings', icon: SettingsIcon, count: null, color: 'text-muted-foreground', requiresPro: false },
    { id: 'upgrade', label: 'Upgrade to Pro', icon: Zap, count: null, color: 'text-primary', requiresPro: false },
  ];
  // Flat list for mobile menu and other consumers
  const navItems = [...coreNavItems, ...financeNavItems, ...toolsNavItems, ...familyNavItems, ...bottomNavItems];

  // Core sections for bottom navigation. The "Finance" combined tab was
  // confusing — users couldn't tell whether it meant Expenses or
  // Subscriptions until they tapped through. Splitting into two
  // dedicated tabs trades one slot for a better target. Profile is
  // still reachable from the menu / quick-access drawer.
  const bottomTabItems: TabItem[] = [
    { id: 'dashboard',     label: 'Home',           icon: BarChart3,  href: '/' },
    { id: 'passwords',     label: 'Passwords',      icon: Key,        href: '/passwords',     count: stats.totalPasswords },
    { id: 'notes',         label: 'Notes',          icon: FileText,   href: '/notes',         count: stats.totalNotes },
    { id: 'expenses',      label: 'Expenses',       icon: DollarSign, href: '/expenses',      count: stats.totalExpenses },
    { id: 'subscriptions', label: 'Subs',           icon: Bookmark,   href: '/subscriptions', count: stats.activeSubscriptions },
  ];

  // All sections for MoreSheet
  const allSections: SectionItem[] = [
    // Vault group
    { id: 'vaults', label: 'Vaults', icon: ShieldCheck, href: '/vaults', group: 'vault' },
    { id: 'passwords', label: 'Passwords', icon: Key, href: '/passwords', group: 'vault', count: stats.totalPasswords },
    { id: 'notes', label: 'Notes', icon: BookOpen, href: '/notes', group: 'vault', count: stats.totalNotes },
    { id: 'documents', label: 'Documents', icon: FileText, href: '/documents', group: 'vault' },
    { id: 'api-keys', label: 'API Keys', icon: Shield, href: '/api-keys', group: 'vault' },
    { id: 'cards', label: 'Cards', icon: CardIcon, href: '/cards', group: 'vault' },
    { id: 'identities', label: 'Identities', icon: UserCircle, href: '/identities', group: 'vault' },
    { id: 'wifi', label: 'Wi-Fi', icon: Wifi, href: '/wifi', group: 'vault', count: wifiPasswords?.length || 0 },
    { id: 'crypto', label: 'Crypto', icon: Bitcoin, href: '/crypto', group: 'vault', count: cryptoWallets?.length || 0, requiresPro: true },
    { id: 'licenses', label: 'Licenses', icon: KeyRound, href: '/licenses', group: 'vault', count: softwareLicenses?.length || 0, requiresPro: true },
    { id: 'insurance', label: 'Insurance', icon: ShieldCheck, href: '/insurance', group: 'finance', count: insurancePolicies?.length || 0, requiresPro: true },
    { id: 'tax', label: 'Tax Docs', icon: Calculator, href: '/tax', group: 'finance', count: taxDocuments?.length || 0, requiresPro: true },
    { id: 'qr', label: 'QR Vault', icon: QrCodeIcon, href: '/qr', group: 'tools', count: qrCodes?.length || 0, requiresPro: true },
    { id: 'bookmarks', label: 'Bookmarks', icon: Bookmark, href: '/bookmarks', group: 'vault', count: secureBookmarks?.length || 0 },
    { id: 'family', label: 'Family', icon: Users, href: '/family', group: 'account', count: familyMembers?.length || 0, requiresPro: true },
    { id: 'dark-web', label: 'Dark Web Monitor', icon: ShieldAlert, href: '/dark-web', group: 'tools' },
    { id: 'digital-will', label: 'Digital Will', icon: Heart, href: '/digital-will', group: 'account' },
    { id: 'form-filler', label: 'Form Filler', icon: Wand2, href: '/form-filler', group: 'tools' },
    { id: 'phishing', label: 'Phishing Shield', icon: ShieldCheck, href: '/phishing', group: 'tools' },
    { id: 'breach-timeline', label: 'Breach Timeline', icon: Clock, href: '/breach-timeline', group: 'tools' },
    { id: 'couple', label: "Couple's Vault", icon: Heart, href: '/couple', group: 'account' },
    { id: 'emergency-access', label: 'Emergency Access', icon: Siren, href: '/emergency-access', group: 'account', requiresPro: true },
    // Finance group
    { id: 'subscriptions', label: 'Subscriptions', icon: Bookmark, href: '/subscriptions', group: 'finance', count: stats.activeSubscriptions },
    { id: 'expenses', label: 'Expenses', icon: DollarSign, href: '/expenses', group: 'finance', count: stats.totalExpenses },
    { id: 'bank-statements', label: 'Bank Statements', icon: Building2, href: '/bank-statements', group: 'finance' },
    { id: 'investments', label: 'Investments', icon: TrendingUp, href: '/investments', group: 'finance' },
    { id: 'goals', label: 'Goals', icon: Target, href: '/goals', group: 'finance' },
    // Tools group
    { id: 'security-health', label: 'Security Health', icon: ShieldAlert, href: '/security-health', group: 'tools', count: breachedCount > 0 ? breachedCount : null },
    { id: 'reminders', label: 'Reminders', icon: Bell, href: '/reminders', group: 'tools', count: stats.totalReminders },
    { id: 'logging', label: 'Activity Logs', icon: FileText, href: '/logging', group: 'tools' },
    // Account group
    { id: 'profile', label: 'Profile', icon: User, href: '/profile', group: 'account' },
    { id: 'settings', label: 'Settings', icon: SettingsIcon, href: '/settings', group: 'account' },
    // Sign out — surfaced in the mobile bottom sheet so users don't have
    // to dig into the More menu in the header to find it. Calls the same
    // logout() that locks the vault and clears the cloud token.
    { id: 'logout', label: 'Sign out', icon: LogOut, onClick: () => logout(), group: 'account' },
  ];

  return (
    <UIActionsProvider
      openPasswordGenerator={() => setShowGenerator(true)}
      openImportExport={() => setShowImportExport(true)}
    >
    <div className="h-[100dvh] bg-background overflow-hidden flex flex-col w-full" style={{width: '100%', maxWidth: '100vw', overscrollBehavior: 'none'}}>
      {/* Travel-mode banner — visible app-wide while active. */}
      <TravelModeBanner />
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50 px-2 pt-[env(safe-area-inset-top,0px)] overflow-visible">
        <div className="flex items-center justify-between h-9 gap-1 overflow-visible">
          {/* Left: hamburger + logo */}
          <div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowQuickAccess(true)}
              onPointerUp={() => setShowQuickAccess(true)}
              className="h-9 w-9 rounded-xl flex-shrink-0"
              title="Menu"
              aria-label="Menu"
              data-testid="mobile-hamburger"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <button onClick={() => setLocation('/')} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity flex-shrink min-w-0 overflow-hidden">
              <AppLogo size={24} />
              <span className="text-sm font-bold tracking-tight text-foreground truncate">IronVault</span>
            </button>
            {/* Vault chip — only when multiple vaults */}
            {vaults.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/60 rounded-lg px-2 py-1 border border-border/40 max-w-[80px]">
                    <Database className="w-3 h-3 shrink-0" />
                    <span className="truncate">{activeVault?.name || 'Vault'}</span>
                    <ChevronDown className="w-3 h-3 shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[160px]">
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Switch Vault</div>
                  {vaults.map(vault => (
                    <DropdownMenuItem key={vault.id} className="gap-2" onClick={() => { if (vault.id !== activeVault?.id) requestVaultSwitch(vault.id); }}>
                      <Database className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="flex-1 truncate">{vault.name}</span>
                      {vault.id === activeVault?.id && <Check className="w-3.5 h-3.5 text-primary" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {/* Always-visible cloud sync status. Tap when failed to retry. */}
            <CloudSyncPill vaultId={activeVault?.id ?? null} compact />
          </div>

          {/* Right: Quick Add | Notifications | Overflow ⋮
              Global Search removed — each section has its own scoped search,
              and Cmd/Ctrl+K still opens the command palette for power users. */}
          <div className="flex items-center gap-0.5 flex-shrink-0 overflow-visible">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => setShowQuickAdd(true)} className="h-9 w-9 rounded-xl flex-shrink-0" title="Quick Add" aria-label="Quick Add">
                  <Plus className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Quick Add</TooltipContent>
            </Tooltip>
            <NotificationCenter userId={notificationUserId} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-xl touch-manipulation relative z-[51] flex-shrink-0"
                  title="More"
                  aria-label="More options"
                  data-testid="mobile-more-menu-trigger"
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} className="min-w-[220px] z-[100]">
                <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">
                  {accountEmail || 'Signed in'}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2" onClick={() => setLocation('/profile')}>
                  <User className="w-4 h-4 text-muted-foreground" /> Profile
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2" onClick={() => setLocation('/settings')}>
                  <SettingsIcon className="w-4 h-4 text-muted-foreground" /> Settings
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2" onClick={toggleTheme}>
                  {resolvedTheme === 'dark' ? <Sun className="w-4 h-4 text-muted-foreground" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
                  Toggle Theme
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onClick={handleLockVault} data-testid="menu-sign-out-mobile">
                  <LogOut className="w-4 h-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      {/* Spacer for fixed header + safe area. Height must match the header
          (h-9 = 36px) plus its top safe-area padding. The 0px fallback
          keeps the spacer flush on devices/browsers without a notch. */}
      <div className="lg:hidden h-[calc(env(safe-area-inset-top,0px)+36px)]" />

      {/* Desktop Header - Glassmorphism */}
      <header className="hidden lg:block sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AppLogo size={36} />
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-foreground">IronVault</h1>
            </div>
            {/* Vault Switcher — Radix DropdownMenu (portals to body, bypasses all stacking contexts) */}
            {vaults.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1.5 rounded-xl text-sm h-8 px-3 border-border/60 bg-muted/40"
                  >
                    <Database className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="max-w-[120px] truncate">{activeVault?.name || 'Default Vault'}</span>
                    <ChevronDown className="w-3 h-3 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[200px]">
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Switch Vault</div>
                  {vaults.map(vault => (
                    <DropdownMenuItem
                      key={vault.id}
                      className="gap-2"
                      onClick={() => {
                        if (vault.id !== activeVault?.id) requestVaultSwitch(vault.id);
                      }}
                    >
                      <Database className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="flex-1 truncate">{vault.name}</span>
                      {vault.id === activeVault?.id && <Check className="w-4 h-4 text-primary" />}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Cloud sync</span>
                    <CloudSyncPill vaultId={activeVault?.id ?? null} />
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <a href="/vaults" className="gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Manage Vaults</span>
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {/* Always-visible cloud sync status. Tap when failed to retry. */}
            <CloudSyncPill vaultId={activeVault?.id ?? null} />
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 transform -translate-y-1/2 transition-colors group-focus-within:text-primary" />
              <Input
                type="search"
                placeholder="Search passwords, subscriptions, notes..."
                className="w-80 pl-10 pr-10 py-2 rounded-full bg-muted/50 border-transparent focus-visible:bg-background focus-visible:border-border"
                value={localSearchQuery}
                onChange={(e) => setLocalSearchQuery(e.target.value)}
                onKeyDown={() => setHasSearchInteracted(true)}
                onPaste={() => setHasSearchInteracted(true)}
                onPointerDown={() => setHasSearchInteracted(true)}
                autoComplete="new-password"
                autoCorrect="off"
                spellCheck={false}
                inputMode="search"
                name="q"
                data-lpignore="true"
                data-form-type="other"
              />
              {localSearchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Clear search"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="h-6 w-px bg-border/50" />

            <ToolsMenu
              onPasswordGenerator={() => setShowGenerator(true)}
              onImportExport={() => setShowImportExport(true)}
              onExtensionPairing={() => setShowExtensionPairing(true)}
            />

            <Tooltip>
              <TooltipTrigger asChild>
                <span title="Security Settings">
                  <SecuritySettingsModal
                    trigger={
                      <Button variant="ghost" size="sm" className="p-2 rounded-xl" title="Security Settings" aria-label="Security Settings">
                        <SettingsIcon className="w-5 h-5" />
                      </Button>
                    }
                    onSettingsChanged={(_kdfConfig) => {}}
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent>Security Settings</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => setShowQuickAdd(true)} className="p-2 rounded-xl" title="Quick Add" aria-label="Quick Add">
                  <Plus className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Quick Add</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span title="Notifications"><NotificationCenter userId={notificationUserId} /></span>
              </TooltipTrigger>
              <TooltipContent>Notifications</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span title="Toggle Theme"><ThemeToggle /></span>
              </TooltipTrigger>
              <TooltipContent>Toggle Theme</TooltipContent>
            </Tooltip>

            <div className="h-6 w-px bg-border/50" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="p-2 rounded-xl hover:bg-accent text-foreground" title="Account" aria-label="Account menu" data-testid="user-menu-desktop">
                  <User className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[200px]">
                <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">
                  {accountEmail || 'Signed in'}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2" onClick={() => setLocation('/profile')}>
                  <User className="w-4 h-4 text-muted-foreground" /> Profile
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2" onClick={() => setLocation('/settings')}>
                  <SettingsIcon className="w-4 h-4 text-muted-foreground" /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onClick={handleLockVault} data-testid="menu-sign-out-desktop">
                  <LogOut className="w-4 h-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {showMobileMenu && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black bg-opacity-50" onClick={() => setShowMobileMenu(false)}>
          <div className="bg-card w-80 h-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Menu</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMobileMenu(false)}
                  className="p-2"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>
            
            <div className="p-4">
              {/* All Sections */}
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-foreground mb-4">All Sections</h3>
                <div className="space-y-2">
                  {navItems.map((item) => (
                    <Link key={item.id} href={item.id === 'dashboard' ? '/' : `/${item.id}`}>
                      <Button
                        variant="ghost"
                        className="w-full justify-start gap-3 px-3 py-3 h-auto text-left rounded-xl hover:bg-accent"
                        onClick={() => setShowMobileMenu(false)}
                      >
                        <item.icon className={`w-5 h-5 ${item.color}`} />
                        <div className="flex-1">
                          <div className="font-medium text-foreground">{item.label}</div>
                          {item.count !== null && (
                            <div className="text-sm text-muted-foreground">{item.count} items</div>
                          )}
                        </div>
                      </Button>
                    </Link>
                  ))}
                </div>
              </div>

            </div>

            <div className="p-4 border-t border-border bg-card">
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 px-3 py-3 text-foreground"
                  onClick={() => {
                    setShowGenerator(true);
                    setShowMobileMenu(false);
                  }}
                >
                  <RefreshCw className="w-5 h-5" />
                  Password Generator
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 px-3 py-3 text-foreground"
                  onClick={() => {
                    setShowImportExport(true);
                    setShowMobileMenu(false);
                  }}
                >
                  <Upload className="w-5 h-5" />
                  Import / Export
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 px-3 py-3 text-foreground"
                  onClick={() => {
                    setShowSecuritySettings(true);
                    setShowMobileMenu(false);
                  }}
                >
                  <SettingsIcon className="w-5 h-5" />
                  Security Settings
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex flex-1 overflow-hidden">
        <motion.nav
          animate={{ width: sidebarCollapsed ? 68 : 248 }}
          initial={false}
          transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          className="flex-shrink-0 border-r border-black/[0.06] dark:border-white/[0.04] bg-white/70 dark:bg-[#070b13]/60 backdrop-blur-2xl backdrop-saturate-150 p-3 flex flex-col h-full"
        >
          {/* Scrollable primary nav items with section groups */}
          <div className="flex-1 overflow-y-auto min-h-0 smooth-scrollbar" data-sidebar-scroll>
            {/* Core Vault group */}
            <div className={`px-2 pt-1 pb-1 ${sidebarCollapsed ? 'h-1' : ''}`}>
              {!sidebarCollapsed && (
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Vault</span>
              )}
            </div>
            <div className="space-y-0.5 mb-1">
              {coreNavItems.map((item) => {
                const itemPath = item.id === 'dashboard' ? '/' : `/${item.id}`;
                const isActive = item.id === 'dashboard' ? location === '/' : location === itemPath;
                return (
                <Link key={item.id} href={itemPath}>
                  <Button
                    variant="ghost"
                    title={sidebarCollapsed ? item.label : undefined}
                    aria-label={sidebarCollapsed ? item.label : undefined}
                    className={`relative w-full ${sidebarCollapsed ? 'justify-center px-0' : 'justify-start gap-3 px-3'} py-2.5 h-auto text-foreground rounded-xl transition-all duration-200 ${sidebarCollapsed ? '' : 'hover:translate-x-0.5'} hover:bg-white/[0.06] hover:backdrop-blur-md${isActive ? ' bg-emerald-500/10 text-emerald-200 font-semibold shadow-[inset_0_0_0_1px_rgba(16,185,129,0.18)]' : ''}`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="sidebarActiveIndicator"
                        className="absolute left-0 top-[25%] bottom-[25%] w-[3px] rounded-r bg-gradient-to-b from-emerald-400 to-teal-500 shadow-[0_0_12px_rgba(16,185,129,0.6)]"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                    <item.icon className={`w-[18px] h-[18px] ${item.color}`} />
                    {sidebarCollapsed && 'alertBadge' in item && item.alertBadge ? (
                      <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-background">
                        {item.alertBadge > 9 ? '9+' : item.alertBadge}
                      </span>
                    ) : null}
                    {!sidebarCollapsed && (
                      <>
                        <span className="text-sm">{item.label}</span>
                        {'alertBadge' in item && item.alertBadge ? (
                          <span className="ml-auto bg-red-500/15 text-red-600 dark:text-red-400 text-[10px] px-2 py-0.5 rounded-full font-bold ring-1 ring-red-500/30">
                            {item.alertBadge > 99 ? '99+' : item.alertBadge}
                          </span>
                        ) : 'limitLabel' in item && item.limitLabel !== null ? (
                          <span className="ml-auto bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-semibold">
                            {item.limitLabel}
                          </span>
                        ) : item.count !== null && (
                          <span className="ml-auto bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-semibold">
                            {item.count > 99 ? '99+' : item.count}
                          </span>
                        )}
                      </>
                    )}
                  </Button>
                </Link>
                );
              })}
            </div>
            {/* Finance group */}
            <div className={`px-2 pt-2 pb-1 border-t border-border/30 mt-1 ${sidebarCollapsed ? 'h-2' : ''}`}>
              {!sidebarCollapsed && (
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Finance</span>
              )}
            </div>
            <div className="space-y-0.5">
              {financeNavItems.map((item) => {
                const itemPath = `/${item.id}`;
                const isActive = location === itemPath;
                return (
                <Link key={item.id} href={itemPath}>
                  <Button
                    variant="ghost"
                    title={sidebarCollapsed ? item.label : undefined}
                    aria-label={sidebarCollapsed ? item.label : undefined}
                    className={`relative w-full ${sidebarCollapsed ? 'justify-center px-0' : 'justify-start gap-3 px-3'} py-2.5 h-auto text-foreground rounded-xl transition-all duration-200 ${sidebarCollapsed ? '' : 'hover:translate-x-0.5'} hover:bg-white/[0.06] hover:backdrop-blur-md${isActive ? ' bg-emerald-500/10 text-emerald-200 font-semibold shadow-[inset_0_0_0_1px_rgba(16,185,129,0.18)]' : ''}`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="sidebarActiveIndicator"
                        className="absolute left-0 top-[25%] bottom-[25%] w-[3px] rounded-r bg-gradient-to-b from-emerald-400 to-teal-500 shadow-[0_0_12px_rgba(16,185,129,0.6)]"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                    <item.icon className={`w-[18px] h-[18px] ${item.color}`} />
                    {!sidebarCollapsed && (
                      <>
                        <span className="text-sm">{item.label}</span>
                        {'limitLabel' in item && item.limitLabel !== null ? (
                          <span className="ml-auto bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-semibold">
                            {item.limitLabel}
                          </span>
                        ) : item.count !== null && (
                          <span className="ml-auto bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-semibold">
                            {item.count > 99 ? '99+' : item.count}
                          </span>
                        )}
                      </>
                    )}
                  </Button>
                </Link>
                );
              })}
            </div>
            {/* Security & Tools group */}
            <div className={`px-2 pt-2 pb-1 border-t border-border/30 mt-1 ${sidebarCollapsed ? 'h-2' : ''}`}>
              {!sidebarCollapsed && (
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Security & Tools</span>
              )}
            </div>
            <div className="space-y-0.5">
              {toolsNavItems.map((item) => {
                const itemPath = `/${item.id}`;
                const isActive = location === itemPath;
                return (
                <Link key={item.id} href={itemPath}>
                  <Button
                    variant="ghost"
                    title={sidebarCollapsed ? item.label : undefined}
                    aria-label={sidebarCollapsed ? item.label : undefined}
                    className={`relative w-full ${sidebarCollapsed ? 'justify-center px-0' : 'justify-start gap-3 px-3'} py-2.5 h-auto text-foreground rounded-xl transition-all duration-200 ${sidebarCollapsed ? '' : 'hover:translate-x-0.5'} hover:bg-white/[0.06] hover:backdrop-blur-md${isActive ? ' bg-emerald-500/10 text-emerald-200 font-semibold shadow-[inset_0_0_0_1px_rgba(16,185,129,0.18)]' : ''}`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="sidebarActiveIndicator"
                        className="absolute left-0 top-[25%] bottom-[25%] w-[3px] rounded-r bg-gradient-to-b from-emerald-400 to-teal-500 shadow-[0_0_12px_rgba(16,185,129,0.6)]"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                    <item.icon className={`w-[18px] h-[18px] ${item.color}`} />
                    {!sidebarCollapsed && (
                      <>
                        <span className="text-sm">{item.label}</span>
                        {item.count !== null && (
                          <span className="ml-auto bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-semibold">
                            {item.count > 99 ? '99+' : item.count}
                          </span>
                        )}
                      </>
                    )}
                  </Button>
                </Link>
                );
              })}
            </div>
            {/* Family & Sharing group */}
            <div className={`px-2 pt-2 pb-1 border-t border-border/30 mt-1 ${sidebarCollapsed ? 'h-2' : ''}`}>
              {!sidebarCollapsed && (
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Family & Sharing</span>
              )}
            </div>
            <div className="space-y-0.5">
              {familyNavItems.map((item) => {
                const itemPath = `/${item.id}`;
                const isActive = location === itemPath;
                return (
                <Link key={item.id} href={itemPath}>
                  <Button
                    variant="ghost"
                    title={sidebarCollapsed ? item.label : undefined}
                    aria-label={sidebarCollapsed ? item.label : undefined}
                    className={`relative w-full ${sidebarCollapsed ? 'justify-center px-0' : 'justify-start gap-3 px-3'} py-2.5 h-auto text-foreground rounded-xl transition-all duration-200 ${sidebarCollapsed ? '' : 'hover:translate-x-0.5'} hover:bg-white/[0.06] hover:backdrop-blur-md${isActive ? ' bg-emerald-500/10 text-emerald-200 font-semibold shadow-[inset_0_0_0_1px_rgba(16,185,129,0.18)]' : ''}`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="sidebarActiveIndicator"
                        className="absolute left-0 top-[25%] bottom-[25%] w-[3px] rounded-r bg-gradient-to-b from-emerald-400 to-teal-500 shadow-[0_0_12px_rgba(16,185,129,0.6)]"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                    <item.icon className={`w-[18px] h-[18px] ${item.color}`} />
                    {!sidebarCollapsed && (
                      <>
                        <span className="text-sm">{item.label}</span>
                        {item.count !== null && (
                          <span className="ml-auto bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-semibold">
                            {item.count > 99 ? '99+' : item.count}
                          </span>
                        )}
                      </>
                    )}
                  </Button>
                </Link>
                );
              })}
            </div>
          </div>
          {/* Pinned bottom utility items. Hide the "Upgrade to Pro" entry
              entirely for paying users — there's nothing left to upgrade to
              and the link in their nav is just noise. */}
          <div className="border-t border-border/50 pt-2 mt-2 space-y-0.5 flex-shrink-0">
            {bottomNavItems
              .filter((item) => !(item.id === 'upgrade' && isPro))
              .map((item) => {
              const itemPath = `/${item.id}`;
              const isActive = location === itemPath;
              return (
              <Link key={item.id} href={itemPath}>
                <Button
                  variant="ghost"
                  title={sidebarCollapsed ? item.label : undefined}
                  aria-label={sidebarCollapsed ? item.label : undefined}
                  className={`relative w-full ${sidebarCollapsed ? 'justify-center px-0' : 'justify-start gap-3 px-3'} py-2.5 h-auto text-foreground rounded-xl transition-all duration-200 ${sidebarCollapsed ? '' : 'hover:translate-x-0.5'} hover:bg-white/[0.06] hover:backdrop-blur-md${isActive ? ' bg-emerald-500/10 text-emerald-200 font-semibold shadow-[inset_0_0_0_1px_rgba(16,185,129,0.18)]' : ''}`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="sidebarActiveIndicator"
                      className="absolute left-0 top-[25%] bottom-[25%] w-[3px] rounded-r bg-gradient-to-b from-emerald-400 to-teal-500 shadow-[0_0_12px_rgba(16,185,129,0.6)]"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <item.icon className={`w-[18px] h-[18px] ${item.color}`} />
                  {!sidebarCollapsed && <span className="text-sm">{item.label}</span>}
                </Button>
              </Link>
              );
            })}
            {/* Collapse / expand toggle */}
            <button
              type="button"
              onClick={() => setSidebarCollapsed(v => !v)}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-pressed={sidebarCollapsed}
              className={`mt-1 w-full ${sidebarCollapsed ? 'justify-center' : 'justify-end gap-1.5 px-3'} flex items-center py-2 h-auto rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors`}
            >
              {sidebarCollapsed
                ? <ChevronRight className="w-4 h-4" />
                : <><span className="text-[11px]">Collapse</span><ChevronLeft className="w-4 h-4" /></>}
            </button>
          </div>
        </motion.nav>

        {/* Main Content — flex-col + overflow-y-auto + min-h-0 lets the inner
            content scroll independently of the fixed sidebar. min-h-0 is
            critical: in a column flex layout, children with flex-1 default to
            min-content sizing which prevents overflow:auto from kicking in. */}
        <main className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden gradient-mesh flex flex-col" style={{overscrollBehavior: 'none'}}>
          <CloudSyncBanner
            isCloudSyncing={isCloudSyncing}
            cloudSyncStatus={cloudSyncStatus}
            lastSyncError={lastSyncError}
            onRetry={retryCloudSync}
            vaultId={activeVault?.id}
          />
          <div className="px-6 pb-6 pt-1 flex-1 min-w-0">
            <AnalyticsIntegration>
              <ErrorBoundary level="page" resetKey={location}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={location}
                    {...slideUp}
                    className="will-change-transform"
                  >
                    {children}
                  </motion.div>
                </AnimatePresence>
              </ErrorBoundary>
            </AnalyticsIntegration>
          </div>
          <Footer />
        </main>
      </div>

      {/* Mobile Main Content — no footer on mobile (BottomTabs replace it) */}
      <main className="lg:hidden flex-1 min-h-0 w-full max-w-full gradient-mesh flex flex-col overflow-y-auto overflow-x-hidden" style={{overscrollBehavior: 'none', WebkitOverflowScrolling: 'touch'}}>
        <CloudSyncBanner
          isCloudSyncing={isCloudSyncing}
          cloudSyncStatus={cloudSyncStatus}
          lastSyncError={lastSyncError}
          onRetry={retryCloudSync}
        />
        <div className="w-full min-w-0 px-4 pb-[calc(96px+env(safe-area-inset-bottom,0px))] flex-1 overflow-x-hidden">
          <AnalyticsIntegration>
            <ErrorBoundary level="page" resetKey={location}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={location}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className="will-change-transform"
                >
                  {children}
                </motion.div>
              </AnimatePresence>
            </ErrorBoundary>
          </AnalyticsIntegration>
        </div>
      </main>

      {/* Lazy-loaded modals — only mount when their `open` flag is true so
          the dialog code (and any heavy sub-deps it pulls in) is fetched
          on demand rather than baked into the main bundle. Each one is
          wrapped in its own Suspense so a slow chunk fetch can't suspend
          the whole authenticated layout. */}
      <React.Suspense fallback={null}>
        {showQuickAdd && (
          <QuickAddMenu open={showQuickAdd} onClose={() => setShowQuickAdd(false)} />
        )}
      </React.Suspense>
      <React.Suspense fallback={null}>
        {showCommandPalette && (
          <CommandPalette open={showCommandPalette} onOpenChange={setShowCommandPalette} />
        )}
      </React.Suspense>

      {/* Bottom Navigation for Mobile - New BottomTabs Component */}
      <BottomTabs items={bottomTabItems} />

      {/* Hamburger Drawer (left-slide) — replaces the older bottom-sheet for the
          ☰ menu trigger. The MoreSheet component still ships from
          @/components/mobile in case any other surface still needs a bottom
          variant; the hamburger flow now uses HamburgerDrawer. */}
      <HamburgerDrawer
        open={showQuickAccess}
        onOpenChange={setShowQuickAccess}
        sections={allSections}
        header={
          <div className="flex items-center gap-2.5">
            <AppLogo size={28} />
            <div className="min-w-0">
              <div className="text-[15px] font-bold leading-tight truncate">IronVault</div>
              {accountEmail && (
                <div className="text-[11px] text-muted-foreground truncate">{accountEmail}</div>
              )}
            </div>
          </div>
        }
        footer={
          <div className="flex items-center justify-between gap-2">
            <CloudSyncPill vaultId={activeVault?.id ?? null} compact />
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="h-9 px-3 rounded-xl text-[13px]"
              aria-label="Toggle theme"
            >
              {resolvedTheme === 'dark' ? <Sun className="w-4 h-4 mr-1.5" /> : <Moon className="w-4 h-4 mr-1.5" />}
              {resolvedTheme === 'dark' ? 'Light' : 'Dark'}
            </Button>
          </div>
        }
      />

      {/* Global Search Modal - mobile */}
      <SearchModal
        open={showSearchModal}
        onOpenChange={(open) => {
          setShowSearchModal(open);
          if (open) {
            setHasSearchInteracted(false);
            setSearchQuery('');
            setLocalSearchQuery('');
          } else {
            setSearchQuery('');
            setLocalSearchQuery('');
          }
        }}
        searchQuery={localSearchQuery}
        onSearchChange={(q) => { setLocalSearchQuery(q); setSearchQuery(q); }}
        results={(() => {
          const q = localSearchQuery.toLowerCase();
          return {
            passwords: (passwords ?? [])
              .filter(p => p.name?.toLowerCase()?.includes(q) || p.username?.toLowerCase()?.includes(q))
              .map(p => ({ id: p.id, type: 'password' as const, title: p.name, subtitle: p.username, href: `/passwords?openId=${encodeURIComponent(p.id)}` })),
            subscriptions: (subscriptions ?? [])
              .filter(s => s.name?.toLowerCase()?.includes(q))
              .map(s => ({ id: s.id, type: 'subscription' as const, title: s.name, subtitle: s.category, href: `/subscriptions?openId=${encodeURIComponent(s.id)}` })),
            notes: (notes ?? [])
              .filter(n => n.title?.toLowerCase()?.includes(q) || n.content?.toLowerCase()?.includes(q))
              .map(n => ({ id: n.id, type: 'note' as const, title: n.title, href: `/notes?openId=${encodeURIComponent(n.id)}` })),
            // ExpenseEntry schema uses `title`, not `description` — the older
            // code read `(e as any).description` which is always undefined,
            // so expenses never matched search. Read `title` first, with
            // notes as a secondary haystack.
            expenses: (expenses ?? [])
              .filter(e => e.title?.toLowerCase()?.includes(q) || e.category?.toLowerCase()?.includes(q) || e.notes?.toLowerCase()?.includes(q))
              .map(e => ({ id: e.id, type: 'expense' as const, title: e.title || e.category || 'Expense', subtitle: e.category, href: `/expenses?openId=${encodeURIComponent(e.id)}` })),
            reminders: (reminders ?? [])
              .filter(r => r.title?.toLowerCase()?.includes(q))
              .map(r => ({ id: r.id, type: 'reminder' as const, title: r.title, href: `/reminders?openId=${encodeURIComponent(r.id)}` })),
            creditCards: (creditCards ?? [])
              .filter(c => c.cardName?.toLowerCase()?.includes(q) || c.cardholderName?.toLowerCase()?.includes(q) || c.brand?.toLowerCase()?.includes(q))
              .map(c => ({ id: c.id, type: 'card' as const, title: c.cardName, subtitle: c.cardholderName, href: `/cards?openId=${encodeURIComponent(c.id)}` })),
            identities: (identities ?? [])
              .filter(i => {
                const fullName = [i.firstName, i.middleName, i.lastName].filter(Boolean).join(' ').toLowerCase();
                return (
                  i.title?.toLowerCase()?.includes(q) ||
                  fullName.includes(q) ||
                  i.documentNumber?.toLowerCase()?.includes(q) ||
                  i.email?.toLowerCase()?.includes(q)
                );
              })
              .map(i => ({
                id: i.id,
                type: 'identity' as const,
                title: i.title,
                subtitle: [i.firstName, i.lastName].filter(Boolean).join(' ') || undefined,
                href: `/identities?openId=${encodeURIComponent(i.id)}`,
              })),
            cryptoWallets: (cryptoWallets ?? [])
              .filter(w => w.name?.toLowerCase()?.includes(q) || w.walletAddress?.toLowerCase()?.includes(q) || w.exchangeName?.toLowerCase()?.includes(q))
              .map(w => ({ id: w.id, type: 'crypto' as const, title: w.name, subtitle: w.walletType?.toUpperCase(), href: '/crypto' })),
            wifiPasswords: (wifiPasswords ?? [])
              .filter(w => w.networkName?.toLowerCase()?.includes(q) || w.location?.toLowerCase()?.includes(q))
              .map(w => ({ id: w.id, type: 'wifi' as const, title: w.networkName, subtitle: w.location || w.securityType, href: '/wifi' })),
            softwareLicenses: (softwareLicenses ?? [])
              .filter(l => l.softwareName?.toLowerCase()?.includes(q) || l.vendor?.toLowerCase()?.includes(q))
              .map(l => ({ id: l.id, type: 'license' as const, title: l.softwareName, subtitle: l.vendor || l.version, href: '/licenses' })),
            insurancePolicies: (insurancePolicies ?? [])
              .filter(p => p.policyName?.toLowerCase()?.includes(q) || p.insurer?.toLowerCase()?.includes(q) || p.policyNumber?.toLowerCase()?.includes(q))
              .map(p => ({ id: p.id, type: 'insurance' as const, title: p.policyName, subtitle: p.insurer, href: '/insurance' })),
            taxDocuments: (taxDocuments ?? [])
              .filter(d => d.documentName?.toLowerCase()?.includes(q) || d.financialYear?.toLowerCase()?.includes(q) || d.panNumber?.toLowerCase()?.includes(q))
              .map(d => ({ id: d.id, type: 'tax' as const, title: d.documentName, subtitle: `FY ${d.financialYear}`, href: '/tax' })),
            qrCodes: (qrCodes ?? [])
              .filter(qr => qr.name?.toLowerCase()?.includes(q) || qr.qrData?.toLowerCase()?.includes(q))
              .map(qr => ({ id: qr.id, type: 'qr' as const, title: qr.name, subtitle: qr.category, href: '/qr' })),
            secureBookmarks: (secureBookmarks ?? [])
              .filter(b => b.title?.toLowerCase()?.includes(q) || b.url?.toLowerCase()?.includes(q) || (b.tags || []).some(t => t.toLowerCase().includes(q)))
              .map(b => ({ id: b.id, type: 'bookmark' as const, title: b.title, subtitle: b.category || b.url, href: '/bookmarks' })),
            familyMembers: (familyMembers ?? [])
              .filter(m => m.name?.toLowerCase()?.includes(q) || m.email?.toLowerCase()?.includes(q))
              .map(m => ({ id: m.id, type: 'family' as const, title: m.name, subtitle: m.email, href: '/family' })),
          };
        })()}
      />

      <React.Suspense fallback={null}>
        {showGenerator && (
          <PasswordGeneratorModal open={showGenerator} onOpenChange={setShowGenerator} />
        )}
      </React.Suspense>
      <React.Suspense fallback={null}>
        {showImportExport && (
          <ImportExportModal open={showImportExport} onOpenChange={setShowImportExport} />
        )}
      </React.Suspense>
      <React.Suspense fallback={null}>
        {showExtensionPairing && (
          <ExtensionPairingModal open={showExtensionPairing} onOpenChange={setShowExtensionPairing} />
        )}
      </React.Suspense>

      {/* Vault switcher is now handled inline via Radix DropdownMenu in both
          the mobile chip and desktop button — no portal needed. */}

      {/* Biometric setup prompt — only mounts after the vault is unlocked
          AND a master password is in memory. Wrapped in Suspense so the
          lazy chunk doesn't block first paint. */}
      <React.Suspense fallback={null}>
        {!!masterPassword && (
          <BiometricSetupPrompt masterPassword={masterPassword} vaultId={activeVault?.id ?? null} />
        )}
      </React.Suspense>
    </div>
    </UIActionsProvider>
  );
}

// Enables document-level scrolling for public/landing pages.
// The vault app uses overflow-hidden on html/body/root to manage its own scroll
// panes — this restores normal scroll when the landing page or auth pages are shown.
function PublicPageWrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const els = [document.documentElement, document.body, document.getElementById('root')];
    els.forEach(el => { if (el) el.style.overflowY = 'auto'; });
    return () => {
      els.forEach(el => { if (el) el.style.overflowY = ''; });
    };
  }, []);
  return <>{children}</>;
}

// Shared public info routes (used in multiple tiers)
const PUBLIC_INFO_ROUTES = (
  <>
    <Route path="/about" component={AboutPage} />
    <Route path="/faq" component={FAQPage} />
    <Route path="/features" component={FeaturesPage} />
    <Route path="/security" component={SecurityPage} />
    <Route path="/contact" component={ContactPage} />
    <Route path="/docs" component={DocsPage} />
    <Route path="/support" component={DocsPage} />
    <Route path="/privacy" component={PrivacyPage} />
    <Route path="/terms" component={TermsPage} />
    <Route path="/disclaimer" component={DisclaimerPage} />
    <Route path="/cookies" component={PrivacyPage} />
    <Route path="/pricing" component={PricingPage} />
    <Route path="/blog" component={BlogPage} />
    <Route path="/changelog" component={ChangelogPage} />
    <Route path="/status" component={StatusPage} />
    <Route path="/roadmap" component={AboutPage} />
    <Route path="/api" component={AboutPage} />
  </>
);

// Suspense fallback used while a lazy-loaded route chunk is fetching.
// BUG-09: render a themed skeleton (not bare text on transparent bg) so
// route transitions don't flash a black/blank screen between chunks.
function RouteSuspenseFallback() {
  // No fade-in here — the boundary already takes the perceptible part of the
  // chunk fetch (especially on Integrations / Emergency Access where the
  // chunks aren't pre-warmed), so an opacity-from-0 ramp manifests as a
  // visible "blank flash" before the skeleton becomes legible.
  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        <div className="h-8 w-40 rounded-md bg-muted/60 animate-pulse" />
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
        <div className="space-y-2 mt-4">
          <div className="h-12 rounded-lg bg-muted/40 animate-pulse" />
          <div className="h-12 rounded-lg bg-muted/40 animate-pulse" />
          <div className="h-12 rounded-lg bg-muted/40 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// Router Component
function Router() {
  const { isUnlocked, isLoading, isAccountLoggedIn } = useAuth();
  const [location] = useLocation();

  // Warm up the lazy chunks once the vault is unlocked, so the first navigation
  // doesn't pay a chunk-fetch cost. Cheap & idempotent — runs at most once.
  useEffect(() => {
    if (isUnlocked) warmRouteChunks();
  }, [isUnlocked]);

  // Share links are always public — bypass all auth checks
  if (location.startsWith('/share/')) {
    return (
      <React.Suspense fallback={<RouteSuspenseFallback />}>
        <ShareView />
      </React.Suspense>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-mesh">
        <div className="text-center animate-fade-in">
          <div className="animate-pulse-glow rounded-full inline-block p-1 mb-6">
            <AppLogo size={72} variant="hero" />
          </div>
          <p className="text-muted-foreground text-sm font-medium tracking-wide">Loading IronVault...</p>
        </div>
      </div>
    );
  }

  // ── Tier 1: No account session → marketing landing + auth pages ──────────────
  if (!isAccountLoggedIn) {
    return (
      <PublicPageWrapper>
        <React.Suspense fallback={<RouteSuspenseFallback />}>
          <Switch>
            <Route path="/" component={LandingPage} />
            <Route path="/auth/login" component={Login} />
            <Route path="/auth/signup" component={SignupPage} />
            <Route path="/auth/forgot-password" component={ForgotPasswordPage} />
            <Route path="/auth/reset-password" component={ResetPasswordPage} />
            <Route path="/auth/verify" component={VerifyEmailPage} />
            <Route path="/login" component={Login} />
            {/* Share-redeem is intentionally public — the link recipient may
                not have an IronVault account at all. The blob is E2E encrypted
                with a key in the URL fragment, so no auth gating is needed. */}
            <Route path="/share/:id" component={ShareRedeem} />
            {PUBLIC_INFO_ROUTES}
            {/* Catch-all → landing */}
            <Route component={LandingPage} />
          </Switch>
        </React.Suspense>
      </PublicPageWrapper>
    );
  }

  // ── Tier 2: Account logged in but vault locked → vault picker + create-vault ─
  if (!isUnlocked) {
    // BUG-08: capture the intended URL so we can return there after unlock.
    // Skip auth/landing/share/upgrade paths and the picker itself — we only
    // want to remember "deep" app destinations like /passwords, /notes etc.
    try {
      const path = location;
      const skip = path === '/' ||
        path.startsWith('/auth') ||
        path.startsWith('/login') ||
        path.startsWith('/upgrade') ||
        path.startsWith('/share/');
      if (!skip) {
        sessionStorage.setItem('iv_post_unlock_redirect', path);
      }
    } catch { /* noop */ }
    return (
      <PublicPageWrapper>
        <React.Suspense fallback={<RouteSuspenseFallback />}>
          <Switch>
            <Route path="/auth/create-vault" component={CreateVaultPage} />
            <Route path="/auth/forgot-password" component={ForgotPasswordPage} />
            <Route path="/auth/reset-password" component={ResetPasswordPage} />
            <Route path="/auth/verify" component={VerifyEmailPage} />
            {/* Redirect signup/login to vault picker (already logged in) */}
            <Route path="/auth/signup" component={VaultPickerPage} />
            <Route path="/auth/login" component={VaultPickerPage} />
            {/* /upgrade must be reachable from the vault picker too — without
                this it hits the catch-all and silently re-renders the picker,
                looking like a blank page where plans should be. */}
            <Route path="/upgrade" component={UpgradePage} />
            {PUBLIC_INFO_ROUTES}
            {/* Default → vault picker */}
            <Route component={VaultPickerPage} />
          </Switch>
        </React.Suspense>
      </PublicPageWrapper>
    );
  }

  // CRITICAL: pass JSX children to <Route>, NOT inline arrow functions to
  // the `component` prop. Inline arrow functions create a fresh component
  // reference on every parent re-render, which makes wouter unmount and
  // remount the entire page tree on each App re-render. That was the root
  // cause of "note editor closes mid-typing": every autosave triggered a
  // vault-context state change, which cascaded a re-render up to App,
  // which created new Route component refs, which unmounted /notes,
  // which destroyed the editor's local `editorOpen` state. Children-style
  // routes pass stable JSX trees so React reconciles in place.
  return (
    <React.Suspense fallback={<RouteSuspenseFallback />}>
    <Switch>
      <Route path="/"><MainLayout><Dashboard /></MainLayout></Route>
      {/* Bug 11: alias /dashboard so deep links / shortcuts that target the
          dashboard explicitly don't fall back to the catch-all and don't get
          confused with the Tier-1 LandingPage at "/". Renders the same
          component — no auth re-evaluation. */}
      <Route path="/dashboard"><MainLayout><Dashboard /></MainLayout></Route>
      <Route path="/security-health"><MainLayout><SecurityHealth /></MainLayout></Route>
      <Route path="/passwords"><MainLayout><Passwords /></MainLayout></Route>
      <Route path="/subscriptions"><MainLayout><Subscriptions /></MainLayout></Route>
      <Route path="/notes"><MainLayout><Notes /></MainLayout></Route>
      <Route path="/expenses"><MainLayout><Expenses /></MainLayout></Route>
      <Route path="/reminders"><MainLayout><Reminders /></MainLayout></Route>
      <Route path="/bank-statements"><MainLayout><BankStatements /></MainLayout></Route>
      <Route path="/investments"><MainLayout><Investments /></MainLayout></Route>
      <Route path="/goals"><MainLayout><Goals /></MainLayout></Route>
      <Route path="/profile"><MainLayout><Profile /></MainLayout></Route>
      <Route path="/documents"><MainLayout><Documents /></MainLayout></Route>
      <Route path="/api-keys"><MainLayout><APIKeys /></MainLayout></Route>
      <Route path="/cards"><MainLayout><CreditCards /></MainLayout></Route>
      <Route path="/identities"><MainLayout><Identities /></MainLayout></Route>
      <Route path="/crypto"><MainLayout><CryptoVault /></MainLayout></Route>
      <Route path="/wifi"><MainLayout><WifiPasswords /></MainLayout></Route>
      <Route path="/licenses"><MainLayout><SoftwareLicenses /></MainLayout></Route>
      <Route path="/insurance"><MainLayout><InsuranceVault /></MainLayout></Route>
      <Route path="/tax"><MainLayout><TaxDocuments /></MainLayout></Route>
      <Route path="/qr"><MainLayout><QRVault /></MainLayout></Route>
      <Route path="/bookmarks"><MainLayout><SecureBookmarks /></MainLayout></Route>
      <Route path="/dark-web"><MainLayout><DarkWebMonitor /></MainLayout></Route>
      <Route path="/family"><MainLayout><FamilyDashboard /></MainLayout></Route>
      <Route path="/digital-will"><MainLayout><DigitalWill /></MainLayout></Route>
      <Route path="/form-filler"><MainLayout><SmartFormFiller /></MainLayout></Route>
      <Route path="/phishing"><MainLayout><PhishingShield /></MainLayout></Route>
      <Route path="/breach-timeline"><MainLayout><BreachTimeline /></MainLayout></Route>
      <Route path="/couple"><MainLayout><CoupleVault /></MainLayout></Route>
      {/* Share-redeem renders with its own minimal layout (no sidebar) so an
          authenticated user opening a share link sees the same clean view
          a logged-out recipient would. */}
      <Route path="/share/:id" component={ShareRedeem} />
      <Route path="/logging"><MainLayout><Logging /></MainLayout></Route>
      <Route path="/settings"><MainLayout><Settings /></MainLayout></Route>
      <Route path="/integrations"><MainLayout><Integrations /></MainLayout></Route>
      <Route path="/emergency-access"><MainLayout><EmergencyAccess /></MainLayout></Route>
      <Route path="/import-passwords"><MainLayout><ImportPasswords /></MainLayout></Route>
      <Route path="/qa"><MainLayout><QAPage /></MainLayout></Route>
      <Route path="/vaults"><MainLayout><VaultsPage /></MainLayout></Route>
      <Route path="/teams"><MainLayout><TeamsPage /></MainLayout></Route>

      {/* Public Information Pages — wrap each in PublicPageWrapper so the
          vault shell's overflow-hidden on html/body/root is overridden and
          these pages can scroll the document. Tier 1 and Tier 2 already wrap
          the whole Switch in PublicPageWrapper; tier 3 (authenticated) needs
          per-route wrapping because MainLayout-based vault routes share the
          same Switch and must keep the no-document-scroll behavior. */}
      <Route path="/about"><PublicPageWrapper><AboutPage /></PublicPageWrapper></Route>
      <Route path="/faq"><PublicPageWrapper><FAQPage /></PublicPageWrapper></Route>
      <Route path="/features"><PublicPageWrapper><FeaturesPage /></PublicPageWrapper></Route>
      <Route path="/security"><PublicPageWrapper><SecurityPage /></PublicPageWrapper></Route>
      <Route path="/contact"><PublicPageWrapper><ContactPage /></PublicPageWrapper></Route>
      <Route path="/docs"><PublicPageWrapper><DocsPage /></PublicPageWrapper></Route>
      <Route path="/support"><PublicPageWrapper><DocsPage /></PublicPageWrapper></Route>
      <Route path="/privacy"><PublicPageWrapper><PrivacyPage /></PublicPageWrapper></Route>
      <Route path="/terms"><PublicPageWrapper><TermsPage /></PublicPageWrapper></Route>
      <Route path="/disclaimer"><PublicPageWrapper><DisclaimerPage /></PublicPageWrapper></Route>
      <Route path="/cookies"><PublicPageWrapper><PrivacyPage /></PublicPageWrapper></Route>
      <Route path="/pricing"><PublicPageWrapper><PricingPage /></PublicPageWrapper></Route>
      <Route path="/blog"><PublicPageWrapper><BlogPage /></PublicPageWrapper></Route>
      <Route path="/changelog"><PublicPageWrapper><ChangelogPage /></PublicPageWrapper></Route>
      <Route path="/status"><PublicPageWrapper><StatusPage /></PublicPageWrapper></Route>
      <Route path="/roadmap"><PublicPageWrapper><AboutPage /></PublicPageWrapper></Route>
      <Route path="/api"><PublicPageWrapper><AboutPage /></PublicPageWrapper></Route>
      <Route path="/upgrade"><MainLayout><UpgradePage /></MainLayout></Route>
      <Route component={NotFound} />
    </Switch>
    </React.Suspense>
  );
}

function App() {
  // Initialize notification service
  React.useEffect(() => {
    try {
      NotificationService.initialize();
    } catch (error) {
      console.error('Error initializing notification service:', error);
    }
  }, []);

  // Auto-center focused inputs on mobile (keeps field visible above virtual keyboard)
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handler = (e: FocusEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
        clearTimeout(timer);
        timer = setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
    };
    document.addEventListener('focus', handler, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('focus', handler, true);
    };
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={150} skipDelayDuration={300}>
          <ThemeProvider>
            <LoggingProvider>
              <AuthProvider>
                <CurrencyProvider>
                  <VaultProvider>
                    <SearchProvider>
                      <LicenseProvider>
                        <VaultSelectionProvider>
                          <Toaster />
                          <ZohoSalesIQIdentity />
                          <Router />
                          {/* PWA / extension nudges. The browser-extension
                              prompt is lazy + idle — its only purpose is
                              suggesting the Chrome extension to logged-in
                              users, so blocking initial paint to load it
                              is wasteful. */}
                          <PWAOfflineIndicator />
                          <React.Suspense fallback={null}>
                            <BrowserExtensionPrompt />
                          </React.Suspense>
                        </VaultSelectionProvider>
                      </LicenseProvider>
                    </SearchProvider>
                  </VaultProvider>
                </CurrencyProvider>
              </AuthProvider>
            </LoggingProvider>
          </ThemeProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;