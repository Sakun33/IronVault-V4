import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MobileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  showClose?: boolean;
}

export function MobileDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  contentClassName,
  showClose = true,
}: MobileDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-24px)]',
          'max-w-[calc(100vw-32px)]',
          'flex flex-col',
          'p-0',
          'gap-0',
          className
        )}
      >
        {/* Fixed Header */}
        <DialogHeader className={cn(
          'px-4 pt-4 pb-3',
          'border-b border-border',
          'flex-shrink-0'
        )}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-semibold text-foreground">
                {title}
              </DialogTitle>
              {description && (
                <DialogDescription className="text-sm text-muted-foreground mt-1">
                  {description}
                </DialogDescription>
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
        </DialogHeader>

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
          <DialogFooter className={cn(
            'px-4 py-3',
            'border-t border-border',
            'flex-shrink-0',
            'pb-[calc(12px+env(safe-area-inset-bottom))]'
          )}>
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
