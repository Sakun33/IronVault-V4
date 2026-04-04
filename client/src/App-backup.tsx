import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
// import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { VaultProvider, useVault } from "@/contexts/vault-context";
import { CurrencyProvider } from "@/contexts/currency-context";
import { LoggingProvider } from "@/contexts/logging-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { LicenseProvider } from "@/contexts/license-context";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
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
import Profile from "@/pages/profile";
import Settings from "@/pages/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Search, RefreshCw, Settings as SettingsIcon, Bookmark, Key, BarChart3, Upload, Download, BookOpen, DollarSign, Bell, FileText, Building2, TrendingUp, Plus, Menu, X, Shield, Target, User } from "lucide-react";
import React, { useState } from "react";
import { PasswordGeneratorModal } from "@/components/password-generator-modal";
import { ImportExportModal } from "@/components/import-export-modal";
import { ExtensionPairingModal } from "@/components/extension-pairing-modal";
import { SecuritySettingsModal } from "@/components/security-settings-modal";
import { PWAOfflineIndicator } from "@/components/pwa-offline-indicator";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { NotificationService } from "@/lib/notifications";
import { SectionCard } from "@/components/StatCard";
import { AnalyticsIntegration } from "@/components/analytics-integration";

// Main Layout Component for authenticated users
function MainLayout({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();
  const { searchQuery, setSearchQuery, stats } = useVault();
  const [, setLocation] = useLocation();
  const [showGenerator, setShowGenerator] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  const [showExtensionPairing, setShowExtensionPairing] = useState(false);
  const [showSecuritySettings, setShowSecuritySettings] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showQuickAccess, setShowQuickAccess] = useState(false);

  const handleLockVault = () => {
    logout();
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3, count: null, color: 'text-blue-600' },
    { id: 'passwords', label: 'Passwords', icon: Key, count: stats.totalPasswords, color: 'text-green-600' },
    { id: 'subscriptions', label: 'Subscriptions', icon: Bookmark, count: stats.activeSubscriptions, color: 'text-purple-600' },
    { id: 'notes', label: 'Notes', icon: BookOpen, count: stats.totalNotes, color: 'text-orange-600' },
    { id: 'expenses', label: 'Expenses', icon: DollarSign, count: stats.totalExpenses, color: 'text-red-600' },
    { id: 'reminders', label: 'Reminders', icon: Bell, count: stats.totalReminders, color: 'text-yellow-600' },
    { id: 'bank-statements', label: 'Bank Statements', icon: Building2, count: null, color: 'text-indigo-600' },
    { id: 'investments', label: 'Investment / Goals', icon: TrendingUp, count: null, color: 'text-emerald-600' },
    { id: 'documents', label: 'Documents', icon: FileText, count: null, color: 'text-indigo-600' },
    { id: 'profile', label: 'Profile', icon: User, count: null, color: 'text-blue-600' },
    { id: 'logging', label: 'Activity Logs', icon: FileText, count: null, color: 'text-gray-600' },
    { id: 'settings', label: 'Settings', icon: SettingsIcon, count: null, color: 'text-gray-600' },
  ];

  // Core sections for bottom navigation (only 4 most used)
  const coreNavItems = [
    { id: 'passwords', label: 'Passwords', icon: Key, count: stats.totalPasswords, color: 'text-green-600' },
    { id: 'subscriptions', label: 'Subscriptions', icon: Bookmark, count: stats.activeSubscriptions, color: 'text-purple-600' },
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3, count: null, color: 'text-blue-600' },
    { id: 'more', label: 'More', icon: Plus, count: null, color: 'text-gray-600' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile Header */}
      <header className="lg:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                <Lock className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">SecureVault</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowGenerator(true)}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Plus className="w-5 h-5" />
            </Button>
            <NotificationBell userId="current-user" />
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLockVault}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Lock className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Mobile Search */}
        <div className="mt-3">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Search..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-full shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </header>

      {/* Desktop Header */}
      <header className="hidden lg:block bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">SecureVault</h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Search passwords, subscriptions, notes..."
                className="w-80 pl-10 pr-4 py-2 rounded-full border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowGenerator(true)}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <RefreshCw className="w-5 h-5" />
            </Button>

            <SecuritySettingsModal
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <SettingsIcon className="w-5 h-5" />
                </Button>
              }
              onSettingsChanged={(kdfConfig) => {
                console.log('Security settings updated:', kdfConfig);
              }}
            />

            <NotificationBell userId="current-user" />
            <ThemeToggle />

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/profile')}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <User className="w-5 h-5" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLockVault}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Lock className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {showMobileMenu && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black bg-opacity-50" onClick={() => setShowMobileMenu(false)}>
          <div className="bg-white dark:bg-gray-800 w-80 h-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Menu</h2>
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
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">All Sections</h3>
                <div className="space-y-2">
                  {navItems.map((item) => (
                    <Link key={item.id} href={item.id === 'dashboard' ? '/' : `/${item.id}`}>
                      <Button
                        variant="ghost"
                        className="w-full justify-start gap-3 px-3 py-3 h-auto text-left rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
                        onClick={() => setShowMobileMenu(false)}
                      >
                        <item.icon className={`w-5 h-5 ${item.color}`} />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 dark:text-white">{item.label}</div>
                          {item.count !== null && (
                            <div className="text-sm text-gray-500 dark:text-gray-400">{item.count} items</div>
                          )}
                        </div>
                      </Button>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Tools */}
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Tools</h3>
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 px-3 py-3 h-auto text-left rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => {
                      setShowGenerator(true);
                      setShowMobileMenu(false);
                    }}
                  >
                    <RefreshCw className="w-5 h-5 text-blue-500" />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">Password Generator</div>
                    </div>
                  </Button>
                  
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 px-3 py-3 h-auto text-left rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => {
                      setShowImportExport(true);
                      setShowMobileMenu(false);
                    }}
                  >
                    <Upload className="w-5 h-5 text-green-500" />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">Import / Export</div>
                    </div>
                  </Button>
                  
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 px-3 py-3 h-auto text-left rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => {
                      setShowExtensionPairing(true);
                      setShowMobileMenu(false);
                    }}
                  >
                    <SettingsIcon className="w-5 h-5 text-purple-500" />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">Browser Extension</div>
                    </div>
                  </Button>
                  
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 px-3 py-3 h-auto text-left rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => {
                      setShowSecuritySettings(true);
                      setShowMobileMenu(false);
                    }}
                  >
                    <SettingsIcon className="w-5 h-5 text-orange-500" />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">Security Settings</div>
                    </div>
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 px-3 py-3"
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
                  className="w-full justify-start gap-3 px-3 py-3"
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
                  className="w-full justify-start gap-3 px-3 py-3"
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
      <div className="hidden lg:flex h-[calc(100vh-73px)]">
        <nav className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4 space-y-2">
          <div className="space-y-1">
            {navItems.map((item) => (
              <Link key={item.id} href={item.id === 'dashboard' ? '/' : `/${item.id}`}>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                  {item.label}
                  {item.count !== null && (
                    <span className="ml-auto bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 text-xs px-2 py-1 rounded-full font-medium">
                      {item.count > 99 ? '99+' : item.count}
                    </span>
                  )}
                </Button>
              </Link>
            ))}
          </div>

          <hr className="border-gray-200 dark:border-gray-700" />

          <div className="space-y-1">
            <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide px-3">
              Tools
            </h3>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => setShowGenerator(true)}
            >
              <RefreshCw className="w-5 h-5" />
              Password Generator
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => setShowImportExport(true)}
            >
              <Upload className="w-5 h-5" />
              Import / Export
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => setShowExtensionPairing(true)}
            >
              <SettingsIcon className="w-5 h-5" />
              Browser Extension
            </Button>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
          <div className="p-6">
            <AnalyticsIntegration>
              {children}
            </AnalyticsIntegration>
          </div>
        </main>
      </div>

      {/* Mobile Main Content */}
      <main className="lg:hidden bg-gray-50 dark:bg-gray-900 min-h-[calc(100vh-140px)] pb-32">
        <div className="p-4">
          <AnalyticsIntegration>
            {children}
          </AnalyticsIntegration>
        </div>
      </main>

      {/* Bottom Navigation for Mobile - Core 4 Sections + More */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 safe-area-inset shadow-lg">
        <div className="px-4 py-2">
          <div className="flex justify-around">
            {coreNavItems.map((item) => {
              if (item.id === 'more') {
                return (
                  <Button
                    key={item.id}
                    variant="ghost"
                    size="sm"
                    className="flex flex-col items-center gap-1 px-2 py-2 h-auto relative rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => setShowQuickAccess(true)}
                  >
                    <item.icon className={`w-5 h-5 ${item.color}`} />
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{item.label}</span>
                  </Button>
                );
              }
              
              return (
                <Link key={item.id} href={item.id === 'dashboard' ? '/' : `/${item.id}`}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex flex-col items-center gap-1 px-2 py-2 h-auto relative rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <item.icon className={`w-5 h-5 ${item.color}`} />
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{item.label}</span>
                    {item.count !== null && item.count > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 bg-blue-500 text-white rounded-full w-3 h-3 flex items-center justify-center text-[10px] font-medium">
                        {item.count > 99 ? '99+' : item.count}
                      </span>
                    )}
                  </Button>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Quick Access Modal */}
      {showQuickAccess && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black bg-opacity-50" onClick={() => setShowQuickAccess(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-t-3xl absolute bottom-0 left-0 right-0 max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">All Sections</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowQuickAccess(false)}
                  className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>
            
            <div className="p-4">
              {/* All Sections */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Sections</h3>
                <div className="grid grid-cols-2 gap-4">
                  {navItems.map((item) => (
                    <Link key={item.id} href={item.id === 'dashboard' ? '/' : `/${item.id}`}>
                      <SectionCard
                        icon={item.icon}
                        label={item.label}
                        count={item.count || undefined}
                        color={item.color}
                        onClick={() => setShowQuickAccess(false)}
                      />
                    </Link>
                  ))}
                </div>
              </div>

              {/* Tools */}
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Tools</h3>
                <div className="grid grid-cols-2 gap-4">
                  <SectionCard
                    icon={RefreshCw}
                    label="Password Generator"
                    color="text-blue-500"
                    onClick={() => {
                      setShowGenerator(true);
                      setShowQuickAccess(false);
                    }}
                  />
                  
                  <SectionCard
                    icon={Upload}
                    label="Import / Export"
                    color="text-green-500"
                    onClick={() => {
                      setShowImportExport(true);
                      setShowQuickAccess(false);
                    }}
                  />
                  
                  <SectionCard
                    icon={SettingsIcon}
                    label="Browser Extension"
                    color="text-purple-500"
                    onClick={() => {
                      setShowExtensionPairing(true);
                      setShowQuickAccess(false);
                    }}
                  />
                  
                  <SectionCard
                    icon={SettingsIcon}
                    label="Security Settings"
                    color="text-orange-500"
                    onClick={() => {
                      setShowSecuritySettings(true);
                      setShowQuickAccess(false);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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

// Router Component
function Router() {
  const { isUnlocked, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 mx-auto">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <p className="text-gray-600 dark:text-gray-400">Loading SecureVault...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {/* Admin routes - accessible without authentication */}
      
      {!isUnlocked ? (
        <Route path="/" component={Login} />
      ) : (
        <>
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
        </>
      )}
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

  try {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ThemeProvider>
            <AuthProvider>
              <CurrencyProvider>
                <LoggingProvider>
                  <VaultProvider>
                    <LicenseProvider>
                      {/* <Toaster /> */}
                      <Router />
                      {/* PWA Components */}
                      <PWAOfflineIndicator />
                      <PWAInstallPrompt />
                    </LicenseProvider>
                  </VaultProvider>
                </LoggingProvider>
              </CurrencyProvider>
            </AuthProvider>
          </ThemeProvider>
        </TooltipProvider>
      </QueryClientProvider>
    );
  } catch (error) {
    console.error('Error rendering App component:', error);
    return <div>Error loading app: {String(error)}</div>;
  }
}

export default App;