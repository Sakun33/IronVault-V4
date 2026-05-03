/**
 * Multi-Vault Login Page
 * 
 * Handles:
 * - Create first vault flow
 * - Unlock existing vault(s)
 * - Lockout state (3 attempts = 1 hour)
 * - Multiple vault matching (choose vault modal)
 * - Plan-locked vault messaging
 * - Biometric authentication for default vault
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Eye, 
  EyeOff, 
  Fingerprint, 
  AlertTriangle, 
  Upload, 
  Info,
  Shield,
  Clock,
  Crown,
  Plus
} from 'lucide-react';
import { AppLogo } from '@/components/app-logo';
import { useMultiVaultAuth, VaultInfo, MAX_FAILED_ATTEMPTS } from '@/contexts/multi-vault-auth-context';
import { useToast } from '@/hooks/use-toast';
import { CustomerInfoDialog } from '@/components/customer-info-dialog';
import { VaultChooserDialog } from '@/components/vault-chooser-dialog';
import { checkBiometricCapabilities, unlockWithBiometric, isBiometricUnlockEnabled, getVaultsWithBiometricEnabled } from '@/native/biometrics';
import { isNativeApp } from '@/native/platform';
import { autoRegisterOnVaultCreation } from '@/lib/customer-registration';
import { vaultBackupService } from '@/lib/vault-backup';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

export default function MultiVaultLogin() {
  const {
    isLoading: authLoading,
    vaults,
    vaultCount,
    maxVaults,
    canCreateVault,
    lockoutState,
    tryUnlock,
    unlockVault,
    unlockVaultWithKey,
    createVault,
    userTier,
  } = useMultiVaultAuth();
  
  const { toast } = useToast();
  
  // UI State
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [vaultName, setVaultName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isCreatingVault, setIsCreatingVault] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Customer info dialog
  const [showCustomerInfoDialog, setShowCustomerInfoDialog] = useState(false);
  const [pendingVaultData, setPendingVaultData] = useState<{ name: string; password: string } | null>(null);
  
  // Vault chooser dialog
  const [showVaultChooser, setShowVaultChooser] = useState(false);
  const [matchingVaults, setMatchingVaults] = useState<VaultInfo[]>([]);
  const [pendingPassword, setPendingPassword] = useState('');
  
  // Lockout countdown
  const [lockoutDisplay, setLockoutDisplay] = useState('');
  
  // Restore backup state
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [restorePassword, setRestorePassword] = useState('');
  const [backupFileContent, setBackupFileContent] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  
  // Biometric state
  const [biometricVaultId, setBiometricVaultId] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('');

  // No vaults = show create flow
  const hasVaults = vaultCount > 0;
  
  // Check for biometric availability and enabled vault on mount
  useEffect(() => {
    const checkBiometric = async () => {
      if (!isNativeApp()) return;
      
      try {
        const capabilities = await checkBiometricCapabilities();
        setBiometricAvailable(capabilities.isAvailable);
        setBiometricType(capabilities.biometryType === 'faceId' ? 'Face ID' : 'Touch ID');
        
        if (capabilities.isAvailable) {
          // Find which vault has biometric enabled
          const vaultsWithBiometric = await getVaultsWithBiometricEnabled();
          if (vaultsWithBiometric.length > 0) {
            setBiometricVaultId(vaultsWithBiometric[0]); // Only first one (should only be one)
          }
        }
      } catch (error) {
        console.error('Error checking biometric:', error);
      }
    };
    
    checkBiometric();
  }, [vaults]);

  // Update lockout display
  useEffect(() => {
    if (lockoutState.isLocked && lockoutState.remainingMs > 0) {
      const minutes = Math.floor(lockoutState.remainingMs / 60000);
      const seconds = Math.floor((lockoutState.remainingMs % 60000) / 1000);
      setLockoutDisplay(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    } else {
      setLockoutDisplay('');
    }
  }, [lockoutState]);

  // Auto-show create form if no vaults
  useEffect(() => {
    if (!authLoading && !hasVaults) {
      setIsCreatingVault(true);
    }
  }, [authLoading, hasVaults]);

  /**
   * Handle unlock attempt
   */
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!masterPassword) {
      setError('Please enter your master password');
      return;
    }
    
    if (lockoutState.isLocked) {
      setError(`Account locked. Try again in ${lockoutDisplay}`);
      return;
    }
    
    setIsLoading(true);
    try {
      const result = await tryUnlock(masterPassword);
      
      if (result.isLockedOut) {
        setError(`Too many failed attempts. Account locked for 1 hour.`);
        setMasterPassword('');
        return;
      }
      
      if (result.vaultLockedByPlan) {
        setError('This vault is locked. Upgrade to Premium to access.');
        toast({
          title: 'Vault Locked',
          description: 'This vault requires a Premium subscription to access.',
          variant: 'destructive',
        });
        return;
      }
      
      if (!result.success) {
        setError(result.error || 'Incorrect password');
        return;
      }
      
      // Check if multiple vaults match
      if (result.matchingVaults && result.matchingVaults.length > 1) {
        setMatchingVaults(result.matchingVaults);
        setPendingPassword(masterPassword);
        setShowVaultChooser(true);
        return;
      }
      
      // Single vault matched - already unlocked by tryUnlock
      toast({
        title: 'Vault Unlocked',
        description: `Welcome back!`,
      });
    } catch (err) {
      console.error('Unlock error:', err);
      setError('Incorrect master password');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle vault selection from chooser
   */
  const handleVaultSelect = async (vaultId: string) => {
    setShowVaultChooser(false);
    setIsLoading(true);

    try {
      const success = await unlockVault(vaultId, pendingPassword);
      if (success) {
        toast({
          title: 'Vault Unlocked',
          description: 'Welcome back!',
        });
      } else {
        setError('Incorrect master password');
      }
    } catch (err) {
      setError('Incorrect master password');
    } finally {
      setIsLoading(false);
      setPendingPassword('');
    }
  };

  /**
   * Handle create vault form submission
   */
  const handleCreateVault = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!vaultName.trim()) {
      setError('Vault name is required');
      return;
    }
    
    if (masterPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    
    if (masterPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    // If first vault, show customer info dialog
    if (!hasVaults) {
      setPendingVaultData({ name: vaultName.trim(), password: masterPassword });
      setShowCustomerInfoDialog(true);
      return;
    }
    
    // Not first vault, create directly
    await createVaultDirectly(vaultName.trim(), masterPassword);
  };

  /**
   * Create vault directly (no customer info needed)
   */
  const createVaultDirectly = async (name: string, password: string) => {
    setIsLoading(true);
    try {
      const vaultId = await createVault(name, password, !hasVaults);
      
      toast({
        title: 'Vault Created',
        description: `"${name}" has been created successfully.`,
      });
      
      // Clear form
      setVaultName('');
      setMasterPassword('');
      setConfirmPassword('');
      setIsCreatingVault(false);
    } catch (err) {
      console.error('Create vault error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create vault');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle customer info submission (first vault)
   */
  const handleCustomerInfoSubmit = async (
    email: string,
    name: string,
    country: string,
    phone?: string,
    marketingConsent?: boolean,
    selectedPlan?: string
  ) => {
    setShowCustomerInfoDialog(false);
    
    if (!pendingVaultData) return;
    
    setIsLoading(true);
    try {
      const vaultId = await createVault(pendingVaultData.name, pendingVaultData.password, true);
      
      // Save customer profile
      if (email) {
        const customerProfile = {
          email,
          name: name || email.split('@')[0],
          country: country || 'US',
          phone: phone || '',
          registeredAt: new Date().toISOString(),
          subscription: selectedPlan || 'free',
          marketingConsent: marketingConsent || false,
        };
        localStorage.setItem('customerProfile', JSON.stringify(customerProfile));
        
        // Register with CRM
        autoRegisterOnVaultCreation(email, name, country, phone, marketingConsent, selectedPlan);
      }
      
      toast({
        title: 'Vault Created',
        description: 'Your vault is ready to use!',
      });
      
      // Clear form
      setVaultName('');
      setMasterPassword('');
      setConfirmPassword('');
      setPendingVaultData(null);
    } catch (err) {
      console.error('Create vault error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create vault');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle biometric authentication
   */
  const handleBiometricAuth = async () => {
    if (!biometricVaultId) {
      toast({
        title: 'Not Enabled',
        description: 'Enable biometric unlock in vault settings first.',
      });
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      // Unlock with biometric for the specific vault that has it enabled
      const result = await unlockWithBiometric(biometricVaultId);
      
      if (result.success && result.deviceKey) {
        // Use pre-derived key directly (bypasses KDF re-derivation)
        const unlockSuccess = await unlockVaultWithKey(biometricVaultId, result.deviceKey);
        
        if (unlockSuccess) {
          const vaultName = vaults.find(v => v.id === biometricVaultId)?.name || 'Vault';
          toast({
            title: 'Success',
            description: `${vaultName} unlocked with ${biometricType}`,
          });
        } else {
          setError('Biometric unlock failed. Please use your master password.');
        }
      } else {
        toast({
          title: 'Authentication Failed',
          description: result.error || 'Biometric authentication failed',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Biometric auth error:', err);
      setError('Biometric authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle restore from backup
   */
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
        toast({
          title: 'Backup Restored',
          description: `Successfully restored ${result.vaultCount} vault(s). Please refresh the app.`,
        });
        setShowRestoreDialog(false);
        setRestorePassword('');
        setBackupFileContent(null);
        // Reload the page to refresh vault list
        window.location.reload();
      } else {
        toast({
          title: 'Restore Failed',
          description: result.error || 'Failed to restore backup',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Restore Failed',
        description: 'An error occurred while restoring the backup',
        variant: 'destructive',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-start sm:justify-center bg-background px-4 py-6 sm:py-8 overflow-y-auto" data-testid="login-page">
      {/* Customer Info Dialog */}
      <CustomerInfoDialog
        open={showCustomerInfoDialog}
        onSubmit={handleCustomerInfoSubmit}
      />
      
      {/* Vault Chooser Dialog */}
      <VaultChooserDialog
        open={showVaultChooser}
        onClose={() => {
          setShowVaultChooser(false);
          setPendingPassword('');
        }}
        vaults={matchingVaults}
        onSelect={handleVaultSelect}
      />
      
      {/* Restore Backup Dialog */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Restore from Backup</DialogTitle>
            <DialogDescription>
              Enter the password you used when creating the backup to restore your vaults.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="restorePassword">Backup Password</Label>
              <Input
                id="restorePassword"
                type="password"
                placeholder="Enter backup password"
                value={restorePassword}
                onChange={(e) => setRestorePassword(e.target.value)}
                disabled={isRestoring}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRestoreDialog(false);
                setRestorePassword('');
                setBackupFileContent(null);
              }}
              disabled={isRestoring}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRestoreConfirm}
              disabled={!restorePassword || isRestoring}
            >
              {isRestoring ? 'Restoring...' : 'Restore'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <div className="max-w-md w-full">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <AppLogo size={64} variant="hero" className="mb-4" />
          <h1 className="text-2xl font-bold text-foreground">IronVault</h1>
          <p className="text-sm text-muted-foreground">Secure offline password manager</p>
        </div>

        {/* Lockout Warning */}
        {lockoutState.isLocked && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Account locked. Try again in {lockoutDisplay}
            </AlertDescription>
          </Alert>
        )}

        {/* Vault Counter */}
        {hasVaults && !isCreatingVault && (
          <div className="flex items-center justify-center gap-2 mb-4">
            <Badge variant="outline" className="text-sm">
              <Shield className="w-3 h-3 mr-1" />
              {vaultCount} Vault{vaultCount !== 1 ? 's' : ''}
            </Badge>
          </div>
        )}

        {/* Main Card */}
        <Card className="shadow-lg border">
          <CardContent className="pt-6">
            {/* Unlock Form */}
            {!isCreatingVault && hasVaults && (
              <form onSubmit={handleUnlock} className="space-y-4">
                <div>
                  <Label htmlFor="masterPassword">Master Password</Label>
                  <div className="relative mt-1">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      id="masterPassword"
                      placeholder="Enter your master password"
                      value={masterPassword}
                      onChange={(e) => setMasterPassword(e.target.value)}
                      disabled={lockoutState.isLocked || isLoading}
                      className="pr-10"
                      data-testid="input-unlock-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>

                  {/* Failed attempts indicator */}
                  {lockoutState.failedAttempts > 0 && !lockoutState.isLocked && (
                    <p className="text-xs text-destructive mt-1">
                      {lockoutState.failedAttempts}/{MAX_FAILED_ATTEMPTS} failed attempts
                    </p>
                  )}
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={lockoutState.isLocked || isLoading}
                  data-testid="button-unlock-vault"
                >
                  {isLoading ? 'Unlocking...' : 'Unlock Vault'}
                </Button>

                {/* Biometric Option - Show if biometric hardware is available */}
                {isNativeApp() && biometricAvailable && (
                  <>
                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">Or</span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-14 flex items-center justify-center gap-3 border-2 border-primary/30 hover:border-primary hover:bg-primary/5"
                      onClick={handleBiometricAuth}
                      disabled={lockoutState.isLocked || isLoading || !biometricVaultId}
                      data-testid="button-biometric-auth"
                    >
                      <Fingerprint className="w-6 h-6 text-primary" />
                      <span className="font-medium">
                        {biometricVaultId ? `Unlock with ${biometricType}` : `Enable ${biometricType} in Settings`}
                      </span>
                    </Button>
                    {!biometricVaultId && (
                      <p className="text-xs text-center text-muted-foreground mt-2">
                        Unlock with password first, then enable {biometricType} in Profile → Security
                      </p>
                    )}
                  </>
                )}

                {/* Create New Vault Link */}
                {canCreateVault && (
                  <div className="text-center pt-4 border-t">
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => setIsCreatingVault(true)}
                      className="text-primary"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Create New Vault
                    </Button>
                  </div>
                )}
              </form>
            )}

            {/* Create Vault Form */}
            {isCreatingVault && (
              <form onSubmit={handleCreateVault} className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-semibold text-foreground">
                    {hasVaults ? 'Create New Vault' : 'Create Your First Vault'}
                  </h2>
                  <Badge variant="outline">
                    {vaultCount}/{maxVaults}
                  </Badge>
                </div>

                <div>
                  <Label htmlFor="vaultName">Vault Name</Label>
                  <Input
                    id="vaultName"
                    placeholder="My Vault"
                    value={vaultName}
                    onChange={(e) => setVaultName(e.target.value)}
                    disabled={isLoading}
                    className="mt-1"
                    data-testid="input-vault-name"
                  />
                </div>

                <div>
                  <Label htmlFor="createPassword">Master Password</Label>
                  <div className="relative mt-1">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      id="createPassword"
                      placeholder="Create a strong password"
                      value={masterPassword}
                      onChange={(e) => setMasterPassword(e.target.value)}
                      disabled={isLoading}
                      className="pr-10"
                      data-testid="input-create-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative mt-1">
                    <Input
                      type={showConfirmPassword ? 'text' : 'password'}
                      id="confirmPassword"
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isLoading}
                      className="pr-10"
                      data-testid="input-confirm-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showConfirmPassword}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Alert className="border-primary/30 bg-primary/5">
                  <Info className="w-4 h-4 text-primary" />
                  <AlertDescription className="text-sm">
                    Your master password cannot be recovered. Choose a strong password you can remember.
                  </AlertDescription>
                </Alert>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                  data-testid="button-create-vault"
                >
                  {isLoading ? 'Creating...' : 'Create Vault'}
                </Button>

                {hasVaults && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setIsCreatingVault(false);
                      setVaultName('');
                      setMasterPassword('');
                      setConfirmPassword('');
                      setError('');
                    }}
                  >
                    Back to Unlock
                  </Button>
                )}
              </form>
            )}
          </CardContent>
        </Card>

        {/* Restore from Backup */}
        <div className="mt-4 text-center">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleRestoreBackup}
          >
            <Upload className="w-4 h-4 mr-2" />
            Restore from Backup
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Reinstalled the app? Restore your vaults from a backup file.
          </p>
        </div>

        {/* Plan Limit Info */}
        {!canCreateVault && userTier === 'free' && (
          <Alert className="mt-4 border-primary/30">
            <Crown className="w-4 h-4 text-primary" />
            <AlertDescription className="text-sm">
              Free plan allows 1 vault. Upgrade to Premium for up to 5 vaults.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
