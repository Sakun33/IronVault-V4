import React, { createContext, useContext, useState } from 'react';

/**
 * Tiny context that owns just the search query.
 *
 * QA-R2 H3 fix: searchQuery used to live on VaultContext, which re-created
 * its value object (and therefore re-rendered every consumer of useVault())
 * on every keystroke. Pulling it into its own micro-context means only
 * components that actually read the search query re-render when it changes;
 * password lists, dashboards, charts, etc. stay stable.
 */
interface SearchContextType {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [searchQuery, setSearchQuery] = useState('');
  return (
    <SearchContext.Provider value={{ searchQuery, setSearchQuery }}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch(): SearchContextType {
  const ctx = useContext(SearchContext);
  if (!ctx) {
    // Defensive default — return a no-op so consumers that mount briefly
    // outside the provider tree (e.g. shared modals) don't crash.
    return { searchQuery: '', setSearchQuery: () => {} };
  }
  return ctx;
}
