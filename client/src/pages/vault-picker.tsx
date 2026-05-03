import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Eye, EyeOff, Lock, Plus, Cloud, ShieldCheck, LogOut, Fingerprint, Zap, Trash2,
  Check, Sparkles, Crown, Users,
} from 'lucide-react';
import { getPlan, formatINR } from '@/lib/plans';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { AppLogo } from '@/components/app-logo';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { vaultStorage } from '@/lib/storage';
import { vaultManager, type VaultInfo } from '@/lib/vault-manager';
import { checkBiometricCapabilities, unlockWithBiometric, isBiometricUnlockEnabled } from '@/native/biometrics';
import { isNativeApp } from '@/native/platform';
import { listCloudVaults, downloadCloudVault, pushCloudVault, deleteCloudVault, markVaultAsNotCloudSynced, getCloudToken, acquireCloudToken, markVaultAsCloudSynced, type CloudVaultMeta } from '@/lib/cloud-vault-sync';
import { getAccountPasswordHash } from '@/lib/account-auth';
import { useLicense } from '@/contexts/license-context';
import { usePlanFeatures, clearPlanCache } from '@/hooks/use-plan-features';

function resetViewportZoom() {
  setTimeout(() => {
    const vp = document.querySelector('meta[name="viewport"]');
    if (vp) vp.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
  }, 100);
}

export default function VaultPickerPage() {
  const [, setLocation] = useLocation();
  const { login, loginWithKey, loginWithoutVerification, accountEmail, accountLogout } = useAuth();
  const { toast } = useToast();
  const { license } = useLicense();

  const { vaultLimit, isPaid, isLoading: planLoading } = usePlanFeatures();

  // Loading state is keyed by the chosen plan so we can show a spinner only
  // on the card the user clicked, not blanket-disable every checkout button.
  const [upgradeLoading, setUpgradeLoading] = useState<null | 'pro_monthly' | 'pro_family' | 'lifetime'>(null);

  // Lets a free web user dismiss the upgrade gate and continue with the
  // limited free experience (1 local IndexedDB vault, no cloud sync). We
  // never want a paying-curious user to feel trapped at this screen, and
  // we don't want to re-prompt every login — persist the choice so
  // returning free users land directly on their vault list.
  const [paywallBypassed, setPaywallBypassed] = useState(() => {
    try { return localStorage.getItem('iv_paywall_bypassed') === '1'; } catch { return false; }
  });

  const persistPaywallBypassed = (value: boolean) => {
    setPaywallBypassed(value);
    try {
      if (value) localStorage.setItem('iv_paywall_bypassed', '1');
      else localStorage.removeItem('iv_paywall_bypassed');
    } catch { /* localStorage unavailable */ }
  };

  const PLAN_DESCRIPTIONS: Record<'pro_monthly' | 'pro_family' | 'lifetime', string> = {
    pro_monthly: 'IronVault Pro Monthly',
    pro_family: 'IronVault Pro Family',
    lifetime: 'IronVault Lifetime',
  };

  const handleUpgrade = async (planKey: 'pro_monthly' | 'pro_family' | 'lifetime') => {
    setUpgradeLoading(planKey);
    try {
      // Step 1: Razorpay script — surface a clear error rather than a generic crash.
      if (typeof window.Razorpay === 'undefined') {
        try {
          await new Promise<void>((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://checkout.razorpay.com/v1/checkout.js';
            s.onload = () => resolve();
            s.onerror = () => reject(new Error('Razorpay failed to load'));
            setTimeout(() => reject(new Error('Razorpay load timeout')), 10000);
            document.head.appendChild(s);
          });
        } catch (loadErr) {
          throw new Error('Could not load Razorpay. Please check your connection.');
        }
      }
      if (typeof window.Razorpay === 'undefined') {
        throw new Error('Razorpay script unavailable.');
      }

      const email = accountEmail || localStorage.getItem('iv_account_email') || '';
      if (!email) {
        throw new Error('Sign in first to upgrade.');
      }

      // Step 2: Create order — server may return non-JSON HTML (e.g. 502),
      // so explicitly verify both HTTP status and the parsed payload before
      // we hand anything to Razorpay.
      let orderResp: Response;
      try {
        orderResp = await fetch('/api/payments/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan: planKey, email }),
        });
      } catch {
        throw new Error('Network error. Please try again.');
      }
      if (!orderResp.ok) {
        throw new Error(`Order creation failed (HTTP ${orderResp.status}).`);
      }
      let orderData: any;
      try {
        orderData = await orderResp.json();
      } catch {
        throw new Error('Invalid response from payment server.');
      }
      const { orderId, amount, currency, keyId } = orderData || {};
      if (!orderId || !amount || !currency || !keyId) {
        throw new Error('Payment server returned incomplete order details.');
      }

      // Step 3: Open Razorpay — `new Razorpay()` and `.open()` can both throw
      // synchronously (bad key, blocked popup); bubble them up to the user.
      try {
        const rzp = new window.Razorpay({
          key: keyId,
          amount,
          currency,
          name: 'IronVault',
          description: PLAN_DESCRIPTIONS[planKey],
          order_id: orderId,
          handler: async (response: any) => {
            try {
              const verify = await fetch('/api/payments/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...response, plan: planKey, email }),
              });
              const verifyData = await verify.json().catch(() => ({}));
              if (verifyData?.success) {
                window.location.reload();
              } else {
                toast({
                  title: 'Payment verification failed',
                  description: 'If your card was charged, contact support.',
                  variant: 'destructive',
                });
              }
            } catch (verifyErr) {
              console.error('[upgrade] verify failed:', verifyErr);
              toast({
                title: 'Payment verification error',
                description: 'Please reload — if charged, contact support.',
                variant: 'destructive',
              });
            }
          },
          modal: {
            ondismiss: () => setUpgradeLoading(null),
          },
          prefill: { email },
          theme: { color: '#4f46e5' },
        });
        rzp.on?.('payment.failed', (response: any) => {
          console.error('[upgrade] payment failed:', response);
          toast({
            title: 'Payment failed',
            description: response?.error?.description || 'Please try again.',
            variant: 'destructive',
          });
        });
        rzp.open();
      } catch (openErr) {
        console.error('[upgrade] Razorpay open failed:', openErr);
        throw new Error('Could not open checkout. Please try again.');
      }
    } catch (err) {
      console.error('[upgrade] Payment error:', err);
      const description = err instanceof Error ? err.message : 'Could not open checkout. Try again.';
      toast({ title: 'Upgrade unavailable', description, variant: 'destructive' });
      setUpgradeLoading(null);
    }
    // Note: we no longer clear `upgradeLoading` in finally — the modal stays
    // open while Razorpay UI is up. It's cleared via `modal.ondismiss` or
    // on payment.failed/success above.
  };

  const [vaults, setVaults] = useState<VaultInfo[]>([]);
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [showPw, setShowPw] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricVaultId, setBiometricVaultId] = useState<string | null>(null);

  const [cloudVaults, setCloudVaults] = useState<CloudVaultMeta[]>([]);
  const [cloudDownloading, setCloudDownloading] = useState<string | null>(null);
  const [cloudPasswordInput, setCloudPasswordInput] = useState<Record<string, string>>({});
  const [cloudShowPw, setCloudShowPw] = useState<Record<string, boolean>>({});
  const [cloudErrors, setCloudErrors] = useState<Record<string, string>>({});

  const [vaultToDelete, setVaultToDelete] = useState<{
    id: string; name: string; isLocal: boolean; isCloud: boolean;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeletePw, setShowDeletePw] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newVaultName, setNewVaultName] = useState('');
  const [newVaultPassword, setNewVaultPassword] = useState('');
  const [newVaultConfirm, setNewVaultConfirm] = useState('');
  // Default storage type: native app and free-web (no cloud entitlement)
  // both default to local; only paid web users default to cloud.
  const [newVaultType, setNewVaultType] = useState<'local' | 'cloud'>(
    isNativeApp() || !isPaid ? 'local' : 'cloud',
  );
  const [showNewPw, setShowNewPw] = useState(false);
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  // Synchronous guard against double-clicks / rapid Enter presses — React's
  // setIsCreating doesn't commit before a second handler can fire, so a state
  // flag alone isn't enough to prevent the duplicate vault.
  const creatingRef = useRef(false);

  const resetCreateForm = () => {
    setNewVaultName('');
    setNewVaultPassword('');
    setNewVaultConfirm('');
    setNewVaultType(isNativeApp() || !isPaid ? 'local' : 'cloud');
    setShowNewPw(false);
    setCreateError('');
  };

  useEffect(() => {
    // Always re-read local vaults from the (now email-scoped) registry
    const list = vaultManager.getExistingVaults();
    setVaults(list);

    // Check biometric availability for the default vault
    const checkBiometric = async () => {
      if (!isNativeApp()) return;
      try {
        const caps = await checkBiometricCapabilities();
        if (!caps.isAvailable) return;
        const defaultVault = vaultManager.getDefaultVault();
        if (!defaultVault) return;
        const enabled = await isBiometricUnlockEnabled(defaultVault.id);
        if (enabled) {
          setBiometricAvailable(true);
          setBiometricVaultId(defaultVault.id);
        }
      } catch {
        // Biometric check failed silently
      }
    };
    checkBiometric();

    // Load cloud vaults — only possible once we know the account email
    const loadCloudVaults = async () => {
      if (!accountEmail) return;
      // Ensure we have a cloud token
      let token = getCloudToken();
      if (!token) {
        const hash = getAccountPasswordHash();
        if (hash) token = await acquireCloudToken(accountEmail, hash);
      }
      if (!token) return;
      const remote = await listCloudVaults();
      setCloudVaults(remote);
    };
    loadCloudVaults();
  }, [accountEmail]); // re-run when email is set (e.g. after initializeAuth completes)

  // Auto-bypass the paywall for returning free users who already have at
  // least one vault (local or cloud). Forcing the upgrade gate on every
  // login when they've already created a vault is hostile UX — surface a
  // small "See plans" banner instead so they can upgrade later.
  useEffect(() => {
    if (planLoading) return;
    if (isPaid) return;
    if (paywallBypassed) return;
    if (vaults.length > 0 || cloudVaults.length > 0) {
      persistPaywallBypassed(true);
    }
  }, [vaults.length, cloudVaults.length, isPaid, planLoading, paywallBypassed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Consume pending family invite — checks both URL params and localStorage.
  // URL params are present when the user is already logged in and clicks the invite link
  // (routed to VaultPickerPage by Tier 2). localStorage is set by SignupPage for new users.
  useEffect(() => {
    if (!accountEmail) return;
    const urlParams = new URLSearchParams(window.location.search);
    const urlInviteId = urlParams.get('invite');
    const urlInviteEmail = urlParams.get('email');
    const storedInviteId = localStorage.getItem('pending_family_invite_id');
    const storedInviteEmail = localStorage.getItem('pending_family_invite_email');
    const inviteId = urlInviteId || storedInviteId;
    const inviteEmail = urlInviteEmail ? decodeURIComponent(urlInviteEmail) : storedInviteEmail;
    if (!inviteId) return;
    localStorage.removeItem('pending_family_invite_id');
    localStorage.removeItem('pending_family_invite_email');
    // Clean invite params from URL without triggering a page reload
    if (urlInviteId) {
      const clean = window.location.pathname;
      window.history.replaceState({}, '', clean);
    }
    fetch(`/api/crm/family-invites/${encodeURIComponent(inviteId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'accepted', inviteeEmail: (inviteEmail || accountEmail).toLowerCase() }),
    }).then(r => r.json()).then(d => {
      if (d.success) {
        clearPlanCache();
        toast({ title: 'Family plan activated!', description: 'You now have access to IronVault Pro features.' });
      }
    }).catch(() => {});
  }, [accountEmail]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUnlock = async (vaultId: string, vaultName: string) => {
    const pw = passwords[vaultId] || '';
    if (!pw) {
      setErrors(e => ({ ...e, [vaultId]: 'Please enter your master password.' }));
      return;
    }
    setErrors(e => ({ ...e, [vaultId]: '' }));
    setLoading(vaultId);
    try {
      vaultManager.setActiveVaultId(vaultId);
      await vaultStorage.switchToVault(vaultId);
      const success = await login(pw);
      if (success) {
        await vaultManager.resetFailedAttempts();
        resetViewportZoom();
        toast({ title: 'Vault Unlocked', description: `Welcome back! Opened "${vaultName}"` });
        setLocation('/');
      } else {
        setErrors(e => ({ ...e, [vaultId]: 'Incorrect master password. Please try again.' }));
      }
    } catch (err: any) {
      const raw = (err?.message || '').toString();
      const looksLikeWrongPassword =
        /decrypt/i.test(raw) || /Invalid master key/i.test(raw) || /JSON/i.test(raw);
      setErrors(e => ({
        ...e,
        [vaultId]: looksLikeWrongPassword
          ? 'Incorrect master password. Please try again.'
          : 'Failed to unlock vault.',
      }));
    } finally {
      setLoading(null);
    }
  };

  const handleBiometricUnlock = async () => {
    if (!biometricVaultId) return;
    setLoading('biometric');
    try {
      const vault = vaultManager.getDefaultVault();
      if (!vault) return;
      vaultManager.setActiveVaultId(vault.id);
      await vaultStorage.switchToVault(vault.id);

      const storedKey = vaultManager.getBiometricKey(vault.id);
      if (storedKey) {
        // Try master password stored for biometric
        const success = await login(storedKey);
        if (success) {
          resetViewportZoom();
          toast({ title: 'Vault Unlocked', description: `Opened "${vault.name}" via biometric` });
          setLocation('/');
          return;
        }
      }

      // Fall back to native biometric key unlock
      const result = await unlockWithBiometric(vault.id);
      if (result.success && result.vaultUnlockKey) {
        const success = await loginWithKey(result.vaultUnlockKey);
        if (success) {
          resetViewportZoom();
          toast({ title: 'Vault Unlocked', description: `Opened "${vault.name}" via biometric` });
          setLocation('/');
          return;
        }
      }
      toast({ title: 'Biometric failed', description: 'Please enter your master password.', variant: 'destructive' });
    } catch {
      toast({ title: 'Biometric error', description: 'Please enter your master password.', variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  const handleCloudUnlock = async (cloudVault: CloudVaultMeta) => {
    const pw = cloudPasswordInput[cloudVault.vaultId] || '';
    if (!pw) {
      setCloudErrors(e => ({ ...e, [cloudVault.vaultId]: 'Please enter your master password.' }));
      return;
    }
    setCloudErrors(e => ({ ...e, [cloudVault.vaultId]: '' }));
    setCloudDownloading(cloudVault.vaultId);
    try {
      vaultManager.setActiveVaultId(cloudVault.vaultId);
      await vaultStorage.switchToVault(cloudVault.vaultId);

      // Ensure vault is in local registry so VaultSelectionContext can find it after unlock.
      const existing = vaultManager.getExistingVaults().find(v => v.id === cloudVault.vaultId);
      if (!existing) {
        vaultManager.addToRegistry({
          id: cloudVault.vaultId,
          name: cloudVault.vaultName,
          createdAt: new Date().toISOString(),
          lastAccessedAt: new Date().toISOString(),
          isDefault: cloudVault.isDefault || false,
          biometricEnabled: false,
          iconColor: '#6366f1',
        }, vaultLimit);
      }

      // ── Always-rescue local data ─────────────────────────────────────────
      // The previous fix only ran rescue when `iv_dirty_<id>` was set, but
      // that flag is cleared on push success — and a push can *appear* to
      // succeed (HTTP 200) without actually landing the imports on the
      // server (silent failures, races, server-side partial writes). When
      // that happens, the rescue is skipped and clearEncryptedItems()
      // unconditionally destroys the local imports.
      //
      // Defensive approach: ALWAYS try to push local data first. The PUT
      // endpoint's optimistic concurrency handles the multi-device case:
      //   - rescue.success    → local was newer/equal; cloud now matches
      //                         local. Keep local; skip the wipe.
      //   - rescue.serverNewer → cloud is newer (another device updated).
      //                          Fall through to wipe-and-replace.
      //   - other failure      → if dirty flag is set, refuse to wipe (we
      //                          have unsynced changes the user should not
      //                          silently lose). Else fall through.
      const dirtyKey = `iv_dirty_${cloudVault.vaultId}`;
      let preservedLocal = false;
      try {
        const localUnlocked = await vaultStorage.unlockVault(pw);
        if (localUnlocked) {
          // Count actual entries — a byte-length threshold on the encrypted blob
          // misclassifies vaults with rich metadata-only state (icons, categories,
          // settings) as non-empty, and vaults with very small entries as empty.
          const localItemCount = await vaultStorage.getTotalItemCount();
          if (localItemCount > 0) {
            const localBlob = await vaultStorage.exportVault(pw);
            console.log('[CLOUD-UNLOCK] Local has content — pushing before any wipe', { localItemCount });
            const rescue = await pushCloudVault(
              cloudVault.vaultId, cloudVault.vaultName, localBlob,
              cloudVault.isDefault || false,
            );
            if (rescue.success) {
              preservedLocal = true;
              localStorage.removeItem(dirtyKey);
              console.log('[CLOUD-UNLOCK] Preserved local data — push succeeded');
            } else if (rescue.serverNewer) {
              // Cloud is newer — wipe-and-replace below is the right call.
              // Clear dirty since cloud is now authoritative.
              localStorage.removeItem(dirtyKey);
              console.log('[CLOUD-UNLOCK] Cloud is newer than local — will replace');
            } else if (localStorage.getItem(dirtyKey) === '1') {
              // Push failed AND we have explicitly-marked unsynced changes —
              // refuse to wipe.
              console.error('[CLOUD-UNLOCK] Push failed with dirty flag set — refusing to wipe', rescue);
              setCloudErrors(e => ({
                ...e,
                [cloudVault.vaultId]:
                  'Cloud sync failed and you have unsynced local changes. Check your network and try again.',
              }));
              return;
            } else {
              console.warn('[CLOUD-UNLOCK] Push failed but dirty flag not set — proceeding with cloud download', rescue);
            }
          } else {
            console.log('[CLOUD-UNLOCK] Local blob is empty/tiny — falling through to cloud download', { blobLength: localBlob.length });
          }
        } else {
          console.log('[CLOUD-UNLOCK] Local unlock failed (no usable local data) — falling through to cloud download');
        }
      } catch (rescueErr) {
        console.error('[CLOUD-UNLOCK] Rescue attempt threw — falling through to cloud download', rescueErr);
      }

      if (preservedLocal) {
        // Local IDB has the authoritative data and it's now on the server.
        // Just unlock — auto-sync will pull any future updates from other devices.
        loginWithoutVerification(pw);
        markVaultAsCloudSynced(cloudVault.vaultId);
        // Set lastPull to NOW so doPull doesn't immediately re-download (our
        // push set serverUpdatedAt on the server; using NOW avoids a redundant
        // round-trip and replaceVaultFromBlob with the same data).
        localStorage.setItem(`iv_last_pull_${cloudVault.vaultId}`, new Date().toISOString());
        resetViewportZoom();
        toast({ title: 'Vault Unlocked', description: `Welcome back to "${cloudVault.vaultName}"` });
        setLocation('/');
        return;
      }
      // ─────────────────────────────────────────────────────────────────────

      // Local data unusable, empty, or cloud is newer: wipe and replace.
      const full = await downloadCloudVault(cloudVault.vaultId);
      if (!full) throw new Error('Failed to download vault from cloud');

      // Derive a fresh key from the cloud blob — never reuse stale local metadata.
      // createVault sets encryptionKey on vaultStorage; importVault writes items
      // encrypted with that key.  loginWithoutVerification sets auth state directly
      // without re-running unlockVault (which would fail if the verification entry
      // was wiped by clearEncryptedItems).
      await vaultStorage.createVault(pw);
      await vaultStorage.clearEncryptedItems();
      await vaultStorage.importVault(full.encryptedBlob, pw);
      await vaultStorage.ensureVerificationEntry();

      loginWithoutVerification(pw);
      markVaultAsCloudSynced(cloudVault.vaultId);
      localStorage.setItem(
        `iv_last_pull_${cloudVault.vaultId}`,
        full.serverUpdatedAt || new Date().toISOString(),
      );
      void pushCloudVault(cloudVault.vaultId, cloudVault.vaultName, full.encryptedBlob, cloudVault.isDefault || false);
      resetViewportZoom();
      toast({ title: 'Cloud Vault Unlocked', description: `Welcome back! Opened "${cloudVault.vaultName}" from cloud` });
      setLocation('/');
    } catch (err: any) {
      const raw = (err?.message || '').toString();
      // Decryption failures, JSON parse errors and "file format not recognized" all
      // indicate a wrong master password — surface a clean, user-friendly message.
      const looksLikeWrongPassword =
        /decrypt/i.test(raw) ||
        /file format/i.test(raw) ||
        /JSON/i.test(raw) ||
        /Invalid master key/i.test(raw) ||
        /Failed to import vault/i.test(raw) ||
        /Unsupported state/i.test(raw);
      const friendly = looksLikeWrongPassword
        ? 'Incorrect master password. Please try again.'
        : raw || 'Failed to unlock cloud vault.';
      setCloudErrors(e => ({ ...e, [cloudVault.vaultId]: friendly }));
    } finally {
      setCloudDownloading(null);
    }
  };

  const handleLogout = () => {
    accountLogout();
    setLocation('/');
  };

  const refreshVaultLists = async () => {
    setVaults(vaultManager.getExistingVaults());
    if (accountEmail) {
      try {
        const remote = await listCloudVaults();
        setCloudVaults(remote);
      } catch {
        // Offline — keep last-known list
      }
    }
  };

  const verifyVaultPassword = async (vaultId: string, password: string): Promise<boolean> => {
    // Path 1: locally-stored verification hash (set on creation)
    if (await vaultManager.tryUnlockVault(vaultId, password)) return true;
    // Path 2: IDB verification entry (set after first unlock — covers cloud-synced vaults
    // that don't have a local hash entry yet).
    const previousActive = vaultManager.getActiveVaultId();
    try {
      vaultManager.setActiveVaultId(vaultId);
      await vaultStorage.switchToVault(vaultId);
      const ok = await vaultStorage.unlockVault(password);
      return ok;
    } catch {
      return false;
    } finally {
      if (previousActive && previousActive !== vaultId) {
        vaultManager.setActiveVaultId(previousActive);
        try { await vaultStorage.switchToVault(previousActive); } catch { /* noop */ }
      }
    }
  };

  const handleConfirmDelete = async () => {
    if (!vaultToDelete) return;
    setDeleteError('');

    if (!deletePassword) {
      setDeleteError('Enter the master password to confirm deletion.');
      return;
    }

    const totalVaults = new Set([
      ...vaults.map(v => v.id),
      ...cloudVaults.map(c => c.vaultId),
    ]).size;
    if (totalVaults <= 1) {
      toast({
        title: 'Cannot delete last vault',
        description: 'You must keep at least one vault. Create another vault first.',
        variant: 'destructive',
      });
      return;
    }

    setIsDeleting(true);
    try {
      const passwordOk = await verifyVaultPassword(vaultToDelete.id, deletePassword);
      if (!passwordOk) {
        setDeleteError('Incorrect master password.');
        return;
      }

      if (vaultToDelete.isCloud) {
        const ok = await deleteCloudVault(vaultToDelete.id);
        if (!ok) {
          setDeleteError('Could not remove vault from the cloud. Please retry.');
          return;
        }
        markVaultAsNotCloudSynced(vaultToDelete.id);
      }
      if (vaultToDelete.isLocal) {
        await vaultManager.deleteVault(vaultToDelete.id);
        vaultManager.removeVaultPassword(vaultToDelete.id);
        vaultManager.removeBiometricKey(vaultToDelete.id);
      }
      toast({
        title: 'Vault deleted',
        description: `"${vaultToDelete.name}" and all its data have been removed.`,
      });
      setVaultToDelete(null);
      setDeletePassword('');
      setShowDeletePw(false);
      await refreshVaultLists();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete vault.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateVault = async () => {
    // Synchronous guard — `isCreating` state takes a render to commit, so a
    // second click/Enter can fire before the button disables. The ref blocks
    // those re-entrant calls and is the actual fix for "Test vault appeared
    // twice" reports.
    if (creatingRef.current) return;
    creatingRef.current = true;

    setCreateError('');
    if (!newVaultName.trim()) { setCreateError('Vault name is required'); creatingRef.current = false; return; }
    if (newVaultPassword.length < 8) { setCreateError('Master password must be at least 8 characters'); creatingRef.current = false; return; }
    if (newVaultPassword !== newVaultConfirm) { setCreateError('Passwords do not match'); creatingRef.current = false; return; }

    // Defense-in-depth: if a vault with the same trimmed name already exists
    // in this account's registry, refuse rather than letting createVault
    // silently dedupe to "Test 2".
    const trimmedName = newVaultName.trim();
    const existingByName = vaultManager.getExistingVaults().find(
      v => v.name.trim().toLowerCase() === trimmedName.toLowerCase(),
    );
    if (existingByName) {
      setCreateError(`A vault named "${existingByName.name}" already exists.`);
      creatingRef.current = false;
      return;
    }

    setIsCreating(true);
    const previousActive = vaultManager.getActiveVaultId();
    try {
      // Cloud vaults that aren't already in the local registry would otherwise
      // be missed by createVault's limit check (which counts the local registry).
      const cloudOnlyCount = cloudVaults.filter(
        cv => !vaults.some(v => v.id === cv.vaultId),
      ).length;
      const newVault = await vaultManager.createVault(
        trimmedName,
        vaults.length === 0 && cloudVaults.length === 0,
        vaultLimit,
        cloudOnlyCount,
      );

      vaultManager.setActiveVaultId(newVault.id);
      await vaultStorage.switchToVault(newVault.id);
      await vaultStorage.createVault(newVaultPassword);
      await vaultManager.createVaultPassword(newVault.id, newVaultPassword);

      // Web defaults to cloud, but free users have no cloud entitlement —
      // honor the local choice so we don't churn through a guaranteed-fail
      // push and surface a confusing "cloud sync requires Pro" toast.
      const wantsCloud = newVaultType === 'cloud' || (!isNativeApp() && isPaid);
      if (wantsCloud) {
        try {
          const blob = await vaultStorage.exportVault(newVaultPassword);
          const result = await pushCloudVault(newVault.id, newVault.name, blob, false);
          if (result.planError) {
            toast({
              title: 'Cloud sync requires Pro',
              description: 'Vault was created locally. Upgrade to enable cloud sync.',
              variant: 'destructive',
            });
          } else if (result.success) {
            markVaultAsCloudSynced(newVault.id);
          } else {
            toast({
              title: 'Cloud sync failed',
              description: 'Vault was created locally — sync will retry when online.',
              variant: 'destructive',
            });
          }
        } catch {
          toast({
            title: 'Cloud sync failed',
            description: 'Vault was created locally.',
            variant: 'destructive',
          });
        }
      }

      // Restore previous active vault — picker should not silently switch the user.
      if (previousActive && previousActive !== newVault.id) {
        vaultManager.setActiveVaultId(previousActive);
        try { await vaultStorage.switchToVault(previousActive); } catch { /* noop */ }
      }

      toast({
        title: 'Vault created',
        description: `"${newVault.name}" is ready. Enter your password to unlock it.`,
      });

      setShowCreateDialog(false);
      resetCreateForm();
      await refreshVaultLists();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create vault';
      setCreateError(message.startsWith('PLAN_LIMIT:') ? message.slice('PLAN_LIMIT:'.length).trim() : message);
    } finally {
      setIsCreating(false);
      creatingRef.current = false;
    }
  };

  // Combined local + cloud count — a vault that exists in both lists is counted once.
  const combinedVaultCount = new Set([
    ...vaults.map(v => v.id),
    ...cloudVaults.map(c => c.vaultId),
  ]).size;
  const atVaultLimit = !planLoading && combinedVaultCount >= vaultLimit;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <AppLogo size={28} />
          <span className="font-bold text-lg">IronVault</span>
        </div>
        <div className="flex items-center gap-3">
          {accountEmail && (
            <span className="text-sm text-muted-foreground hidden sm:block">{accountEmail}</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="gap-2 text-muted-foreground"
            data-testid="button-account-logout"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 py-10">
        {/* Web upgrade gate gets a wider container so three plan cards fit
            comfortably side-by-side on tablet/desktop without squishing. */}
        <div className={`w-full ${!isNativeApp() && !isPaid && !planLoading && !paywallBypassed ? 'max-w-5xl' : 'max-w-md'}`}>
          {/* Free-plan banner — shown only after the user dismisses the
              paywall on web. Keeps the upgrade prompt one click away
              without forcing it on every visit. */}
          {!isNativeApp() && !isPaid && !planLoading && paywallBypassed && (
            <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-center gap-3">
              <Zap className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-200 flex-1">
                You're on the Free plan. Upgrade for cloud sync and more vaults.
              </p>
              <button
                type="button"
                onClick={() => persistPaywallBypassed(false)}
                className="text-xs font-semibold text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 whitespace-nowrap underline underline-offset-2"
                data-testid="button-show-upgrade"
              >
                See plans →
              </button>
            </div>
          )}

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight mb-2">
              {!isNativeApp() && !isPaid && !planLoading && !paywallBypassed ? 'Unlock IronVault Web' : 'Your Vaults'}
            </h1>
            <p className="text-muted-foreground">
              {!isNativeApp() && !isPaid && !planLoading && !paywallBypassed
                ? 'Choose a plan to access your vaults from any browser.'
                : 'Enter your master password to unlock a vault.'}
            </p>
          </div>

          {/* Web upgrade gate — free users on web see an inline plan picker
              with three side-by-side cards (stacks on mobile). Each card
              fires Razorpay directly via handleUpgrade(planKey). */}
          {!isNativeApp() && !isPaid && !planLoading && !paywallBypassed && (() => {
            const proPlan = getPlan('pro')!;
            const familyPlan = getPlan('family')!;
            const lifetimePlan = getPlan('lifetime')!;
            const cards = [
              {
                key: 'pro_monthly' as const,
                plan: proPlan,
                price: formatINR(proPlan.priceMonthly!),
                priceSuffix: '/mo',
                priceSub: '14-day free trial',
                badge: null as string | null,
                accent: 'indigo',
                icon: Sparkles,
                features: [
                  'Up to 5 vaults (local + cloud)',
                  'Web app + Mobile app',
                  'Cross-device cloud sync',
                  'Unlimited passwords & notes',
                  'Bank statement import (OCR)',
                  'Expense & investment tracking',
                  'Biometric authentication',
                  'Priority support',
                ],
                ctaLabel: 'Choose Pro',
              },
              {
                key: 'pro_family' as const,
                plan: familyPlan,
                price: formatINR(familyPlan.priceMonthly!),
                priceSuffix: '/mo',
                priceSub: 'Up to 6 family members',
                badge: null,
                accent: 'rose',
                icon: Users,
                features: [
                  'Everything in Pro',
                  'Up to 6 family seats',
                  '5 vaults per member',
                  'Shared family vault',
                  'Individual private vaults',
                  'Family spending dashboard',
                  'Priority support',
                ],
                ctaLabel: 'Choose Family',
              },
              {
                key: 'lifetime' as const,
                plan: lifetimePlan,
                price: formatINR(lifetimePlan.priceOneTime!),
                priceSuffix: '',
                priceSub: 'one-time payment',
                badge: 'Best Value',
                accent: 'amber',
                icon: Crown,
                features: [
                  'Everything in Pro — forever',
                  'Web app + Mobile app',
                  'Up to 5 vaults (local + cloud)',
                  'No recurring payments',
                  'All future updates included',
                  'Early access to new features',
                  'Premium support',
                ],
                ctaLabel: 'Choose Lifetime',
              },
            ];

            const accentClasses: Record<string, { ring: string; bg: string; text: string; cta: string; badge: string }> = {
              indigo: {
                ring: 'border-border hover:border-indigo-500/40',
                bg: 'bg-indigo-500/10',
                text: 'text-indigo-500',
                cta: 'bg-indigo-600 hover:bg-indigo-700 text-white',
                badge: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/20',
              },
              rose: {
                ring: 'border-border hover:border-rose-500/40',
                bg: 'bg-rose-500/10',
                text: 'text-rose-500',
                cta: 'bg-rose-600 hover:bg-rose-700 text-white',
                badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/20',
              },
              amber: {
                ring: 'border-amber-500/60 ring-2 ring-amber-500/30 shadow-xl shadow-amber-500/10',
                bg: 'bg-gradient-to-br from-amber-500/20 to-orange-500/20',
                text: 'text-amber-600 dark:text-amber-400',
                cta: 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md shadow-amber-500/30',
                badge: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0',
              },
            };

            return (
              <div className="mb-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {cards.map(card => {
                    const c = accentClasses[card.accent];
                    const Icon = card.icon;
                    const isAvailable = card.plan.available;
                    const isLoading = upgradeLoading === card.key;
                    const isHighlight = card.accent === 'amber';
                    return (
                      <div
                        key={card.key}
                        className={`relative rounded-2xl border bg-card p-5 flex flex-col transition-all hover:-translate-y-0.5 hover:shadow-lg ${c.ring} ${isHighlight ? 'md:scale-[1.02]' : ''}`}
                      >
                        {card.badge && (
                          <span className={`absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${c.badge}`}>
                            {card.badge}
                          </span>
                        )}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${c.bg}`}>
                          <Icon className={`w-5 h-5 ${c.text}`} />
                        </div>
                        <h3 className="text-lg font-bold tracking-tight">{card.plan.name}</h3>
                        <p className="text-xs text-muted-foreground mb-3 min-h-[2rem]">{card.plan.description}</p>
                        <div className="mb-1">
                          <span className="text-3xl font-bold tabular-nums tracking-tight">{card.price}</span>
                          {card.priceSuffix && (
                            <span className="text-sm text-muted-foreground ml-1">{card.priceSuffix}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-4">{card.priceSub}</p>
                        <ul className="space-y-2 mb-5 flex-1">
                          {card.features.map(f => (
                            <li key={f} className="flex items-start gap-2 text-xs text-foreground/80">
                              <Check className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${c.text}`} />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                        <Button
                          onClick={() => handleUpgrade(card.key)}
                          disabled={!isAvailable || isLoading || upgradeLoading !== null}
                          className={`w-full rounded-xl ${c.cta} disabled:opacity-60`}
                          data-testid={`button-choose-${card.key}`}
                        >
                          {isLoading ? 'Loading…' : !isAvailable ? 'Coming Soon' : card.ctaLabel}
                        </Button>
                      </div>
                    );
                  })}
                </div>
                <p className="text-center text-xs text-muted-foreground mt-6">
                  Free plan: Mobile app only · 1 local vault · No web access
                </p>
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => persistPaywallBypassed(true)}
                    className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2"
                    data-testid="button-continue-free"
                  >
                    Continue with Free Plan →
                  </button>
                  <p className="text-xs text-muted-foreground mt-1">
                    Limited to 1 local vault, no cloud sync
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Biometric shortcut (native only) */}
          {isNativeApp() && biometricAvailable && biometricVaultId && (
            <Button
              variant="outline"
              className="w-full mb-6 gap-2 h-12"
              onClick={handleBiometricUnlock}
              disabled={loading === 'biometric'}
              data-testid="button-biometric-unlock"
            >
              <Fingerprint className="w-5 h-5 text-primary" />
              {loading === 'biometric' ? 'Unlocking…' : 'Unlock with biometric'}
            </Button>
          )}

          {/* Local vaults — mobile or free-web-bypassed; cloud-cached entries hidden (appear under Cloud Vaults) */}
          {(isNativeApp() || paywallBypassed) && (
            <>
              {vaults.filter(v => !cloudVaults.some(cv => cv.vaultId === v.id)).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No vaults yet. Create your first vault below.</p>
                </div>
              ) : (
                <div className="space-y-4 mb-6">
                  {vaults.filter(v => !cloudVaults.some(cv => cv.vaultId === v.id)).map(vault => (
                    <div key={vault.id} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <ShieldCheck className="w-5 h-5 text-primary" />
                        <span className="font-semibold">{vault.name}</span>
                        {vault.isDefault && (
                          <span className="ml-1 text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">Default</span>
                        )}
                        <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">Local</span>
                        <button
                          type="button"
                          aria-label={`Delete vault ${vault.name}`}
                          data-testid="button-delete-vault"
                          onClick={() => setVaultToDelete({ id: vault.id, name: vault.name, isLocal: true, isCloud: false })}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {errors[vault.id] && (
                        <p className="text-destructive text-sm mb-2">{errors[vault.id]}</p>
                      )}
                      <div className="relative mb-3">
                        <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                        <Input
                          data-testid="input-unlock-password"
                          type={showPw[vault.id] ? 'text' : 'password'}
                          placeholder="Master password"
                          value={passwords[vault.id] || ''}
                          onChange={e => setPasswords(p => ({ ...p, [vault.id]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && handleUnlock(vault.id, vault.name)}
                          className="pl-10 pr-11"
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw(s => ({ ...s, [vault.id]: !s[vault.id] }))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          tabIndex={-1}
                        >
                          {showPw[vault.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <Button
                        data-testid="button-unlock-vault"
                        className="w-full"
                        onClick={() => handleUnlock(vault.id, vault.name)}
                        disabled={loading === vault.id}
                      >
                        {loading === vault.id ? 'Unlocking…' : 'Unlock Vault'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Create new vault (mobile only) — combined local + cloud count */}
              {!planLoading && combinedVaultCount >= vaultLimit ? (
                <div className="w-full mb-8 p-3 rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="text-sm text-amber-800 dark:text-amber-300 truncate">
                      {vaultLimit === 1
                        ? 'Free plan: 1 vault max'
                        : `Plan limit reached: ${combinedVaultCount} of ${vaultLimit} vaults used`}
                    </span>
                  </div>
                  <Button
                    data-testid="button-upgrade-plan"
                    variant="outline"
                    size="sm"
                    className="shrink-0 text-amber-700 dark:text-amber-300 border-amber-400 dark:border-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                    onClick={() => setLocation('/upgrade')}
                  >
                    <Zap className="w-3 h-3 mr-1" />
                    Upgrade
                  </Button>
                </div>
              ) : (
                <Button
                  data-testid="button-create-new-vault"
                  variant="outline"
                  className="w-full mb-8 gap-2"
                  onClick={() => { resetCreateForm(); setShowCreateDialog(true); }}
                >
                  <Plus className="w-4 h-4" />
                  Add a vault
                </Button>
              )}
            </>
          )}

          {/* Cloud vaults section — shown for paid users (web or native) */}
          {(isNativeApp() || isPaid) && (
            cloudVaults.length > 0 ? (
              <div className="space-y-4 mb-6">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cloud Vaults</p>
                {cloudVaults.map(cv => (
                  <div key={cv.vaultId} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Cloud className="w-5 h-5 text-blue-500" />
                      <span className="font-semibold">{cv.vaultName}</span>
                      {cv.isDefault && (
                        <span className="ml-1 text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">Default</span>
                      )}
                      <span className="ml-auto text-xs text-blue-500 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded">Cloud</span>
                      <button
                        type="button"
                        aria-label={`Delete vault ${cv.vaultName}`}
                        data-testid="button-delete-cloud-vault"
                        onClick={() => setVaultToDelete({
                          id: cv.vaultId,
                          name: cv.vaultName,
                          isLocal: vaults.some(v => v.id === cv.vaultId),
                          isCloud: true,
                        })}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {cloudErrors[cv.vaultId] && (
                      <p className="text-destructive text-sm mb-2">{cloudErrors[cv.vaultId]}</p>
                    )}
                    <div className="relative mb-3">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                      <Input
                        data-testid="input-unlock-password"
                        type={cloudShowPw[cv.vaultId] ? 'text' : 'password'}
                        placeholder="Master password"
                        value={cloudPasswordInput[cv.vaultId] || ''}
                        onChange={e => setCloudPasswordInput(p => ({ ...p, [cv.vaultId]: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && handleCloudUnlock(cv)}
                        className="pl-10 pr-11"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setCloudShowPw(s => ({ ...s, [cv.vaultId]: !s[cv.vaultId] }))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors z-10"
                        tabIndex={-1}
                      >
                        {cloudShowPw[cv.vaultId] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button
                      data-testid="button-unlock-cloud-vault"
                      className="w-full"
                      onClick={() => handleCloudUnlock(cv)}
                      disabled={cloudDownloading === cv.vaultId}
                    >
                      {cloudDownloading === cv.vaultId ? 'Downloading…' : 'Unlock Vault'}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border/50 bg-muted/30 p-5 text-center mb-4">
                <Cloud className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                {isNativeApp() && license.tier === 'free' ? (
                  <>
                    <p className="text-sm font-medium text-muted-foreground">Cloud Sync — Pro feature</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Upgrade to Pro to sync your vault across devices.</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => setLocation('/upgrade')}>
                      Upgrade to Pro
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-muted-foreground">No cloud vaults yet</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      {isNativeApp() ? 'Create a cloud vault or convert an existing local vault.' : 'Create your first cloud vault to get started.'}
                    </p>
                    <Button
                      size="sm"
                      className="mt-3 gap-2"
                      variant={isNativeApp() ? 'outline' : 'default'}
                      onClick={() => { resetCreateForm(); setNewVaultType('cloud'); setShowCreateDialog(true); }}
                    >
                      <Plus className="w-4 h-4" /> Create cloud vault
                    </Button>
                  </>
                )}
              </div>
            )
          )}

          {/* Always-visible "+ New Vault" card-button */}
          {(isNativeApp() || isPaid || paywallBypassed) && (
            <>
              <button
                type="button"
                data-testid="button-add-new-vault"
                disabled={atVaultLimit}
                onClick={() => { resetCreateForm(); setShowCreateDialog(true); }}
                className="w-full rounded-xl border border-dashed border-border bg-card/40 hover:bg-card hover:border-primary/50 transition-colors p-4 flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground mb-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:bg-card/40"
              >
                <Plus className="w-5 h-5" />
                <span className="font-medium">
                  {atVaultLimit ? 'Vault limit reached' : 'New Vault'}
                </span>
              </button>
              {!planLoading && (
                <p
                  className="text-xs text-center text-muted-foreground mb-4"
                  data-testid="text-vault-usage"
                >
                  {combinedVaultCount} of {vaultLimit === -1 ? '∞' : vaultLimit} vaults used
                  {atVaultLimit && vaultLimit !== -1 && (
                    <>
                      {' · '}
                      <button
                        type="button"
                        onClick={() => setLocation('/upgrade')}
                        className="text-primary hover:underline"
                      >
                        Upgrade
                      </button>
                    </>
                  )}
                </p>
              )}
            </>
          )}
        </div>
      </main>

      <AlertDialog
        open={!!vaultToDelete}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setVaultToDelete(null);
            setDeletePassword('');
            setDeleteError('');
            setShowDeletePw(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              Delete vault?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  This will permanently delete <strong>"{vaultToDelete?.name}"</strong>
                  {vaultToDelete?.isCloud && vaultToDelete?.isLocal && ' from this device and the cloud'}
                  {vaultToDelete?.isCloud && !vaultToDelete?.isLocal && ' from the cloud'}
                  {!vaultToDelete?.isCloud && vaultToDelete?.isLocal && ' from this device'}.
                </p>
                <p className="text-destructive font-medium">
                  All passwords, notes, and other data inside it will be lost. This cannot be undone.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <Label htmlFor="delete-master-password">
              Enter the master password for this vault to confirm
            </Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
              <Input
                id="delete-master-password"
                data-testid="input-delete-master-password"
                type={showDeletePw ? 'text' : 'password'}
                placeholder="Master password"
                value={deletePassword}
                onChange={(e) => { setDeletePassword(e.target.value); setDeleteError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !isDeleting) handleConfirmDelete(); }}
                disabled={isDeleting}
                className="pl-10 pr-10"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowDeletePw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showDeletePw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {deleteError && (
              <p className="text-destructive text-sm" data-testid="text-delete-error">{deleteError}</p>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-delete-vault"
              onClick={(e) => { e.preventDefault(); handleConfirmDelete(); }}
              disabled={isDeleting || !deletePassword}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting…' : 'Delete vault'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={showCreateDialog}
        onOpenChange={(open) => { if (!open && !isCreating) { setShowCreateDialog(false); resetCreateForm(); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              Create a new vault
            </DialogTitle>
            <DialogDescription>
              Each vault is encrypted with its own master password. You'll need this password every time you unlock it.
            </DialogDescription>
          </DialogHeader>

          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
              atVaultLimit
                ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300'
                : 'border-border bg-muted/40 text-muted-foreground'
            }`}
            data-testid="text-dialog-vault-usage"
          >
            <Zap className={`w-4 h-4 ${atVaultLimit ? 'text-amber-500' : 'text-primary'}`} />
            <span className="flex-1">
              {combinedVaultCount} of {vaultLimit === -1 ? '∞' : vaultLimit} vaults used
              {atVaultLimit && vaultLimit !== -1 && ' — upgrade to add more'}
            </span>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-vault-name">Vault name</Label>
              <Input
                id="new-vault-name"
                data-testid="input-new-vault-name"
                placeholder="e.g. Personal, Work, Family"
                value={newVaultName}
                onChange={(e) => setNewVaultName(e.target.value)}
                disabled={isCreating}
                autoFocus
              />
            </div>

            {isNativeApp() && (
              <div className="space-y-2">
                <Label>Storage type</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    data-testid="button-vault-type-local"
                    onClick={() => setNewVaultType('local')}
                    disabled={isCreating}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      newVaultType === 'local'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <ShieldCheck className="w-4 h-4 text-primary" />
                      <span className="font-medium text-sm">Local</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Stored only on this device.</p>
                  </button>
                  <button
                    type="button"
                    data-testid="button-vault-type-cloud"
                    onClick={() => setNewVaultType('cloud')}
                    disabled={isCreating || !isPaid}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      newVaultType === 'cloud'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40'
                    } ${!isPaid ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Cloud className="w-4 h-4 text-blue-500" />
                      <span className="font-medium text-sm">Cloud {!isPaid && <span className="text-xs text-amber-600">(Pro)</span>}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Synced across your devices.</p>
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="new-vault-password">Master password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                <Input
                  id="new-vault-password"
                  data-testid="input-new-vault-password"
                  type={showNewPw ? 'text' : 'password'}
                  placeholder="At least 8 characters"
                  value={newVaultPassword}
                  onChange={(e) => setNewVaultPassword(e.target.value)}
                  disabled={isCreating}
                  className="pl-10 pr-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-vault-confirm">Confirm master password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                <Input
                  id="new-vault-confirm"
                  data-testid="input-new-vault-confirm"
                  type={showNewPw ? 'text' : 'password'}
                  placeholder="Re-enter password"
                  value={newVaultConfirm}
                  onChange={(e) => setNewVaultConfirm(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !isCreating) handleCreateVault(); }}
                  disabled={isCreating}
                  className="pl-10"
                  autoComplete="new-password"
                />
              </div>
            </div>

            {createError && (
              <p className="text-destructive text-sm" data-testid="text-create-error">{createError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setShowCreateDialog(false); resetCreateForm(); }}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              data-testid="button-confirm-create-vault"
              onClick={handleCreateVault}
              disabled={isCreating || atVaultLimit}
            >
              {isCreating ? 'Creating…' : atVaultLimit ? 'Limit reached' : 'Create vault'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
