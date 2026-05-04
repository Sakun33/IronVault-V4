import React from 'react';
import { Link, useLocation } from 'wouter';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

export interface TabItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  count?: number | null;
  color?: string;
  onClick?: () => void;
}

interface BottomTabsProps {
  items: TabItem[];
  className?: string;
}

export function BottomTabs({ items, className }: BottomTabsProps) {
  const [location] = useLocation();

  const isActive = (href: string) => {
    if (href === '/') {
      return location === '/';
    }
    return location.startsWith(href);
  };

  // Render the same content for Link/Button wrappers — duplicating the
  // markup just to swap the parent element bloated this file. Encapsulated
  // here once.
  const renderInner = (item: TabItem, active: boolean) => {
    const Icon = item.icon;
    return (
      <Button
        variant="ghost"
        size="sm"
        data-testid={`bottom-tab-${item.id}`}
        className={cn(
          'relative flex flex-col items-center justify-center gap-0.5 px-3 py-1.5',
          'min-w-[64px] min-h-[44px] h-auto rounded-2xl transition-all duration-200',
          'active:scale-90',
          active && 'bg-emerald-500/10'
        )}
      >
        {active && (
          <motion.span
            layoutId="bottomTabsActive"
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="absolute inset-0 rounded-2xl bg-emerald-500/12 ring-1 ring-emerald-400/30 -z-[1]"
          />
        )}
        <div className="relative">
          <Icon
            className={cn(
              'w-[22px] h-[22px] transition-all duration-200',
              active ? 'text-emerald-300 scale-110 drop-shadow-[0_0_6px_rgba(16,185,129,0.6)]' : 'text-muted-foreground'
            )}
          />
          {item.count !== null && item.count !== undefined && item.count > 0 && (
            <span className="absolute -top-1 -right-2 bg-emerald-500 text-white rounded-full min-w-[16px] h-4 flex items-center justify-center text-[9px] font-bold px-1">
              {item.count > 99 ? '99+' : item.count}
            </span>
          )}
        </div>
        <span
          className={cn(
            'text-[10px] font-medium transition-colors leading-tight',
            active ? 'text-emerald-300 font-semibold' : 'text-muted-foreground'
          )}
        >
          {item.label}
        </span>
      </Button>
    );
  };

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'glass-surface',
        'border-t border-white/10',
        'pb-[env(safe-area-inset-bottom)]',
        'shadow-[0_-8px_30px_rgba(0,0,0,0.06)]',
        'dark:shadow-[0_-8px_30px_rgba(0,0,0,0.25)]',
        'lg:hidden',
        className
      )}
      aria-label="Primary mobile navigation"
    >
      <div className="px-3 pt-2.5 pb-0.5">
        <div className="flex justify-around items-center">
          {items.map((item) => {
            const active = isActive(item.href);
            if (item.onClick) {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  className="bg-transparent border-0 p-0"
                  aria-label={item.label}
                >
                  {renderInner(item, active)}
                </button>
              );
            }
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => window.scrollTo({ top: 0, behavior: 'instant' })}
              >
                {renderInner(item, active)}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
