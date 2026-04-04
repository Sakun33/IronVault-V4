import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/**
 * MobileDialog - Mobile-optimized dialog component
 * 
 * Key features:
 * - Hard max-height constraint: calc(100dvh - safe-top - safe-bottom - 24px)
 * - Sticky header with title + close button
 * - Scrollable content area
 * - Sticky footer for action buttons
 * - Proper z-index (51) above everything
 * - Lighter backdrop (50% opacity)
 * - Prevents all overlap issues
 */

const MobileDialog = DialogPrimitive.Root;
const MobileDialogTrigger = DialogPrimitive.Trigger;
const MobileDialogPortal = DialogPrimitive.Portal;
const MobileDialogClose = DialogPrimitive.Close;

const MobileDialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
));
MobileDialogOverlay.displayName = 'MobileDialogOverlay';

interface MobileDialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  children: React.ReactNode;
  className?: string;
}

const MobileDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  MobileDialogContentProps
>(({ className, children, ...props }, ref) => (
  <MobileDialogPortal>
    <MobileDialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-51 -translate-x-1/2 -translate-y-1/2',
        'w-[calc(100vw-32px)] max-w-lg',
        'max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-24px)]',
        'flex flex-col',
        'bg-card border border-border rounded-xl shadow-lg',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
        'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </MobileDialogPortal>
));
MobileDialogContent.displayName = 'MobileDialogContent';

interface MobileDialogHeaderProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * MobileDialogHeader - Sticky header section
 * 
 * Always visible at top of dialog, contains title and close button
 */
function MobileDialogHeader({ children, className }: MobileDialogHeaderProps) {
  return (
    <div
      className={cn(
        'sticky top-0 z-10 bg-card',
        'flex items-center justify-between gap-4',
        'px-6 py-4 border-b border-border',
        'shrink-0',
        className
      )}
    >
      {children}
    </div>
  );
}

interface MobileDialogTitleProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * MobileDialogTitle - Dialog title
 */
function MobileDialogTitle({ children, className }: MobileDialogTitleProps) {
  return (
    <DialogPrimitive.Title
      className={cn(
        'text-title-sm font-semibold text-foreground',
        'flex-1 min-w-0',
        className
      )}
    >
      {children}
    </DialogPrimitive.Title>
  );
}

interface MobileDialogCloseButtonProps {
  className?: string;
}

/**
 * MobileDialogCloseButton - Close button (X)
 */
function MobileDialogCloseButton({ className }: MobileDialogCloseButtonProps) {
  return (
    <MobileDialogClose asChild>
      <Button
        variant="ghost"
        size="icon"
        className={cn('shrink-0', className)}
        aria-label="Close dialog"
      >
        <X className="h-5 w-5" />
      </Button>
    </MobileDialogClose>
  );
}

interface MobileDialogBodyProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * MobileDialogBody - Scrollable content area
 * 
 * This is the main content region that scrolls independently
 */
function MobileDialogBody({ children, className }: MobileDialogBodyProps) {
  return (
    <div
      className={cn(
        'flex-1 overflow-y-auto overflow-x-hidden',
        'px-6 py-4',
        'scroll-container',
        className
      )}
    >
      {children}
    </div>
  );
}

interface MobileDialogFooterProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * MobileDialogFooter - Sticky footer with action buttons
 * 
 * Always visible at bottom, typically contains Cancel + Primary CTA
 */
function MobileDialogFooter({ children, className }: MobileDialogFooterProps) {
  return (
    <div
      className={cn(
        'sticky bottom-0 z-10 bg-card',
        'flex items-center justify-end gap-3',
        'px-6 py-4 border-t border-border',
        'shrink-0',
        className
      )}
    >
      {children}
    </div>
  );
}

interface MobileDialogDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * MobileDialogDescription - Optional description text
 */
function MobileDialogDescription({ children, className }: MobileDialogDescriptionProps) {
  return (
    <DialogPrimitive.Description
      className={cn('text-body text-muted-foreground', className)}
    >
      {children}
    </DialogPrimitive.Description>
  );
}

export {
  MobileDialog,
  MobileDialogTrigger,
  MobileDialogContent,
  MobileDialogHeader,
  MobileDialogTitle,
  MobileDialogCloseButton,
  MobileDialogBody,
  MobileDialogFooter,
  MobileDialogDescription,
  MobileDialogClose,
};
