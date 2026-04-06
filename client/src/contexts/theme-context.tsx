import React, { createContext, useContext, useEffect, useState } from 'react';
import { themes, getThemeById, DEFAULT_THEME_ID, type ThemePreset } from '@/lib/themes';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
  toggleTheme: () => void;
  themePreset: string;
  setThemePreset: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyThemeVariables(preset: ThemePreset, mode: 'light' | 'dark') {
  const root = document.documentElement;
  const vars = mode === 'dark' ? preset.dark : preset.light;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}

function clearThemeVariables() {
  const root = document.documentElement;
  // Clear all custom properties we might have set
  const allVarNames = themes[0] ? Object.keys(themes[0].light) : [];
  for (const key of allVarNames) {
    root.style.removeProperty(key);
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [themePreset, setThemePresetState] = useState<string>(DEFAULT_THEME_ID);

  // Load preferences from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('securevault-theme') as Theme;
    if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
      setThemeState(savedTheme);
    }
    const savedPreset = localStorage.getItem('ironvault-theme-preset');
    if (savedPreset && getThemeById(savedPreset)) {
      setThemePresetState(savedPreset);
    }
  }, []);

  // Handle system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleSystemThemeChange = () => {
      if (theme === 'system') {
        setResolvedTheme(mediaQuery.matches ? 'dark' : 'light');
      }
    };

    if (theme === 'system') {
      setResolvedTheme(mediaQuery.matches ? 'dark' : 'light');
    } else {
      setResolvedTheme(theme);
    }

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [theme]);

  // Apply theme class + CSS variables
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);

    const preset = getThemeById(themePreset);
    if (preset) {
      applyThemeVariables(preset, resolvedTheme);
    } else {
      clearThemeVariables();
    }

    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      const bg = preset
        ? (resolvedTheme === 'dark' ? preset.dark : preset.light)['--background']
        : undefined;
      // Convert HSL string to a simple hex fallback
      metaThemeColor.setAttribute(
        'content',
        resolvedTheme === 'dark' ? '#0f172a' : '#ffffff',
      );
    }
  }, [resolvedTheme, themePreset]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('securevault-theme', newTheme);

    if (newTheme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      setResolvedTheme(mediaQuery.matches ? 'dark' : 'light');
    } else {
      setResolvedTheme(newTheme);
    }
  };

  const setThemePreset = (id: string) => {
    if (getThemeById(id)) {
      setThemePresetState(id);
      localStorage.setItem('ironvault-theme-preset', id);
    }
  };

  const toggleTheme = () => {
    if (resolvedTheme === 'light') {
      setTheme('dark');
    } else {
      setTheme('light');
    }
  };

  const value: ThemeContextType = {
    theme,
    setTheme,
    resolvedTheme,
    toggleTheme,
    themePreset,
    setThemePreset,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
