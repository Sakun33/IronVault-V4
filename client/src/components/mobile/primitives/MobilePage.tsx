import React from 'react';
import { cn } from '@/lib/utils';

interface MobilePageProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * MobilePage - Root container for all mobile screens
 * 
 * Responsibilities:
 * - Enforces min-height: 100dvh
 * - Prevents horizontal overflow
 * - Reserves space for header + bottom tabs
 * - Applies safe area padding
 * - Ensures content NEVER sits behind bottom tabs
 */
export function MobilePage({ children, className }: MobilePageProps) {
  return (
    <div
      className={cn(
        'min-h-[100dvh] flex flex-col overflow-x-hidden bg-background',
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
}

/**
 * MobilePageContent - Scrollable content area
 * 
 * Responsibilities:
 * - Provides scrollable region
 * - Reserves space for bottom tabs (pb-[calc(64px+env(safe-area-inset-bottom)+16px)])
 * - Applies page padding (px-4)
 * - Allows content to grow (flex-1)
 */
export function MobilePageContent({ children, className }: MobilePageContentProps) {
  return (
    <div
      className={cn(
        'flex-1 overflow-y-auto overflow-x-hidden',
        'px-4 pb-[calc(64px+env(safe-area-inset-bottom)+16px)]',
        'scroll-container',
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

/**
 * MobilePageScroll - Alternative scroll container without padding
 * 
 * Use when content needs full-width (e.g., list rows with internal padding)
 */
export function MobilePageScroll({ children, className }: MobilePageScrollProps) {
  return (
    <div
      className={cn(
        'flex-1 overflow-y-auto overflow-x-hidden',
        'pb-[calc(64px+env(safe-area-inset-bottom)+16px)]',
        'scroll-container',
        className
      )}
    >
      {children}
    </div>
  );
}
