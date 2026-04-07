import { Switch, Route, Link, useLocation } from "wouter";
import { ErrorBoundary } from "@/components/error-boundary";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { VaultProvider, useVault } from "@/contexts/vault-context";
import { CurrencyProvider } from "@/contexts/currency-context";
import { LoggingProvider } from "@/contexts/logging-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { LicenseProvider } from "@/contexts/license-context";
import { VaultSelectionProvider, useVaultSelection } from "@/contexts/vault-selection-context";
import { useSubscription } from "@/hooks/use-subscription";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import SignupPage from "@/pages/signup";
import Dashboard from "@/pages/dashboard";
import Passwords from "@/pages/passwords";
import Subscriptions from "@/pages/subscriptions";
import Notes from "@/pages/notes";
import Expenses from "@/pages/expenses";
import Reminders from "@/pages/reminders";
import Logging from "@/pages/logging";
import BankStatements from "@/pages/bank-statements";
import Investments from "@/pages/investments";
import Goals from "@/pages/goals";
import Documents from "@/pages/documents";
import APIKeys from "@/pages/api-keys";
import Profile from "@/pages/profile";
import Settings from "@/pages/settings";
import AboutPage from "@/pages/info/about";
import FeaturesPage from "@/pages/info/features";
import SecurityPage from "@/pages/info/security";
import ContactPage from "@/pages/info/contact";
import DocsPage from "@/pages/info/docs";
import PrivacyPage from "@/pages/info/privacy";
import TermsPage from "@/pages/info/terms";
import DisclaimerPage from "@/pages/info/disclaimer";
import PricingPage from "@/pages/info/pricing";
import BlogPage from "@/pages/info/blog";
import ChangelogPage from "@/pages/info/changelog";
import StatusPage from "@/pages/info/status";
import LandingPage from "@/pages/landing";
import UpgradePage from "@/pages/pricing";
import QAPage from "@/pages/qa";
import VaultsPage from "@/pages/vaults";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, RefreshCw, Settings as SettingsIcon, Bookmark, Key, BarChart3, Upload, Download, BookOpen, DollarSign, Bell, FileText, Building2, TrendingUp, Plus, Menu, X, Shield, Target, User, XCircle, ShieldCheck, Lock, Zap, ChevronDown, Database } from "lucide-react";
import { AppLogo } from "@/components/app-logo";
import { BottomTabs, MoreSheet, type TabItem, type SectionItem } from "@/components/mobile";
import React, { useState, useEffect, useCallback } from "react";
import { PasswordGeneratorModal } from "@/components/password-generator-modal";
import { ImportExportModal } from "@/components/import-export-modal";
import { ExtensionPairingModal } from "@/components/extension-pairing-modal";
import { SecuritySettingsModal } from "@/components/security-settings-modal";
import { PWAOfflineIndicator } from "@/components/pwa-offline-indicator";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { SimpleThemeToggle, ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { NotificationService } from "@/lib/notifications";
import { SectionCard } from "@/components/StatCard";
import { ToolsMenu } from "@/components/tools-menu";
import { AnalyticsIntegration } from "@/components/analytics-integration";
import { Footer } from "@/components/footer";

// Main Layout Component for authenticated users
function MainLayout({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();
  const { searchQuery, setSearchQuery, stats } = useVault();
  const { getLimit, isPro } = useSubscription();
  const { vaults, activeVault, switchVault } = useVaultSelection();
  const [location, setLocation] = useLocation();
  const [showGenerator, setShowGenerator] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  const [showExtensionPairing, setShowExtensionPairing] = useState(false);
  const [showSecuritySettings, setShowSecuritySettings] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showQuickAccess, setShowQuickAccess] = useState(false);
  const [showVaultSwitcher, setShowVaultSwitcher] = useState(false);
  // Search removed from mobile header - individual pages have their own search
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const [hasSearchInteracted, setHasSearchInteracted] = useState(false);

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

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3, count: null, limitLabel: null as string | null, color: 'text-primary', requiresPro: false },
    { id: 'vaults', label: 'Vaults', icon: ShieldCheck, count: null, limitLabel: null as string | null, color: 'text-violet-600', requiresPro: false },
    { id: 'passwords', label: 'Passwords', icon: Key, count: stats.totalPasswords, limitLabel: isPro ? null : `${stats.totalPasswords}/${getLimit('passwords')}`, color: 'text-primary', requiresPro: false },
    { id: 'subscriptions', label: 'Subscriptions', icon: Bookmark, count: stats.activeSubscriptions, limitLabel: null as string | null, color: 'text-purple-600', requiresPro: true },
    { id: 'notes', label: 'Notes', icon: BookOpen, count: stats.totalNotes, limitLabel: isPro ? null : `${stats.totalNotes}/${getLimit('notes')}`, color: 'text-orange-600', requiresPro: false },
    { id: 'expenses', label: 'Expenses', icon: DollarSign, count: stats.totalExpenses, color: 'text-red-600', requiresPro: true },
    { id: 'reminders', label: 'Reminders', icon: Bell, count: stats.totalReminders, color: 'text-yellow-600', requiresPro: false },
    { id: 'bank-statements', label: 'Bank Statements', icon: Building2, count: null, color: 'text-indigo-600', requiresPro: true },
    { id: 'investments', label: 'Investment / Goals', icon: TrendingUp, count: null, color: 'text-emerald-600', requiresPro: true },
    { id: 'documents', label: 'Documents', icon: FileText, count: null, color: 'text-indigo-600', requiresPro: true },
    { id: 'api-keys', label: 'API Keys', icon: Shield, count: null, color: 'text-cyan-600', requiresPro: true },
    { id: 'profile', label: 'Profile', icon: User, count: null, color: 'text-primary', requiresPro: false },
    { id: 'logging', label: 'Activity Logs', icon: FileText, count: null, color: 'text-muted-foreground', requiresPro: false },
    { id: 'settings', label: 'Settings', icon: SettingsIcon, count: null, color: 'text-muted-foreground', requiresPro: false },
    { id: 'upgrade', label: 'Upgrade to Pro', icon: Zap, count: null, color: 'text-primary', requiresPro: false },
  ];

  // Core sections for bottom navigation (only 4 most used)
  const bottomTabItems: TabItem[] = [
    { id: 'passwords', label: 'Passwords', icon: Key, href: '/passwords', count: stats.totalPasswords },
    { id: 'subscriptions', label: 'Subscriptions', icon: Bookmark, href: '/subscriptions', count: stats.activeSubscriptions },
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3, href: '/' },
    { id: 'more', label: 'More', icon: Plus, href: '#', onClick: () => setShowQuickAccess(true) },
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
      {/* Mobile Header - Glassmorphism */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50 px-3 pt-[env(safe-area-inset-top)] pb-1.5 overflow-hidden">
        <div className="flex items-center justify-between max-w-full h-11">
          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowQuickAccess(true)}
              className="h-9 w-9 rounded-xl"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <button
              onClick={() => setLocation('/')}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <AppLogo size={28} />
              <span className="text-base font-bold tracking-tight text-foreground">IronVault</span>
            </button>
            {/* Mobile vault switcher chip */}
            {vaults.length > 1 && (
              <div className="relative">
                <button
                  className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/60 rounded-lg px-2 py-1 border border-border/40"
                  onClick={() => setShowVaultSwitcher(v => !v)}
                >
                  <span className="max-w-[70px] truncate">{activeVault?.name || 'Vault'}</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showVaultSwitcher && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowVaultSwitcher(false)} />
                    <div className="absolute left-0 top-full mt-1 z-50 min-w-[160px] bg-popover border border-border rounded-xl shadow-lg py-1 overflow-hidden">
                      {vaults.map(vault => (
                        <button
                          key={vault.id}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors ${vault.id === activeVault?.id ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'}`}
                          onClick={async () => {
                            setShowVaultSwitcher(false);
                            if (vault.id !== activeVault?.id) {
                              await switchVault(vault.id);
                              window.location.href = '/';
                            }
                          }}
                        >
                          <span className="truncate">{vault.name}</span>
                          {vault.id === activeVault?.id && (
                            <span className="ml-auto text-[10px] text-primary">Active</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <NotificationBell userId="current-user" />
            <SimpleThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLockVault}
              className="h-9 w-9 rounded-xl"
            >
              <Lock className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>
      {/* Spacer for fixed header + safe area */}
      <div className="lg:hidden h-[calc(env(safe-area-inset-top)+44px)]" />

      {/* Desktop Header - Glassmorphism */}
      <header className="hidden lg:block sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AppLogo size={36} />
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-foreground">IronVault</h1>
            </div>
            {/* Vault Switcher */}
            {vaults.length > 0 && (
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1.5 rounded-xl text-sm h-8 px-3 border-border/60 bg-muted/40"
                  onClick={() => setShowVaultSwitcher(v => !v)}
                >
                  <Database className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="max-w-[120px] truncate">{activeVault?.name || 'Default Vault'}</span>
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </Button>
                {showVaultSwitcher && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowVaultSwitcher(false)} />
                    <div className="absolute left-0 top-full mt-1 z-50 min-w-[180px] bg-popover border border-border rounded-xl shadow-lg py-1 overflow-hidden">
                      {vaults.map(vault => (
                        <button
                          key={vault.id}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors ${vault.id === activeVault?.id ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'}`}
                          onClick={async () => {
                            setShowVaultSwitcher(false);
                            if (vault.id !== activeVault?.id) {
                              await switchVault(vault.id);
                              window.location.href = '/';
                            }
                          }}
                        >
                          <Database className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{vault.name}</span>
                          {vault.id === activeVault?.id && (
                            <span className="ml-auto text-[10px] text-primary font-semibold">Active</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
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

            <SecuritySettingsModal
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-2 rounded-xl"
                >
                  <SettingsIcon className="w-5 h-5" />
                </Button>
              }
              onSettingsChanged={(_kdfConfig) => {
              }}
            />

            <NotificationBell userId="current-user" />
            <ThemeToggle />

            <div className="h-6 w-px bg-border/50" />

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/profile')}
              className="p-2 rounded-xl hover:bg-accent text-foreground"
            >
              <User className="w-5 h-5" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLockVault}
              className="p-2 rounded-xl hover:bg-accent text-foreground"
            >
              <Lock className="w-5 h-5" />
            </Button>
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
        <nav className="w-60 flex-shrink-0 bg-card/50 backdrop-blur-sm border-r border-border/50 p-3 flex flex-col h-full">
          {/* Scrollable primary nav items */}
          <div className="flex-1 overflow-y-auto space-y-0.5 min-h-0">
            {navItems.filter(item => !['profile', 'logging', 'settings', 'upgrade'].includes(item.id)).map((item) => {
              const itemPath = item.id === 'dashboard' ? '/' : `/${item.id}`;
              const isActive = item.id === 'dashboard' ? location === '/' : location === itemPath;
              return (
              <Link key={item.id} href={itemPath}>
                <Button
                  variant="ghost"
                  className={`w-full justify-start gap-3 px-3 py-2.5 h-auto hover:bg-accent/80 text-foreground rounded-xl transition-all duration-200 hover:translate-x-0.5${isActive ? ' bg-accent font-semibold' : ''}`}
                >
                  <item.icon className={`w-[18px] h-[18px] ${item.color}`} />
                  <span className="text-sm">{item.label}</span>
                  {item.requiresPro && !isPro ? (
                    <span className="ml-auto bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">
                      Pro
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
                </Button>
              </Link>
              );
            })}
          </div>
          {/* Pinned bottom utility items — always visible */}
          <div className="border-t border-border/50 pt-2 mt-2 space-y-0.5 flex-shrink-0">
            {navItems.filter(item => ['profile', 'logging', 'settings', 'upgrade'].includes(item.id)).map((item) => {
              const itemPath = `/${item.id}`;
              const isActive = location === itemPath;
              return (
              <Link key={item.id} href={itemPath}>
                <Button
                  variant="ghost"
                  className={`w-full justify-start gap-3 px-3 py-2.5 h-auto hover:bg-accent/80 text-foreground rounded-xl transition-all duration-200 hover:translate-x-0.5${isActive ? ' bg-accent font-semibold' : ''}`}
                >
                  <item.icon className={`w-[18px] h-[18px] ${item.color}`} />
                  <span className="text-sm">{item.label}</span>
                  {item.requiresPro && !isPro && item.id === 'upgrade' && (
                    <span className="ml-auto bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-semibold">↑</span>
                  )}
                </Button>
              </Link>
              );
            })}
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden gradient-mesh flex flex-col">
          <div className="p-6 flex-1 min-w-0 animate-fade-in">
            <AnalyticsIntegration>
              {children}
            </AnalyticsIntegration>
          </div>
          <Footer />
        </main>
      </div>

      {/* Mobile Main Content — no footer on mobile (BottomTabs replace it) */}
      <main className="lg:hidden flex-1 w-full max-w-full gradient-mesh flex flex-col overflow-y-auto overflow-x-hidden">
        <div className="w-full min-w-0 p-4 pb-[calc(96px+env(safe-area-inset-bottom))] flex-1 overflow-x-hidden animate-fade-in">
          <AnalyticsIntegration>
            {children}
          </AnalyticsIntegration>
        </div>
      </main>

      {/* Bottom Navigation for Mobile - New BottomTabs Component */}
      <BottomTabs items={bottomTabItems} />

      {/* More Sheet - New MoreSheet Component */}
      <MoreSheet
        open={showQuickAccess}
        onOpenChange={setShowQuickAccess}
        sections={allSections}
      />

      {/* Search removed from mobile header - individual pages have their own search */}

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

// Router Component
function Router() {
  const { isUnlocked, isLoading } = useAuth();

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

  // If not unlocked: show marketing landing page at / and auth routes; all other paths fall through to landing
  if (!isUnlocked) {
    return (
      <PublicPageWrapper>
        <Switch>
          <Route path="/" component={LandingPage} />
          {/* Auth routes */}
          <Route path="/auth/login" component={Login} />
          <Route path="/auth/signup" component={SignupPage} />
          <Route path="/login" component={Login} />
          {/* Public info pages */}
          <Route path="/about" component={AboutPage} />
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
          {/* Catch-all: show landing page */}
          <Route component={LandingPage} />
        </Switch>
      </PublicPageWrapper>
    );
  }

  return (
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
      <Route path="/about" component={AboutPage} />
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
      <Route path="/upgrade" component={() => (
        <MainLayout>
          <UpgradePage />
        </MainLayout>
      )} />
      <Route path="/roadmap" component={AboutPage} />
      <Route path="/blog" component={BlogPage} />
      <Route path="/changelog" component={ChangelogPage} />
      <Route path="/status" component={StatusPage} />
      <Route path="/api" component={AboutPage} />
      
      <Route component={NotFound} />
    </Switch>
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

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ThemeProvider>
            <LoggingProvider>
              <AuthProvider>
                <CurrencyProvider>
                  <VaultProvider>
                    <LicenseProvider>
                      <VaultSelectionProvider>
                        <Toaster />
                        <Router />
                        {/* PWA Components */}
                        <PWAOfflineIndicator />
                        <PWAInstallPrompt />
                      </VaultSelectionProvider>
                    </LicenseProvider>
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