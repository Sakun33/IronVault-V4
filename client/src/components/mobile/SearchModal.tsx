import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { X, Search, Clock, Key, Bookmark, BookOpen, DollarSign, Bell } from 'lucide-react';
import { Link } from 'wouter';

interface SearchResult {
  id: string;
  type: 'password' | 'subscription' | 'note' | 'expense' | 'reminder';
  title: string;
  subtitle?: string;
  href: string;
}

interface SearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  results?: {
    passwords?: SearchResult[];
    subscriptions?: SearchResult[];
    notes?: SearchResult[];
    expenses?: SearchResult[];
    reminders?: SearchResult[];
  };
  recentSearches?: string[];
  onClearRecentSearches?: () => void;
}

// Keys are the singular type values used in SearchResult.type
const typeConfig = {
  password: { icon: Key, label: 'Passwords', color: 'text-primary' },
  subscription: { icon: Bookmark, label: 'Subscriptions', color: 'text-primary' },
  note: { icon: BookOpen, label: 'Notes', color: 'text-foreground' },
  expense: { icon: DollarSign, label: 'Expenses', color: 'text-foreground' },
  reminder: { icon: Bell, label: 'Reminders', color: 'text-foreground' },
};

function SearchModalInner({
  open,
  onOpenChange,
  searchQuery,
  onSearchChange,
  results = {},
  recentSearches = [],
  onClearRecentSearches,
}: SearchModalProps) {
  const [activeTab, setActiveTab] = useState<'all' | keyof typeof typeConfig>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => { inputRef.current?.focus(); }, 100);
    }
  }, [open]);

  // Flatten without overriding type — items already carry the correct singular type
  const allResults: SearchResult[] = Object.values(results).flatMap(items => items ?? []);

  const filteredResults =
    activeTab === 'all' ? allResults : allResults.filter(r => r.type === activeTab);

  const hasResults = filteredResults.length > 0;
  const showRecentSearches = !searchQuery && recentSearches.length > 0;

  // Singular keys so Object.entries yields 'password', 'subscription', … matching typeConfig
  const resultCounts: Record<keyof typeof typeConfig, number> = {
    password: results.passwords?.length ?? 0,
    subscription: results.subscriptions?.length ?? 0,
    note: results.notes?.length ?? 0,
    expense: results.expenses?.length ?? 0,
    reminder: results.reminders?.length ?? 0,
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Header */}
      <div className="bg-background px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="h-10 w-10 rounded-xl shrink-0"
          >
            <X className="w-5 h-5" />
          </Button>

          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 transform -translate-y-1/2" />
            <Input
              ref={inputRef}
              type="text"
              placeholder="Search everything..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted/50 border-0"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        {searchQuery && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
            <Button
              variant={activeTab === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('all')}
              className="rounded-full shrink-0"
            >
              All ({allResults.length})
            </Button>
            {(Object.entries(resultCounts) as [keyof typeof typeConfig, number][]).map(([type, count]) => {
              if (count === 0) return null;
              const config = typeConfig[type];
              if (!config) return null;
              return (
                <Button
                  key={type}
                  variant={activeTab === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab(type)}
                  className="rounded-full shrink-0"
                >
                  {config.label} ({count})
                </Button>
              );
            })}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {showRecentSearches && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Recent Searches</h3>
              {onClearRecentSearches && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearRecentSearches}
                  className="text-xs h-auto py-1 px-2"
                >
                  Clear
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {recentSearches.map((search, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  className="w-full justify-start gap-3 px-3 py-2 h-auto text-left rounded-xl"
                  onClick={() => onSearchChange(search)}
                >
                  <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-foreground">{search}</span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {searchQuery && !hasResults && (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No results found</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Try searching with different keywords
            </p>
          </div>
        )}

        {searchQuery && hasResults && (
          <div className="p-4 space-y-1">
            {filteredResults.map((result) => {
              const config = typeConfig[result.type];
              if (!config) return null;
              const Icon = config.icon;

              return (
                <Link key={result.id} href={result.href}>
                  <Button
                    variant="ghost"
                    className="w-full flex items-center gap-3 p-3 h-auto text-left rounded-xl hover:bg-accent"
                    onClick={() => onOpenChange(false)}
                  >
                    <div className="p-2 rounded-xl bg-accent shrink-0">
                      <Icon className={cn('w-4 h-4', config.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-foreground truncate">
                        {result.title}
                      </div>
                      {result.subtitle && (
                        <div className="text-xs text-muted-foreground truncate">
                          {result.subtitle}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0">
                      {config.label}
                    </div>
                  </Button>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function SearchModal(props: SearchModalProps) {
  try {
    return <SearchModalInner {...props} />;
  } catch (err) {
    console.error('SearchModal crash:', err);
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center gap-4 p-8" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <Search className="w-10 h-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground text-center">Search is temporarily unavailable. Please try again.</p>
        <Button variant="outline" onClick={() => props.onOpenChange(false)}>Close</Button>
      </div>
    );
  }
}
