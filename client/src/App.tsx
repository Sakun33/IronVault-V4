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
import { CurrencyProvider } from "@/contexts/currency-context";
import { LoggingProvider } from "@/contexts/logging-context";
import { ThemeProvider, useTheme } from "@/contexts/theme-context";
import { LicenseProvider } from "@/contexts/license-context";
import { VaultSelectionProvider, useVaultSelection } from "@/contexts/vault-selection-context";
import { useSubscription } from "@/hooks/use-subscription";
import { useCloudAutoSync } from "@/hooks/use-cloud-auto-sync";
import { listCloudVaults, markVaultAsCloudSynced, pushCloudVault } from "@/lib/cloud-vault-sync";
import { vaultStorage } from "@/lib/storage";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import LandingPage from "@/pages/landing";
import VaultPickerPage from "@/pages/vault-picker";
// Heavy / less-frequently-visited pages are code-split so they don't bloat the
// initial bundle. The Suspense fallback inside <Router /> covers their loading.
const SignupPage = React.lazy(() => import("@/pages/signup"));
const ForgotPasswordPage = React.lazy(() => import("@/pages/forgot-password"));
const ResetPasswordPage = React.lazy(() => import("@/pages/reset-password"));
const VerifyEmailPage = React.lazy(() => import("@/pages/verify-email"));
const Dashboard = React.lazy(() => import("@/pages/dashboard"));
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
const Profile = React.lazy(() => import("@/pages/profile"));
const Settings = React.lazy(() => import("@/pages/settings"));
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, RefreshCw, Settings as SettingsIcon, Bookmark, Key, BarChart3, Upload, Download, BookOpen, DollarSign, Bell, FileText, Building2, TrendingUp, Plus, Menu, X, Shield, Target, User, XCircle, ShieldCheck, Lock, Zap, ChevronDown, ChevronLeft, ChevronRight, Database, Check, MoreVertical, Sun, Moon } from "lucide-react";
import { AppLogo } from "@/components/app-logo";
import { BottomTabs, MoreSheet, SearchModal, type TabItem, type SectionItem } from "@/components/mobile";
import React, { useState, useEffect, useCallback } from "react";
import { PasswordGeneratorModal } from "@/components/password-generator-modal";
import { ImportExportModal } from "@/components/import-export-modal";
import { ExtensionPairingModal } from "@/components/extension-pairing-modal";
import { SecuritySettingsModal } from "@/components/security-settings-modal";
import { PWAOfflineIndicator } from "@/components/pwa-offline-indicator";
import { BrowserExtensionPrompt } from "@/components/browser-extension-prompt";
import { SimpleThemeToggle, ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { NotificationService } from "@/lib/notifications";
import { SectionCard } from "@/components/StatCard";
import { ToolsMenu } from "@/components/tools-menu";
import { AnalyticsIntegration } from "@/components/analytics-integration";
import { Footer } from "@/components/footer";
import { QuickAddMenu } from "@/components/quick-add-fab";
import { CommandPalette } from "@/components/command-palette";
import { ZohoSalesIQIdentity } from "@/components/zoho-salesiq-identity";
import { BiometricSetupPrompt } from "@/components/biometric-setup-prompt";

// Main Layout Component for authenticated users
function MainLayout({ children }: { children: React.ReactNode }) {
  const reducedMotion = useReducedMotion();
  const slideUp = makeSlideUp(reducedMotion);
  const { logout, masterPassword, isUnlocked, accountEmail } = useAuth();
  const notificationUserId = accountEmail || 'guest';
  const { searchQuery, setSearchQuery, stats, isCloudSyncing, passwords, subscriptions, notes, expenses, reminders } = useVault();
  const { getLimit, isPro } = useSubscription();
  const { vaults, activeVault, requestVaultSwitch } = useVaultSelection();
  const { toggleTheme, resolvedTheme } = useTheme();
  useCloudAutoSync(activeVault?.id, masterPassword);

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

  // Cmd+K (Mac) / Ctrl+K (Win/Linux) opens the global command palette.
  // Bound at the layout level so it works on every authenticated page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Collapsible sidebar — persists across reloads. Defaults to expanded.
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('iv_sidebar_collapsed') === '1';
  });
  useEffect(() => {
    try { localStorage.setItem('iv_sidebar_collapsed', sidebarCollapsed ? '1' : '0'); } catch {}
  }, [sidebarCollapsed]);

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
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3, count: null, limitLabel: null as string | null, color: 'text-primary', requiresPro: false },
    { id: 'vaults', label: 'Vaults', icon: ShieldCheck, count: null, limitLabel: null as string | null, color: 'text-violet-600', requiresPro: false },
    { id: 'passwords', label: 'Passwords', icon: Key, count: stats.totalPasswords, limitLabel: isPro ? null : `${stats.totalPasswords}/${getLimit('passwords')}`, color: 'text-primary', requiresPro: false },
    { id: 'notes', label: 'Notes', icon: BookOpen, count: stats.totalNotes, limitLabel: isPro ? null : `${stats.totalNotes}/${getLimit('notes')}`, color: 'text-orange-600', requiresPro: false },
    { id: 'documents', label: 'Documents', icon: FileText, count: null, color: 'text-indigo-600', requiresPro: true },
    { id: 'api-keys', label: 'API Keys', icon: Shield, count: null, color: 'text-cyan-600', requiresPro: true },
  ];
  // Finance items (second section)
  const financeNavItems = [
    { id: 'subscriptions', label: 'Subscriptions', icon: Bookmark, count: stats.activeSubscriptions, limitLabel: null as string | null, color: 'text-purple-600', requiresPro: true },
    { id: 'expenses', label: 'Expenses', icon: DollarSign, count: stats.totalExpenses, color: 'text-red-600', requiresPro: true },
    { id: 'bank-statements', label: 'Bank Statements', icon: Building2, count: null, color: 'text-indigo-600', requiresPro: true },
    { id: 'investments', label: 'Investment / Goals', icon: TrendingUp, count: null, color: 'text-emerald-600', requiresPro: true },
    { id: 'reminders', label: 'Reminders', icon: Bell, count: stats.totalReminders, color: 'text-yellow-600', requiresPro: false },
  ];
  // Bottom pinned items (system/account)
  const bottomNavItems = [
    { id: 'profile', label: 'Profile', icon: User, count: null, color: 'text-primary', requiresPro: false },
    { id: 'logging', label: 'Activity Logs', icon: FileText, count: null, color: 'text-muted-foreground', requiresPro: false },
    { id: 'settings', label: 'Settings', icon: SettingsIcon, count: null, color: 'text-muted-foreground', requiresPro: false },
    { id: 'upgrade', label: 'Upgrade to Pro', icon: Zap, count: null, color: 'text-primary', requiresPro: false },
  ];
  // Flat list for mobile menu and other consumers
  const navItems = [...coreNavItems, ...financeNavItems, ...bottomNavItems];

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
    // Finance group
    { id: 'subscriptions', label: 'Subscriptions', icon: Bookmark, href: '/subscriptions', group: 'finance', count: stats.activeSubscriptions },
    { id: 'expenses', label: 'Expenses', icon: DollarSign, href: '/expenses', group: 'finance', count: stats.totalExpenses },
    { id: 'bank-statements', label: 'Bank Statements', icon: Building2, href: '/bank-statements', group: 'finance' },
    { id: 'investments', label: 'Investments', icon: TrendingUp, href: '/investments', group: 'finance' },
    { id: 'goals', label: 'Goals', icon: Target, href: '/goals', group: 'finance' },
    // Tools group
    { id: 'reminders', label: 'Reminders', icon: Bell, href: '/reminders', group: 'tools', count: stats.totalReminders },
    { id: 'logging', label: 'Activity Logs', icon: FileText, href: '/logging', group: 'tools' },
    // Account group
    { id: 'profile', label: 'Profile', icon: User, href: '/profile', group: 'account' },
    { id: 'settings', label: 'Settings', icon: SettingsIcon, href: '/settings', group: 'account' },
  ];

  return (
    <div className="h-[100dvh] bg-background overflow-hidden flex flex-col w-full" style={{width: '100%', maxWidth: '100vw'}}>
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50 px-3 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between h-14">
          {/* Left: hamburger + logo */}
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => setShowQuickAccess(true)} className="h-9 w-9 rounded-xl" title="Menu" aria-label="Menu">
                  <Menu className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Menu</TooltipContent>
            </Tooltip>
            <button onClick={() => setLocation('/')} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
              <AppLogo size={26} />
              <span className="text-sm font-bold tracking-tight text-foreground">IronVault</span>
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
          </div>

          {/* Right: Search | Quick Add | Overflow ⋮ */}
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => setShowSearchModal(true)} className="h-9 w-9 rounded-xl" title="Search" aria-label="Search">
                  <Search className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Search</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => setShowQuickAdd(true)} className="h-9 w-9 rounded-xl" title="Quick Add" aria-label="Quick Add">
                  <Plus className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Quick Add</TooltipContent>
            </Tooltip>
            <NotificationBell userId={notificationUserId} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" title="More" aria-label="More options">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[180px]">
                <DropdownMenuItem className="gap-2" onClick={toggleTheme}>
                  {resolvedTheme === 'dark' ? <Sun className="w-4 h-4 text-muted-foreground" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
                  Toggle Theme
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2" onClick={() => setLocation('/profile')}>
                  <User className="w-4 h-4 text-muted-foreground" /> Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onClick={handleLockVault}>
                  <Lock className="w-4 h-4" /> Lock Vault
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      {/* Spacer for fixed header + safe area */}
      <div className="lg:hidden h-[calc(env(safe-area-inset-top)+56px)]" />

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
                  <DropdownMenuItem asChild>
                    <a href="/vaults" className="gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Manage Vaults</span>
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
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
                <span title="Notifications"><NotificationBell userId={notificationUserId} /></span>
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

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => setLocation('/profile')} className="p-2 rounded-xl hover:bg-accent text-foreground" title="Profile" aria-label="Profile">
                  <User className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Profile</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={handleLockVault} className="p-2 rounded-xl hover:bg-accent text-foreground" title="Lock Vault" aria-label="Lock Vault">
                  <Lock className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Lock Vault</TooltipContent>
            </Tooltip>
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
          animate={{ width: sidebarCollapsed ? 68 : 240 }}
          initial={false}
          transition={{ type: 'spring', stiffness: 300, damping: 32 }}
          className="flex-shrink-0 glass-surface border-r p-3 flex flex-col h-full"
        >
          {/* Scrollable primary nav items with section groups */}
          <div className="flex-1 overflow-y-auto min-h-0 smooth-scrollbar">
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
        <main className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden gradient-mesh flex flex-col">
          {isCloudSyncing && (
            <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border-b border-primary/20 text-primary text-sm">
              <svg className="w-3.5 h-3.5 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Syncing from cloud…
            </div>
          )}
          <div className="p-6 flex-1 min-w-0">
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
      <main className="lg:hidden flex-1 min-h-0 w-full max-w-full gradient-mesh flex flex-col overflow-y-auto overflow-x-hidden">
        {isCloudSyncing && (
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border-b border-primary/20 text-primary text-sm">
            <svg className="w-3.5 h-3.5 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Syncing from cloud…
          </div>
        )}
        <div className="w-full min-w-0 p-4 pb-[calc(96px+env(safe-area-inset-bottom))] flex-1 overflow-x-hidden">
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

      {/* Quick-Add Menu - controlled from header + button */}
      <QuickAddMenu open={showQuickAdd} onClose={() => setShowQuickAdd(false)} />

      {/* Global Cmd+K command palette */}
      <CommandPalette open={showCommandPalette} onOpenChange={setShowCommandPalette} />

      {/* Bottom Navigation for Mobile - New BottomTabs Component */}
      <BottomTabs items={bottomTabItems} />

      {/* More Sheet - New MoreSheet Component */}
      <MoreSheet
        open={showQuickAccess}
        onOpenChange={setShowQuickAccess}
        sections={allSections}
      />

      {/* Global Search Modal - mobile */}
      <SearchModal
        open={showSearchModal}
        onOpenChange={(open) => {
          setShowSearchModal(open);
          if (!open) { setSearchQuery(''); setLocalSearchQuery(''); }
        }}
        searchQuery={localSearchQuery}
        onSearchChange={(q) => { setLocalSearchQuery(q); setSearchQuery(q); }}
        results={(() => {
          const q = localSearchQuery.toLowerCase();
          return {
            passwords: (passwords ?? [])
              .filter(p => p.name?.toLowerCase()?.includes(q) || p.username?.toLowerCase()?.includes(q))
              .map(p => ({ id: p.id, type: 'password' as const, title: p.name, subtitle: p.username, href: '/passwords' })),
            subscriptions: (subscriptions ?? [])
              .filter(s => s.name?.toLowerCase()?.includes(q))
              .map(s => ({ id: s.id, type: 'subscription' as const, title: s.name, subtitle: s.category, href: '/subscriptions' })),
            notes: (notes ?? [])
              .filter(n => n.title?.toLowerCase()?.includes(q) || n.content?.toLowerCase()?.includes(q))
              .map(n => ({ id: n.id, type: 'note' as const, title: n.title, href: '/notes' })),
            expenses: (expenses ?? [])
              .filter(e => (e as any).description?.toLowerCase()?.includes(q) || e.category?.toLowerCase()?.includes(q))
              .map(e => ({ id: e.id, type: 'expense' as const, title: (e as any).description || e.category || 'Expense', subtitle: e.category, href: '/expenses' })),
            reminders: (reminders ?? [])
              .filter(r => r.title?.toLowerCase()?.includes(q))
              .map(r => ({ id: r.id, type: 'reminder' as const, title: r.title, href: '/reminders' })),
          };
        })()}
      />

      <PasswordGeneratorModal
        open={showGenerator}
        onOpenChange={setShowGenerator}
      />
      <ImportExportModal
        open={showImportExport}
        onOpenChange={setShowImportExport}
      />
      <ExtensionPairingModal
        open={showExtensionPairing}
        onOpenChange={setShowExtensionPairing}
      />

      {/* Vault switcher is now handled inline via Radix DropdownMenu in both
          the mobile chip and desktop button — no portal needed. */}

      {/* Biometric setup prompt — shown once per session after password unlock on native */}
      <BiometricSetupPrompt masterPassword={masterPassword} vaultId={activeVault?.id ?? null} />
    </div>
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
function RouteSuspenseFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground text-sm">Loading…</div>
    </div>
  );
}

// Router Component
function Router() {
  const { isUnlocked, isLoading, isAccountLoggedIn } = useAuth();
  const [location] = useLocation();

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

  return (
    <React.Suspense fallback={<RouteSuspenseFallback />}>
    <Switch>
      <Route path="/" component={() => (
        <MainLayout>
          <Dashboard />
        </MainLayout>
      )} />
      <Route path="/passwords" component={() => (
        <MainLayout>
          <Passwords />
        </MainLayout>
      )} />
      <Route path="/subscriptions" component={() => (
        <MainLayout>
          <Subscriptions />
        </MainLayout>
      )} />
      <Route path="/notes" component={() => (
        <MainLayout>
          <Notes />
        </MainLayout>
      )} />
      <Route path="/expenses" component={() => (
        <MainLayout>
          <Expenses />
        </MainLayout>
      )} />
      <Route path="/reminders" component={() => (
        <MainLayout>
          <Reminders />
        </MainLayout>
      )} />
      <Route path="/bank-statements" component={() => (
        <MainLayout>
          <BankStatements />
        </MainLayout>
      )} />
      <Route path="/investments" component={() => (
        <MainLayout>
          <Investments />
        </MainLayout>
      )} />
      <Route path="/goals" component={() => (
        <MainLayout>
          <Goals />
        </MainLayout>
      )} />
      <Route path="/profile" component={() => (
        <MainLayout>
          <Profile />
        </MainLayout>
      )} />
      <Route path="/documents" component={() => (
        <MainLayout>
          <Documents />
        </MainLayout>
      )} />
      <Route path="/api-keys" component={() => (
        <MainLayout>
          <APIKeys />
        </MainLayout>
      )} />
      <Route path="/logging" component={() => (
        <MainLayout>
          <Logging />
        </MainLayout>
      )} />
      <Route path="/settings" component={() => (
        <MainLayout>
          <Settings />
        </MainLayout>
      )} />
      <Route path="/import-passwords" component={() => (
        <MainLayout>
          <ImportPasswords />
        </MainLayout>
      )} />
      <Route path="/qa" component={() => (
        <MainLayout>
          <QAPage />
        </MainLayout>
      )} />
      <Route path="/vaults" component={() => (
        <MainLayout>
          <VaultsPage />
        </MainLayout>
      )} />
      
      {/* Public Information Pages */}
      {PUBLIC_INFO_ROUTES}
      <Route path="/upgrade" component={() => (
        <MainLayout>
          <UpgradePage />
        </MainLayout>
      )} />
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
                          {/* PWA / extension nudges */}
                          <PWAOfflineIndicator />
                          <BrowserExtensionPrompt />
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