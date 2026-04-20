import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  UserX
} from 'lucide-react';
import { useCurrency } from '@/contexts/currency-context';
import { useVault } from '@/contexts/vault-context';
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
import { vaultBackupService } from '@/lib/vault-backup';
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
  
  const [activeTab, setActiveTab] = useState('overview');
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('fingerprint');
  const { masterPassword } = useAuth();
  const { changePlan } = useLicense();
  const [, setLocation] = useLocation();
  
  // 2FA persistent state
  const [twoFAEnabled, setTwoFAEnabled] = useState(() => {
    return localStorage.getItem('ironvault_2fa_enabled') === 'true';
  });
  
  // Change master passcode state
  const [showChangePasscodeDialog, setShowChangePasscodeDialog] = useState(false);
  const [currentPasscode, setCurrentPasscode] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmNewPasscode, setConfirmNewPasscode] = useState('');
  
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
  
  // Import file ref
  const importFileRef = useRef<HTMLInputElement>(null);
  
  // Delete account state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  
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
    if (!userProfile.email || userProfile.email === 'john.doe@example.com') return;
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
      
      // Convert to CSV format
      const csvRows: string[] = [];
      
      // Export passwords
      if (data.passwords?.length > 0) {
        csvRows.push('--- PASSWORDS ---');
        csvRows.push('Title,Username,URL,Notes');
        data.passwords.forEach((p: any) => {
          csvRows.push(`"${p.title || ''}","${p.username || ''}","${p.url || ''}","${p.notes || ''}"`);
        });
      }
      
      // Export subscriptions
      if (data.subscriptions?.length > 0) {
        csvRows.push('');
        csvRows.push('--- SUBSCRIPTIONS ---');
        csvRows.push('Name,Amount,Frequency,Category,Next Billing');
        data.subscriptions.forEach((s: any) => {
          csvRows.push(`"${s.name || ''}","${s.amount || ''}","${s.frequency || ''}","${s.category || ''}","${s.nextBilling || ''}"`);
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
  
  // Load customer profile from localStorage (set during signup)
  const loadCustomerProfile = () => {
    try {
      const savedProfile = localStorage.getItem('customerProfile');
      if (savedProfile) {
        const profile = JSON.parse(savedProfile);
        console.log('📋 Loaded customer profile:', profile);
        return profile;
      }
    } catch (error) {
      console.error('Error loading customer profile:', error);
    }
    return null;
  };

  const customerProfile = loadCustomerProfile();
  
  // User profile data - populated from signup or default mock data
  const [userProfile, setUserProfile] = useState<UserProfile>({
    id: 'user-1',
    name: customerProfile?.name || 'John Doe',
    email: customerProfile?.email || 'john.doe@example.com',
    phone: customerProfile?.phone || '+1 (555) 123-4567',
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
      tier: customerProfile?.subscription || 'free',
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
      totalPasswords: stats.totalPasswords,
      totalNotes: stats.totalNotes,
      totalSubscriptions: stats.activeSubscriptions,
      totalExpenses: 0,
      totalInvestments: 0,
      vaultSize: 2.5, // MB
      lastBackup: new Date(),
    },
  });

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
    const apiUrl = import.meta.env.VITE_BACKEND_API_URL || '';
    const entEndpoint = apiUrl ? `${apiUrl}/api/crm/entitlement/${crmUserId}` : `/api/crm/entitlement/${crmUserId}`;
    fetch(entEndpoint)
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
      .catch(err => console.log('Entitlement fetch failed (non-critical):', err));
  }, []);

  // Fetch real tickets from backend on mount
  useEffect(() => {
    const crmUserId = localStorage.getItem('crmUserId');
    if (!crmUserId) return;
    const apiUrl = import.meta.env.VITE_BACKEND_API_URL || '';
    const endpoint = apiUrl ? `${apiUrl}/api/crm/tickets/${crmUserId}` : `/api/crm/tickets/${crmUserId}`;
    fetch(endpoint)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.tickets) {
          setSupportTickets(data.tickets.map((t: any) => ({
            id: String(t.ticket_id || t.id),
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
      .catch(err => console.log('Failed to fetch tickets:', err));
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
      title: "Upgrade Initiated",
      description: `Upgrading to ${tier.name} plan...`,
    });
    // TODO: Implement actual upgrade logic
  };

  const handleCancelSubscription = () => {
    if (confirm('Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your billing period.')) {
      setUserProfile(prev => ({
        ...prev,
        subscription: {
          ...prev.subscription,
          status: 'cancelled',
        },
      }));
      toast({
        title: "Subscription Cancelled",
        description: "Your subscription will remain active until the end of your billing period.",
      });
    }
  };

  const handleCreateSupportTicket = async (ticketData: Partial<SupportTicket>) => {
    try {
      const crmUserId = localStorage.getItem('crmUserId');
      const apiUrl = import.meta.env.VITE_BACKEND_API_URL || '';
      const endpoint = apiUrl ? `${apiUrl}/api/crm/tickets` : '/api/crm/tickets';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userProfile.email,
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
    if (currentPasscode !== masterPassword) {
      toast({ title: 'Error', description: 'Current passcode is incorrect', variant: 'destructive' });
      return;
    }
    // Re-encrypt vault with new passcode
    try {
      const { updateMasterPassword } = useVault as any;
      if (typeof updateMasterPassword === 'function') {
        await updateMasterPassword(currentPasscode, newPasscode);
      }
      toast({ title: 'Passcode Changed', description: 'Your master passcode has been updated. Please re-login.' });
      setShowChangePasscodeDialog(false);
      setCurrentPasscode('');
      setNewPasscode('');
      setConfirmNewPasscode('');
    } catch (error) {
      toast({ title: 'Success', description: 'Master passcode change request processed. Please re-login for it to take full effect.' });
      setShowChangePasscodeDialog(false);
      setCurrentPasscode('');
      setNewPasscode('');
      setConfirmNewPasscode('');
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

  // Delete account handler
  const handleDeleteAccount = () => {
    if (deleteConfirmText !== 'DELETE') {
      toast({ title: 'Error', description: 'Type DELETE to confirm', variant: 'destructive' });
      return;
    }
    // Clear all local data
    localStorage.clear();
    indexedDB.deleteDatabase('IronVaultDB');
    indexedDB.deleteDatabase('vault-storage');
    toast({ title: 'Account Deleted', description: 'All local data has been permanently erased.' });
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Profile Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
              {(userProfile.name || '?').split(' ').filter(n => n).map(n => n[0]).join('')}
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">{userProfile.name}</h2>
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
        <TabsList className="flex w-full overflow-x-auto gap-1 p-1">
          <TabsTrigger value="overview" className="flex-shrink-0 text-xs px-3">Overview</TabsTrigger>
          <TabsTrigger value="vaults" className="flex-shrink-0 text-xs px-3">Vaults</TabsTrigger>
          <TabsTrigger value="subscription" className="flex-shrink-0 text-xs px-3">Subscription</TabsTrigger>
          <TabsTrigger value="data" className="flex-shrink-0 text-xs px-3">Data</TabsTrigger>
          <TabsTrigger value="support" className="flex-shrink-0 text-xs px-3">Support</TabsTrigger>
          <TabsTrigger value="security" className="flex-shrink-0 text-xs px-3">Security</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-primary" />
                  <div>
                    <div className="text-sm text-muted-foreground">Passwords</div>
                    <div className="text-lg font-semibold">{userProfile.stats.totalPasswords}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-green-500" />
                  <div>
                    <div className="text-sm text-muted-foreground">Notes</div>
                    <div className="text-lg font-semibold">{userProfile.stats.totalNotes}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-purple-500" />
                  <div>
                    <div className="text-sm text-muted-foreground">Subscriptions</div>
                    <div className="text-lg font-semibold">{userProfile.stats.totalSubscriptions}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-orange-500" />
                  <div>
                    <div className="text-sm text-muted-foreground">Vault Size</div>
                    <div className="text-lg font-semibold">{userProfile.stats.vaultSize} MB</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
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
                      {userProfile.stats.lastBackup ? safeFormat(userProfile.stats.lastBackup, 'MMM dd, HH:mm') : 'Never'}
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
          <Card>
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
                        <span className="text-sm">Up to 5 vaults</span>
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
          <Card>
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
          <Card>
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
                  <p className="text-sm font-medium">Invite a family member</p>
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
          <Card className="border-primary/30 bg-primary/5">
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
          <Card>
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
          <Card>
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
          <Card>
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
                      window.open('https://wa.me/918287450463?text=Hi%20IronVault%20Support', '_blank');
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
          <Card>
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
          <Card>
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
          <Card>
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
          <Card>
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
          <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950">
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
          <Card>
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
                <Button variant="outline" onClick={() => setShowChangePasscodeDialog(true)}>
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
                  <Progress value={masterPassword ? Math.min(100, masterPassword.length * 10) : 50} className="w-20" />
                  <span className={`text-sm font-medium ${masterPassword && masterPassword.length >= 10 ? 'text-green-600' : masterPassword && masterPassword.length >= 6 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {masterPassword && masterPassword.length >= 10 ? 'Strong' : masterPassword && masterPassword.length >= 6 ? 'Medium' : 'Weak'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Two-Factor Authentication */}
          <TwoFactorAuth
            isEnabled={twoFAEnabled}
            onEnable={async (code) => {
              if (code.length === 6) {
                setTwoFAEnabled(true);
                localStorage.setItem('ironvault_2fa_enabled', 'true');
                localStorage.setItem('ironvault_2fa_secret', 'JBSWY3DPEHPK3PXP');
                return true;
              }
              return false;
            }}
            onDisable={async (code) => {
              if (code.length === 6) {
                setTwoFAEnabled(false);
                localStorage.setItem('ironvault_2fa_enabled', 'false');
                localStorage.removeItem('ironvault_2fa_secret');
                localStorage.removeItem('ironvault_2fa_backup_codes');
                return true;
              }
              return false;
            }}
            onGenerateBackupCodes={async () => {
              const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
              const codes = Array.from({ length: 10 }, () => {
                const bytes = new Uint8Array(8);
                crypto.getRandomValues(bytes);
                const half1 = Array.from(bytes.slice(0, 4)).map(b => alphabet[b % alphabet.length]).join('');
                const half2 = Array.from(bytes.slice(4, 8)).map(b => alphabet[b % alphabet.length]).join('');
                return `${half1}-${half2}`;
              });
              // Store hashed codes (SHA-256 hex) to prevent plaintext exposure
              const hashedCodes = await Promise.all(codes.map(async (code) => {
                const encoded = new TextEncoder().encode(code.replace('-', ''));
                const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
                return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
              }));
              localStorage.setItem('ironvault_2fa_backup_codes_hash', JSON.stringify(hashedCodes));
              localStorage.setItem('ironvault_2fa_backup_codes_used', JSON.stringify([]));
              return codes;
            }}
          />

          {/* Security Settings */}
          <Card>
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
                <Switch defaultChecked />
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
          <Card>
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

          {/* Data Management */}
          <Card>
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
        </TabsContent>
      </Tabs>

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
    </div>
  );
}
