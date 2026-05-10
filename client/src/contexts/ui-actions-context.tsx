import React, { createContext, useContext, useMemo } from 'react';

/**
 * UI actions shared across the app — the password generator and import/export
 * modals are mounted once at the App shell so they survive route changes and
 * carry consistent state. Pages that want to trigger them (dashboard quick
 * actions, etc.) consume this context instead of mounting their own copy,
 * which previously caused two competing modal instances and stale state.
 */
interface UIActionsContextType {
  openPasswordGenerator: () => void;
  openImportExport: () => void;
}

const UIActionsContext = createContext<UIActionsContextType | undefined>(undefined);

export function UIActionsProvider({
  children,
  openPasswordGenerator,
  openImportExport,
}: {
  children: React.ReactNode;
  openPasswordGenerator: () => void;
  openImportExport: () => void;
}) {
  const value = useMemo(
    () => ({ openPasswordGenerator, openImportExport }),
    [openPasswordGenerator, openImportExport],
  );
  return <UIActionsContext.Provider value={value}>{children}</UIActionsContext.Provider>;
}

export function useUIActions(): UIActionsContextType {
  const ctx = useContext(UIActionsContext);
  if (!ctx) {
    return {
      openPasswordGenerator: () => {},
      openImportExport: () => {},
    };
  }
  return ctx;
}
