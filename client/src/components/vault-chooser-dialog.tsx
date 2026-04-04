/**
 * Vault Chooser Dialog
 * 
 * Shows a list of vaults when multiple vaults match the entered password.
 * Allows user to select which vault to unlock.
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, Star, Clock, Shield } from 'lucide-react';
import { format } from 'date-fns';
import type { VaultInfo } from '@/contexts/multi-vault-auth-context';

interface VaultChooserDialogProps {
  open: boolean;
  onClose: () => void;
  vaults: VaultInfo[];
  onSelect: (vaultId: string) => void;
}

export function VaultChooserDialog({ open, onClose, vaults, onSelect }: VaultChooserDialogProps) {
  // Sort vaults: default first, then by last unlocked
  const sortedVaults = [...vaults].sort((a, b) => {
    if (a.isDefault && !b.isDefault) return -1;
    if (!a.isDefault && b.isDefault) return 1;
    
    const aTime = a.lastUnlockedAt?.getTime() || 0;
    const bTime = b.lastUnlockedAt?.getTime() || 0;
    return bTime - aTime;
  });

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Choose Vault
          </DialogTitle>
          <DialogDescription>
            Multiple vaults match this password. Select which vault to unlock.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 mt-4">
          {sortedVaults.map((vault) => (
            <button
              key={vault.id}
              onClick={() => onSelect(vault.id)}
              disabled={vault.isLocked}
              className={`w-full p-4 rounded-lg border text-left transition-colors ${
                vault.isLocked 
                  ? 'bg-muted/50 border-muted cursor-not-allowed opacity-60'
                  : 'bg-card border-border hover:border-primary hover:bg-accent'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{vault.name}</span>
                    {vault.isDefault && (
                      <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                        <Star className="w-3 h-3 mr-1" />
                        Default
                      </Badge>
                    )}
                    {vault.isLocked && (
                      <Badge variant="destructive" className="text-xs">
                        <Lock className="w-3 h-3 mr-1" />
                        Locked
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {vault.lastUnlockedAt 
                        ? `Last opened ${format(vault.lastUnlockedAt, 'MMM d, yyyy')}`
                        : 'Never opened'}
                    </span>
                  </div>
                </div>
                
                {!vault.isLocked && (
                  <div className="text-primary">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                )}
              </div>
              
              {vault.isLocked && (
                <p className="text-xs text-destructive mt-2">
                  Upgrade to Premium to access this vault
                </p>
              )}
            </button>
          ))}
        </div>
        
        <div className="mt-4 pt-4 border-t">
          <Button variant="outline" className="w-full" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
