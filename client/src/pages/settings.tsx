// Settings Page Component
// Includes support ticket submission and analytics controls
// Integrated into the main SecureVault app

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Settings,
  Shield,
  Bell,
  Database,
  Download,
  Upload,
  LifeBuoy,
  BarChart3,
  Cloud,
  CloudOff,
  Eye,
  EyeOff,
  Lock,
  Key,
  AlertTriangle,
  CheckCircle,
  Info,
  RefreshCw,
  Palette,
  Sun,
  Moon,
  Monitor,
  Type,
  Webhook,
  HeartHandshake,
  Fingerprint,
} from 'lucide-react';
import { FontSizeSettings } from '@/components/font-size-settings';
import TravelModeCard from '@/components/travel-mode-card';
import SupportTicketSubmission from '@/components/support-ticket-submission';
import { useAnalytics } from '@/components/analytics-integration';
import { vaultBackupService } from '@/lib/vault-backup';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/contexts/theme-context';
import ThemeSelector from '@/components/theme-selector';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Link } from 'wouter';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { securitySettingsService, AUTO_LOCK_OPTIONS, type AutoLockInterval } from '@/lib/security/security-settings';
import { useAuth } from '@/contexts/auth-context';
import { usePlan } from '@/lib/plan-service';
import { ProfileCard } from '@/components/profile-card';
import {
  checkBiometricCapabilities,
  getEnrolledBiometricVaults,
  disableAllBiometric,
  type BiometricCapabilities,
} from '@/native/biometrics';
import { isNativeApp } from '@/native/platform';
import {
  registerPasskey,
  listPasskeys,
  deletePasskey,
  isPasskeySupported,
  isPasskeyBlockedByNativeApp,
  type RegisteredPasskey,
} from '@/lib/passkey-auth';
import { CloudSyncPill } from '@/components/cloud-sync-pill';
import { useVaultSelection } from '@/contexts/vault-selection-context';
import { getCloudToken } from '@/lib/cloud-vault-sync';
import { isCloudSyncEligible, isLocalOnly, getLastSyncAt as queueLastSyncAt } from '@/lib/cloud-sync-queue';

export default function SettingsPage() {
  const { accountEmail } = useAuth();
  const plan = usePlan();
  const planLabel = plan.tier === 'free' ? 'FREE' : plan.tier.toUpperCase().replace('PRO_FAMILY_MEMBER', 'FAMILY');
  const [analyticsEnabled, setAnalyticsEnabled] = useState(
    () => localStorage.getItem('ironvault-analytics-enabled') !== 'false'
  );
  const [supportTicketsEnabled, setSupportTicketsEnabled] = useState(
    () => localStorage.getItem('ironvault-support-enabled') !== 'false'
  );
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  
  // Vault backup state
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [backupPassword, setBackupPassword] = useState('');
  const [confirmBackupPassword, setConfirmBackupPassword] = useState('');
  const [isBackingUp, setIsBackingUp] = useState(false);
  // Clear data confirmation dialog
  const [showClearDataDialog, setShowClearDataDialog] = useState(false);

  // Security settings (auto-lock + lock-on-background) — backed by
  // securitySettingsService which persists to localStorage and drives the
  // idle-vault-lock timer.
  const [autoLockInterval, setAutoLockInterval] = useState<AutoLockInterval>(
    () => securitySettingsService.getSettings().autoLockInterval
  );
  const [lockOnBackground, setLockOnBackground] = useState<boolean>(
    () => securitySettingsService.getSettings().lockOnBackground
  );
  const [clipboardAutoClear, setClipboardAutoClear] = useState<boolean>(
    () => securitySettingsService.getSettings().clipboardAutoClear
  );

  // Biometric state — only meaningful on native (Capacitor) builds.
  const [bioCaps, setBioCaps] = useState<BiometricCapabilities | null>(null);
  const [bioEnrolledVaultIds, setBioEnrolledVaultIds] = useState<string[]>([]);
  const [bioBusy, setBioBusy] = useState(false);

  // Passkey state — works on any modern browser with a platform authenticator.
  const [passkeys, setPasskeys] = useState<RegisteredPasskey[]>([]);
  const [passkeyBusy, setPasskeyBusy] = useState(false);

  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const { getAnalyticsSummary, getSupportTicketStats, isAnalyticsEnabled } = useAnalytics();

  // Load sync settings
  useEffect(() => {
    const storedSync = localStorage.getItem('cloud-sync-enabled');
    if (storedSync) {
      setSyncEnabled(storedSync === 'true');
    }

    const storedLastSync = localStorage.getItem('cloud-sync-last-time');
    if (storedLastSync) {
      setLastSyncTime(new Date(storedLastSync));
    }
  }, []);

  // Save sync settings
  useEffect(() => {
    localStorage.setItem('cloud-sync-enabled', syncEnabled.toString());
  }, [syncEnabled]);

  // Persist analytics and support toggles
  useEffect(() => {
    localStorage.setItem('ironvault-analytics-enabled', String(analyticsEnabled));
  }, [analyticsEnabled]);

  // Load biometric capabilities + enrollments. Re-runs when the page mounts;
  // re-enrollment happens from the vault-picker (BiometricSetupPrompt), so
  // we refresh on focus to catch state changes from there.
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const caps = await checkBiometricCapabilities();
        const enrolled = isNativeApp() ? await getEnrolledBiometricVaults() : [];
        if (cancelled) return;
        setBioCaps(caps);
        setBioEnrolledVaultIds(enrolled);
      } catch {
        if (cancelled) return;
        setBioCaps(null);
        setBioEnrolledVaultIds([]);
      }
    };
    refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => { cancelled = true; window.removeEventListener('focus', onFocus); };
  }, []);

  // Load passkeys once on mount + after every register/delete.
  useEffect(() => {
    if (!isPasskeySupported()) return;
    listPasskeys().then(setPasskeys).catch(() => undefined);
  }, []);

  const reloadPasskeys = async () => {
    setPasskeys(await listPasskeys().catch(() => [] as RegisteredPasskey[]));
  };

  const handleAddPasskey = async () => {
    if (passkeyBusy) return;
    setPasskeyBusy(true);
    try {
      const label = (typeof navigator !== 'undefined' ? navigator.platform : '') || 'This device';
      const r = await registerPasskey(label);
      if (!r.ok) {
        toast({ title: 'Passkey setup failed', description: r.error, variant: 'destructive' });
        return;
      }
      await reloadPasskeys();
      toast({ title: 'Passkey added', description: 'You can now sign in with this device.', variant: 'success' });
    } finally {
      setPasskeyBusy(false);
    }
  };

  const handleDeletePasskey = async (credentialId: string) => {
    if (passkeyBusy) return;
    setPasskeyBusy(true);
    try {
      const ok = await deletePasskey(credentialId);
      if (!ok) { toast({ title: 'Could not remove', variant: 'destructive' }); return; }
      await reloadPasskeys();
      toast({ title: 'Passkey removed', variant: 'success' });
    } finally {
      setPasskeyBusy(false);
    }
  };

  const handleDisableAllBiometric = async () => {
    if (bioBusy) return;
    setBioBusy(true);
    try {
      await disableAllBiometric();
      setBioEnrolledVaultIds([]);
      toast({
        title: 'Biometric disabled',
        description: 'Removed biometric unlock from all vaults on this device.',
      });
    } catch (err) {
      toast({
        title: 'Could not disable',
        description: err instanceof Error ? err.message : 'Try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setBioBusy(false);
    }
  };

  useEffect(() => {
    localStorage.setItem('ironvault-support-enabled', String(supportTicketsEnabled));
  }, [supportTicketsEnabled]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncStatus('syncing');
    
    try {
      // Simulate cloud sync
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const now = new Date();
      setLastSyncTime(now);
      localStorage.setItem('cloud-sync-last-time', now.toISOString());
      setSyncStatus('success');
      
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (error) {
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 5000);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportData = async () => {
    try {
      const summary = await getAnalyticsSummary();
      const ticketStats = await getSupportTicketStats();
      const exportData = {
        exportedAt: new Date().toISOString(),
        analytics: summary,
        supportTickets: ticketStats,
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ironvault-analytics-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ variant: 'success', title: 'Exported', description: 'Analytics data exported successfully' });
    } catch (error) {
      console.error('Export failed:', error);
      toast({ title: 'Export Failed', description: 'Failed to export analytics data', variant: 'destructive' });
    }
  };

  const handleVaultBackup = async () => {
    if (backupPassword !== confirmBackupPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please make sure both passwords match',
        variant: 'destructive',
      });
      return;
    }

    if (backupPassword.length < 8) {
      toast({
        title: 'Password too short',
        description: 'Backup password must be at least 8 characters',
        variant: 'destructive',
      });
      return;
    }

    setIsBackingUp(true);
    try {
      const result = await vaultBackupService.exportBackup(backupPassword);
      
      if (result.success) {
        toast({
          title: 'Backup Created',
          description: 'Your vault backup has been created. Save it somewhere safe!',
        });
        setShowBackupDialog(false);
        setBackupPassword('');
        setConfirmBackupPassword('');
      } else {
        toast({
          title: 'Backup Failed',
          description: result.error || 'Failed to create backup',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Backup Failed',
        description: 'An error occurred while creating the backup',
        variant: 'destructive',
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleClearData = async () => {
    setShowClearDataDialog(true);
  };

  const handleClearDataConfirmed = async () => {
    setShowClearDataDialog(false);
    try {
      localStorage.removeItem('ironvault_analytics');
      localStorage.removeItem('ironvault_support_tickets');
      toast({ title: 'Data Cleared', description: 'All analytics and support data has been cleared' });
    } catch (error) {
      console.error('Clear data failed:', error);
      toast({ title: 'Clear Failed', description: 'Failed to clear analytics data', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-5">
      {/* Page header — bold title + muted subtitle (HealthBridge pattern). */}
      <div className="px-1 pt-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account, security, and app preferences.</p>
      </div>

      {/* Profile card — avatar + email + plan badge */}
      <ProfileCard
        email={accountEmail}
        name={accountEmail ? accountEmail.split('@')[0] : null}
        plan={planLabel}
      />

      {/* Clear Data Confirmation Dialog */}
      <Dialog open={showClearDataDialog} onOpenChange={setShowClearDataDialog}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-clear-data">
          <DialogHeader>
            <DialogTitle>Clear Analytics Data</DialogTitle>
            <DialogDescription>
              Are you sure you want to clear all analytics and support data? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowClearDataDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleClearDataConfirmed} data-testid="button-confirm-clear-data">
              Clear Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Backup Password Dialog */}
      <Dialog open={showBackupDialog} onOpenChange={setShowBackupDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Vault Backup</DialogTitle>
            <DialogDescription>
              Choose a strong password to encrypt your backup. You'll need this password to restore.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="backupPassword">Backup Password</Label>
              <Input
                id="backupPassword"
                type="password"
                placeholder="Enter a strong password (min 8 characters)"
                value={backupPassword}
                onChange={(e) => setBackupPassword(e.target.value)}
                disabled={isBackingUp}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmBackupPassword">Confirm Password</Label>
              <Input
                id="confirmBackupPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmBackupPassword}
                onChange={(e) => setConfirmBackupPassword(e.target.value)}
                disabled={isBackingUp}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowBackupDialog(false);
                setBackupPassword('');
                setConfirmBackupPassword('');
              }}
              disabled={isBackingUp}
            >
              Cancel
            </Button>
            <Button
              onClick={handleVaultBackup}
              disabled={!backupPassword || !confirmBackupPassword || isBackingUp}
            >
              {isBackingUp ? 'Creating Backup...' : 'Create Backup'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Theme */}
      <Card className="rounded-2xl border bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-xl border-black/[0.08] dark:border-white/[0.08] shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
            <Palette className="w-5 h-5" />
            Theme
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <ThemeSelector />

          <Separator />

          <div>
            <Label className="text-sm font-medium mb-3 block">Appearance</Label>
            <div className="flex gap-2">
              {([
                { value: 'light' as const, icon: Sun, label: 'Light' },
                { value: 'dark' as const, icon: Moon, label: 'Dark' },
                { value: 'system' as const, icon: Monitor, label: 'System' },
              ] as const).map(({ value, icon: Icon, label }) => (
                <Button
                  key={value}
                  variant={theme === value ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 gap-2"
                  onClick={() => setTheme(value)}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accessibility — font size / app size */}
      <Card className="rounded-2xl border bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-xl border-black/[0.08] dark:border-white/[0.08] shadow-none" data-testid="card-accessibility">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
            <Type className="w-5 h-5" />
            Accessibility
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">
            Adjust the app's text size to suit your reading comfort. Changes apply instantly across IronVault.
          </p>
          <FontSizeSettings />
        </CardContent>
      </Card>

      {/* Travel Mode — hide vaults at borders */}
      <TravelModeCard />

      {/* Security — auto-lock & lock-on-background */}
      <Card className="rounded-2xl border bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-xl border-black/[0.08] dark:border-white/[0.08] shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
            <Shield className="w-5 h-5" />
            Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <Label htmlFor="auto-lock" className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Auto-lock vault
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Lock the vault after this period of inactivity. Requires the master password to unlock.
              </p>
            </div>
            <Select
              value={autoLockInterval}
              onValueChange={(v) => {
                const next = v as AutoLockInterval;
                setAutoLockInterval(next);
                securitySettingsService.updateSettings({ autoLockInterval: next });
                toast({ title: 'Auto-lock updated', description: `Vault will lock after ${securitySettingsService.getAutoLockIntervalLabel(next).toLowerCase()}.` });
              }}
            >
              <SelectTrigger id="auto-lock" className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUTO_LOCK_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="lock-bg">Lock when app is in background</Label>
              <p className="text-sm text-muted-foreground">
                Re-lock the vault as soon as the tab/app loses focus (mobile and desktop).
              </p>
            </div>
            <Switch
              id="lock-bg"
              checked={lockOnBackground}
              onCheckedChange={(checked) => {
                setLockOnBackground(checked);
                securitySettingsService.updateSettings({ lockOnBackground: checked });
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="clipboard-clear">Auto-clear copied secrets</Label>
              <p className="text-sm text-muted-foreground">
                Clear copied passwords/codes from the clipboard 30 seconds after copy.
              </p>
            </div>
            <Switch
              id="clipboard-clear"
              checked={clipboardAutoClear}
              onCheckedChange={(checked) => {
                setClipboardAutoClear(checked);
                securitySettingsService.updateSettings({ clipboardAutoClear: checked });
              }}
            />
          </div>

          {/* Biometric unlock — native-only. Enrollment happens from the
              vault picker (BiometricSetupPrompt) right after the master
              password is typed. From Settings you can only see status and
              disable enrollments — re-enabling needs the master password,
              which we don't have here. */}
          {isNativeApp() && bioCaps?.isAvailable && (
            <>
              <Separator />
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <Label className="flex items-center gap-2">
                    <Fingerprint className="w-4 h-4" />
                    {bioCaps.biometricLabel} unlock
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {bioEnrolledVaultIds.length > 0 ? (
                      <>
                        Enabled for {bioEnrolledVaultIds.length} vault
                        {bioEnrolledVaultIds.length === 1 ? '' : 's'}. Unlock
                        with {bioCaps.biometricLabel} from the vault picker.
                      </>
                    ) : (
                      <>
                        Open a vault with your master password and you'll be
                        offered to enable {bioCaps.biometricLabel} for next
                        time.
                      </>
                    )}
                  </p>
                </div>
                {bioEnrolledVaultIds.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisableAllBiometric}
                    disabled={bioBusy}
                    data-testid="button-disable-all-biometric"
                  >
                    {bioBusy ? 'Disabling…' : 'Disable all'}
                  </Button>
                )}
              </div>
            </>
          )}

          {/* Passkey (FIDO2) — browser-only. iOS/Android WKWebView can't satisfy
              the WebAuthn RP-ID origin check from capacitor://localhost, so on
              native we surface a "open in a browser" note instead of a button
              that would fail with a confusing NotAllowedError. */}
          {isPasskeyBlockedByNativeApp() && (
            <>
              <Separator />
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <Key className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <div className="font-medium text-foreground">Passkeys (web only)</div>
                    <div className="text-muted-foreground text-xs mt-0.5">
                      Open IronVault in a browser at ironvault.app to add a passkey. The mobile app uses Face ID / Touch ID for vault unlock instead.
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
          {isPasskeySupported() && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <Label className="flex items-center gap-2">
                      <Key className="w-4 h-4" /> Passkey sign-in
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Add a passkey on this device for password-less sign-in. Uses Touch ID, Face ID, Windows Hello, or your security key.
                    </p>
                  </div>
                  <Button onClick={handleAddPasskey} disabled={passkeyBusy} size="sm">
                    {passkeyBusy ? 'Working…' : 'Add passkey'}
                  </Button>
                </div>
                {passkeys.length > 0 && (
                  <div className="space-y-1.5">
                    {passkeys.map(pk => (
                      <div key={pk.credentialId} className="flex items-center justify-between text-xs bg-muted/30 rounded-lg px-3 py-2">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{pk.deviceLabel || 'Unnamed device'}</div>
                          <div className="text-muted-foreground">
                            Added {new Date(pk.createdAt).toLocaleDateString()}
                            {pk.lastUsedAt && <> · used {new Date(pk.lastUsedAt).toLocaleDateString()}</>}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive h-7 text-xs"
                          onClick={() => handleDeletePasskey(pk.credentialId)}
                          disabled={passkeyBusy}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Privacy & Analytics */}
      <Card className="rounded-2xl border bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-xl border-black/[0.08] dark:border-white/[0.08] shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
            <BarChart3 className="w-5 h-5" />
            Privacy & Analytics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="analytics">Analytics Collection</Label>
              <p className="text-sm text-muted-foreground">
                Collect anonymous usage statistics to help improve the app
              </p>
            </div>
            <Switch
              id="analytics"
              checked={analyticsEnabled}
              onCheckedChange={setAnalyticsEnabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="support">Support Tickets</Label>
              <p className="text-sm text-muted-foreground">
                Allow encrypted support ticket submission
              </p>
            </div>
            <Switch
              id="support"
              checked={supportTicketsEnabled}
              onCheckedChange={setSupportTicketsEnabled}
            />
          </div>

          <CloudSyncStatusRow />


          <Separator />

          <div className="bg-primary/10 p-4 rounded-lg">
            <div className="flex items-start gap-3">
              <Info className="w-3 h-3 text-primary mt-0.5" />
              <div>
                <h4 className="font-medium text-foreground">
                  Privacy Protection
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  All analytics data is encrypted locally and only contains anonymous usage statistics. 
                  No personal information is ever collected or transmitted.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Support & Feedback */}
      <Card className="rounded-2xl border bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-xl border-black/[0.08] dark:border-white/[0.08] shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
            <LifeBuoy className="w-5 h-5" />
            Support & Feedback
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Report an Issue</Label>
            <p className="text-sm text-muted-foreground mb-3">
              Submit encrypted support tickets to help us improve the app
            </p>
            <SupportTicketSubmission featureContext="settings" />
          </div>

          <Separator />

          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start gap-2" onClick={async () => {
              const summary = await getAnalyticsSummary();
              toast({ title: 'Analytics Summary', description: summary ? `Events tracked: ${Object.keys(summary).length} categories` : 'No analytics data collected yet' });
            }}>
              <Eye className="w-4 h-4" />
              View Analytics Summary
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={async () => {
              const stats = await getSupportTicketStats();
              toast({ title: 'Support Tickets', description: stats ? `Total tickets: ${stats.total || 0}` : 'No support tickets submitted yet' });
            }}>
              <BarChart3 className="w-4 h-4" />
              View Support Tickets
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Vault Backup */}
      <Card className="rounded-2xl border bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-xl border-black/[0.08] dark:border-white/[0.08] shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
            <Shield className="w-5 h-5" />
            Vault Backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Create an encrypted backup of all your vaults. This backup can be used to restore your data if you reinstall the app or switch devices.
          </p>
          <Button 
            className="w-full" 
            onClick={() => setShowBackupDialog(true)}
          >
            <Download className="w-4 h-4 mr-2" />
            Create Vault Backup
          </Button>
          <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
            <div className="flex items-start gap-3">
              <Info className="w-3 h-3 text-primary mt-0.5" />
              <div>
                <h4 className="font-medium text-foreground">
                  Important
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Store your backup file in a safe location (cloud storage, email to yourself, etc.). You'll need the backup password to restore.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Integrations & Emergency Access */}
      <Card className="rounded-2xl border bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-xl border-black/[0.08] dark:border-white/[0.08] shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
            <Webhook className="w-5 h-5" />
            Integrations & Sharing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Link href="/integrations">
            <Button variant="outline" className="w-full justify-start gap-2" data-testid="settings-integrations-cta">
              <Webhook className="w-4 h-4" />
              Webhooks (Zapier, Make, n8n)
            </Button>
          </Link>
          <Link href="/emergency-access">
            <Button variant="outline" className="w-full justify-start gap-2" data-testid="settings-emergency-cta">
              <HeartHandshake className="w-4 h-4" />
              Emergency Access (Digital Will)
            </Button>
          </Link>
          <p className="text-xs text-muted-foreground pt-1">
            Connect IronVault events to external automations, or designate trusted contacts who can request vault access if you become inactive.
          </p>
        </CardContent>
      </Card>

      {/* Import Passwords */}
      <Card className="rounded-2xl border bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-xl border-black/[0.08] dark:border-white/[0.08] shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
            <Upload className="w-5 h-5" />
            Import Passwords
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Bring passwords in from any major password manager or browser — Apple Passwords,
            Chrome, Firefox, Safari, Edge, 1Password, LastPass, Bitwarden, Dashlane, KeePass,
            and more. Files are parsed locally on this device.
          </p>
          <Link href="/import-passwords">
            <Button className="w-full" data-testid="settings-import-passwords-cta">
              <Upload className="w-4 h-4 mr-2" />
              Import from CSV
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card className="rounded-2xl border bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-xl border-black/[0.08] dark:border-white/[0.08] shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
            <Database className="w-5 h-5" />
            Data Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start gap-2" onClick={handleExportData}>
              <Download className="w-4 h-4" />
              Export Analytics Data
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={async () => {
              try {
                const stats = await getSupportTicketStats();
                const blob = new Blob([JSON.stringify(stats || {}, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `ironvault-tickets-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
                toast({ variant: 'success', title: 'Exported', description: 'Support tickets exported successfully' });
              } catch (error) {
                toast({ title: 'Export Failed', description: 'Failed to export support tickets', variant: 'destructive' });
              }
            }}>
              <Download className="w-4 h-4" />
              Export Support Tickets
            </Button>
          </div>

          <Separator />

          <div className="space-y-2">
            <Button 
              variant="destructive" 
              className="w-full justify-start gap-2" 
              onClick={handleClearData}
            >
              <AlertTriangle className="w-4 h-4" />
              Clear All Analytics Data
            </Button>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-900 dark:text-yellow-100">
                  Warning
                </h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  Clearing analytics data will permanently delete all usage statistics and support tickets. 
                  This action cannot be undone.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Browser Extension */}
      <Card id="browser-extension" className="rounded-2xl border bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-xl border-black/[0.08] dark:border-white/[0.08] shadow-none scroll-mt-24" data-testid="card-browser-extension">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
            <Monitor className="w-5 h-5" />
            Browser Extension
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="font-medium">IronVault for Chrome</p>
              <p className="text-sm text-muted-foreground mt-1">
                Auto-fill passwords on any website directly from your vault.
                Zero-knowledge — your master password never leaves the browser.
              </p>
            </div>
            <Badge variant="outline" className="shrink-0">v1.0</Badge>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild className="gap-2" data-testid="button-install-extension">
              <a href="/chrome-extension.zip" download="ironvault-extension.zip">
                <Download className="w-4 h-4" />
                Download .zip
              </a>
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => window.open('https://github.com/Sakun33/IronVault-V4/tree/main/chrome-extension', '_blank', 'noopener,noreferrer')}
              data-testid="button-extension-source"
            >
              <Key className="w-4 h-4" />
              View source on GitHub
            </Button>
          </div>

          <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 space-y-2">
            <p className="text-sm font-medium flex items-center gap-2">
              <Info className="w-4 h-4 text-primary" />
              Install in 4 steps
            </p>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Click <strong>Download .zip</strong> above and unzip it somewhere you'll remember.</li>
              <li>Open <code className="bg-muted px-1 rounded text-xs">chrome://extensions</code> in Chrome.</li>
              <li>Toggle <strong>Developer mode</strong> on (top right corner).</li>
              <li>Click <strong>Load unpacked</strong> and pick the unzipped folder.</li>
            </ol>
          </div>

          <div className="space-y-2 pt-2">
            <p className="text-sm font-medium flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Security features
            </p>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>Zero-knowledge: passwords decrypted locally, never sent to server</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>Vault stays AES-256-GCM encrypted; PBKDF2-SHA-256 with 600,000 iterations</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>Session duration you choose: 1h / 4h / 8h / 24h / 1 week / Until logout — full local wipe on expiry</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>Master password required to reveal or copy any password — every time, never cached</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>One credential decrypted at a time; passwords masked as ••••• with a 5-second reveal</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>Strict CSP, no <code className="text-xs bg-muted px-1 rounded">eval()</code>, no inline scripts; minimum permissions only</span>
              </li>
            </ul>
          </div>

          <Separator />

          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground">
              The extension uses the same encrypted cloud vault as this app. Sign in
              with your IronVault email + master password; the encrypted blob is
              cached locally and decrypted only on your device.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Settings */}
      <Card className="rounded-2xl border bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-xl border-black/[0.08] dark:border-white/[0.08] shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
            <Settings className="w-5 h-5" />
            Advanced Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showAdvanced ? 'Hide' : 'Show'} Advanced Options
          </Button>

          {showAdvanced && (
            <div className="space-y-4 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="sync-endpoint">Sync Endpoint</Label>
                <Input
                  id="sync-endpoint"
                  placeholder="https://api.securevault.com/sync"
                  disabled={!syncEnabled}
                />
                <p className="text-sm text-muted-foreground">
                  Custom endpoint for encrypted data synchronization
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sync-interval">Sync Interval (hours)</Label>
                <Input
                  id="sync-interval"
                  type="number"
                  placeholder="12"
                  disabled={!syncEnabled}
                />
                <p className="text-sm text-muted-foreground">
                  How often to sync data to the cloud
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="retention-days">Data Retention (days)</Label>
                <Input
                  id="retention-days"
                  type="number"
                  placeholder="365"
                />
                <p className="text-sm text-muted-foreground">
                  How long to keep analytics data locally
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Information */}
      <Card className="rounded-2xl border bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-xl border-black/[0.08] dark:border-white/[0.08] shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
            <Shield className="w-5 h-5" />
            Security Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <div className="font-medium">End-to-End Encryption</div>
                <div className="text-sm text-muted-foreground">
                  All data encrypted with AES-256-GCM
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <div className="font-medium">Zero-Knowledge Architecture</div>
                <div className="text-sm text-muted-foreground">
                  No plaintext data ever stored
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <div className="font-medium">Privacy-Preserving</div>
                <div className="text-sm text-muted-foreground">
                  Only anonymous usage statistics
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <div className="font-medium">Offline-First</div>
                <div className="text-sm text-muted-foreground">
                  Works without internet connection
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Cloud Sync status row for the Privacy & Analytics card.
 *
 * Cloud sync is fully implemented — `useCloudAutoSync` pushes after every save
 * and pulls every 5 min while a cloud token is present. This row surfaces the
 * live state (token present? vault eligible? last successful push?) and a
 * "Sync Now" button that funnels into the same enqueuePush path everything
 * else uses.
 */
function CloudSyncStatusRow() {
  const { activeVault } = useVaultSelection();
  const vaultId = activeVault?.id ?? null;
  const [hasToken, setHasToken] = useState<boolean>(() => !!getCloudToken());
  const [lastAt, setLastAt] = useState<number | null>(() => queueLastSyncAt());
  const localOnly = vaultId ? isLocalOnly(vaultId) : false;
  const eligible = vaultId ? isCloudSyncEligible(vaultId) : false;

  useEffect(() => {
    const refresh = () => {
      setHasToken(!!getCloudToken());
      setLastAt(queueLastSyncAt());
    };
    const id = window.setInterval(refresh, 30_000);
    window.addEventListener('vault:cloud:push:done', refresh);
    window.addEventListener('vault:cloud:push:failed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      clearInterval(id);
      window.removeEventListener('vault:cloud:push:done', refresh);
      window.removeEventListener('vault:cloud:push:failed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const triggerSync = () => {
    window.dispatchEvent(new CustomEvent('vault:force-cloud-push'));
  };

  const lastSyncLabel = (() => {
    if (!lastAt) return 'Never synced';
    const delta = Date.now() - lastAt;
    if (delta < 60_000) return 'Synced just now';
    if (delta < 3_600_000) return `Synced ${Math.floor(delta / 60_000)}m ago`;
    if (delta < 86_400_000) return `Synced ${Math.floor(delta / 3_600_000)}h ago`;
    return `Synced ${Math.floor(delta / 86_400_000)}d ago`;
  })();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Label className="flex items-center gap-2">
            <Cloud className="w-4 h-4" />
            Cloud Sync
          </Label>
          <p className="text-sm text-muted-foreground">
            {localOnly
              ? 'This vault is set to Local only. Sign in on this device to enable sync.'
              : hasToken && eligible
                ? 'Encrypted blobs sync after every save and every 5 minutes.'
                : hasToken
                  ? 'Cloud sync available — this vault has not been uploaded yet.'
                  : 'Sign in to enable encrypted cloud backup across your devices.'}
          </p>
        </div>
        <CloudSyncPill vaultId={vaultId} compact />
      </div>
      <div className="flex items-center justify-between gap-3 pl-6">
        <div className="text-xs text-muted-foreground">{lastSyncLabel}</div>
        <Button
          size="sm"
          variant="outline"
          onClick={triggerSync}
          disabled={!hasToken || !vaultId || localOnly}
          data-testid="cloud-sync-now"
        >
          <RefreshCw className="w-3 h-3 mr-1.5" />
          Sync now
        </Button>
      </div>
    </div>
  );
}
