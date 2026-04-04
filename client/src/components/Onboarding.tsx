import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Shield, Lock, Smartphone, Bell, ArrowRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnboardingProps {
  onComplete: () => void;
}

const screens = [
  {
    id: 'privacy',
    icon: Shield,
    title: 'Your vault stays on your device',
    description: 'IronVault stores everything locally. Your passwords, subscriptions, and notes never leave your device.',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  {
    id: 'encryption',
    icon: Lock,
    title: 'Encrypted with zero-knowledge',
    description: 'Your data is protected with AES-256-GCM encryption. We never see your master password or decrypted data.',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950',
  },
  {
    id: 'biometrics',
    icon: Smartphone,
    title: 'Unlock faster with biometrics',
    description: 'Use Face ID, Touch ID, or fingerprint to quickly unlock your vault without typing your password every time.',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950',
  },
  {
    id: 'reminders',
    icon: Bell,
    title: 'Stay on top of renewals',
    description: 'Get notified before subscriptions renew so you can review or cancel. All notifications are local—no tracking.',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950',
  },
];

export function Onboarding({ onComplete }: OnboardingProps) {
  const [currentScreen, setCurrentScreen] = useState(0);
  const isLastScreen = currentScreen === screens.length - 1;
  const screen = screens[currentScreen];
  const Icon = screen.icon;

  const handleNext = () => {
    if (isLastScreen) {
      onComplete();
    } else {
      setCurrentScreen(currentScreen + 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-background flex flex-col">
      {/* Skip button */}
      <div className="flex justify-end p-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <Button variant="ghost" onClick={handleSkip} className="text-muted-foreground">
          Skip
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
        {/* Icon */}
        <div className={cn('w-24 h-24 rounded-3xl flex items-center justify-center mb-8', screen.bgColor)}>
          <Icon className={cn('w-12 h-12', screen.color)} />
        </div>

        {/* Title */}
        <h1 className="text-title-lg text-center mb-4 max-w-md">
          {screen.title}
        </h1>

        {/* Description */}
        <p className="text-body text-center text-muted-foreground max-w-md mb-12">
          {screen.description}
        </p>

        {/* Progress dots */}
        <div className="flex gap-2 mb-8">
          {screens.map((_, index) => (
            <div
              key={index}
              className={cn(
                'h-2 rounded-full transition-all',
                index === currentScreen
                  ? 'w-8 bg-primary'
                  : index < currentScreen
                  ? 'w-2 bg-primary/50'
                  : 'w-2 bg-border'
              )}
            />
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] space-y-3">
        <Button
          onClick={handleNext}
          className="w-full h-12 rounded-xl text-body font-semibold"
          size="lg"
        >
          {isLastScreen ? (
            <>
              Get Started
              <Check className="w-5 h-5 ml-2" />
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="w-5 h-5 ml-2" />
            </>
          )}
        </Button>

        {/* Progress indicator text */}
        <p className="text-caption text-center text-muted-foreground">
          {currentScreen + 1} of {screens.length}
        </p>
      </div>
    </div>
  );
}

// Hook to manage onboarding state
export function useOnboarding() {
  const [hasOnboarded, setHasOnboarded] = useState(() => {
    try {
      return localStorage.getItem('ironvault_onboarded') === 'true';
    } catch {
      return false;
    }
  });

  const completeOnboarding = () => {
    try {
      localStorage.setItem('ironvault_onboarded', 'true');
      setHasOnboarded(true);
    } catch (error) {
      console.error('Failed to save onboarding state:', error);
    }
  };

  const resetOnboarding = () => {
    try {
      localStorage.removeItem('ironvault_onboarded');
      setHasOnboarded(false);
    } catch (error) {
      console.error('Failed to reset onboarding:', error);
    }
  };

  return {
    hasOnboarded,
    completeOnboarding,
    resetOnboarding,
  };
}
