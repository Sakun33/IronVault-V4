import { LayoutGrid, List as ListIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ViewMode = 'list' | 'grid';

interface ViewToggleProps {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
  className?: string;
  /** Optional larger touch targets for mobile-only contexts. */
  size?: 'sm' | 'md';
}

/**
 * Premium pill-style list/grid toggle. Single rounded-full container with two
 * inset pill buttons; the active button gets an emerald wash + soft shadow
 * to read as "selected" without the heavy block-button look that the older
 * inline markup had. Used across passwords, subscriptions, api-keys, etc.
 */
export function ViewToggle({ view, onChange, className, size = 'md' }: ViewToggleProps) {
  const buttonSize = size === 'sm' ? 'h-7 px-2.5' : 'h-8 px-3';
  return (
    <div
      role="tablist"
      aria-label="View toggle"
      className={cn(
        'flex items-center bg-white/5 dark:bg-white/5 rounded-full p-0.5 border border-white/10 backdrop-blur-md',
        className,
      )}
    >
      <button
        type="button"
        role="tab"
        aria-selected={view === 'list'}
        aria-label="List view"
        onClick={() => onChange('list')}
        className={cn(
          buttonSize,
          'rounded-full text-sm transition-all flex items-center gap-1.5',
          view === 'list'
            ? 'bg-emerald-500/20 text-emerald-400 shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
        data-testid="view-toggle-list"
      >
        <ListIcon className="w-4 h-4" />
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === 'grid'}
        aria-label="Grid view"
        onClick={() => onChange('grid')}
        className={cn(
          buttonSize,
          'rounded-full text-sm transition-all flex items-center gap-1.5',
          view === 'grid'
            ? 'bg-emerald-500/20 text-emerald-400 shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
        data-testid="view-toggle-grid"
      >
        <LayoutGrid className="w-4 h-4" />
      </button>
    </div>
  );
}
