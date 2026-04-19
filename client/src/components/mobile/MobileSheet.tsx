import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MobileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  showClose?: boolean;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export function MobileSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  contentClassName,
  showClose = true,
  side = 'bottom',
}: MobileSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        hideClose={true}
        className={cn(
          'max-h-[calc(100dvh-env(safe-area-inset-top)-48px)]',
          side === 'bottom' && 'max-h-[90dvh]',
          side === 'right' && 'w-[min(88vw,360px)]',
          side === 'left' && 'w-[min(88vw,360px)]',
          'flex flex-col',
          'p-0',
          'gap-0',
          className
        )}
      >
        {/* Fixed Header */}
        {(title || showClose) && (
          <SheetHeader className={cn(
            'px-4 pt-4 pb-3',
            'border-b border-border',
            'flex-shrink-0'
          )}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {title && (
                  <SheetTitle className="text-lg font-semibold text-foreground">
                    {title}
                  </SheetTitle>
                )}
                {description && (
                  <SheetDescription className="text-sm text-muted-foreground mt-1">
                    {description}
                  </SheetDescription>
                )}
              </div>
              {showClose && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="h-8 w-8 p-0 rounded-full flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              )}
            </div>
          </SheetHeader>
        )}

        {/* Scrollable Content */}
        <div className={cn(
          'flex-1 overflow-y-auto overflow-x-hidden',
          'px-4 py-4',
          'overscroll-contain',
          contentClassName
        )}>
          {children}
        </div>

        {/* Fixed Footer */}
        {footer && (
          <SheetFooter className={cn(
            'px-4 py-3',
            'border-t border-border',
            'flex-shrink-0',
            'pb-[calc(12px+env(safe-area-inset-bottom))]'
          )}>
            {footer}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
