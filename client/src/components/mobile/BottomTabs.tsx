import React from 'react';
import { Link, useLocation } from 'wouter';
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

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'bg-background/80 backdrop-blur-2xl',
        'border-t border-border/40',
        'pb-[env(safe-area-inset-bottom)]',
        'shadow-[0_-8px_30px_rgba(0,0,0,0.06)]',
        'dark:shadow-[0_-8px_30px_rgba(0,0,0,0.25)]',
        'lg:hidden',
        className
      )}
    >
      <div className="px-3 pt-2.5 pb-0.5">
        <div className="flex justify-around items-center">
          {items.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;

            if (item.onClick) {
              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  size="sm"
                  onClick={item.onClick}
                  data-testid={`bottom-tab-${item.id}`}
                  className={cn(
                    'flex flex-col items-center gap-0.5 px-3 py-1.5 h-auto',
                    'min-w-[64px] rounded-2xl transition-all duration-200',
                    'active:scale-90',
                    active && 'bg-primary/8'
                  )}
                >
                  <div className="relative">
                    <Icon
                      className={cn(
                        'w-[22px] h-[22px] transition-all duration-200',
                        active ? 'text-primary scale-110' : 'text-muted-foreground'
                      )}
                    />
                    {item.count !== null && item.count !== undefined && item.count > 0 && (
                      <span className="absolute -top-1 -right-2 bg-primary text-primary-foreground rounded-full min-w-[16px] h-4 flex items-center justify-center text-[9px] font-bold px-1">
                        {item.count > 99 ? '99+' : item.count}
                      </span>
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-[10px] font-medium transition-colors leading-tight',
                      active ? 'text-primary font-semibold' : 'text-muted-foreground'
                    )}
                  >
                    {item.label}
                  </span>
                  {active && (
                    <div className="w-1 h-1 rounded-full bg-primary" />
                  )}
                </Button>
              );
            }

            return (
              <Link 
                key={item.id} 
                href={item.href}
                onClick={() => window.scrollTo({ top: 0, behavior: 'instant' })}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  data-testid={`bottom-tab-${item.id}`}
                  className={cn(
                    'flex flex-col items-center gap-0.5 px-3 py-1.5 h-auto',
                    'min-w-[64px] rounded-2xl transition-all duration-200',
                    'active:scale-90',
                    active && 'bg-primary/8'
                  )}
                >
                  <div className="relative">
                    <Icon
                      className={cn(
                        'w-[22px] h-[22px] transition-all duration-200',
                        active ? 'text-primary scale-110' : 'text-muted-foreground'
                      )}
                    />
                    {item.count !== null && item.count !== undefined && item.count > 0 && (
                      <span className="absolute -top-1 -right-2 bg-primary text-primary-foreground rounded-full min-w-[16px] h-4 flex items-center justify-center text-[9px] font-bold px-1">
                        {item.count > 99 ? '99+' : item.count}
                      </span>
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-[10px] font-medium transition-colors leading-tight',
                      active ? 'text-primary font-semibold' : 'text-muted-foreground'
                    )}
                  >
                    {item.label}
                  </span>
                  {active && (
                    <div className="w-1 h-1 rounded-full bg-primary" />
                  )}
                </Button>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
