import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Chrome, Shield, Check, Copy, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ExtensionPairingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExtensionPairingModal({ open, onOpenChange }: ExtensionPairingModalProps) {
  const { toast } = useToast();
  
  const [pairingCode, setPairingCode] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPairing, setIsPairing] = useState(false);
  const [pairedExtensions, setPairedExtensions] = useState<Array<{
    id: string;
    name: string;
    pairedAt: string;
    lastUsed?: string;
  }>>([]);

  // Generate a new pairing code
  const generatePairingCode = async () => {
    setIsGenerating(true);
    try {
      // Generate a secure 6-digit pairing code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setPairingCode(code);
      
      // Store the code temporarily on the server for verification
      const response = await fetch('/api/extension/generate-pairing-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code,
          expiresIn: 300 // 5 minutes
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate pairing code');
      }
      
      toast({
        title: "Pairing Code Generated",
        description: "Enter this code in your browser extension to pair it with IronVault",
      });
      
    } catch (error) {
      console.error('Failed to generate pairing code:', error);
      toast({
        title: "Error",
        description: "Failed to generate pairing code",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Copy pairing code to clipboard
  const copyPairingCode = async () => {
    try {
      await navigator.clipboard.writeText(pairingCode);
      toast({
        title: "Copied",
        description: "Pairing code copied to clipboard",
      });
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Load paired extensions
  const loadPairedExtensions = async () => {
    try {
      const response = await fetch('/api/extension/paired-devices');
      if (response.ok) {
        const data = await response.json();
        setPairedExtensions(data.devices || []);
      }
    } catch (error) {
      console.error('Failed to load paired extensions:', error);
    }
  };

  // Revoke extension pairing
  const revokeExtension = async (extensionId: string) => {
    try {
      const response = await fetch('/api/extension/revoke-pairing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extensionId })
      });
      
      if (response.ok) {
        toast({
          title: "Extension Revoked",
          description: "Extension access has been revoked",
        });
        loadPairedExtensions();
      }
    } catch (error) {
      console.error('Failed to revoke extension:', error);
      toast({
        title: "Error",
        description: "Failed to revoke extension access",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (open) {
      loadPairedExtensions();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="extension-pairing-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Chrome className="w-5 h-5" />
            Browser Extension Pairing
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Security Notice */}
          <Alert>
            <Shield className="w-4 h-4" />
            <AlertDescription>
              Pairing allows browser extensions to securely auto-fill passwords from your vault. 
              Only pair extensions you trust and revoke access when no longer needed.
            </AlertDescription>
          </Alert>

          {/* Pairing Section */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Pair New Extension</Label>
              <p className="text-sm text-muted-foreground">
                Generate a pairing code and enter it in your IronVault browser extension.
              </p>
            </div>
            
            {pairingCode ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={pairingCode}
                    readOnly
                    className="font-mono text-lg text-center"
                    data-testid="pairing-code-display"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyPairingCode}
                    data-testid="copy-pairing-code"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="text-sm text-muted-foreground text-center">
                  Code expires in 5 minutes. Enter this code in your extension popup.
                </div>
                
                <Button
                  variant="outline"
                  onClick={generatePairingCode}
                  disabled={isGenerating}
                  className="w-full"
                  data-testid="regenerate-code"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Generate New Code
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <Button
                onClick={generatePairingCode}
                disabled={isGenerating}
                className="w-full"
                data-testid="generate-pairing-code"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Chrome className="w-4 h-4 mr-2" />
                    Generate Pairing Code
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Paired Extensions */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Paired Extensions</Label>
              <p className="text-sm text-muted-foreground">
                Manage extensions that have access to your vault.
              </p>
            </div>
            
            {pairedExtensions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Chrome className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No extensions paired</p>
                <p className="text-sm">Generate a pairing code to connect your first extension</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pairedExtensions.map((extension) => (
                  <div
                    key={extension.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Check className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">{extension.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Paired: {new Date(extension.pairedAt).toLocaleDateString()}
                          {extension.lastUsed && (
                            <span className="ml-2">
                              • Last used: {new Date(extension.lastUsed).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => revokeExtension(extension.id)}
                      data-testid={`revoke-extension-${extension.id}`}
                    >
                      Revoke
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="font-medium">How to pair:</div>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Install the IronVault browser extension</li>
              <li>Click "Generate Pairing Code" above</li>
              <li>Open the extension popup and click "Pair with Vault"</li>
              <li>Enter the pairing code when prompted</li>
              <li>Extension will be paired and ready to use</li>
            </ol>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}