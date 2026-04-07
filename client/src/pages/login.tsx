import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Eye, EyeOff, Fingerprint, AlertTriangle, Upload, Info, Clock, Shield, Plus } from 'lucide-react';
import { AppLogo } from '@/components/app-logo';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { vaultStorage } from '@/lib/storage';
import { useLogging } from '@/contexts/logging-context';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CustomerInfoDialog } from '@/components/customer-info-dialog';
import { autoRegisterOnVaultCreation } from '@/lib/customer-registration';
import { checkBiometricCapabilities, unlockWithBiometric, isBiometricUnlockEnabled } from '@/native/biometrics';
import { isNativeApp } from '@/native/platform';
import { vaultManager, MAX_FAILED_ATTEMPTS, type LockoutState } from '@/lib/vault-manager';
import { ResetVaultDialog } from '@/components/reset-vault-dialog';
import { hasAccountCredentials, verifyAccountCredentials } from '@/lib/account-auth';

export default function Login() {
  const [, setLocation] = useLocation();
  const { login, loginWithKey, createVault, vaultExists } = useAuth();
  const { toast } = useToast();
  const { clearLogs } = useLogging();
  
  // Account login step (step 1 of 2-stage auth)
  const [accountStep, setAccountStep] = useState(() => hasAccountCredentials());
  const [accountEmailInput, setAccountEmailInput] = useState('');
  const [accountPasswordInput, setAccountPasswordInput] = useState('');
  const [showAccountPassword, setShowAccountPassword] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [accountLoading, setAccountLoading] = useState(false);

  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isCreatingVault, setIsCreatingVault] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showImportSection, setShowImportSection] = useState(false);
  const [showCustomerInfoDialog, setShowCustomerInfoDialog] = useState(false);
  const [showNewVaultDialog, setShowNewVaultDialog] = useState(false);
  const [pendingVaultPassword, setPendingVaultPassword] = useState('');
  const [newVaultName, setNewVaultName] = useState('');
  const [vaultCount, setVaultCount] = useState({ current: 0, max: 1 });
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [showBackupCodeEntry, setShowBackupCodeEntry] = useState(false);
  const [backupCode, setBackupCode] = useState('');

  // Lockout state
  const [lockoutState, setLockoutState] = useState<LockoutState>({ isLocked: false, remainingMs: 0, failedAttempts: 0 });
  const [lockoutDisplay, setLockoutDisplay] = useState('');

  // Check lockout state on mount and periodically
  const updateLockoutState = useCallback(async () => {
    try {
      const state = await vaultManager.getLockoutState();
      setLockoutState(state);
      
      if (state.isLocked && state.remainingMs > 0) {
        const minutes = Math.floor(state.remainingMs / 60000);
        const seconds = Math.floor((state.remainingMs % 60000) / 1000);
        setLockoutDisplay(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      } else {
        setLockoutDisplay('');
      }
    } catch (error) {
      console.error('Error checking lockout state:', error);
      // Default to not locked if there's an error
      setLockoutState({ isLocked: false, remainingMs: 0, failedAttempts: 0 });
    }
  }, []);

  useEffect(() => {
    updateLockoutState();
    
    // Update vault count
    setVaultCount(vaultManager.getVaultCount());
    
    // Check biometric availability
    const checkBiometric = async () => {
      console.log('Login: Checking biometric...', { isNative: isNativeApp(), vaultExists });
      if (isNativeApp() && vaultExists) {
        try {
          const capabilities = await checkBiometricCapabilities();
          console.log('Login: Biometric capabilities:', capabilities);
          setBiometricAvailable(capabilities.isAvailable);
          
          // Get the default vault ID from vault manager
          const defaultVault = vaultManager.getDefaultVault();
          const vaultId = defaultVault?.id || 'default';
          console.log('Login: Default vault ID:', vaultId);
          
          const enabled = await isBiometricUnlockEnabled(vaultId);
          console.log('Login: Biometric enabled for vault:', enabled);
          setBiometricEnabled(enabled);
        } catch (error) {
          console.error('Login: Error checking biometric:', error);
          // On iOS, assume biometric is available even if check fails
          setBiometricAvailable(true);
        }
      }
    };
    checkBiometric();
    
    // Update every second if locked out
    const interval = setInterval(() => {
      updateLockoutState();
    }, 1000);
    
    return () => clearInterval(interval);
  }, [updateLockoutState, vaultExists]);

  const handleAccountLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountError('');
    if (!accountEmailInput || !accountEmailInput.includes('@')) {
      setAccountError('Please enter a valid email address.');
      return;
    }
    if (!accountPasswordInput) {
      setAccountError('Please enter your account password.');
      return;
    }
    setAccountLoading(true);
    try {
      const valid = await verifyAccountCredentials(accountEmailInput, accountPasswordInput);
      if (valid) {
        setAccountStep(false);
      } else {
        setAccountError('Incorrect email or password. Please try again.');
      }
    } finally {
      setAccountLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!masterPassword) {
      toast({
        title: "Error",
        description: "Please enter your master password",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      console.log('🔐 Attempting login - trying password against all vaults...');
      
      // Try password against ALL vaults
      const result = await vaultManager.tryUnlockAnyVault(masterPassword);
      
      if (result.success && result.vaultId) {
        console.log(`✅ Password matched vault: ${result.vaultName} (${result.vaultId})`);
        
        // Set active vault
        vaultManager.setActiveVaultId(result.vaultId);
        
        // IMPORTANT: Switch vaultStorage to the correct vault database before unlocking
        await vaultStorage.switchToVault(result.vaultId);
        console.log(`📂 Switched to vault database: ${vaultStorage.getDatabaseName()}`);
        
        // Now do the actual vault unlock with the auth context
        const success = await login(masterPassword);
        
        if (success) {
          // Reset failed attempts on success
          await vaultManager.resetFailedAttempts();
          await updateLockoutState();
          
          toast({
            title: "Vault Unlocked",
            description: `Welcome back! Opened "${result.vaultName}"`,
          });
          
          // Navigate to dashboard after successful unlock
          setLocation('/');
        } else {
          // This shouldn't happen if tryUnlockAnyVault succeeded
          console.error('❌ Vault unlock failed after password match');
          toast({
            title: "Error",
            description: "Failed to unlock vault. Please try again.",
            variant: "destructive",
          });
        }
      } else {
        // No vault matched
        toast({
          title: "Authentication Failed",
          description: "Incorrect password. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('🔐 Login error:', error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      
      toast({
        title: "Login Error",
        description: `Failed to unlock vault: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateVault = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!masterPassword) {
      toast({
        title: "Error",
        description: "Please enter a master password",
        variant: "destructive",
      });
      return;
    }

    if (masterPassword.length < 8) {
      toast({
        title: "Error",
        description: "Master password must be at least 8 characters long",
        variant: "destructive",
      });
      return;
    }

    if (masterPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    // Check if this password already exists for another vault
    const existingVault = await vaultManager.checkPasswordExists(masterPassword);
    if (existingVault.exists && existingVault.vaultId) {
      // Password already exists - open that vault instead
      toast({
        title: "Vault Already Exists",
        description: `A vault "${existingVault.vaultName}" already uses this password. Opening it now...`,
      });
      
      vaultManager.setActiveVaultId(existingVault.vaultId);
      const success = await login(masterPassword);
      if (success) {
        await vaultManager.resetFailedAttempts();
      }
      return;
    }

    // Check vault limit (always allow the first vault)
    const count = vaultManager.getVaultCount();
    if (count.current > 0 && count.current >= count.max) {
      toast({
        title: "Vault Limit Reached",
        description: `You can only have ${count.max} vault(s). Upgrade to Premium for up to 5 vaults.`,
        variant: "destructive",
      });
      return;
    }

    setPendingVaultPassword(masterPassword);
    
    // Check if this is the first vault (need full customer info) or subsequent vault (only name + password)
    if (vaultManager.isFirstVault()) {
      setShowCustomerInfoDialog(true);
    } else {
      // Show simple new vault dialog for subsequent vaults
      setNewVaultName('');
      setShowNewVaultDialog(true);
    }
  };

  const handleCustomerInfoSubmit = async (email: string, name: string, country: string, phone?: string, marketingConsent?: boolean, selectedPlan?: string, vaultName?: string) => {
    setShowCustomerInfoDialog(false);
    await createVaultWithCustomerInfo(pendingVaultPassword, email, name, country, phone, marketingConsent, selectedPlan, vaultName);
  };

  // Handler for subsequent vault creation (only name + password)
  const handleNewVaultSubmit = async () => {
    if (!newVaultName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a vault name",
        variant: "destructive",
      });
      return;
    }

    setShowNewVaultDialog(false);
    await createSubsequentVault(pendingVaultPassword, newVaultName.trim());
  };

  // Create subsequent vault (only name + password, uses existing customer info)
  const createSubsequentVault = async (password: string, vaultName: string) => {
    setIsLoading(true);
    try {
      // Create new vault entry in registry
      const newVault = await vaultManager.createVault(vaultName, false);
      
      // Create password verification for this vault
      await vaultManager.createVaultPassword(newVault.id, password);
      
      // Set as active vault
      vaultManager.setActiveVaultId(newVault.id);
      
      // IMPORTANT: Switch vaultStorage to the new vault's database BEFORE creating
      await vaultStorage.switchToVault(newVault.id);
      
      // Create the actual vault storage
      await createVault(password);
      
      // Update vault count
      setVaultCount(vaultManager.getVaultCount());
      
      toast({
        title: "Vault Created!",
        description: `"${vaultName}" is ready to use (${vaultManager.getVaultCount().current}/${vaultManager.getVaultCount().max} vaults)`,
      });
      
      // Navigate to dashboard after vault creation
      setLocation('/');
      
      setMasterPassword('');
      setConfirmPassword('');
      setIsCreatingVault(false);
    } catch (error) {
      console.error('Error creating vault:', error);
      toast({
        title: "Error",
        description: "Failed to create vault. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setPendingVaultPassword('');
      setNewVaultName('');
    }
  };


  const createVaultWithCustomerInfo = async (password: string, email: string, name: string, country: string, phone?: string, marketingConsent?: boolean, selectedPlan?: string, vaultName?: string) => {
    setIsLoading(true);
    try {
      const finalVaultName = vaultName || 'My Vault';
      console.log('📦 Creating first vault:', finalVaultName);
      
      // Create vault entry in registry first
      const newVault = await vaultManager.createVault(finalVaultName, true); // First vault is default
      
      // Create password verification for this vault
      await vaultManager.createVaultPassword(newVault.id, password);
      
      // Set as active vault
      vaultManager.setActiveVaultId(newVault.id);
      
      // IMPORTANT: Switch vaultStorage to the new vault's database BEFORE creating
      await vaultStorage.switchToVault(newVault.id);
      
      // Create the actual vault storage
      await createVault(password);
      console.log('✅ Vault created successfully');
      
      // Determine plan details
      const planInfo = {
        plan: selectedPlan || 'free',
        trialActive: selectedPlan && ['pro_monthly', 'pro_yearly'].includes(selectedPlan),
        trialDays: selectedPlan && ['pro_monthly', 'pro_yearly'].includes(selectedPlan) ? 7 : 0,
      };
      
      // Save customer profile to localStorage for profile page
      if (email) {
        const customerProfile = {
          email: email,
          name: name || email.split('@')[0],
          country: country || 'US',
          phone: phone || '',
          registeredAt: new Date().toISOString(),
          subscription: selectedPlan || 'free',
          trialActive: planInfo.trialActive,
          trialEndsAt: planInfo.trialActive ? new Date(Date.now() + planInfo.trialDays * 24 * 60 * 60 * 1000).toISOString() : undefined,
          marketingConsent: marketingConsent || false,
        };
        localStorage.setItem('customerProfile', JSON.stringify(customerProfile));
        console.log('💾 Customer profile saved to localStorage');
      }
      
      // Update vault count
      setVaultCount(vaultManager.getVaultCount());
      
      // Register customer with CRM (non-blocking)
      if (email) {
        autoRegisterOnVaultCreation(email, name, country, phone, marketingConsent, selectedPlan);
      }
      
      toast({
        title: "Vault Created Successfully!",
        description: isNativeApp()
          ? "💡 Reminder: Use Import/Export to backup your vault data."
          : "💡 Reminder: Use Import/Export to backup your vault and access it in other browsers.",
      });
      
      // Set a flag to show export reminder on first dashboard load
      localStorage.setItem('showExportReminder', 'true');
      
      // Navigate to dashboard after first vault creation
      setLocation('/');
    } catch (error) {
      console.error('❌ Vault creation error:', error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      
      toast({
        title: "Error",
        description: `Failed to create vault: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setPendingVaultPassword('');
    }
  };

  const handleBiometricAuth = async () => {
    setIsLoading(true);
    try {
      // Check if biometric is available
      const capabilities = await checkBiometricCapabilities();
      
      if (!capabilities.isAvailable) {
        toast({
          title: "Not Available",
          description: "Biometric authentication is not available on this device",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Get the default vault ID from vault manager
      const defaultVault = vaultManager.getDefaultVault();
      const vaultId = defaultVault?.id || 'default';

      // Check if biometric unlock is enabled
      const isEnabled = await isBiometricUnlockEnabled(vaultId);
      
      if (!isEnabled) {
        toast({
          title: "Not Enabled",
          description: "Please enable biometric unlock in Settings first. Go to Profile > Security Settings.",
        });
        setIsLoading(false);
        return;
      }

      // Attempt biometric unlock
      const result = await unlockWithBiometric(vaultId);
      
      if (result.success && result.deviceKey) {
        // Use pre-derived key directly (bypasses KDF re-derivation)
        const success = await loginWithKey(result.deviceKey);
        
        if (success) {
          // Reset failed attempts on successful biometric login
          await vaultManager.resetFailedAttempts();
          toast({
            title: "Success",
            description: `Unlocked ${defaultVault?.name || 'vault'} with ${capabilities.biometryType === 'faceId' ? 'Face ID' : 'Touch ID'}`,
          });
          setLocation('/dashboard');
        } else {
          toast({
            title: "Error",
            description: "Failed to unlock vault. Please use your master password.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Authentication Failed",
          description: result.error || "Biometric authentication failed",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Biometric auth error:', error);
      toast({
        title: "Error",
        description: "Biometric authentication failed. Please use your master password.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackupCodeLogin = async () => {
    const normalised = backupCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (normalised.length !== 8) {
      toast({ title: "Invalid Code", description: "Enter a valid 8-character backup code", variant: "destructive" });
      return;
    }
    // Hash the entered code and compare against stored hashes
    const encoded = new TextEncoder().encode(normalised);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    const enteredHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    const storedHashes: string[] = JSON.parse(localStorage.getItem('ironvault_2fa_backup_codes_hash') || '[]');
    const usedHashes: string[] = JSON.parse(localStorage.getItem('ironvault_2fa_backup_codes_used') || '[]');

    const matchIndex = storedHashes.findIndex(h => h === enteredHash);
    if (matchIndex === -1 || usedHashes.includes(enteredHash)) {
      toast({ title: "Invalid Code", description: "Code not recognised or already used", variant: "destructive" });
      return;
    }

    // Mark code as used
    usedHashes.push(enteredHash);
    localStorage.setItem('ironvault_2fa_backup_codes_used', JSON.stringify(usedHashes));

    // Proceed with the stored master password unlock
    if (!masterPassword) {
      toast({ title: "Enter Password", description: "Enter your master password first, then use the backup code", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const result = await vaultManager.tryUnlockAnyVault(masterPassword);
      if (result.success && result.vaultId) {
        vaultManager.setActiveVaultId(result.vaultId);
        await vaultStorage.switchToVault(result.vaultId);
        const success = await login(masterPassword);
        if (success) {
          await vaultManager.resetFailedAttempts();
          toast({ title: "Vault Unlocked", description: "Backup code accepted (one-time use)" });
          setLocation('/');
        }
      } else {
        toast({ title: "Wrong Password", description: "Master password is incorrect", variant: "destructive" });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetComplete = () => {
    // Clear activity logs when resetting vault
    clearLogs();
    
    toast({
      title: "Vault Reset",
      description: "Vault has been reset. You can now create a new vault.",
      variant: "destructive",
    });
    
    // Force a complete page refresh with cache bust to ensure fresh state
    setTimeout(() => {
      // Use href assignment instead of reload to ensure a fresh start
      window.location.href = window.location.pathname + '?reset=' + Date.now();
    }, 500);
  };

  const handleImportVault = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!masterPassword) {
      toast({
        title: "Master Password Required",
        description: "Please enter your master password before importing the vault.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const content = await file.text();
      
      // Initialize database if not already initialized
      if (!vaultStorage.isInitialized()) {
        await vaultStorage.init();
      }
      
      // Import the vault data
      await vaultStorage.importVault(content, masterPassword);
      
      toast({
        title: "Success",
        description: "Vault imported successfully! You can now login with your master password.",
      });
      
      setShowImportSection(false);
      setMasterPassword('');
      
      // Refresh the page to detect the imported vault
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to import vault. Please check the file and master password.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      // Reset the file input
      event.target.value = '';
    }
  };

  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-start gradient-mesh px-4 py-8 pb-12" data-testid="login-page">
      {/* Customer Info Dialog (First Vault) */}
      <CustomerInfoDialog
        open={showCustomerInfoDialog}
        onSubmit={handleCustomerInfoSubmit}
        isFirstVault={true}
      />

      {/* New Vault Dialog (Subsequent Vaults - Only Name + Password) */}
      <Dialog open={showNewVaultDialog} onOpenChange={setShowNewVaultDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
              <Plus className="w-6 h-6 text-white" />
            </div>
            <DialogTitle className="text-center text-xl">Create New Vault</DialogTitle>
            <DialogDescription className="text-center">
              Add another secure vault to organize your data
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="new-vault-name" className="text-sm font-medium">
                Vault Name <span className="text-red-500">*</span>
              </Label>
              <div className="relative mt-2">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="new-vault-name"
                  type="text"
                  placeholder="e.g., Work, Personal, Family"
                  value={newVaultName}
                  onChange={(e) => setNewVaultName(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> Your customer information will be shared across all vaults. 
                Each vault has its own master password for security.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewVaultDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleNewVaultSubmit} disabled={isLoading || !newVaultName.trim()}>
              {isLoading ? 'Creating...' : 'Create Vault'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <div className="max-w-md w-full animate-fade-in-up">

        {/* ── Step 1: Account Login ─────────────────────────────────────── */}
        {accountStep && (
          <>
            <div className="text-center mb-8">
              <div className="inline-block mb-4">
                <AppLogo size={64} variant="hero" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground mb-1">Welcome back</h1>
              <p className="text-sm text-muted-foreground font-medium">Step 1 of 2 — Sign in to your account</p>
            </div>

            <Card className="shadow-xl border-border/50 backdrop-blur-sm bg-card/90">
              <CardContent className="pt-6">
                <form onSubmit={handleAccountLogin} className="space-y-4">
                  <div>
                    <Label htmlFor="account-email" className="block text-sm font-medium text-foreground mb-2">
                      Email
                    </Label>
                    <Input
                      type="email"
                      id="account-email"
                      data-testid="input-account-email"
                      placeholder="you@example.com"
                      value={accountEmailInput}
                      onChange={e => setAccountEmailInput(e.target.value)}
                      disabled={accountLoading}
                      autoComplete="email"
                      autoFocus
                    />
                  </div>
                  <div>
                    <Label htmlFor="account-password" className="block text-sm font-medium text-foreground mb-2">
                      Account Password
                    </Label>
                    <div className="relative">
                      <Input
                        type={showAccountPassword ? 'text' : 'password'}
                        id="account-password"
                        data-testid="input-account-password"
                        className="pr-10"
                        placeholder="Your account password"
                        value={accountPasswordInput}
                        onChange={e => setAccountPasswordInput(e.target.value)}
                        disabled={accountLoading}
                        autoComplete="current-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowAccountPassword(!showAccountPassword)}
                      >
                        {showAccountPassword ? <EyeOff className="h-5 w-5 text-muted-foreground" /> : <Eye className="h-5 w-5 text-muted-foreground" />}
                      </Button>
                    </div>
                  </div>

                  {accountError && (
                    <p className="text-sm text-destructive">{accountError}</p>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={accountLoading}
                    data-testid="button-account-login"
                  >
                    {accountLoading ? 'Verifying…' : 'Continue'}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    Don't have an account?{' '}
                    <a href="/auth/signup" className="text-primary font-medium hover:underline">
                      Sign up free
                    </a>
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* ── Step 2 / direct vault unlock (shown when accountStep = false) ─ */}
        {!accountStep && (
        <>

        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-block mb-4">
            <AppLogo size={64} variant="hero" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">IronVault</h1>
          </div>
          <p className="text-sm text-muted-foreground font-medium">Secure offline password manager</p>
          
          {/* Vault Counter */}
          {vaultCount.current > 0 && (
            <div className="mt-3">
              <Badge variant="outline" className="text-xs shadow-xs">
                <Shield className="w-3 h-3 mr-1" />
                {vaultCount.current}/{vaultCount.max} Vaults
              </Badge>
            </div>
          )}
        </div>

        {/* Browser Storage Info Alert - Only show on web, not mobile app */}
        {!isCreatingVault && !isNativeApp() && (
          <Alert className="mb-4 border-primary/30 bg-primary/5">
            <Info className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm text-foreground">
              <strong>Browser-Specific Storage:</strong> Each browser has its own separate vault storage. 
              {!vaultExists && (
                <> To use data from another browser, click "Import Vault" below.</>
              )}
              {vaultExists && (
                <> To access data from another browser, first export from that browser, then import here using the button below.</>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Login/Create Vault Form */}
        <Card className="shadow-xl border-border/50 backdrop-blur-sm bg-card/90">
          <CardContent className="pt-6">
            <form onSubmit={isCreatingVault ? handleCreateVault : handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="masterPassword" className="block text-sm font-medium text-foreground mb-2">
                  {isCreatingVault ? 'Create Master Password' : 'Master Password'}
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    id="masterPassword"
                    className="pr-10"
                    placeholder={isCreatingVault ? 'Create a strong master password' : 'Enter your master password'}
                    value={masterPassword}
                    onChange={(e) => setMasterPassword(e.target.value)}
                    disabled={isLoading}
                    data-testid={isCreatingVault ? "input-create-password" : "input-unlock-password"}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    data-testid={isCreatingVault ? "toggle-create-password-visibility" : "toggle-password-visibility"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Eye className="h-5 w-5 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              {isCreatingVault && (
                <div>
                  <Label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-2">
                    Confirm Master Password
                  </Label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? 'text' : 'password'}
                      id="confirmPassword"
                      className="pr-10"
                      placeholder="Confirm your master password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      data-testid="input-confirm-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      data-testid="toggle-confirm-password"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <Eye className="h-5 w-5 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {!isCreatingVault && vaultExists && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="remember"
                      checked={rememberMe}
                      onCheckedChange={setRememberMe}
                      data-testid="switch-remember-me"
                    />
                    <Label htmlFor="remember" className="text-sm text-muted-foreground">
                      Remember me
                    </Label>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
                data-testid={isCreatingVault ? "button-create-vault" : "button-unlock-vault"}
              >
                {isLoading ? 'Processing...' : (isCreatingVault ? 'Create Vault' : 'Unlock Vault')}
              </Button>
            </form>

            {!isCreatingVault && vaultExists && localStorage.getItem('ironvault_2fa_enabled') === 'true' && (
              <div className="mt-4 pt-4 border-t border-border">
                {!showBackupCodeEntry ? (
                  <div className="text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowBackupCodeEntry(true)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      Use backup code instead
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="backup-code" className="text-sm">Backup Code</Label>
                    <Input
                      id="backup-code"
                      placeholder="XXXX-XXXX"
                      value={backupCode}
                      onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
                      className="font-mono tracking-widest text-center"
                      maxLength={9}
                    />
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowBackupCodeEntry(false)}>
                        Cancel
                      </Button>
                      <Button size="sm" className="flex-1" onClick={handleBackupCodeLogin} disabled={isLoading}>
                        Verify
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!isCreatingVault && (
              <>
                {/* Reset Vault Option - Show when vault exists OR when there's lockout state to clear */}
                {(vaultExists || vaultCount.current > 0) && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-2">
                        Forgot your Master Password?
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowResetDialog(true)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        data-testid="button-reset-vault"
                      >
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Reset Vault
                      </Button>
                      <p className="text-xs text-muted-foreground mt-1">
                        Start fresh with a new Master Password
                      </p>
                    </div>
                  </div>
                )}

                {/* Biometric Option - show on native apps when vault exists */}
                {vaultExists && isNativeApp() && (
                  <div className="mt-4 pt-4 border-t border-border">
                    {biometricEnabled ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full flex items-center justify-center gap-2 py-3 border-primary/30 hover:bg-primary/5 hover:border-primary/50 transition-all duration-200"
                        onClick={handleBiometricAuth}
                        data-testid="button-biometric-auth"
                      >
                        <Fingerprint className="w-5 h-5 text-primary" />
                        <span className="font-medium">Unlock with Face ID</span>
                      </Button>
                    ) : (
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">
                          <Fingerprint className="w-4 h-4 inline mr-1" />
                          Biometric unlock not enabled
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Login and go to Profile → Security Settings to enable
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Import Vault Section */}
                <div className="mt-4 pt-4 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full flex items-center justify-center gap-2"
                    onClick={() => setShowImportSection(!showImportSection)}
                    data-testid="button-import-vault"
                  >
                    <Upload className="w-5 h-5" />
                    <span className="font-medium">
                      Import Vault
                    </span>
                  </Button>

                  {showImportSection && (
                    <div className="mt-4 p-4 bg-muted/30 rounded-lg border border-border">
                      <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                        <Upload className="w-4 h-4 text-primary" />
                        Import Your Vault
                      </h3>
                      <Alert className="mb-3 border-destructive/30 bg-destructive/5">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        <AlertDescription className="text-xs text-foreground">
                          <strong>{isNativeApp() ? 'How to restore your vault:' : 'How to transfer data between browsers:'}</strong>
                          <ol className="list-decimal ml-4 mt-1 space-y-1">
                            {isNativeApp() ? (
                              <>
                                <li>Make sure you have an exported <strong>.json vault backup</strong></li>
                                <li>Enter your <strong>master password</strong> below</li>
                                <li>Select the backup file to restore</li>
                              </>
                            ) : (
                              <>
                                <li>Open IronVault in your <strong>original browser</strong></li>
                                <li>Go to Dashboard → Click <strong>Import/Export</strong> button (top right)</li>
                                <li>Export your vault as <strong>.json file</strong> with encryption</li>
                                <li>Come back here and import that file below</li>
                              </>
                            )}
                          </ol>
                        </AlertDescription>
                      </Alert>
                      <div className="space-y-3">
                        <div>
                          <Label htmlFor="masterPasswordImport" className="text-xs text-foreground font-medium">
                            Master Password (for decryption)
                          </Label>
                          <Input
                            type="password"
                            id="masterPasswordImport"
                            placeholder="Enter your master password"
                            value={masterPassword}
                            onChange={(e) => setMasterPassword(e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="vaultFile" className="text-xs text-foreground font-medium mb-2 block">
                            Vault File (.json)
                          </Label>
                          <Label htmlFor="vaultFile" className="cursor-pointer">
                            <div className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-xl hover:border-primary hover:bg-primary/5 transition-all duration-200">
                              <Upload className="w-5 h-5 text-muted-foreground" />
                              <span className="text-sm font-medium text-foreground">Click to Choose File</span>
                            </div>
                          </Label>
                          <Input
                            id="vaultFile"
                            type="file"
                            accept=".json,.csv"
                            onChange={handleImportVault}
                            className="hidden"
                            disabled={isLoading || !masterPassword}
                          />
                          <p className="text-xs text-muted-foreground mt-2">
                            Supported formats: .json (encrypted or plain), .csv
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Switch to Create Vault - always show */}
                <div className="text-center mt-6">
                  <p className="text-sm text-muted-foreground">
                    {vaultExists ? 'Need to create a new vault?' : 'Want to create a new vault instead?'}{' '}
                    <Button
                      type="button"
                      variant="link"
                      className="text-primary hover:underline p-0"
                      onClick={() => setIsCreatingVault(true)}
                      data-testid="button-create-new-vault"
                    >
                      Create New Vault
                    </Button>
                  </p>
                </div>
              </>
            )}

            {isCreatingVault && (
              <>
                <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/30">
                  <p className="text-sm text-foreground mb-2">
                    <strong>Important:</strong> Your master password cannot be recovered. 
                    Make sure to choose a strong password that you can remember.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    💡 <strong>Backup:</strong> After creating your vault, use "Import/Export" 
                    to save a backup file.{!isNativeApp() && ' You can import this file in other browsers to access your data.'}
                  </p>
                </div>
                
                <div className="text-center mt-6">
                  <p className="text-sm text-muted-foreground">
                    Already have a vault?{' '}
                    <Button
                      type="button"
                      variant="link"
                      className="text-primary hover:underline p-0"
                      onClick={() => setIsCreatingVault(false)}
                      data-testid="button-back-to-login"
                    >
                      Back to Login
                    </Button>
                  </p>
                </div>
              </>
            )}

            {/* Reset Vault Dialog */}
            <ResetVaultDialog
              open={showResetDialog}
              onOpenChange={setShowResetDialog}
              onResetComplete={handleResetComplete}
            />
          </CardContent>
        </Card>

        </> // close {!accountStep && (
        )}

      </div>
    </div>
  );
}
