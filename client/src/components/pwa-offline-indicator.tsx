import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { WifiOff, Wifi, RefreshCw, Download } from 'lucide-react';
import { usePWA } from '@/lib/pwa';

export function PWAOfflineIndicator() {
  const { isOnline, updateAvailable, applyUpdate, networkInfo } = usePWA();
  const [showOfflineAlert, setShowOfflineAlert] = useState(false);
  const [showUpdateAlert, setShowUpdateAlert] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setShowOfflineAlert(true);
    } else {
      // Hide offline alert when back online, but with a small delay
      const timer = setTimeout(() => setShowOfflineAlert(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  useEffect(() => {
    if (updateAvailable) {
      setShowUpdateAlert(true);
    }
  }, [updateAvailable]);

  if (!showOfflineAlert && !showUpdateAlert) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm space-y-2" data-testid="pwa-indicators">
      {/* Offline Indicator */}
      {showOfflineAlert && (
        <Alert 
          className={`border-2 transition-all duration-300 ${
            isOnline 
              ? 'border-green-500 bg-green-50 dark:bg-green-950' 
              : 'border-orange-500 bg-orange-50 dark:bg-orange-950'
          }`}
          data-testid="offline-indicator"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {isOnline ? (
                <Wifi className="w-4 h-4 text-green-600 dark:text-green-400" />
              ) : (
                <WifiOff className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              )}
              <AlertDescription className={
                isOnline 
                  ? 'text-green-800 dark:text-green-200' 
                  : 'text-orange-800 dark:text-orange-200'
              }>
                {isOnline ? 'Back online!' : 'Working offline'}
                {networkInfo.effectiveType && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {networkInfo.effectiveType.toUpperCase()}
                  </Badge>
                )}
              </AlertDescription>
            </div>
            {!isOnline && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.location.reload()}
                className="ml-2"
                data-testid="button-retry-connection"
              >
                <RefreshCw className="w-3 h-3" />
              </Button>
            )}
          </div>
          {!isOnline && (
            <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
              Your data is secured locally and will sync when reconnected.
            </p>
          )}
        </Alert>
      )}

      {/* Update Available Indicator */}
      {showUpdateAlert && updateAvailable && (
        <Alert 
          className="border-2 border-primary bg-primary/10"
          data-testid="update-indicator"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Download className="w-4 h-4 text-primary" />
              <AlertDescription className="text-primary">
                App update available
              </AlertDescription>
            </div>
            <div className="flex space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowUpdateAlert(false)}
                className="text-xs"
                data-testid="button-dismiss-update"
              >
                Later
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  await applyUpdate();
                  setShowUpdateAlert(false);
                }}
                className="text-xs"
                data-testid="button-apply-update"
              >
                Update
              </Button>
            </div>
          </div>
          <p className="text-xs text-primary mt-1">
            New features and improvements are ready to install.
          </p>
        </Alert>
      )}
    </div>
  );
}