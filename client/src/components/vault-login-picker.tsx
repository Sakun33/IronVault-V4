import { useState, useEffect } from 'react';
import { vaultManager, type VaultInfo } from '@/lib/vault-manager';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Fingerprint, Star, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface VaultLoginPickerProps {
  onSelectVault: (vaultId: string) => void;
  onBiometricUnlock: (vaultId: string) => void;
  selectedVaultId: string | null;
}

export function VaultLoginPicker({ onSelectVault, onBiometricUnlock, selectedVaultId }: VaultLoginPickerProps) {
  const [vaults, setVaults] = useState<VaultInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadVaults();
  }, []);

  const loadVaults = async () => {
    try {
      setIsLoading(true);
      vaultManager.migrateExistingVault();
      const vaultList = await vaultManager.listVaults();
      setVaults(vaultList);
      
      if (!selectedVaultId && vaultList.length > 0) {
        const defaultVault = vaultList.find(v => v.isDefault) || vaultList[0];
        onSelectVault(defaultVault.id);
      }
    } catch (error) {
      console.error('Failed to load vaults:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-4 text-sm text-muted-foreground">
        Loading vaults...
      </div>
    );
  }

  if (vaults.length <= 1) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-foreground">Select Vault</div>
      <div className="space-y-2">
        {vaults.map((vault) => (
          <Card
            key={vault.id}
            className={`cursor-pointer transition-all ${
              selectedVaultId === vault.id 
                ? 'ring-2 ring-primary bg-primary/5' 
                : 'hover-elevate'
            }`}
            onClick={() => onSelectVault(vault.id)}
            data-testid={`card-login-vault-${vault.id}`}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: vault.iconColor + '20' }}
                >
                  <ShieldCheck className="w-5 h-5" style={{ color: vault.iconColor }} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{vault.name}</span>
                    {vault.isDefault && (
                      <Badge variant="secondary" className="text-xs">
                        <Star className="w-3 h-3 mr-1" />
                        Default
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Last used {formatDistanceToNow(vault.lastAccessedAt, { addSuffix: true })}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {vault.biometricEnabled && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onBiometricUnlock(vault.id);
                      }}
                      className="h-9 w-9"
                      data-testid={`button-biometric-unlock-${vault.id}`}
                      aria-label="Unlock with biometrics"
                    >
                      <Fingerprint className="w-5 h-5 text-primary" />
                    </Button>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
