import React from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Bell, Fingerprint, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PermissionEducationProps {
  type: 'notifications' | 'biometrics';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAllow: () => void;
  onDeny: () => void;
}

const permissionContent = {
  notifications: {
    icon: Bell,
    title: 'Get subscription reminders',
    description: 'IronVault can notify you before your subscriptions renew so you can review or cancel them.',
    benefits: [
      'Reminder 3 days before renewal',
      'Day-of renewal alerts',
      'All notifications stay local—no tracking',
      'You can adjust or disable anytime in Settings',
    ],
    allowText: 'Enable Reminders',
    denyText: 'Not Now',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950',
  },
  biometrics: {
    icon: Fingerprint,
    title: 'Unlock with biometrics',
    description: 'Use Face ID, Touch ID, or fingerprint to unlock your vault quickly without typing your password.',
    benefits: [
      'Faster access to your vault',
      'Your biometric data never leaves your device',
      'Secure storage via Keychain/Keystore',
      'You can disable anytime in Settings',
    ],
    allowText: 'Enable Biometrics',
    denyText: 'Not Now',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950',
  },
};

export function PermissionEducation({
  type,
  open,
  onOpenChange,
  onAllow,
  onDeny,
}: PermissionEducationProps) {
  const content = permissionContent[type];
  const Icon = content.icon;

  const handleAllow = () => {
    onAllow();
    onOpenChange(false);
  };

  const handleDeny = () => {
    onDeny();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl border-t">
        <SheetHeader>
          <div className="flex items-center justify-between mb-4">
            <div className={cn('w-16 h-16 rounded-2xl flex items-center justify-center', content.bgColor)}>
              <Icon className={cn('w-8 h-8', content.color)} />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="p-2 rounded-xl"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          <SheetTitle className="text-title text-left">
            {content.title}
          </SheetTitle>

          <SheetDescription className="text-body-sm text-left text-muted-foreground">
            {content.description}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {content.benefits.map((benefit, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center mt-0.5 shrink-0">
                <div className="w-2 h-2 rounded-full bg-primary" />
              </div>
              <p className="text-body-sm text-foreground flex-1">{benefit}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 space-y-3 pb-[env(safe-area-inset-bottom)]">
          <Button
            onClick={handleAllow}
            className="w-full h-12 rounded-xl text-body font-semibold"
            size="lg"
          >
            {content.allowText}
          </Button>

          <Button
            onClick={handleDeny}
            variant="ghost"
            className="w-full h-12 rounded-xl text-body"
            size="lg"
          >
            {content.denyText}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Hook for managing permission education state
export function usePermissionEducation() {
  const [hasSeenNotifications, setHasSeenNotifications] = React.useState(() => {
    try {
      return localStorage.getItem('ironvault_permission_notifications_seen') === 'true';
    } catch {
      return false;
    }
  });

  const [hasSeenBiometrics, setHasSeenBiometrics] = React.useState(() => {
    try {
      return localStorage.getItem('ironvault_permission_biometrics_seen') === 'true';
    } catch {
      return false;
    }
  });

  const markNotificationsSeen = () => {
    try {
      localStorage.setItem('ironvault_permission_notifications_seen', 'true');
      setHasSeenNotifications(true);
    } catch (error) {
      console.error('Failed to save notifications permission state:', error);
    }
  };

  const markBiometricsSeen = () => {
    try {
      localStorage.setItem('ironvault_permission_biometrics_seen', 'true');
      setHasSeenBiometrics(true);
    } catch (error) {
      console.error('Failed to save biometrics permission state:', error);
    }
  };

  return {
    hasSeenNotifications,
    hasSeenBiometrics,
    markNotificationsSeen,
    markBiometricsSeen,
  };
}
