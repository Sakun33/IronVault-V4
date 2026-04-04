import React from 'react';
import { cn } from '@/lib/utils';

interface MobilePageProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
  fullHeight?: boolean;
}

export function MobilePage({ children, className, noPadding = false, fullHeight = false }: MobilePageProps) {
  return (
    <div
      className={cn(
        'min-h-[100dvh] bg-background overflow-x-hidden',
        'pb-[calc(64px+env(safe-area-inset-bottom))]',
        !noPadding && 'pt-[calc(56px+env(safe-area-inset-top))]',
        fullHeight && 'h-[100dvh] flex flex-col',
        className
      )}
    >
      {children}
    </div>
  );
}

interface MobilePageContentProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function MobilePageContent({ children, className, noPadding = false }: MobilePageContentProps) {
  return (
    <div
      className={cn(
        'flex-1',
        !noPadding && 'p-4',
        className
      )}
    >
      {children}
    </div>
  );
}

interface MobilePageScrollProps {
  children: React.ReactNode;
  className?: string;
}

export function MobilePageScroll({ children, className }: MobilePageScrollProps) {
  return (
    <div className={cn('flex-1 overflow-y-auto overflow-x-hidden overscroll-contain -webkit-overflow-scrolling-touch', className)}>
      {children}
    </div>
  );
}
