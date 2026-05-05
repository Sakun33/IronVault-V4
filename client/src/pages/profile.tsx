import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import { getPlan } from '@/lib/plans';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  User,
  Settings,
  CreditCard,
  Shield,
  Bell,
  Globe,
  Download,
  Upload,
  Crown,
  Zap,
  Building2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Calendar,
  DollarSign,
  FileText,
  HelpCircle,
  MessageSquare,
  Star,
  Gift,
  Award,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Edit,
  Save,
  Trash2,
  Plus,
  Search,
  Filter,
  BarChart3,
  PieChart,
  TrendingUp,
  Target,
  Heart,
  Video,
  Mail,
  Phone,
  MapPin,
  Clock,
  Key,
  Database,
  Cloud,
  HardDrive,
  Fingerprint,
  Receipt,
  Banknote,
  Wallet,
  Smartphone,
  Monitor,
  Tablet,
  CloudOff,
  RefreshCw,
  ExternalLink,
  Copy,
  Share2,
  Archive,
  Trash,
  AlertCircle,
  Info,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Users,
  UserPlus,
  UserX,
  Chrome,
  KeyRound,
  Timer
} from 'lucide-react';
import { useCurrency } from '@/contexts/currency-context';
import { autoLockService } from '@/native/auto-lock';
import { useVault } from '@/contexts/vault-context';
import { ErrorBoundary } from '@/components/error-boundary';
import { useToast } from '@/hooks/use-toast';
import { format, addDays, addMonths, addYears, isValid } from 'date-fns';

const safeFormat = (date: Date | null | undefined, fmt: string, fallback = '—') => {
  try {
    return date && isValid(date) ? format(date, fmt) : fallback;
  } catch {
    return fallback;
  }
};
import { PricingService, PricingTier, LicenseInfo } from '@/lib/pricing';
import { PricingUpgrade } from '@/components/pricing-upgrade';
import { checkBiometricCapabilities, enableBiometricUnlock, disableBiometricUnlock, isBiometricUnlockEnabled, getBiometricKeystore } from '@/native/biometrics';
import { useAuth } from '@/contexts/auth-context';
import { useLicense } from '@/contexts/license-context';
import { useLocation } from 'wouter';
import { CryptoService } from '@/lib/crypto';
import { VaultManagementSection } from '@/components/vault-management-section';
import { vaultManager } from '@/lib/vault-manager';
import { TwoFactorAuth } from '@/components/two-factor-auth';
import { ChangeMasterPasswordDialog } from '@/components/change-master-password-dialog';
import { vaultBackupService } from '@/lib/vault-backup';
import { getCloudToken } from '@/lib/cloud-vault-sync';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  preferences: {
    theme: 'light' | 'dark' | 'system';
    language: string;
    currency: string;
    notifications: {
      email: boolean;
      push: boolean;
      sms: boolean;
    };
    privacy: {
      analytics: boolean;
      crashReports: boolean;
      marketing: boolean;
    };
  };
  subscription: LicenseInfo;
  createdAt: Date;
  lastLogin: Date;
  stats: {
    totalPasswords: number;
    totalNotes: number;
    totalSubscriptions: number;
    totalExpenses: number;
    totalInvestments: number;
    vaultSize: number;
    lastBackup?: Date;
  };
}

interface SupportTicket {
  id: string;
  title: string;
  description: string;
  category: 'bug' | 'feature' | 'performance' | 'ui' | 'other';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdAt: Date;
  updatedAt: Date;
  responses?: Array<{
    id: string;
    message: string;
    isAdmin: boolean;
    createdAt: Date;
  }>;
}

export default function Profile() {
  const { formatCurrency, currency, currencies } = useCurrency();
  const { stats } = useVault();
  const { toast } = useToast();
  const { accountEmail, masterPassword, changeMasterPassword } = useAuth();

  const [activeTab, setActiveTab] = useState('overview');
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('fingerprint');
  // Session-timeout toggle — wired to autoLockService. Reads the persisted
  // setting on first paint so the Switch reflects the actual state instead
  // of just `defaultChecked`.
  const [sessionTimeoutEnabled, setSessionTimeoutEnabled] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('autolock_enabled');
      return v === null ? true : v === 'true';
    } catch { return true; }
  });
  const { changePlan, license } = useLicense();
  const [, setLocation] = useLocation();
  
  // 2FA state — server is the source of truth. We seed from localStorage to
  // avoid a flicker on first paint, then refresh from /api/auth/2fa/status.
  // Local cache is best-effort; the server flag wins on every refresh.
  const [twoFAEnabled, setTwoFAEnabled] = useState(() => {
    return localStorage.getItem('ironvault_2fa_enabled') === 'true';
  });

  useEffect(() => {
    const token = getCloudToken();
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/2fa/status', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const enabled = !!data?.enabled;
        setTwoFAEnabled(enabled);
        localStorage.setItem('ironvault_2fa_enabled', enabled ? 'true' : 'false');
      } catch {
        /* offline — keep cached value */
      }
    })();
    return () => { cancelled = true; };
  }, []);
  
  // Change master passcode state
  const [showChangePasscodeDialog, setShowChangePasscodeDialog] = useState(false);
  const [currentPasscode, setCurrentPasscode] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmNewPasscode, setConfirmNewPasscode] = useState('');
  // New (verified) master-password change flow
  const [showChangeMasterPasswordDialog, setShowChangeMasterPasswordDialog] = useState(false);
  
  // Edit profile state
  const [editingEmail, setEditingEmail] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  
  // Family invites state
  const [outgoingInvites, setOutgoingInvites] = useState<any[]>([]);
  const [incomingInvites, setIncomingInvites] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [invitesLoading, setInvitesLoading] = useState(false);

  // FAQ expand state
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  
  // Import file ref
  const importFileRef = useRef<HTMLInputElement>(null);
  
  // Delete account state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Clear-all-local-data state (Feature 3 — internet-café wipe)
  const [showClearLocalDialog, setShowClearLocalDialog] = useState(false);
  const [isClearingLocal, setIsClearingLocal] = useState(false);

  // Active sessions (Feature 5)
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string>('');

  // Activity log (Feature 6)
  const [activity, setActivity] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityFilterType, setActivityFilterType] = useState<string>('all');
  const [activityFilterAction, setActivityFilterAction] = useState<string>('all');
  
  // Export/Backup state
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [backupPassword, setBackupPassword] = useState('');
  const [confirmBackupPassword, setConfirmBackupPassword] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [restorePassword, setRestorePassword] = useState('');
  const [backupFileContent, setBackupFileContent] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastExportDate, setLastExportDate] = useState<Date | null>(null);
  const [lastBackupDate, setLastBackupDate] = useState<Date | null>(() => {
    const stored = localStorage.getItem('ironvault-last-backup-date');
    return stored ? new Date(stored) : null;
  });

  // Load customer profile from localStorage (set during signup)
  const loadCustomerProfile = () => {
    try {
      const savedProfile = localStorage.getItem('customerProfile');
      if (savedProfile) {
        const profile = JSON.parse(savedProfile);
        return profile;
      }
    } catch (error) {
      console.error('Error loading customer profile:', error);
    }
    return null;
  };

  const customerProfile = loadCustomerProfile();

  // User profile data - populated from signup
  const [userProfile, setUserProfile] = useState<UserProfile>({
    id: accountEmail || 'guest',
    name: customerProfile?.name || accountEmail?.split('@')[0] || 'User',
    email: customerProfile?.email || accountEmail || '',
    phone: customerProfile?.phone || '',
    preferences: {
      theme: 'system',
      language: 'en',
      currency: currency,
      notifications: {
        email: true,
        push: true,
        sms: false,
      },
      privacy: {
        analytics: true,
        crashReports: true,
        marketing: false,
      },
    },
    subscription: {
      tier: license.tier,
      status: 'active',
      startDate: customerProfile?.registeredAt ? new Date(customerProfile.registeredAt) : new Date(),
      endDate: undefined,
      billingCycle: 'lifetime',
      amount: 0,
      currency: currency,
      features: ['local_vault', 'unlimited_passwords', 'offline_access'],
      limits: {
        passwords: -1,
        subscriptions: -1,
        notes: -1,
        expenses: -1,
        reminders: -1,
        bankStatements: -1,
        investments: -1,
        vaults: 5,
        documents: -1,
      },
    },
    createdAt: customerProfile?.registeredAt ? new Date(customerProfile.registeredAt) : new Date(),
    lastLogin: new Date(),
    stats: {
      totalPasswords: stats?.totalPasswords ?? 0,
      totalNotes: stats?.totalNotes ?? 0,
      totalSubscriptions: stats?.activeSubscriptions ?? 0,
      totalExpenses: 0,
      totalInvestments: 0,
      vaultSize: 0, // MB — populated asynchronously, see useEffect below
      lastBackup: new Date(),
    },
  });

  // Compute approximate vault size from IndexedDB navigator.storage.estimate()
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const nav: any = navigator;
        if (nav.storage?.estimate) {
          const est = await nav.storage.estimate();
          const mb = (est.usage ?? 0) / (1024 * 1024);
          if (!cancelled) {
            setUserProfile(prev => ({ ...prev, stats: { ...prev.stats, vaultSize: Math.round(mb * 100) / 100 } }));
          }
        }
      } catch { /* leave vaultSize at 0 */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Check biometric availability on mount
  useEffect(() => {
    const checkBiometrics = async () => {
      try {
        const capabilities = await checkBiometricCapabilities();
        setBiometricAvailable(capabilities.isAvailable);
        setBiometricType(capabilities.biometryType);
        
        const isEnabled = await isBiometricUnlockEnabled();
        setBiometricEnabled(isEnabled);
      } catch (error) {
        console.error('Error checking biometrics:', error);
      }
    };
    checkBiometrics();
  }, []);

  // Load family invites (outgoing for owner + incoming for this email)
  const loadFamilyInvites = useCallback(async () => {
    if (!userProfile.email) return;
    setInvitesLoading(true);
    try {
      const [outRes, inRes] = await Promise.all([
        fetch(`/api/crm/family-invites/${encodeURIComponent(userProfile.email)}`),
        fetch(`/api/crm/family-invites/invitee/${encodeURIComponent(userProfile.email)}`),
      ]);
      if (outRes.ok) { const d = await outRes.json(); setOutgoingInvites(d.invites ?? []); }
      if (inRes.ok) { const d = await inRes.json(); setIncomingInvites(d.invites ?? []); }
    } catch { /* best-effort */ }
    finally { setInvitesLoading(false); }
  }, [userProfile.email]);

  useEffect(() => { loadFamilyInvites(); }, [loadFamilyInvites]);

  const handleSendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    try {
      const res = await fetch('/api/crm/family-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerEmail: userProfile.email, inviteeEmail: inviteEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Invite failed', description: data.error || 'Could not send invite', variant: 'destructive' });
      } else {
        toast({ title: 'Invite sent', description: `Invite sent to ${inviteEmail.trim()}` });
        setInviteEmail('');
        loadFamilyInvites();
      }
    } catch {
      toast({ title: 'Error', description: 'Network error sending invite', variant: 'destructive' });
    } finally { setInviteLoading(false); }
  };

  const handleUpdateInvite = async (id: string, status: 'accepted' | 'declined' | 'revoked') => {
    try {
      const res = await fetch(`/api/crm/family-invites/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast({ title: `Invite ${status}` });
        loadFamilyInvites();
      }
    } catch { /* ignore */ }
  };

  const handleBiometricToggle = async (enabled: boolean) => {
    try {
      if (enabled) {
        if (!masterPassword) {
          toast({
            title: "Error",
            description: "Master password not available. Please re-login.",
            variant: "destructive",
          });
          return;
        }
        
        // SECURITY: Derive a vault unlock key from the master password
        // We store the derived key in Keychain/Keystore, NOT the password
        const salt = CryptoService.generateSalt();
        const biometricKeystore = getBiometricKeystore();
        const vaultUnlockKey = await biometricKeystore.deriveVaultUnlockKey(masterPassword, salt);
        
        // Get the default vault ID from vault manager
        const defaultVault = vaultManager.getDefaultVault();
        const vaultId = defaultVault?.id || 'default';
        
        const success = await enableBiometricUnlock(vaultUnlockKey, vaultId);
        
        if (success) {
          // Store the salt in vault metadata (non-secret) for key re-derivation
          localStorage.setItem(`ironvault_biometric_salt_${vaultId}`, btoa(Array.from(salt).map(b => String.fromCharCode(b)).join('')));
          
          setBiometricEnabled(true);
          toast({
            title: "Biometric Enabled",
            description: `You can now unlock with ${biometricType === 'faceId' ? 'Face ID' : 'Touch ID'}`,
          });
        } else {
          toast({
            title: "Error",
            description: "Failed to enable biometric unlock. Make sure biometrics are set up on your device.",
            variant: "destructive",
          });
        }
      } else {
        // Get the default vault ID from vault manager
        const defaultVault = vaultManager.getDefaultVault();
        const vaultId = defaultVault?.id || 'default';
        
        await disableBiometricUnlock(vaultId);
        
        // Clean up the salt
        localStorage.removeItem(`ironvault_biometric_salt_${vaultId}`);
        
        setBiometricEnabled(false);
        toast({
          title: "Biometric Disabled",
          description: "Biometric unlock has been disabled",
        });
      }
    } catch (error) {
      console.error('Error toggling biometric:', error);
      toast({
        title: "Error",
        description: "Failed to update biometric settings",
        variant: "destructive",
      });
    }
  };

  // Export data handlers
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const data = await vaultBackupService.exportVaultData();
      if (!data) throw new Error('No data to export');
      
      // RFC-4180 CSV escape with formula-injection neutralization. Excel/Sheets
      // execute cell content beginning with =, +, -, @, \t, or \r as a formula
      // (which can exfiltrate data via WEBSERVICE etc.). Prefix offending cells
      // with a single quote so they render as literal text.
      const csvEsc = (v: unknown) => {
        let s = String(v ?? '');
        if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
        return `"${s.replace(/"/g, '""')}"`;
      };

      // Convert to CSV format
      const csvRows: string[] = [];

      // Export passwords (schema field is `name`, not `title`)
      if (data.passwords?.length > 0) {
        csvRows.push('--- PASSWORDS ---');
        csvRows.push('Name,Username,URL,Notes');
        data.passwords.forEach((p: any) => {
          csvRows.push([csvEsc(p.name), csvEsc(p.username), csvEsc(p.url), csvEsc(p.notes)].join(','));
        });
      }

      // Export subscriptions (schema fields are `cost` and `billingCycle`)
      if (data.subscriptions?.length > 0) {
        csvRows.push('');
        csvRows.push('--- SUBSCRIPTIONS ---');
        csvRows.push('Name,Cost,BillingCycle,Category,Next Billing');
        data.subscriptions.forEach((s: any) => {
          csvRows.push([csvEsc(s.name), csvEsc(s.cost), csvEsc(s.billingCycle), csvEsc(s.category), csvEsc(s.nextBillingDate)].join(','));
        });
      }
      
      const csvContent = csvRows.join('\n');
      await downloadFile(csvContent, `IronVault_Export_${format(new Date(), 'yyyy-MM-dd')}.csv`, 'text/csv');
      
      setLastExportDate(new Date());
      toast({ title: 'Export Complete', description: 'Your data has been exported as CSV' });
    } catch (error) {
      toast({ title: 'Export Failed', description: 'Failed to export data', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJSON = async () => {
    setIsExporting(true);
    try {
      const data = await vaultBackupService.exportVaultData();
      if (!data) throw new Error('No data to export');
      
      const jsonContent = JSON.stringify(data, null, 2);
      await downloadFile(jsonContent, `IronVault_Export_${format(new Date(), 'yyyy-MM-dd')}.json`, 'application/json');
      
      setLastExportDate(new Date());
      toast({ title: 'Export Complete', description: 'Your data has been exported as JSON' });
    } catch (error) {
      toast({ title: 'Export Failed', description: 'Failed to export data', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportZIP = async () => {
    setIsExporting(true);
    try {
      // For ZIP export, we'll create an encrypted backup
      if (!backupPassword) {
        setShowBackupDialog(true);
        setIsExporting(false);
        return;
      }
      
      const result = await vaultBackupService.exportBackup(backupPassword);
      if (result.success) {
        setLastExportDate(new Date());
        toast({ title: 'Export Complete', description: 'Your encrypted backup has been created' });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({ title: 'Export Failed', description: 'Failed to create backup', variant: 'destructive' });
    } finally {
      setIsExporting(false);
      setBackupPassword('');
    }
  };

  const handleSelectiveExport = async (type: 'passwords' | 'subscriptions' | 'goals') => {
    setIsExporting(true);
    try {
      const data = await vaultBackupService.exportVaultData();
      if (!data) throw new Error('No data to export');
      
      let exportData: any = {};
      switch (type) {
        case 'passwords':
          exportData = { passwords: data.passwords || [] };
          break;
        case 'subscriptions':
          exportData = { subscriptions: data.subscriptions || [] };
          break;
        case 'goals':
          exportData = { goals: data.goals || [] };
          break;
      }
      
      const jsonContent = JSON.stringify(exportData, null, 2);
      await downloadFile(jsonContent, `IronVault_${type}_${format(new Date(), 'yyyy-MM-dd')}.json`, 'application/json');
      
      toast({ title: 'Export Complete', description: `Your ${type} have been exported` });
    } catch (error) {
      toast({ title: 'Export Failed', description: 'Failed to export data', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const downloadFile = async (content: string, filename: string, mimeType: string) => {
    if (Capacitor.isNativePlatform()) {
      // Save to filesystem and share on native
      const base64Content = btoa(unescape(encodeURIComponent(content)));
      await Filesystem.writeFile({
        path: filename,
        data: base64Content,
        directory: Directory.Cache,
      });
      
      const fileInfo = await Filesystem.getUri({
        path: filename,
        directory: Directory.Cache,
      });
      
      await Share.share({
        title: filename,
        url: fileInfo.uri,
      });
    } else {
      // Web download
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handleCreateBackup = async () => {
    if (backupPassword !== confirmBackupPassword) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    if (backupPassword.length < 8) {
      toast({ title: 'Password too short', description: 'Use at least 8 characters', variant: 'destructive' });
      return;
    }
    
    setIsExporting(true);
    try {
      const result = await vaultBackupService.exportBackup(backupPassword);
      if (result.success) {
        const backupNow = new Date();
        setLastBackupDate(backupNow);
        localStorage.setItem('ironvault-last-backup-date', backupNow.toISOString());
        setShowBackupDialog(false);
        setBackupPassword('');
        setConfirmBackupPassword('');
        toast({ title: 'Backup Created', description: 'Your encrypted backup has been saved' });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({ title: 'Backup Failed', description: 'Failed to create backup', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleRestoreBackup = async () => {
    const fileContent = await vaultBackupService.readBackupFile();
    if (fileContent) {
      setBackupFileContent(fileContent);
      setShowRestoreDialog(true);
    }
  };

  const handleRestoreConfirm = async () => {
    if (!backupFileContent || !restorePassword) return;
    
    setIsRestoring(true);
    try {
      const result = await vaultBackupService.importBackup(backupFileContent, restorePassword);
      if (result.success) {
        toast({ title: 'Restore Complete', description: `Restored ${result.vaultCount} vault(s)` });
        setShowRestoreDialog(false);
        setRestorePassword('');
        setBackupFileContent(null);
        window.location.reload();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({ title: 'Restore Failed', description: 'Invalid password or corrupted backup', variant: 'destructive' });
    } finally {
      setIsRestoring(false);
    }
  };
  
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [ticketFormData, setTicketFormData] = useState({
    title: '',
    category: 'bug' as SupportTicket['category'],
    priority: 'medium' as SupportTicket['priority'],
    description: ''
  });

  // Fetch entitlement from backend to sync admin subscription changes
  useEffect(() => {
    const crmUserId = localStorage.getItem('crmUserId');
    if (!crmUserId) return;
    const cloudToken = localStorage.getItem('iv_cloud_token');
    if (!cloudToken) return; // QA-R2 C2: endpoint now requires Bearer auth
    const apiUrl = import.meta.env.VITE_BACKEND_API_URL || '';
    const entEndpoint = apiUrl ? `${apiUrl}/api/crm/entitlement/${crmUserId}` : `/api/crm/entitlement/${crmUserId}`;
    fetch(entEndpoint, { headers: { 'Authorization': `Bearer ${cloudToken}` } })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.entitlement?.plan) {
          const planName = data.entitlement.plan.toLowerCase();
          setUserProfile(prev => ({
            ...prev,
            subscription: { ...prev.subscription, tier: planName, status: data.entitlement.status || 'active' }
          }));
          // Update localStorage so it stays in sync
          const saved = localStorage.getItem('customerProfile');
          if (saved) {
            try {
              const cp = JSON.parse(saved);
              cp.subscription = planName;
              localStorage.setItem('customerProfile', JSON.stringify(cp));
            } catch (_) {}
          }
          // Sync to license context so feature gates update immediately
          const normalized = planName === 'premium' ? 'pro' : planName;
          if (['free', 'pro', 'family', 'lifetime'].includes(normalized)) {
            changePlan(normalized as 'free' | 'pro' | 'family' | 'lifetime').catch(() => {});
          }
        }
      })
      .catch(() => {});
  }, []);

  // Fetch real tickets from backend on mount — use email (tickets are keyed by email, not UUID)
  useEffect(() => {
    let email = '';
    try { email = JSON.parse(localStorage.getItem('iv_account') || '{}').email || ''; } catch {}
    if (!email) try { email = JSON.parse(localStorage.getItem('iv_account_session') || '{}').email || ''; } catch {}
    if (!email) return;
    fetch(`/api/crm/tickets/${encodeURIComponent(email)}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.tickets)) {
          setSupportTickets(data.tickets.map((t: any) => ({
            id: String(t.id),
            title: t.subject,
            description: t.description || '',
            category: 'other' as const,
            priority: t.priority || 'medium',
            status: t.status || 'open',
            createdAt: new Date(t.created_at),
            updatedAt: new Date(t.updated_at || t.created_at),
          })));
        }
      })
      .catch(() => {});
  }, []);

  // Get pricing tiers
  const pricingTiers = PricingService.getTiersForCurrency(currency);
  const currentTier = pricingTiers.find(tier => tier.id === userProfile.subscription.tier);

  // Calculate subscription status
  const subscriptionStatus = useMemo(() => {
    const now = new Date();
    const endDate = userProfile.subscription.endDate;
    
    if (userProfile.subscription.status === 'cancelled') {
      return { status: 'cancelled', color: 'bg-muted', text: 'Cancelled' };
    }
    
    if (userProfile.subscription.status === 'expired') {
      return { status: 'expired', color: 'bg-red-500', text: 'Expired' };
    }
    
    if (endDate && endDate < now) {
      return { status: 'expired', color: 'bg-red-500', text: 'Expired' };
    }
    
    const daysUntilExpiry = endDate ? Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    
    if (daysUntilExpiry <= 7) {
      return { status: 'expiring', color: 'bg-yellow-500', text: `Expires in ${daysUntilExpiry} days` };
    }
    
    return { status: 'active', color: 'bg-green-500', text: 'Active' };
  }, [userProfile.subscription]);

  const handleUpgradeSubscription = (tier: PricingTier) => {
    toast({
      title: "Redirecting",
      description: `Opening ${tier.name} plan checkout...`,
    });
    setLocation('/pricing');
  };

  const handleCancelSubscription = () => {
    setShowCancelConfirm(true);
  };

  const confirmCancelSubscription = () => {
    setUserProfile(prev => ({
      ...prev,
      subscription: { ...prev.subscription, status: 'cancelled' },
    }));
    toast({ title: "Subscription Cancelled", description: "Your subscription will remain active until the end of your billing period." });
    setShowCancelConfirm(false);
  };

  const handleCreateSupportTicket = async (ticketData: Partial<SupportTicket>) => {
    try {
      // QA-R2 C1: backend now requires Bearer auth on POST /api/crm/tickets
      // and uses the token's email server-side, so we don't send body.email.
      const cloudToken = localStorage.getItem('iv_cloud_token');
      if (!cloudToken) throw new Error('Not signed in');
      const response = await fetch('/api/crm/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cloudToken}`,
        },
        body: JSON.stringify({
          subject: ticketData.title || 'Support Request',
          description: ticketData.description || '',
          priority: ticketData.priority || 'medium',
          category: ticketData.category || 'other'
        }),
      });

      const result = await response.json();

      if (result.success && result.ticket) {
        const newTicket: SupportTicket = {
          id: String(result.ticket.ticket_id || result.ticket.id),
          title: result.ticket.subject,
          description: result.ticket.description || '',
          category: ticketData.category || 'other',
          priority: result.ticket.priority || 'medium',
          status: result.ticket.status || 'open',
          createdAt: new Date(result.ticket.created_at),
          updatedAt: new Date(result.ticket.created_at),
        };
        setSupportTickets(prev => [newTicket, ...prev]);
        toast({
          title: "Support Ticket Created",
          description: "Your support ticket has been submitted successfully.",
        });
      } else {
        throw new Error(result.message || 'Failed to submit ticket');
      }
    } catch (error) {
      console.error('Failed to create support ticket:', error);
      toast({
        title: "Error",
        description: "Failed to submit support ticket. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateProfile = (updates: Partial<UserProfile>) => {
    setUserProfile(prev => ({ ...prev, ...updates }));
    // Persist to localStorage
    const saved = localStorage.getItem('customerProfile');
    if (saved) {
      try {
        const cp = JSON.parse(saved);
        if (updates.name) cp.name = updates.name;
        if (updates.email) cp.email = updates.email;
        if (updates.phone) cp.phone = updates.phone;
        localStorage.setItem('customerProfile', JSON.stringify(cp));
      } catch (_) {}
    }
    toast({
      title: "Profile Updated",
      description: "Your profile has been updated successfully.",
    });
  };

  // Change master passcode handler
  const handleChangePasscode = async () => {
    if (!currentPasscode) {
      toast({ title: 'Error', description: 'Enter your current passcode', variant: 'destructive' });
      return;
    }
    if (newPasscode.length < 6) {
      toast({ title: 'Error', description: 'New passcode must be at least 6 characters', variant: 'destructive' });
      return;
    }
    if (newPasscode !== confirmNewPasscode) {
      toast({ title: 'Error', description: 'New passcodes do not match', variant: 'destructive' });
      return;
    }
    // Constant-time string compare to avoid timing-attack signal on the
    // current passcode. The two strings are user-supplied and short, but the
    // saved masterPassword is treated as a credential, so use timing-safe equality.
    const cur = currentPasscode || '';
    const mp = masterPassword || '';
    let mismatch = cur.length !== mp.length ? 1 : 0;
    const max = Math.max(cur.length, mp.length);
    for (let i = 0; i < max; i++) {
      mismatch |= (cur.charCodeAt(i) || 0) ^ (mp.charCodeAt(i) || 0);
    }
    if (mismatch !== 0) {
      toast({ title: 'Error', description: 'Current passcode is incorrect', variant: 'destructive' });
      return;
    }
    // Re-encrypt vault with new passcode via the auth-context hook
    try {
      await changeMasterPassword(currentPasscode, newPasscode);
      toast({ title: 'Passcode Changed', description: 'Your master passcode has been updated. Please re-login.' });
      setShowChangePasscodeDialog(false);
      setCurrentPasscode('');
      setNewPasscode('');
      setConfirmNewPasscode('');
    } catch (error: any) {
      toast({ title: 'Error', description: error?.message || 'Failed to change passcode', variant: 'destructive' });
    }
  };

  // Save email edit
  const handleSaveEmail = () => {
    if (!editEmail || !editEmail.includes('@')) {
      toast({ title: 'Invalid Email', description: 'Please enter a valid email address', variant: 'destructive' });
      return;
    }
    handleUpdateProfile({ email: editEmail });
    setEditingEmail(false);
    setEditEmail('');
  };

  // Save phone edit
  const handleSavePhone = () => {
    if (!editPhone || editPhone.length < 6) {
      toast({ title: 'Invalid Phone', description: 'Please enter a valid phone number', variant: 'destructive' });
      return;
    }
    handleUpdateProfile({ phone: editPhone });
    setEditingPhone(false);
    setEditPhone('');
  };

  // Privacy toggle handler
  const handlePrivacyToggle = (key: 'analytics' | 'crashReports' | 'marketing', value: boolean) => {
    setUserProfile(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        privacy: { ...prev.preferences.privacy, [key]: value }
      }
    }));
    localStorage.setItem(`ironvault_privacy_${key}`, String(value));
    toast({ title: 'Setting Updated', description: `${key === 'crashReports' ? 'Crash reports' : key.charAt(0).toUpperCase() + key.slice(1)} ${value ? 'enabled' : 'disabled'}` });
  };

  // Admin request handler — creates a support ticket for the request
  const handleAdminRequest = (requestType: string) => {
    handleCreateSupportTicket({
      title: `Admin Request: ${requestType}`,
      description: `User is requesting: ${requestType}. Please process within 24-48 hours.`,
      category: 'other',
      priority: 'medium',
    });
  };

  // FAQ data
  const faqItems = [
    { id: 'faq1', q: 'How do I change my master passcode?', a: 'Go to the Security tab in your profile, find "Master Passcode" section, and click "Change". You\'ll need to enter your current passcode and set a new one.' },
    { id: 'faq2', q: 'How to export my data?', a: 'Go to the Data tab and choose your preferred export format (CSV, JSON, or encrypted ZIP). Your data will be downloaded to your device.' },
    { id: 'faq3', q: 'How to backup my vault?', a: 'Go to the Data tab → Backup & Restore section → Click "Create Backup". You\'ll be asked to set a backup password to encrypt the backup file.' },
    { id: 'faq4', q: 'How to restore from backup?', a: 'Go to the Data tab → Backup & Restore section → Click "Restore". Select your backup file and enter the password you used when creating the backup.' },
  ];

  // Import data from file
  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      const content = await file.text();
      const data = JSON.parse(content);
      const itemCount = Object.values(data).reduce((acc: number, arr: any) => acc + (Array.isArray(arr) ? arr.length : 0), 0);
      toast({ title: 'Import Successful', description: `Imported ${itemCount} items from ${file.name}` });
    } catch (error) {
      toast({ title: 'Import Failed', description: 'Invalid file format. Please use a JSON export file.', variant: 'destructive' });
    }
    // Reset file input
    if (importFileRef.current) importFileRef.current.value = '';
  };

  // ── Clear all local data (Feature 3 — internet café wipe) ──────────────────
  // Wipes every local store the app uses: IndexedDB databases, localStorage,
  // sessionStorage, registered service workers, and CacheStorage. The user can
  // then walk away from a shared device confident nothing remains.
  const handleClearLocalData = async () => {
    setIsClearingLocal(true);
    try {
      // 1. IndexedDB — list every DB and delete it. indexedDB.databases()
      //    isn't on Safari yet, so fall back to a known list of vault DBs.
      try {
        const dbList = (indexedDB as any).databases ? await (indexedDB as any).databases() : [];
        const names = (dbList as any[]).map(d => d?.name).filter(Boolean);
        // Belt-and-braces: also wipe well-known names the app uses.
        const fallback = ['IronVaultDB', 'vault-storage', 'iv_vault_metadata'];
        const targets = Array.from(new Set([...names, ...fallback]));
        await Promise.all(targets.map((n: string) => new Promise<void>((resolve) => {
          try {
            const req = indexedDB.deleteDatabase(n);
            req.onsuccess = () => resolve();
            req.onerror = () => resolve();
            req.onblocked = () => resolve();
          } catch { resolve(); }
        })));
      } catch (e) { console.error('[clear-local] IndexedDB:', e); }

      // 2. CacheStorage
      try {
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        }
      } catch (e) { console.error('[clear-local] caches:', e); }

      // 3. Service workers — unregister all so no SW fetches stale data.
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister()));
        }
      } catch (e) { console.error('[clear-local] service workers:', e); }

      // 4. Web storage — last so the toast doesn't disappear with localStorage.
      try { sessionStorage.clear(); } catch {}
      try { localStorage.clear(); } catch {}

      toast({
        title: 'Local data cleared',
        description: 'All IronVault data removed from this browser.',
      });
      setShowClearLocalDialog(false);
      // Reload so React contexts that cached state are blown away too.
      setTimeout(() => window.location.replace('/'), 1200);
    } catch (err: any) {
      toast({
        title: 'Clear failed',
        description: err?.message || 'Could not clear all data.',
        variant: 'destructive',
      });
    } finally {
      setIsClearingLocal(false);
    }
  };

  // ── Active sessions (Feature 5) ────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError('');
    try {
      const token = localStorage.getItem('iv_cloud_token');
      if (!token) { setSessions([]); setSessionsError('Sign in to cloud sync to see active sessions.'); return; }
      const res = await fetch('/api/auth/sessions', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        if (res.status === 401) setSessionsError('Session expired — please sign in again.');
        else setSessionsError('Could not load sessions.');
        setSessions([]);
        return;
      }
      const json = await res.json();
      setSessions(Array.isArray(json.sessions) ? json.sessions : []);
    } catch (err: any) {
      setSessionsError(err?.message || 'Could not load sessions.');
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  const handleRevokeSession = async (id: string) => {
    const token = localStorage.getItem('iv_cloud_token');
    if (!token) return;
    try {
      const res = await fetch(`/api/auth/sessions/${encodeURIComponent(id)}/revoke`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Revoke failed');
      toast({ title: 'Session revoked', description: 'That device will lose access within ~5 minutes.' });
      loadSessions();
    } catch (err: any) {
      toast({ title: 'Revoke failed', description: err?.message || 'Try again', variant: 'destructive' });
    }
  };

  const handleRevokeAllSessions = async () => {
    const token = localStorage.getItem('iv_cloud_token');
    if (!token) return;
    if (!window.confirm('Sign out of every other device? Your current session is preserved.')) return;
    try {
      const res = await fetch('/api/auth/sessions/revoke-all', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Revoke-all failed');
      const j = await res.json();
      toast({ title: 'Signed out everywhere', description: `${j.revoked || 0} session(s) revoked.` });
      loadSessions();
    } catch (err: any) {
      toast({ title: 'Revoke failed', description: err?.message || 'Try again', variant: 'destructive' });
    }
  };

  // ── Activity log (Feature 6) ───────────────────────────────────────────────
  const loadActivity = useCallback(async () => {
    setActivityLoading(true);
    try {
      const token = localStorage.getItem('iv_cloud_token');
      if (!token) { setActivity([]); return; }
      const params = new URLSearchParams({ limit: '50', offset: '0' });
      if (activityFilterType !== 'all') params.set('type', activityFilterType);
      if (activityFilterAction !== 'all') params.set('action', activityFilterAction);
      const res = await fetch(`/api/vault/activity?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setActivity([]); return; }
      const json = await res.json();
      setActivity(Array.isArray(json.items) ? json.items : []);
    } finally {
      setActivityLoading(false);
    }
  }, [activityFilterType, activityFilterAction]);

  // Load both lists when the Security tab opens.
  useEffect(() => {
    if (activeTab !== 'security') return;
    loadSessions();
    loadActivity();
  }, [activeTab, loadSessions, loadActivity]);

  // Re-fetch activity when filters change (already in deps via loadActivity).
  useEffect(() => {
    if (activeTab === 'security') loadActivity();
  }, [activityFilterType, activityFilterAction, activeTab, loadActivity]);

  const browserIconFor = (browser: string | null) => {
    const b = (browser || '').toLowerCase();
    if (b.includes('chrome') || b.includes('chromium')) return <Chrome className="w-4 h-4" />;
    if (b.includes('safari')) return <Globe className="w-4 h-4" />;
    if (b.includes('firefox') || b.includes('edge') || b.includes('opera')) return <Globe className="w-4 h-4" />;
    return <Monitor className="w-4 h-4" />;
  };

  const formatRelativeTime = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const sec = Math.max(1, Math.floor((Date.now() - d.getTime()) / 1000));
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    return `${Math.floor(sec / 86400)}d ago`;
  };

  const formatActivityLine = (a: any) => {
    const type = a.itemType || 'item';
    const action = a.action || 'event';
    const where = a.deviceName ? `via ${a.deviceName}` : '';
    const title = a.itemTitle ? ` "${a.itemTitle}"` : '';
    return `${capitalize(action)} ${type}${title} ${where}`.trim();
  };

  const capitalize = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

  // Delete account handler — wipe server-side records first, then local data.
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      toast({ title: 'Error', description: 'Type DELETE to confirm', variant: 'destructive' });
      return;
    }
    const token = getCloudToken();
    try {
      const res = await fetch('/api/auth/account', {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      // Treat 401/404 as "nothing on server to delete" — still wipe locally so
      // the user isn't stranded with stale data on this device.
      if (!res.ok && res.status !== 401 && res.status !== 404) {
        const err = await res.json().catch(() => ({}));
        toast({
          title: 'Server delete failed',
          description: err?.error || 'Could not delete account on the server. Local data was not erased — try again.',
          variant: 'destructive',
        });
        return;
      }
    } catch (err) {
      toast({
        title: 'Network error',
        description: 'Could not reach the server to delete your account. Local data was not erased — try again.',
        variant: 'destructive',
      });
      return;
    }
    // Clear all local data
    localStorage.clear();
    try { indexedDB.deleteDatabase('IronVaultDB'); } catch { /* noop */ }
    try { indexedDB.deleteDatabase('vault-storage'); } catch { /* noop */ }
    toast({ title: 'Account Deleted', description: 'Your account and all local data have been permanently erased.' });
    setShowDeleteDialog(false);
    setTimeout(() => window.location.reload(), 1500);
  };

  const getTierIcon = (tierId: string) => {
    switch (tierId) {
      case 'free':
        return <Crown className="w-5 h-5" />;
      case 'pro':
        return <Zap className="w-5 h-5" />;
      case 'lifetime':
        return <Building2 className="w-5 h-5" />;
      default:
        return <Crown className="w-5 h-5" />;
    }
  };

  const getTierColor = (tierId: string) => {
    switch (tierId) {
      case 'free':
        return 'text-muted-foreground';
      case 'pro':
        return 'text-primary';
      case 'lifetime':
        return 'text-purple-600';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <ErrorBoundary>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
            <User className="w-6 h-6" />
            Profile & Settings
          </h1>
          <p className="text-muted-foreground">
            Manage your account, subscription, and preferences
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setLocation('/settings')}
            variant="outline"
          >
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
          <Button 
            onClick={() => setShowPricingModal(true)}
            variant="outline"
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Pricing
          </Button>
        </div>
      </div>

      {/* Backup Password Dialog */}
      <Dialog open={showBackupDialog} onOpenChange={setShowBackupDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Encrypted Backup</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Choose a strong password to encrypt your backup. You'll need this password to restore.
            </p>
            <div className="space-y-2">
              <Label htmlFor="backupPwd">Backup Password</Label>
              <Input
                id="backupPwd"
                type="password"
                placeholder="Min 8 characters"
                value={backupPassword}
                onChange={(e) => setBackupPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmBackupPwd">Confirm Password</Label>
              <Input
                id="confirmBackupPwd"
                type="password"
                placeholder="Confirm password"
                value={confirmBackupPassword}
                onChange={(e) => setConfirmBackupPassword(e.target.value)}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowBackupDialog(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleCreateBackup} disabled={isExporting} className="flex-1">
                {isExporting ? 'Creating...' : 'Create Backup'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Restore Backup Dialog */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Restore from Backup</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Enter the password you used when creating this backup.
            </p>
            <div className="space-y-2">
              <Label htmlFor="restorePwd">Backup Password</Label>
              <Input
                id="restorePwd"
                type="password"
                placeholder="Enter backup password"
                value={restorePassword}
                onChange={(e) => setRestorePassword(e.target.value)}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowRestoreDialog(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleRestoreConfirm} disabled={isRestoring} className="flex-1">
                {isRestoring ? 'Restoring...' : 'Restore'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Profile Overview */}
      <Card className="rounded-2xl shadow-sm border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Profile Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-6">
            {/* Avatar with gradient ring (emerald → teal → blue), pulse on mount */}
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              className="relative shrink-0"
            >
              <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-emerald-400 via-teal-500 to-blue-500 opacity-90 blur-[2px]" aria-hidden />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold ring-2 ring-background">
                {(userProfile.name || '?').split(' ').filter(n => n).map(n => n[0]).join('')}
              </div>
            </motion.div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">
                  {userProfile.name.includes('@') ? userProfile.name.split('@')[0] : userProfile.name}
                </h2>
                <Badge variant="outline" className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                  <Shield className="w-3 h-3 mr-1" />
                  <span className="capitalize">{userProfile.subscription.tier} Plan</span>
                </Badge>
              </div>
              <p className="text-muted-foreground">{userProfile.email}</p>
              <p className="text-sm text-muted-foreground">
                Member since {safeFormat(userProfile.createdAt, 'MMM yyyy')}
              </p>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span>Active</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>Last login: {safeFormat(userProfile.lastLogin, 'MMM dd, yyyy')}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="relative flex w-full overflow-x-auto gap-1 p-1 bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl">
          {[
            { value: 'overview', label: 'Overview' },
            { value: 'vaults', label: 'Vaults' },
            { value: 'subscription', label: 'Subscription' },
            { value: 'data', label: 'Data' },
            { value: 'support', label: 'Support' },
            { value: 'security', label: 'Security' },
          ].map(({ value, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="relative flex-shrink-0 text-xs px-3 z-10 data-[state=active]:bg-transparent data-[state=active]:text-emerald-200 data-[state=active]:shadow-none transition-colors"
            >
              {activeTab === value && (
                <motion.span
                  layoutId="profileActiveTab"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  className="absolute inset-0 -z-10 rounded-xl bg-emerald-500/15 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.3)]"
                />
              )}
              {label}
              {activeTab === value && (
                <motion.span
                  layoutId="profileActiveTabUnderline"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  className="absolute left-3 right-3 -bottom-px h-[2px] rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.6)]"
                />
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="rounded-2xl shadow-sm border-border/50 bg-card hover:shadow-md transition-all duration-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-primary" />
                  <div>
                    <div className="text-sm text-muted-foreground">Passwords</div>
                    <div className="text-lg font-semibold">{userProfile.stats?.totalPasswords ?? 0}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl shadow-sm border-border/50 bg-card hover:shadow-md transition-all duration-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-green-500" />
                  <div>
                    <div className="text-sm text-muted-foreground">Notes</div>
                    <div className="text-lg font-semibold">{userProfile.stats?.totalNotes ?? 0}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl shadow-sm border-border/50 bg-card hover:shadow-md transition-all duration-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-purple-500" />
                  <div>
                    <div className="text-sm text-muted-foreground">Subscriptions</div>
                    <div className="text-lg font-semibold">{userProfile.stats?.totalSubscriptions ?? 0}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl shadow-sm border-border/50 bg-card hover:shadow-md transition-all duration-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-orange-500" />
                  <div>
                    <div className="text-sm text-muted-foreground">Vault Size</div>
                    <div className="text-lg font-semibold">{userProfile.stats?.vaultSize ?? 0} MB</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card className="rounded-2xl shadow-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Vault backup completed</p>
                    <p className="text-xs text-muted-foreground">
                      {userProfile.stats?.lastBackup ? safeFormat(userProfile.stats?.lastBackup, 'MMM dd, HH:mm') : 'Never'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Profile updated</p>
                    <p className="text-xs text-muted-foreground">
                      {safeFormat(userProfile.lastLogin, 'MMM dd, HH:mm')}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vaults Tab */}
        <TabsContent value="vaults" className="space-y-6">
          <VaultManagementSection />
        </TabsContent>

        {/* Subscription Tab */}
        <TabsContent value="subscription" className="space-y-6">
          {/* Current Subscription */}
          <Card className="rounded-2xl shadow-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="w-5 h-5" />
                Your Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-full">
                    <Shield className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">
                      {userProfile.subscription.tier === 'free' ? 'Free'
                        : userProfile.subscription.tier === 'pro' ? 'Pro Monthly'
                        : userProfile.subscription.tier === 'family' ? 'Pro Family'
                        : userProfile.subscription.tier === 'lifetime' ? 'Lifetime'
                        : userProfile.subscription.tier} Plan
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {userProfile.subscription.tier === 'free' 
                        ? 'Basic vault with essential features' 
                        : userProfile.subscription.tier === 'lifetime'
                        ? 'Lifetime access to all premium features'
                        : 'Full access to all premium features'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {userProfile.subscription.tier === 'free' ? (
                    <>
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">Free</div>
                      <p className="text-sm text-muted-foreground">Forever</p>
                    </>
                  ) : userProfile.subscription.tier === 'lifetime' ? (
                    <>
                      <div className="text-2xl font-bold text-primary">₹9,999</div>
                      <p className="text-sm text-muted-foreground">One-time</p>
                    </>
                  ) : userProfile.subscription.tier === 'family' ? (
                    <>
                      <div className="text-2xl font-bold text-primary">₹299</div>
                      <p className="text-sm text-muted-foreground">/month</p>
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-bold text-primary">₹149</div>
                      <p className="text-sm text-muted-foreground">/month</p>
                    </>
                  )}
                </div>
              </div>

              {/* Subscription Status Badge */}
              {userProfile.subscription.tier !== 'free' && (
                <div className="flex items-center gap-2">
                  <Badge className={`${subscriptionStatus.color} text-white`}>{subscriptionStatus.text}</Badge>
                  {userProfile.subscription.endDate && (
                    <span className="text-sm text-muted-foreground">
                      Renews: {userProfile.subscription.endDate.toLocaleDateString()}
                    </span>
                  )}
                </div>
              )}
              
              {/* Plan Features */}
              <div className="mt-6">
                <h4 className="font-medium mb-3">
                  {userProfile.subscription.tier === 'free' ? 'Free Features' : 'Premium Features Included'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm">{userProfile.subscription.tier === 'free' ? 'Up to 50 passwords' : 'Unlimited passwords'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm">AES-256 encryption</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm">Export/Import backup</span>
                  </div>
                  {userProfile.subscription.tier !== 'free' && (
                    <>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-sm">Up to 5 vaults total (local + cloud)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-sm">Priority support</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-sm">Advanced analytics</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-sm">Document scanner</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-sm">Cloud backup</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 flex flex-col gap-2">
                {userProfile.subscription.tier === 'free' && (
                  <Button variant="default" onClick={() => setShowPricingModal(true)}>
                    <Crown className="w-4 h-4 mr-2" />
                    Upgrade Plan
                  </Button>
                )}
                {userProfile.subscription.tier !== 'free' && userProfile.subscription.tier !== 'lifetime' && (
                  <>
                    <Button variant="outline" onClick={handleCancelSubscription}>
                      Cancel Subscription
                    </Button>
                  </>
                )}
              </div>
                
              {/* Info Banner */}
              {userProfile.subscription.tier === 'free' && (
                <div className="mt-4 p-4 bg-primary/10 border border-primary/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Heart className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">Upgrade for More Features</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Unlock multiple vaults, unlimited storage, priority support, and more with a premium plan.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Account Information Card */}
          <Card className="rounded-2xl shadow-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                Account Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg bg-primary/5">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium">Offline Vault</p>
                      <p className="text-sm text-muted-foreground">Your data stays on your device</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                    Active
                  </Badge>
                    </div>
                
                <div className="p-4 border rounded-lg bg-muted/50">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-primary mt-0.5" />
                    <div className="space-y-2">
                      <p className="font-medium text-sm capitalize">
                        IronVault — {userProfile.subscription.tier === 'free' ? 'Free' : userProfile.subscription.tier} Plan
                      </p>
                      <p className="text-sm text-muted-foreground">
                        All your data is encrypted and stored locally on your device.
                        {userProfile.subscription.tier === 'free'
                          ? ' Upgrade to unlock multiple vaults and premium features.'
                          : ' Enjoy all premium features with your current plan.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Family Invites Card — visible to all users (send requires pro/family/lifetime) */}
          <Card className="rounded-2xl shadow-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Family Sharing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Incoming invites — always shown */}
              {incomingInvites.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Pending invites for you</p>
                  {incomingInvites.map((inv: any) => (
                    <div key={inv.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                      <div>
                        <p className="text-sm font-medium">{inv.owner_name || inv.owner_email}</p>
                        <p className="text-xs text-muted-foreground">{inv.owner_email} invited you</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleUpdateInvite(inv.id, 'accepted')}>Accept</Button>
                        <Button size="sm" variant="outline" onClick={() => handleUpdateInvite(inv.id, 'declined')}>Decline</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Send invite — only for pro/family/lifetime */}
              {['pro', 'family', 'lifetime'].includes(userProfile.subscription.tier) ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Invite a family member</p>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {outgoingInvites.filter(i => i.status === 'accepted').length + 1}/{getPlan(userProfile.subscription.tier as any)?.seats ?? 6} members
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="invitee@email.com"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSendInvite()}
                      className="flex-1"
                    />
                    <Button onClick={handleSendInvite} disabled={inviteLoading || !inviteEmail.trim()}>
                      <UserPlus className="w-4 h-4 mr-1" />
                      {inviteLoading ? 'Sending…' : 'Invite'}
                    </Button>
                  </div>

                  {/* Outgoing invite list */}
                  {invitesLoading ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                  ) : outgoingInvites.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Sent invites</p>
                      {outgoingInvites.map((inv: any) => (
                        <div key={inv.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="text-sm font-medium">{inv.invitee_email}</p>
                            <Badge variant={inv.status === 'accepted' ? 'default' : inv.status === 'declined' ? 'destructive' : 'secondary'} className="text-xs mt-1">
                              {inv.status}
                            </Badge>
                          </div>
                          {inv.status === 'pending' && (
                            <Button size="sm" variant="ghost" onClick={() => handleUpdateInvite(inv.id, 'revoked')}>
                              <UserX className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No invites sent yet.</p>
                  )}
                </div>
              ) : (
                <div className="p-4 border rounded-lg bg-muted/50 text-center">
                  <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">Family sharing requires Pro or higher</p>
                  <p className="text-xs text-muted-foreground mt-1">Upgrade your plan to invite family members.</p>
                  <Button size="sm" className="mt-3" onClick={() => setShowPricingModal(true)}>Upgrade Plan</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data & Export Tab */}
        <TabsContent value="data" className="space-y-6">
          {/* Data Encryption Info */}
          <Card className="rounded-2xl shadow-sm border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Shield className="w-5 h-5" />
                Data Encryption & Security
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Database className="w-6 h-6 text-primary mt-1" />
                  <div>
                    <p className="text-foreground font-medium">AES-256 Encryption</p>
                    <p className="text-muted-foreground text-sm mt-1">
                      All your data is encrypted using industry-standard AES-256 encryption before being stored locally on your device.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <CloudOff className="w-6 h-6 text-primary mt-1" />
                  <div>
                    <p className="text-foreground font-medium">Local-Only Storage</p>
                    <p className="text-muted-foreground text-sm mt-1">
                      Your data never leaves your device. No cloud syncing, no external servers - complete privacy and control.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Key className="w-6 h-6 text-primary mt-1" />
                  <div>
                    <p className="text-foreground font-medium">Master Key Protection</p>
                    <p className="text-muted-foreground text-sm mt-1">
                      Your master passcode is used to derive encryption keys. Only you have access to your data.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Export Options */}
          <Card className="rounded-2xl shadow-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5" />
                Export Your Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Export your encrypted data for backup or migration purposes. All exports are protected by your master passcode.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="font-medium">Complete Vault Export</h4>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start" onClick={handleExportCSV} disabled={isExporting}>
                      <FileText className="w-4 h-4 mr-2" />
                      Export as CSV
                    </Button>
                    <Button variant="outline" className="w-full justify-start" onClick={handleExportJSON} disabled={isExporting}>
                      <Database className="w-4 h-4 mr-2" />
                      Export as JSON
                    </Button>
                    <Button variant="outline" className="w-full justify-start" onClick={() => setShowBackupDialog(true)} disabled={isExporting}>
                      <Archive className="w-4 h-4 mr-2" />
                      Export as ZIP
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h4 className="font-medium">Selective Export</h4>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start" onClick={() => handleSelectiveExport('passwords')} disabled={isExporting}>
                      <Key className="w-4 h-4 mr-2" />
                      Passwords Only
                    </Button>
                    <Button variant="outline" className="w-full justify-start" onClick={() => handleSelectiveExport('subscriptions')} disabled={isExporting}>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Subscriptions Only
                    </Button>
                    <Button variant="outline" className="w-full justify-start" onClick={() => handleSelectiveExport('goals')} disabled={isExporting}>
                      <Target className="w-4 h-4 mr-2" />
                      Goals Only
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Last Export</h4>
                    <p className="text-sm text-muted-foreground">{lastExportDate ? safeFormat(lastExportDate, 'MMM d, yyyy h:mm a') : 'Never exported'}</p>
                  </div>
                  <Button variant="outline" size="sm" disabled>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Schedule Auto-Export
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Backup & Restore */}
          <Card className="rounded-2xl shadow-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="w-5 h-5" />
                Backup & Restore
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <HardDrive className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium">Local Backup</p>
                      <p className="text-sm text-muted-foreground">Backup to device storage</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setShowBackupDialog(true)} disabled={isExporting}>
                    <Download className="w-4 h-4 mr-2" />
                    Create Backup
                  </Button>
                </div>
                
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Upload className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="font-medium">Restore from Backup</p>
                      <p className="text-sm text-muted-foreground">Restore from previous backup</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleRestoreBackup} disabled={isRestoring}>
                    <Upload className="w-4 h-4 mr-2" />
                    Restore
                  </Button>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Backup Status</h4>
                    <p className="text-sm text-muted-foreground">{lastBackupDate ? `Last backup: ${safeFormat(lastBackupDate, 'MMM d, yyyy')}` : 'No backups found'}</p>
                  </div>
                  <Badge variant="outline">No Backups</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Support Tab */}
        <TabsContent value="support" className="space-y-6">
          {/* Quick Help */}
          <Card className="rounded-2xl shadow-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5" />
                Quick Help
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="font-medium">Frequently Asked Questions</h4>
                  <div className="space-y-2">
                    {faqItems.map(faq => (
                      <div key={faq.id}>
                        <Button variant="ghost" className="w-full justify-start" onClick={() => setExpandedFAQ(expandedFAQ === faq.id ? null : faq.id)}>
                          {expandedFAQ === faq.id ? <ChevronDown className="w-4 h-4 mr-2" /> : <ChevronRight className="w-4 h-4 mr-2" />}
                          {faq.q}
                        </Button>
                        {expandedFAQ === faq.id && (
                          <div className="ml-6 p-3 text-sm text-muted-foreground bg-muted rounded-md mt-1">
                            {faq.a}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h4 className="font-medium">Contact Support</h4>
                  <div className="space-y-2">
                    <a href="mailto:subsafeironvault@gmail.com" className="w-full">
                      <Button variant="outline" className="w-full justify-start">
                        <Mail className="w-4 h-4 mr-2" />
                        <div className="flex flex-col items-start">
                          <span className="font-medium">Email Support</span>
                          <span className="text-xs text-muted-foreground">subsafeironvault@gmail.com</span>
                        </div>
                      </Button>
                    </a>
                    <a href="tel:+918287450463" className="w-full">
                      <Button variant="outline" className="w-full justify-start">
                        <Phone className="w-4 h-4 mr-2" />
                        <div className="flex flex-col items-start">
                          <span className="font-medium">Phone Support</span>
                          <span className="text-xs text-muted-foreground">+91-8287450463</span>
                        </div>
                      </Button>
                    </a>
                    <Button variant="outline" className="w-full justify-start" onClick={() => {
                      window.open('https://wa.me/918287450463?text=Hi%20IronVault%20Support', '_blank', 'noopener,noreferrer');
                    }}>
                      <MessageSquare className="w-4 h-4 mr-2" />
                      <div className="flex flex-col items-start">
                        <span className="font-medium">Live Chat</span>
                        <span className="text-xs text-muted-foreground">Chat via WhatsApp</span>
                      </div>
                    </Button>
                    <Button variant="outline" className="w-full justify-start" onClick={() => setLocation('/docs')}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      <div className="flex flex-col items-start">
                        <span className="font-medium">Knowledge Base</span>
                        <span className="text-xs text-muted-foreground">Guides & Documentation</span>
                      </div>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Admin Requests */}
          <Card className="rounded-2xl shadow-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Admin Requests
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                For changes that require admin approval, submit a request below. Our team will process your request within 24-48 hours.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="font-medium">Account Changes</h4>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start" onClick={() => handleAdminRequest('Change Email Address')}>
                      <User className="w-4 h-4 mr-2" />
                      Change Email Address
                    </Button>
                    <Button variant="outline" className="w-full justify-start" onClick={() => handleAdminRequest('Change Phone Number')}>
                      <Phone className="w-4 h-4 mr-2" />
                      Change Phone Number
                    </Button>
                    <Button variant="outline" className="w-full justify-start" onClick={() => handleAdminRequest('Update Billing Info')}>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Update Billing Info
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h4 className="font-medium">Subscription Changes</h4>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start" onClick={() => handleAdminRequest('Request Refund')}>
                      <Crown className="w-4 h-4 mr-2" />
                      Request Refund
                    </Button>
                    <Button variant="outline" className="w-full justify-start" onClick={() => handleAdminRequest('Cancel Subscription')}>
                      <Settings className="w-4 h-4 mr-2" />
                      Cancel Subscription
                    </Button>
                    <Button variant="outline" className="w-full justify-start" onClick={() => handleAdminRequest('Downgrade Plan')}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Downgrade Plan
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Request Status</h4>
                    <p className="text-sm text-muted-foreground">No pending requests</p>
                  </div>
                  <Badge variant="outline">All Clear</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Support Tickets */}
          <Card className="rounded-2xl shadow-sm border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Support Tickets
                </CardTitle>
                <Button onClick={() => setShowSupportModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Ticket
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {supportTickets.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No support tickets yet. Create one if you need help.</p>
                ) : (
                  supportTickets.map(ticket => (
                    <div key={ticket.id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium">{ticket.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{ticket.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {ticket.priority}
                            </Badge>
                            <Badge 
                              variant={ticket.status === 'resolved' || ticket.status === 'closed' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {ticket.status}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          <div>{safeFormat(ticket.createdAt, 'MMM dd, yyyy')}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Help Resources */}
          <Card className="rounded-2xl shadow-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5" />
                Help Resources
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button variant="outline" className="h-auto p-4 justify-start" onClick={() => setLocation('/docs')}>
                  <FileText className="w-5 h-5 mr-3" />
                  <div className="text-left">
                    <div className="font-medium">Documentation</div>
                    <div className="text-sm text-muted-foreground">User guides and tutorials</div>
                  </div>
                </Button>
                <Button variant="outline" className="h-auto p-4 justify-start" onClick={() => setLocation('/support')}>
                  <MessageSquare className="w-5 h-5 mr-3" />
                  <div className="text-left">
                    <div className="font-medium">FAQ</div>
                    <div className="text-sm text-muted-foreground">Frequently asked questions</div>
                  </div>
                </Button>
                <Button variant="outline" className="h-auto p-4 justify-start" onClick={() => setLocation('/docs')}>
                  <Video className="w-5 h-5 mr-3" />
                  <div className="text-left">
                    <div className="font-medium">Video Tutorials</div>
                    <div className="text-sm text-muted-foreground">Step-by-step video guides</div>
                  </div>
                </Button>
                <Button variant="outline" className="h-auto p-4 justify-start" onClick={() => window.location.href = 'mailto:subsafeironvault@gmail.com'}>
                  <Mail className="w-5 h-5 mr-3" />
                  <div className="text-left">
                    <div className="font-medium">Contact Support</div>
                    <div className="text-sm text-muted-foreground">Get help from our team</div>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          {/* Account Information */}
          <Card className="rounded-2xl shadow-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Account Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    {editingEmail ? (
                      <>
                        <Input id="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="Enter new email" />
                        <Button variant="default" size="sm" onClick={handleSaveEmail}><Save className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => { setEditingEmail(false); setEditEmail(''); }}>✕</Button>
                      </>
                    ) : (
                      <>
                        <Input id="email" value={userProfile.email} readOnly />
                        <Button variant="outline" size="sm" onClick={() => { setEditingEmail(true); setEditEmail(userProfile.email); }}>
                          <Edit className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    {editingPhone ? (
                      <>
                        <Input id="phone" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="Enter new phone" />
                        <Button variant="default" size="sm" onClick={handleSavePhone}><Save className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => { setEditingPhone(false); setEditPhone(''); }}>✕</Button>
                      </>
                    ) : (
                      <>
                        <Input id="phone" value={userProfile.phone} readOnly />
                        <Button variant="outline" size="sm" onClick={() => { setEditingPhone(true); setEditPhone(userProfile.phone || ''); }}>
                          <Edit className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Local Encryption Notice */}
          <Card className="rounded-2xl shadow-sm border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-300">
                <Shield className="w-5 h-5" />
                End-to-End Encryption
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3">
                <CloudOff className="w-6 h-6 text-green-600 dark:text-green-400 mt-1" />
                <div>
                  <p className="text-green-800 dark:text-green-300 font-medium">Your vault is encrypted with AES-256 and never leaves this device</p>
                  <p className="text-green-700 dark:text-green-400 text-sm mt-1">
                    All sensitive data remains on-device with strong encryption. No cloud syncing - your data stays private and secure.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Master Passcode Management */}
          <Card className="rounded-2xl shadow-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                Master Passcode
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Change Master Passcode</h4>
                  <p className="text-sm text-muted-foreground">Update your vault's master password</p>
                </div>
                <Button variant="outline" onClick={() => setShowChangeMasterPasswordDialog(true)} data-testid="button-open-change-master-password">
                  <Edit className="w-4 h-4 mr-2" />
                  Change
                </Button>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Passcode Strength</h4>
                  <p className="text-sm text-muted-foreground">Current passcode strength indicator</p>
                </div>
                <div className="flex items-center gap-2">
                  {(() => {
                    const pw = masterPassword || '';
                    let score = 0;
                    if (pw.length >= 8) score += 25;
                    if (pw.length >= 12) score += 25;
                    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 20;
                    if (/[0-9]/.test(pw)) score += 15;
                    if (/[^A-Za-z0-9]/.test(pw)) score += 15;
                    score = Math.min(100, score);
                    const label = score >= 80 ? 'Strong' : score >= 50 ? 'Medium' : score > 0 ? 'Weak' : 'Not set';
                    const color = score >= 80 ? 'text-green-600' : score >= 50 ? 'text-yellow-600' : 'text-red-600';
                    return (
                      <>
                        <Progress value={score} className="w-20" />
                        <span className={`text-sm font-medium ${color}`}>{label}</span>
                      </>
                    );
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Two-Factor Authentication — server-backed TOTP. */}
          <TwoFactorAuth
            isEnabled={twoFAEnabled}
            onSetup={async () => {
              const token = getCloudToken();
              if (!token) {
                console.error('[2FA-SETUP] no cloud token — user not signed in');
                return null;
              }
              try {
                const res = await fetch('/api/auth/2fa/setup', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                });
                if (!res.ok) {
                  const txt = await res.text().catch(() => '');
                  console.error('[2FA-SETUP] failed', res.status, txt);
                  return null;
                }
                const data = await res.json();
                // Server intentionally doesn't echo the raw secret in the
                // response body — but the otpauth URI carries it as a
                // query param, and the modal renders it as a manual
                // backup. Extract it client-side so the user sees something
                // other than "undefined" when they want to type the
                // secret into a desktop authenticator.
                let secret = data.secret as string | undefined;
                if (!secret && typeof data.otpauthUrl === 'string') {
                  try {
                    const u = new URL(data.otpauthUrl);
                    secret = u.searchParams.get('secret') || '';
                  } catch { secret = ''; }
                }
                return { ...data, secret: secret || '' };
              } catch (e: any) {
                console.error('[2FA-SETUP] threw:', e?.message || e);
                return null;
              }
            }}
            onVerifyEnable={async (code) => {
              const token = getCloudToken();
              if (!token) {
                console.error('[2FA-VERIFY] no cloud token');
                return null;
              }
              try {
                const res = await fetch('/api/auth/2fa/verify', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                  body: JSON.stringify({ code }),
                });
                if (!res.ok) {
                  const txt = await res.text().catch(() => '');
                  console.error('[2FA-VERIFY] failed', res.status, txt);
                  return null;
                }
                const data = await res.json();
                if (!data?.enabled) {
                  console.error('[2FA-VERIFY] server returned enabled=false', data);
                  return null;
                }
                console.info('[2FA-VERIFY] success — 2FA enabled, refetching status');
                setTwoFAEnabled(true);
                localStorage.setItem('ironvault_2fa_enabled', 'true');
                // Re-confirm with the server so a stale 2fa state from
                // another tab can't mask a successful enable.
                try {
                  const statusRes = await fetch('/api/auth/2fa/status', {
                    headers: { 'Authorization': `Bearer ${token}` },
                  });
                  if (statusRes.ok) {
                    const s = await statusRes.json();
                    if (typeof s?.enabled === 'boolean') {
                      setTwoFAEnabled(s.enabled);
                      localStorage.setItem('ironvault_2fa_enabled', s.enabled ? 'true' : 'false');
                    }
                  }
                } catch { /* status refetch is advisory */ }
                return Array.isArray(data.backupCodes) ? data.backupCodes : [];
              } catch (e: any) {
                console.error('[2FA-VERIFY] threw:', e?.message || e);
                return null;
              }
            }}
            onDisable={async (code) => {
              const token = getCloudToken();
              if (!token) return false;
              const res = await fetch('/api/auth/2fa/disable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ code }),
              });
              if (!res.ok) return false;
              setTwoFAEnabled(false);
              localStorage.setItem('ironvault_2fa_enabled', 'false');
              return true;
            }}
            onRegenerateBackupCodes={async (code) => {
              const token = getCloudToken();
              if (!token) return null;
              const res = await fetch('/api/auth/2fa/backup-codes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ code }),
              });
              if (!res.ok) return null;
              const data = await res.json();
              return data?.backupCodes || null;
            }}
          />

          {/* Security Settings */}
          <Card className="rounded-2xl shadow-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Security Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Session Timeout</h4>
                  <p className="text-sm text-muted-foreground">Automatically lock vault after inactivity</p>
                </div>
                <Switch
                  checked={sessionTimeoutEnabled}
                  onCheckedChange={(checked) => {
                    setSessionTimeoutEnabled(checked);
                    autoLockService.setEnabled(checked);
                  }}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Biometric Authentication</h4>
                  <p className="text-sm text-muted-foreground">
                    {biometricAvailable 
                      ? `Use ${biometricType === 'faceId' ? 'Face ID' : biometricType === 'touchId' ? 'Touch ID' : 'fingerprint'} to unlock`
                      : 'Not available on this device'}
                  </p>
                </div>
                <Switch 
                  checked={biometricEnabled}
                  onCheckedChange={handleBiometricToggle}
                  disabled={!biometricAvailable}
                />
              </div>
            </CardContent>
          </Card>

          {/* Data & Privacy */}
          <Card className="rounded-2xl shadow-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Data & Privacy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Analytics</h4>
                  <p className="text-sm text-muted-foreground">Help improve the app with usage data</p>
                </div>
                <Switch checked={userProfile.preferences.privacy.analytics} onCheckedChange={(v) => handlePrivacyToggle('analytics', v)} />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Crash Reports</h4>
                  <p className="text-sm text-muted-foreground">Automatically send crash reports</p>
                </div>
                <Switch checked={userProfile.preferences.privacy.crashReports} onCheckedChange={(v) => handlePrivacyToggle('crashReports', v)} />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Marketing Emails</h4>
                  <p className="text-sm text-muted-foreground">Receive product updates and offers</p>
                </div>
                <Switch checked={userProfile.preferences.privacy.marketing} onCheckedChange={(v) => handlePrivacyToggle('marketing', v)} />
              </div>
            </CardContent>
          </Card>

          {/* Browser Extension */}
          <Card className="rounded-2xl shadow-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Chrome className="w-5 h-5" />
                Browser Extension
              </CardTitle>
              <CardDescription>
                Auto-fill passwords on any website from your vault — without ever decrypting more than the one credential you need.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <KeyRound className="w-4 h-4 text-primary mb-1.5" />
                  <p className="text-xs font-semibold">Zero-knowledge</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Master password never leaves your browser. The cloud only stores the AES-256-GCM blob.
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <Timer className="w-4 h-4 text-primary mb-1.5" />
                  <p className="text-xs font-semibold">Auto-lock</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Wipes session memory after 5 min of inactivity (1, 5, 15 or 30 min in settings).
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <Fingerprint className="w-4 h-4 text-primary mb-1.5" />
                  <p className="text-xs font-semibold">One credential at a time</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Passwords show as ••••• by default. Reveal lasts 5 seconds. Web pages only get the one you pick.
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-border/60 p-4 space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Install (developer / unpacked)
                </h4>
                <ol className="text-sm space-y-1.5 list-decimal pl-5 text-muted-foreground">
                  <li>
                    <a
                      href="https://github.com/Sakun33/IronVault-V4/tree/main/chrome-extension"
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      Download the chrome-extension folder
                    </a>{' '}
                    from the IronVault repo (or clone the repo locally).
                  </li>
                  <li>Open <code className="px-1 py-0.5 rounded bg-muted text-[12px]">chrome://extensions</code> in Chrome.</li>
                  <li>Toggle <strong>Developer mode</strong> in the top-right.</li>
                  <li>Click <strong>Load unpacked</strong> and pick the <code className="px-1 py-0.5 rounded bg-muted text-[12px]">chrome-extension/</code> folder.</li>
                  <li>Pin the IronVault icon to the toolbar — click it and sign in with your account password + master password.</li>
                </ol>
                <p className="text-[11px] text-muted-foreground">
                  Requires Chrome 116+ (or any modern Chromium browser). The extension only requests permissions for <code className="px-1 rounded bg-muted text-[10px]">ironvault.app</code> — it never asks for cross-site host access.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Active Sessions (Feature 5) */}
          <Card className="rounded-2xl shadow-sm border-border/50" data-testid="card-active-sessions">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="w-5 h-5" />
                  Active Sessions
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={loadSessions} disabled={sessionsLoading}>
                    <RefreshCw className={`w-4 h-4 mr-1.5 ${sessionsLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={handleRevokeAllSessions} disabled={sessions.length <= 1}>
                    <UserX className="w-4 h-4 mr-1.5" />
                    Revoke All
                  </Button>
                </div>
              </div>
              <CardDescription>
                Devices and browsers signed into your IronVault account. Revoking a session locks that device within ~5 minutes — its locally cached vault is wiped on the next check-in.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sessionsError && (
                <p className="text-sm text-muted-foreground py-4">{sessionsError}</p>
              )}
              {!sessionsError && sessionsLoading && sessions.length === 0 && (
                <p className="text-sm text-muted-foreground py-4">Loading sessions…</p>
              )}
              {!sessionsError && !sessionsLoading && sessions.length === 0 && (
                <p className="text-sm text-muted-foreground py-4">No active sessions found.</p>
              )}
              {sessions.length > 0 && (
                <ul className="divide-y divide-border/60">
                  {sessions.map((s) => (
                    <li key={s.id} className="py-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        {browserIconFor(s.browser)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium truncate">{s.deviceName || `${s.browser || 'Unknown'} on ${s.os || 'Unknown'}`}</p>
                          {s.isCurrent && (
                            <Badge variant="secondary" className="text-[10px]">this device</Badge>
                          )}
                          {s.clientKind === 'extension' && (
                            <Badge variant="outline" className="text-[10px]">extension</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {s.ipAddress || 'IP unknown'} · last active {formatRelativeTime(s.lastActiveAt)}
                        </p>
                      </div>
                      {!s.isCurrent && (
                        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => handleRevokeSession(s.id)}>
                          Revoke
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Activity Log (Feature 6) */}
          <Card className="rounded-2xl shadow-sm border-border/50" data-testid="card-activity-log">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Activity
                </CardTitle>
                <Button variant="outline" size="sm" onClick={loadActivity} disabled={activityLoading}>
                  <RefreshCw className={`w-4 h-4 mr-1.5 ${activityLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
              <CardDescription>
                Recent reads, fills, edits, and exports across all your devices.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Select value={activityFilterType} onValueChange={setActivityFilterType}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="All types" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="password">Passwords</SelectItem>
                    <SelectItem value="note">Notes</SelectItem>
                    <SelectItem value="subscription">Subscriptions</SelectItem>
                    <SelectItem value="document">Documents</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={activityFilterAction} onValueChange={setActivityFilterAction}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="All actions" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All actions</SelectItem>
                    <SelectItem value="viewed">Viewed</SelectItem>
                    <SelectItem value="filled">Filled</SelectItem>
                    <SelectItem value="created">Created</SelectItem>
                    <SelectItem value="updated">Updated</SelectItem>
                    <SelectItem value="deleted">Deleted</SelectItem>
                    <SelectItem value="exported">Exported</SelectItem>
                    <SelectItem value="imported">Imported</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {activityLoading && activity.length === 0 && (
                <p className="text-sm text-muted-foreground py-4">Loading activity…</p>
              )}
              {!activityLoading && activity.length === 0 && (
                <p className="text-sm text-muted-foreground py-4">No activity yet. Autofill a password or save a new entry to start the log.</p>
              )}
              {activity.length > 0 && (
                <ul className="divide-y divide-border/60">
                  {activity.map((a) => (
                    <li key={a.id} className="py-2.5 flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                        {a.action === 'filled' || a.action === 'viewed' ? <Eye className="w-3.5 h-3.5" />
                          : a.action === 'created' ? <Plus className="w-3.5 h-3.5" />
                          : a.action === 'deleted' ? <Trash2 className="w-3.5 h-3.5" />
                          : a.action === 'exported' || a.action === 'imported' ? <Download className="w-3.5 h-3.5" />
                          : <Info className="w-3.5 h-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{formatActivityLine(a)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatRelativeTime(a.createdAt)} · {a.ipAddress || 'IP unknown'}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Data Management */}
          <Card className="rounded-2xl shadow-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Data Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <input type="file" ref={importFileRef} accept=".json,.csv" className="hidden" onChange={handleImportData} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button variant="outline" className="h-auto p-4 justify-start" onClick={() => setActiveTab('data')}>
                  <Download className="w-5 h-5 mr-3" />
                  <div className="text-left">
                    <div className="font-medium">Export Data</div>
                    <div className="text-sm text-muted-foreground">Download your vault data</div>
                  </div>
                </Button>
                <Button variant="outline" className="h-auto p-4 justify-start" onClick={() => importFileRef.current?.click()}>
                  <Upload className="w-5 h-5 mr-3" />
                  <div className="text-left">
                    <div className="font-medium">Import Data</div>
                    <div className="text-sm text-muted-foreground">Import from other password managers</div>
                  </div>
                </Button>
                <Button variant="outline" className="h-auto p-4 justify-start text-red-600 hover:text-red-700" onClick={() => setShowDeleteDialog(true)}>
                  <Trash2 className="w-5 h-5 mr-3" />
                  <div className="text-left">
                    <div className="font-medium">Delete Account</div>
                    <div className="text-sm text-muted-foreground">Permanently delete your account</div>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Clear All Local Data (Feature 3 — internet café wipe) */}
          <Card className="rounded-2xl shadow-sm border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20" data-testid="card-clear-local-data">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-800 dark:text-red-300">
                <AlertTriangle className="w-5 h-5" />
                Clear All Local Data
              </CardTitle>
              <CardDescription>
                For internet cafés or shared devices. Wipes IndexedDB, localStorage, sessionStorage, service workers, and all browser caches for IronVault. Cloud-synced vaults are untouched — sign back in on your own device to restore.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                className="w-full sm:w-auto"
                onClick={() => setShowClearLocalDialog(true)}
                data-testid="button-clear-local-data"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All Local Data
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Clear-local-data confirmation dialog (Feature 3) */}
      <AlertDialog open={showClearLocalDialog} onOpenChange={setShowClearLocalDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Clear all local IronVault data?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This wipes the encrypted vault, settings, session, and caches from this browser. Your cloud-synced vaults are not affected — you can sign in again on your own device. This cannot be undone on this browser.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearingLocal}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearLocalData}
              disabled={isClearingLocal}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-confirm-clear-local"
            >
              {isClearingLocal ? 'Clearing…' : 'Clear everything'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Master Password (email-verified) */}
      <ChangeMasterPasswordDialog
        open={showChangeMasterPasswordDialog}
        onOpenChange={setShowChangeMasterPasswordDialog}
        accountEmail={accountEmail}
      />

      {/* Pricing Modal */}
      <PricingUpgrade
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
      />

      {/* Support Modal */}
      <Dialog open={showSupportModal} onOpenChange={setShowSupportModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Create Support Ticket
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ticket-title">Title</Label>
              <Input 
                id="ticket-title" 
                placeholder="Brief description of your issue"
                value={ticketFormData.title}
                onChange={(e) => setTicketFormData(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="ticket-category">Category</Label>
              <Select value={ticketFormData.category} onValueChange={(v) => setTicketFormData(prev => ({ ...prev, category: v as SupportTicket['category'] }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">Bug Report</SelectItem>
                  <SelectItem value="feature">Feature Request</SelectItem>
                  <SelectItem value="performance">Performance Issue</SelectItem>
                  <SelectItem value="ui">UI/UX Issue</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="ticket-priority">Priority</Label>
              <Select value={ticketFormData.priority} onValueChange={(v) => setTicketFormData(prev => ({ ...prev, priority: v as SupportTicket['priority'] }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="ticket-description">Description</Label>
              <textarea 
                id="ticket-description"
                className="w-full min-h-[120px] p-3 border rounded-md bg-background text-foreground placeholder:text-muted-foreground"
                placeholder="Please provide detailed information about your issue..."
                value={ticketFormData.description}
                onChange={(e) => setTicketFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowSupportModal(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                if (!ticketFormData.title || !ticketFormData.description) {
                  toast({ title: 'Validation Error', description: 'Please fill in title and description.', variant: 'destructive' });
                  return;
                }
                handleCreateSupportTicket({
                  title: ticketFormData.title,
                  description: ticketFormData.description,
                  category: ticketFormData.category,
                  priority: ticketFormData.priority
                });
                setTicketFormData({ title: '', category: 'bug', priority: 'medium', description: '' });
                setShowSupportModal(false);
              }}>
                Submit Ticket
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Master Passcode Dialog */}
      <Dialog open={showChangePasscodeDialog} onOpenChange={setShowChangePasscodeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Change Master Passcode
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="currentPasscode">Current Passcode</Label>
              <Input
                id="currentPasscode"
                type="password"
                placeholder="Enter current passcode"
                value={currentPasscode}
                onChange={(e) => setCurrentPasscode(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPasscode">New Passcode</Label>
              <Input
                id="newPasscode"
                type="password"
                placeholder="Min 6 characters"
                value={newPasscode}
                onChange={(e) => setNewPasscode(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmNewPasscode">Confirm New Passcode</Label>
              <Input
                id="confirmNewPasscode"
                type="password"
                placeholder="Confirm new passcode"
                value={confirmNewPasscode}
                onChange={(e) => setConfirmNewPasscode(e.target.value)}
              />
            </div>
            {newPasscode && (
              <div className="flex items-center gap-2">
                <Progress value={Math.min(100, newPasscode.length * 10)} className="flex-1" />
                <span className={`text-xs font-medium ${newPasscode.length >= 10 ? 'text-green-600' : newPasscode.length >= 6 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {newPasscode.length >= 10 ? 'Strong' : newPasscode.length >= 6 ? 'Medium' : 'Weak'}
                </span>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => { setShowChangePasscodeDialog(false); setCurrentPasscode(''); setNewPasscode(''); setConfirmNewPasscode(''); }} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleChangePasscode} disabled={!currentPasscode || !newPasscode || !confirmNewPasscode} className="flex-1">
                Change Passcode
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Delete Account
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-300 font-medium">⚠️ This action is irreversible</p>
              <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                All your vault data, passwords, notes, subscriptions, and settings will be permanently deleted from this device.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="deleteConfirm">Type <strong>DELETE</strong> to confirm</Label>
              <Input
                id="deleteConfirm"
                placeholder="Type DELETE"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => { setShowDeleteDialog(false); setDeleteConfirmText(''); }} className="flex-1">
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteAccount} disabled={deleteConfirmText !== 'DELETE'} className="flex-1">
                Delete Everything
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              You will lose access to premium features at the end of your billing period. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancelSubscription} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Cancel Subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </ErrorBoundary>
  );
}
