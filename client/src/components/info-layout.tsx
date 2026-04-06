import { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Home, Lock, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';

interface InfoLayoutProps {
  children: ReactNode;
  title: string;
}

export function InfoLayout({ children, title }: InfoLayoutProps) {
  const [, setLocation] = useLocation();
  const { isUnlocked } = useAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header - Fixed with safe area for Dynamic Island */}
      <div className="bg-card border-b border-border fixed top-0 left-0 right-0 z-50 pt-[env(safe-area-inset-top)]">
        <div className="max-w-7xl mx-auto px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.history.back()}
                className="h-8 w-8 shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center shrink-0">
                  <Shield className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
                <h1 className="text-base font-bold text-foreground truncate">
                  {title}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {isUnlocked ? (
                <Link href="/">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Home className="w-4 h-4" />
                  </Button>
                </Link>
              ) : (
                <Link href="/">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Lock className="w-4 h-4" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Spacer for fixed header */}
      <div className="h-[calc(env(safe-area-inset-top)+56px)]" />

      {/* Content - scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 py-4 pb-16">
          {children}
        </div>
      </div>
    </div>
  );
}

