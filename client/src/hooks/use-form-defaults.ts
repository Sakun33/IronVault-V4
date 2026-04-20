import { useCallback } from 'react';

const KEYS = {
  lastUsername: 'iv_fd_username',
  lastNotebook: 'iv_fd_notebook',
  lastExpenseCategory: 'iv_fd_expense_cat',
  lastApiEnv: 'iv_fd_api_env',
};

function get(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function set(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch {}
}

export function useFormDefaults() {
  const saveUsername = useCallback((username: string) => {
    if (username.trim()) set(KEYS.lastUsername, username.trim());
  }, []);

  const saveNotebook = useCallback((notebook: string) => {
    if (notebook.trim()) set(KEYS.lastNotebook, notebook.trim());
  }, []);

  const saveExpenseCategory = useCallback((category: string) => {
    if (category.trim()) set(KEYS.lastExpenseCategory, category.trim());
  }, []);

  const saveApiEnv = useCallback((env: string) => {
    if (env.trim()) set(KEYS.lastApiEnv, env.trim());
  }, []);

  return {
    lastUsername: get(KEYS.lastUsername) ?? '',
    lastNotebook: get(KEYS.lastNotebook) ?? 'Default',
    lastExpenseCategory: get(KEYS.lastExpenseCategory) ?? '',
    lastApiEnv: (get(KEYS.lastApiEnv) ?? 'production') as 'development' | 'staging' | 'production',
    saveUsername,
    saveNotebook,
    saveExpenseCategory,
    saveApiEnv,
  };
}
