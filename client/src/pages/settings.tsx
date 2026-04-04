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
  RefreshCw
} from 'lucide-react';
import SupportTicketSubmission from '@/components/support-ticket-submission';
import { useAnalytics } from '@/components/analytics-integration';
import { vaultBackupService } from '@/lib/vault-backup';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

export default function SettingsPage() {
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [supportTicketsEnabled, setSupportTicketsEnabled] = useState(true);
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
  
  const { toast } = useToast();
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
      toast({ title: 'Exported', description: 'Analytics data exported successfully' });
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
    if (!confirm('Are you sure you want to clear all analytics data? This action cannot be undone.')) {
      return;
    }
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
    <div className="space-y-6">
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

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">
          Manage your IronVault preferences and privacy settings
        </p>
      </div>

      {/* Privacy & Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
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

          {/* Cloud Sync - Coming Soon */}
          <div className="space-y-3 opacity-50 pointer-events-none">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="sync" className="flex items-center gap-2">
                  <Cloud className="w-4 h-4" />
                  Cloud Sync
                  <Badge variant="outline" className="text-xs">Coming Soon</Badge>
                </Label>
                <p className="text-sm text-muted-foreground">
                  Encrypted cloud backup will be available in a future update
                </p>
              </div>
              <Switch
                id="sync"
                checked={false}
                disabled={true}
              />
            </div>
          </div>

          <Separator />

          <div className="bg-primary/10 p-4 rounded-lg">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-primary mt-0.5" />
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
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
              <Info className="w-5 h-5 text-primary mt-0.5" />
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

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
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
                toast({ title: 'Exported', description: 'Support tickets exported successfully' });
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

      {/* Advanced Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
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
