import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { X, Search, LucideIcon } from 'lucide-react';

export interface SectionItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  count?: number | null;
  color?: string;
  group: 'vault' | 'finance' | 'tools' | 'account';
}

interface MoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: SectionItem[];
  className?: string;
}

export function MoreSheet({ open, onOpenChange, sections, className }: MoreSheetProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [snapPoint, setSnapPoint] = useState<'partial' | 'full'>('partial');
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number>(0);
  const dragCurrentY = useRef<number>(0);

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSnapPoint('partial');
    }
  }, [open]);

  const handleDragStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
  };

  const handleDragMove = (e: React.TouchEvent) => {
    dragCurrentY.current = e.touches[0].clientY;
  };

  const handleDragEnd = () => {
    const delta = dragCurrentY.current - dragStartY.current;
    
    if (delta > 100) {
      if (snapPoint === 'full') {
        setSnapPoint('partial');
      } else {
        onOpenChange(false);
      }
    } else if (delta < -100 && snapPoint === 'partial') {
      setSnapPoint('full');
    }

    dragStartY.current = 0;
    dragCurrentY.current = 0;
  };

  const filteredSections = sections.filter((section) =>
    section.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedSections = {
    vault: filteredSections.filter((s) => s.group === 'vault'),
    finance: filteredSections.filter((s) => s.group === 'finance'),
    tools: filteredSections.filter((s) => s.group === 'tools'),
    account: filteredSections.filter((s) => s.group === 'account'),
  };

  const groupLabels = {
    vault: 'Vault',
    finance: 'Finance',
    tools: 'Tools',
    account: 'Account',
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 lg:hidden"
      onClick={() => onOpenChange(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          'absolute bottom-0 left-0 right-0',
          'bg-background/95 backdrop-blur-2xl rounded-t-3xl',
          'transition-all duration-300 ease-out',
          'pb-[calc(16px+env(safe-area-inset-bottom))]',
          'shadow-[0_-8px_40px_rgba(0,0,0,0.2)]',
          snapPoint === 'partial' ? 'max-h-[70dvh]' : 'max-h-[90dvh]',
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div
          className="pt-3 pb-2 flex justify-center cursor-grab active:cursor-grabbing"
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
        >
          <div className="w-10 h-1 bg-muted-foreground/25 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 pb-3 border-b border-border/50">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold tracking-tight text-foreground">All Sections</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="p-2 rounded-xl -mr-2"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 transform -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Search sections..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted/50 border-0"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Content - Simple List View */}
        <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: snapPoint === 'partial' ? 'calc(70vh - 8rem)' : 'calc(90vh - 8rem)' }}>
          <div className="p-4">
            <div className="space-y-1">
              {filteredSections.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.id} href={item.href}>
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 px-4 py-3 h-auto rounded-xl hover:bg-accent/60 transition-all duration-200"
                      onClick={() => {
                        onOpenChange(false);
                        window.scrollTo({ top: 0, behavior: 'instant' });
                      }}
                    >
                      <div className={cn('p-2 rounded-xl', item.color, 'bg-current/10')}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-sm text-foreground">
                          {item.label}
                        </div>
                        {item.count !== null && item.count !== undefined && (
                          <div className="text-xs text-muted-foreground">
                            {item.count} {item.count === 1 ? 'item' : 'items'}
                          </div>
                        )}
                      </div>
                    </Button>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
