/**
 * Vault Inline Prompt
 * 
 * Shows an inline autofill prompt when user focuses on password fields or
 * elements with data-vault-ident attribute.
 */

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Shield, Key, Search, Clock, X, ChevronDown, Loader2 } from 'lucide-react';
import { VaultEntry, decryptSecret, extractDomain } from '@/lib/vault-autofill-crypto';
import { localVaultStore, VaultFilter } from '@/lib/vault-autofill-store';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export interface VaultInlinePromptProps {
  targetElement: HTMLElement;
  onSelect: (value: string) => void;
  onDismiss: () => void;
  domain?: string;
  type?: VaultEntry['type'];
}

export function VaultInlinePrompt({
  targetElement,
  onSelect,
  onDismiss,
  domain: providedDomain,
  type = 'password',
}: VaultInlinePromptProps) {
  const { getMasterKey } = useAuth();
  const { toast } = useToast();
  
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<VaultEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllDomains, setShowAllDomains] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const domain = providedDomain || extractDomain(window.location.hostname || 'localhost');

  // Calculate position relative to target element
  useEffect(() => {
    const updatePosition = () => {
      const rect = targetElement.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [targetElement]);

  // Load entries on mount
  useEffect(() => {
    const loadEntries = async () => {
      setIsLoading(true);
      try {
        await localVaultStore.init();
        
        const filter: VaultFilter = {
          type,
        };
        
        if (!showAllDomains) {
          filter.domain = domain;
        }

        const allEntries = await localVaultStore.fetchEntries(filter);
        setEntries(allEntries);
        setFilteredEntries(allEntries);
      } catch (error) {
        console.error('Failed to load vault entries:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadEntries();
  }, [domain, type, showAllDomains]);

  // Filter entries based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredEntries(entries);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = entries.filter(entry =>
      entry.title.toLowerCase().includes(query) ||
      entry.domain.toLowerCase().includes(query) ||
      entry.username?.toLowerCase().includes(query)
    );
    setFilteredEntries(filtered);
  }, [searchQuery, entries]);

  const handleSelectEntry = async (entry: VaultEntry) => {
    try {
      // Get master key
      const masterKey = await getMasterKey();
      if (!masterKey) {
        throw new Error('Master key not available');
      }

      // Decrypt the secret
      const decryptedSecret = await decryptSecret(entry.encryptedPayload, masterKey);

      // Update last used timestamp
      await localVaultStore.updateLastUsed(entry.id);

      // Autofill the field
      onSelect(decryptedSecret);

      toast({
        title: "Auto-filled",
        description: `${entry.title} has been filled`,
      });

      onDismiss();
    } catch (error) {
      console.error('Failed to decrypt and autofill:', error);
      toast({
        title: "Autofill Failed",
        description: error instanceof Error ? error.message : "Failed to decrypt entry",
        variant: "destructive",
      });
    }
  };

  if (!showPicker) {
    // Show compact pill prompt
    return (
      <div
        ref={containerRef}
        className="fixed z-50 animate-in fade-in slide-in-from-top-2"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          minWidth: `${Math.max(position.width, 200)}px`,
        }}
      >
        <div className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg shadow-lg border border-primary">
          <Shield className="w-4 h-4" />
          <span className="text-sm font-medium">Fetch from SecureVault</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPicker(true)}
            className="h-6 px-2 bg-primary/90 hover:bg-primary text-primary-foreground"
          >
            <ChevronDown className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="h-6 w-6 p-0 bg-primary/90 hover:bg-primary text-primary-foreground ml-auto"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>
    );
  }

  // Show full picker
  return (
    <div
      ref={containerRef}
      className="fixed z-50 animate-in fade-in slide-in-from-top-2"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        minWidth: `${Math.max(position.width, 300)}px`,
        maxWidth: '400px',
      }}
    >
      <Card className="shadow-2xl border-2 border-blue-500 dark:border-blue-600">
        <CardContent className="p-0">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border bg-muted">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm text-foreground">
                  SecureVault Autofill
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismiss}
                className="h-6 w-6 p-0"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
            
            {/* Search */}
            <div className="relative">
              <Search className="w-3 h-3 text-muted-foreground absolute left-2 top-1/2 transform -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Search entries..."
                className="pl-7 pr-3 py-1 h-8 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          {/* Entries List */}
          <div className="max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="p-6 text-center">
                <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Loading entries...</p>
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="p-6 text-center">
                <Key className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-1">
                  {searchQuery ? 'No matching entries' : `No saved entries for ${domain}`}
                </p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setShowAllDomains(true)}
                  className="text-xs"
                >
                  Show all entries
                </Button>
              </div>
            ) : (
              <div className="py-2">
                {filteredEntries.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => handleSelectEntry(entry)}
                    className="w-full px-4 py-3 flex items-start gap-3 hover:bg-accent transition-colors text-left"
                  >
                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Key className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm text-foreground truncate">
                          {entry.title}
                        </span>
                        {entry.domain !== domain && (
                          <Badge variant="outline" className="text-xs">
                            {entry.domain}
                          </Badge>
                        )}
                      </div>
                      {entry.username && (
                        <div className="text-xs text-muted-foreground truncate">
                          {entry.username}
                        </div>
                      )}
                      {entry.lastUsed && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Clock className="w-3 h-3" />
                          Last used {format(entry.lastUsed, 'MMM d, yyyy')}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {!showAllDomains && entries.length > 0 && (
            <div className="px-4 py-2 border-t border-border bg-muted">
              <Button
                variant="link"
                size="sm"
                onClick={() => setShowAllDomains(true)}
                className="text-xs w-full"
              >
                Show all entries ({entries.length} from this domain)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

