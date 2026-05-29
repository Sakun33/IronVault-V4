// Travel Mode Settings card.
//
// Lets the user pick which vaults remain visible during travel mode. Disabling
// requires master-password verification so a casual border-agent toggle can't
// reveal everything.

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plane, ShieldAlert, Lock, Eye, EyeOff } from 'lucide-react';
import { useVaultSelection } from '@/contexts/vault-selection-context';
import {
  enableTravelMode,
  disableTravelMode,
  isTravelModeActive,
  getSafeVaultIds,
  getHiddenSections,
  subscribeTravelMode,
} from '@/lib/travel-mode';

// Section catalog shown in the Travel Mode picker. Keep this list focused on
// sections that hold sensitive data a border agent might ask about. The IDs
// must match the nav item ids in App.tsx (sidebar + bottom tabs + MoreSheet).
const SENSITIVE_SECTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'passwords', label: 'Passwords' },
  { id: 'cards', label: 'Credit Cards' },
  { id: 'identities', label: 'Identities' },
  { id: 'documents', label: 'Documents' },
  { id: 'api-keys', label: 'API Keys' },
  { id: 'crypto', label: 'Crypto Wallets' },
  { id: 'wifi', label: 'Wi-Fi Passwords' },
  { id: 'licenses', label: 'Software Licenses' },
  { id: 'bookmarks', label: 'Bookmarks' },
  { id: 'qr', label: 'QR Vault' },
  { id: 'investments', label: 'Investments' },
  { id: 'bank-statements', label: 'Bank Statements' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'subscriptions', label: 'Subscriptions' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'tax', label: 'Tax Documents' },
  { id: 'notes', label: 'Notes' },
];
import { vaultStorage } from '@/lib/storage';
import { useToast } from '@/hooks/use-toast';

export default function TravelModeCard() {
  const { allVaults, activeVault } = useVaultSelection();
  const { toast } = useToast();

  const [active, setActive] = useState<boolean>(() => isTravelModeActive());
  const [showEnableDialog, setShowEnableDialog] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hiddenSectionIds, setHiddenSectionIds] = useState<Set<string>>(new Set());
  const [disablePassword, setDisablePassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [disableError, setDisableError] = useState('');
  const [disabling, setDisabling] = useState(false);

  useEffect(() => subscribeTravelMode(() => setActive(isTravelModeActive())), []);

  const safeIds = active ? getSafeVaultIds() : [];
  const activeHiddenSections = active ? getHiddenSections() : [];

  const openEnable = () => {
    // Default-include the currently active vault so users don't accidentally
    // hide the vault they're using and lock themselves out of switching.
    const initial = new Set<string>();
    if (activeVault?.id) initial.add(activeVault.id);
    setSelectedIds(initial);
    // Sensible defaults for sections to hide at a border — financial + most
    // sensitive vault sections. User can toggle these before confirming.
    setHiddenSectionIds(new Set([
      'passwords', 'cards', 'identities', 'api-keys',
      'crypto', 'investments', 'bank-statements',
    ]));
    setShowEnableDialog(true);
  };

  const handleEnable = () => {
    if (selectedIds.size === 0) {
      toast({
        title: 'Pick at least one vault',
        description: 'You must keep at least one vault visible.',
        variant: 'destructive',
      });
      return;
    }
    enableTravelMode(Array.from(selectedIds), Array.from(hiddenSectionIds));
    setShowEnableDialog(false);
    const sectionsHidden = hiddenSectionIds.size;
    toast({
      title: 'Travel Mode enabled',
      description: `${selectedIds.size} vault${selectedIds.size === 1 ? '' : 's'} visible · ${sectionsHidden} section${sectionsHidden === 1 ? '' : 's'} hidden.`,
    });
  };

  const toggleSection = (id: string) => {
    setHiddenSectionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDisable = async () => {
    setDisableError('');
    if (!disablePassword.trim()) {
      setDisableError('Master password is required.');
      return;
    }
    setDisabling(true);
    try {
      const ok = await vaultStorage.verifyMasterPassword(disablePassword);
      if (!ok) {
        setDisableError('Incorrect master password.');
        setDisabling(false);
        return;
      }
      const cleared = disableTravelMode({ verified: true });
      if (cleared) {
        setShowDisableDialog(false);
        setDisablePassword('');
        toast({
          title: 'Travel Mode disabled',
          description: 'All vaults are visible again.',
        });
      } else {
        setDisableError('Could not disable travel mode.');
      }
    } catch (e: any) {
      setDisableError(e?.message || 'Verification failed.');
    } finally {
      setDisabling(false);
    }
  };

  const toggleId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      <Card data-testid="travel-mode-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plane className="w-5 h-5 text-primary" />
            Travel Mode
            {active && (
              <Badge variant="destructive" className="ml-2">Active</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Crossing a border? Travel Mode hides sensitive vaults so only the
            ones you choose are visible. Disabling requires your master
            password — so a quick toggle can't reveal everything.
          </p>

          {!active ? (
            <Button onClick={openEnable} data-testid="enable-travel-mode">
              <Plane className="w-4 h-4 mr-2" />
              Enable Travel Mode
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <div className="font-semibold text-destructive">Travel Mode is active</div>
                    <div className="text-muted-foreground mt-0.5">
                      {safeIds.length} of {allVaults.length} vault{allVaults.length === 1 ? '' : 's'} visible
                      {activeHiddenSections.length > 0 && (
                        <> · {activeHiddenSections.length} section{activeHiddenSections.length === 1 ? '' : 's'} hidden</>
                      )}
                      . Disabling requires your master password.
                    </div>
                  </div>
                </div>
              </div>
              <Button
                variant="destructive"
                onClick={() => setShowDisableDialog(true)}
                data-testid="disable-travel-mode"
              >
                <Lock className="w-4 h-4 mr-2" />
                Disable (requires master password)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enable dialog */}
      <Dialog open={showEnableDialog} onOpenChange={setShowEnableDialog}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plane className="w-5 h-5 text-primary" />
              Enable Travel Mode
            </DialogTitle>
            <DialogDescription>
              Choose which vaults remain visible. Everything else is hidden
              until you disable Travel Mode.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[440px] overflow-y-auto py-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Vaults to keep visible</div>
              <div className="space-y-1.5">
                {allVaults.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No vaults found.</p>
                ) : (
                  allVaults.map(v => (
                    <label
                      key={v.id}
                      className="flex items-center gap-3 p-2 rounded-lg border border-border hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedIds.has(v.id)}
                        onCheckedChange={() => toggleId(v.id)}
                        data-testid={`travel-vault-${v.id}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{v.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {v.id === activeVault?.id ? 'Currently active' : 'Other vault'}
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Sections to hide</div>
              <p className="text-xs text-muted-foreground mb-2">
                Picked sections vanish from the sidebar, bottom tabs, and menu until Travel Mode is disabled.
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {SENSITIVE_SECTIONS.map(s => (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={hiddenSectionIds.has(s.id)}
                      onCheckedChange={() => toggleSection(s.id)}
                      data-testid={`travel-section-${s.id}`}
                    />
                    <span className="text-sm truncate">{s.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowEnableDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEnable}
              disabled={selectedIds.size === 0}
              data-testid="confirm-enable-travel-mode"
            >
              Enable Travel Mode
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable dialog */}
      <Dialog open={showDisableDialog} onOpenChange={(open) => { if (!open) { setShowDisableDialog(false); setDisablePassword(''); setDisableError(''); } }}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Disable Travel Mode
            </DialogTitle>
            <DialogDescription>
              Enter your master password to reveal all vaults again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="travel-disable-password">Master Password</Label>
            <div className="relative">
              <Input
                id="travel-disable-password"
                type={showPassword ? 'text' : 'password'}
                value={disablePassword}
                onChange={(e) => { setDisablePassword(e.target.value); setDisableError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleDisable(); }}
                disabled={disabling}
                data-testid="travel-disable-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {disableError && (
              <p className="text-xs text-destructive">{disableError}</p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDisableDialog(false)} disabled={disabling}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisable}
              disabled={disabling || !disablePassword.trim()}
              data-testid="confirm-disable-travel-mode"
            >
              {disabling ? 'Verifying…' : 'Disable Travel Mode'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
