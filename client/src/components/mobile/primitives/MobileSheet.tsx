import React from 'react';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/**
 * MobileSheet - Bottom sheet / drawer component
 * 
 * Key features:
 * - Slides up from bottom on mobile
 * - Max height constraint with internal scroll
 * - Drag handle for discoverability
 * - Proper z-index (40)
 * - Full width or drawer width (88vw) based on viewport
 * - Prevents "half white screen" bug
 */

const MobileSheet = SheetPrimitive.Root;
const MobileSheetTrigger = SheetPrimitive.Trigger;
const MobileSheetClose = SheetPrimitive.Close;
const MobileSheetPortal = SheetPrimitive.Portal;

const MobileSheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      'fixed inset-0 z-40 bg-black/50 backdrop-blur-sm',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
    ref={ref}
  />
));
MobileSheetOverlay.displayName = 'MobileSheetOverlay';

interface MobileSheetContentProps extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> {
  children: React.ReactNode;
  className?: string;
  side?: 'bottom' | 'right';
}

const MobileSheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  MobileSheetContentProps
>(({ side = 'bottom', className, children, ...props }, ref) => {
  const isBottom = side === 'bottom';
  
  return (
    <MobileSheetPortal>
      <MobileSheetOverlay />
      <SheetPrimitive.Content
        ref={ref}
        className={cn(
          'fixed z-41 flex flex-col bg-card border border-border',
          isBottom && [
            'inset-x-0 bottom-0',
            'rounded-t-3xl',
            'max-h-[calc(100dvh-env(safe-area-inset-top)-48px)]',
            'pb-[calc(env(safe-area-inset-bottom)+16px)]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
          ],
          !isBottom && [
            'inset-y-0 right-0',
            'w-full sm:w-[88vw] sm:max-w-md',
            'rounded-l-3xl',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
          ],
          className
        )}
        {...props}
      >
        {isBottom && (
          <div className="flex justify-center pt-3 pb-2 shrink-0">
            <div className="w-12 h-1 bg-muted-foreground/30 rounded-full" />
          </div>
        )}
        {children}
      </SheetPrimitive.Content>
    </MobileSheetPortal>
  );
});
MobileSheetContent.displayName = 'MobileSheetContent';

interface MobileSheetHeaderProps {
  children: React.ReactNode;
  className?: string;
}

function MobileSheetHeader({ children, className }: MobileSheetHeaderProps) {
  return (
    <div
      className={cn(
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

interface MobileSheetTitleProps {
  children: React.ReactNode;
  className?: string;
}

function MobileSheetTitle({ children, className }: MobileSheetTitleProps) {
  return (
    <SheetPrimitive.Title
      className={cn(
        'text-title-sm font-semibold text-foreground',
        'flex-1 min-w-0',
        className
      )}
    >
      {children}
    </SheetPrimitive.Title>
  );
}

interface MobileSheetCloseButtonProps {
  className?: string;
}

function MobileSheetCloseButton({ className }: MobileSheetCloseButtonProps) {
  return (
    <MobileSheetClose asChild>
      <Button
        variant="ghost"
        size="icon"
        className={cn('shrink-0', className)}
        aria-label="Close sheet"
      >
        <X className="h-5 w-5" />
      </Button>
    </MobileSheetClose>
  );
}

interface MobileSheetBodyProps {
  children: React.ReactNode;
  className?: string;
}

function MobileSheetBody({ children, className }: MobileSheetBodyProps) {
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

interface MobileSheetFooterProps {
  children: React.ReactNode;
  className?: string;
}

function MobileSheetFooter({ children, className }: MobileSheetFooterProps) {
  return (
    <div
      className={cn(
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

interface MobileSheetDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

function MobileSheetDescription({ children, className }: MobileSheetDescriptionProps) {
  return (
    <SheetPrimitive.Description
      className={cn('text-body text-muted-foreground', className)}
    >
      {children}
    </SheetPrimitive.Description>
  );
}

export {
  MobileSheet,
  MobileSheetTrigger,
  MobileSheetContent,
  MobileSheetHeader,
  MobileSheetTitle,
  MobileSheetCloseButton,
  MobileSheetBody,
  MobileSheetFooter,
  MobileSheetDescription,
  MobileSheetClose,
};
