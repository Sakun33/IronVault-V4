/**
 * Vault Save Modal
 * 
 * Prompts user to save a secret (password, API key, etc.) to the autofill vault.
 * Appears after creating/updating sensitive information.
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Shield, Save, X, Ban, Loader2 } from 'lucide-react';
import { VaultEntry, encryptSecret, extractDomain } from '@/lib/vault-autofill-crypto';
import { localVaultStore } from '@/lib/vault-autofill-store';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';

export interface VaultSaveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  secret: string; // The plaintext secret to save
  title: string; // Default title (e.g., "GitHub Login")
  username?: string; // Optional username
  type: VaultEntry['type'];
  domain?: string; // Optional domain (will be extracted from current URL if not provided)
  tags?: string[];
}

export function VaultSaveModal({
  open,
  onOpenChange,
  secret,
  title: defaultTitle,
  username,
  type,
  domain: providedDomain,
  tags: providedTags,
}: VaultSaveModalProps) {
  const { getMasterKey } = useAuth();
  const { toast } = useToast();
  
  const [title, setTitle] = useState(defaultTitle);
  const [entryTags, setEntryTags] = useState<string[]>(providedTags || []);
  const [isSaving, setIsSaving] = useState(false);
  
  // Extract domain from current URL if not provided
  const domain = providedDomain || extractDomain(window.location.hostname || 'localhost');

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      // Get master key from auth context
      const masterKey = await getMasterKey();
      if (!masterKey) {
        throw new Error('Master key not available. Please unlock vault first.');
      }

      // Encrypt the secret
      const encryptedPayload = await encryptSecret(secret, masterKey);

      // Create vault entry
      const entry: VaultEntry = {
        id: crypto.randomUUID(),
        domain,
        title,
        username,
        type,
        encryptedPayload,
        tags: entryTags,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Save to local vault store
      await localVaultStore.saveEntry(entry);

      toast({
        title: "Saved to Vault",
        description: `${title} has been securely saved to your autofill vault.`,
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save to vault:', error);
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Failed to save to vault",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleNeverForSite = async () => {
    setIsSaving(true);
    
    try {
      await localVaultStore.markNever(domain);
      
      toast({
        title: "Domain Excluded",
        description: `Won't show save prompts for ${domain} anymore.`,
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Failed to mark never:', error);
      toast({
        title: "Error",
        description: "Failed to mark domain",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleNotNow = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <span>Save to SecureVault?</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Domain Badge */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {domain}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {type}
            </Badge>
          </div>

          {/* Title Input */}
          <div className="space-y-2">
            <Label htmlFor="entry-title">Entry Title</Label>
            <Input
              id="entry-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., GitHub Login, API Key"
              autoFocus
            />
          </div>

          {/* Username (if provided) */}
          {username && (
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={username} disabled className="bg-muted" />
            </div>
          )}

          {/* Secret Preview (masked) */}
          <div className="space-y-2">
            <Label>Secret</Label>
            <div className="p-3 bg-muted rounded-lg border border-border">
              <span className="font-mono text-sm text-foreground">
                {'•'.repeat(Math.min(secret.length, 20))}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Your secret will be encrypted with AES-256-GCM before storage.
            </p>
          </div>

          {/* Tags (optional) */}
          <div className="space-y-2">
            <Label htmlFor="entry-tags">Tags (comma-separated, optional)</Label>
            <Input
              id="entry-tags"
              value={entryTags.join(', ')}
              onChange={(e) => setEntryTags(e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
              placeholder="work, github, important"
            />
          </div>

          <div className="p-3 bg-primary/10 rounded-lg border border-primary/30">
            <p className="text-xs text-primary">
              <strong>Auto-fill:</strong> This entry will be available for quick autofill when you need it. 
              Access it by clicking the vault icon in password fields.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleNeverForSite}
            disabled={isSaving}
            className="w-full sm:w-auto"
          >
            <Ban className="w-4 h-4 mr-2" />
            Never for this site
          </Button>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="ghost"
              onClick={handleNotNow}
              disabled={isSaving}
              className="flex-1 sm:flex-initial"
            >
              Not now
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !title.trim()}
              className="flex-1 sm:flex-initial bg-primary hover:bg-primary/90"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Securely
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

