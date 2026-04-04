import { useState } from 'react';
import { useVaultSelection } from '@/contexts/vault-selection-context';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ShieldCheck, ChevronDown, Check, Plus, Settings } from 'lucide-react';
import { Link } from 'wouter';

interface VaultSelectorProps {
  onVaultSwitch?: () => void;
  compact?: boolean;
}

export function VaultSelector({ onVaultSwitch, compact = false }: VaultSelectorProps) {
  const { vaults, activeVault, switchVault, canCreateVault } = useVaultSelection();
  const [isOpen, setIsOpen] = useState(false);

  const handleVaultSelect = async (vaultId: string) => {
    if (vaultId !== activeVault?.id) {
      await switchVault(vaultId);
      onVaultSwitch?.();
    }
    setIsOpen(false);
  };

  if (!activeVault) return null;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className={compact ? "gap-1 px-2" : "gap-2 w-full justify-start"}
          data-testid="button-vault-selector"
        >
          <div 
            className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: activeVault.iconColor + '20' }}
          >
            <ShieldCheck className="w-3.5 h-3.5" style={{ color: activeVault.iconColor }} />
          </div>
          {!compact && (
            <>
              <span className="truncate flex-1 text-left">{activeVault.name}</span>
              <ChevronDown className="w-4 h-4 flex-shrink-0 opacity-50" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
          Switch Vault
        </div>
        {vaults.map((vault) => (
          <DropdownMenuItem
            key={vault.id}
            onClick={() => handleVaultSelect(vault.id)}
            className="gap-2"
            data-testid={`menu-item-vault-${vault.id}`}
          >
            <div 
              className="w-6 h-6 rounded flex items-center justify-center"
              style={{ backgroundColor: vault.iconColor + '20' }}
            >
              <ShieldCheck className="w-3.5 h-3.5" style={{ color: vault.iconColor }} />
            </div>
            <span className="flex-1 truncate">{vault.name}</span>
            {vault.id === activeVault.id && (
              <Check className="w-4 h-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
        
        <DropdownMenuSeparator />
        
        {canCreateVault && (
          <DropdownMenuItem asChild>
            <Link href="/vaults" className="gap-2" data-testid="link-create-vault">
              <Plus className="w-4 h-4" />
              <span>Create New Vault</span>
            </Link>
          </DropdownMenuItem>
        )}
        
        <DropdownMenuItem asChild>
          <Link href="/vaults" className="gap-2" data-testid="link-manage-vaults">
            <Settings className="w-4 h-4" />
            <span>Manage Vaults</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
