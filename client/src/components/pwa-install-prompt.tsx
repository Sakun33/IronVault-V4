import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Smartphone, Monitor, Download, Star } from 'lucide-react';
import { usePWA } from '@/lib/pwa';

interface PWAInstallPromptProps {
  onDismiss?: () => void;
  className?: string;
}

export function PWAInstallPrompt({ onDismiss, className = '' }: PWAInstallPromptProps) {
  const { installPrompt } = usePWA();
  const [dismissed, setDismissed] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Show prompt after a delay if install is available and not dismissed
    if (installPrompt.canInstall && !installPrompt.isInstalled && !dismissed) {
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [installPrompt.canInstall, installPrompt.isInstalled, dismissed]);

  const handleInstall = async () => {
    try {
      await installPrompt.install();
      setShowPrompt(false);
    } catch (error) {
      console.error('Failed to install PWA:', error);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShowPrompt(false);
    onDismiss?.();
  };

  // Don't show if already installed, dismissed, or can't install
  if (!showPrompt || installPrompt.isInstalled || !installPrompt.canInstall) {
    return null;
  }

  return (
    <Card className={`fixed bottom-4 right-4 z-50 max-w-sm shadow-lg border-2 border-primary/20 ${className}`} data-testid="pwa-install-prompt">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-1 rounded-lg bg-primary/10">
              <Smartphone className="w-4 h-4 text-primary" />
            </div>
            <CardTitle className="text-lg">Install IronVault</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-6 w-6 p-0"
            data-testid="button-dismiss-install"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <CardDescription>
          Get the full IronVault experience with offline access and faster loading.
        </CardDescription>
        
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center space-x-2">
            <Monitor className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Works offline</span>
          </div>
          <div className="flex items-center space-x-2">
            <Download className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Fast loading</span>
          </div>
          <div className="flex items-center space-x-2">
            <Star className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Native feel</span>
          </div>
          <div className="flex items-center space-x-2">
            <Smartphone className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Home screen</span>
          </div>
        </div>
        
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleDismiss}
            className="flex-1"
            data-testid="button-not-now"
          >
            Not now
          </Button>
          <Button 
            size="sm" 
            onClick={handleInstall}
            className="flex-1"
            data-testid="button-install-pwa"
          >
            <Download className="w-4 h-4 mr-2" />
            Install
          </Button>
        </div>
        
        <p className="text-xs text-muted-foreground text-center">
          Install IronVault on your device for quick access and better performance.
        </p>
      </CardContent>
    </Card>
  );
}

// Simple version for inline use
export function PWAInstallButton({ className = '' }: { className?: string }) {
  const { installPrompt } = usePWA();

  if (!installPrompt.canInstall || installPrompt.isInstalled) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={installPrompt.install}
      className={className}
      data-testid="button-install-inline"
    >
      <Download className="w-4 h-4 mr-2" />
      Install App
    </Button>
  );
}