import React from 'react';
import { Check } from 'lucide-react';
import { themes } from '@/lib/themes';
import { useTheme } from '@/contexts/theme-context';

export default function ThemeSelector() {
  const { themePreset, setThemePreset, resolvedTheme } = useTheme();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
      {themes.map((theme) => {
        const isActive = themePreset === theme.id;
        const previewColors = resolvedTheme === 'dark' ? {
          bg: theme.preview.card,
          card: theme.preview.bg,
          primary: theme.preview.primary,
        } : theme.preview;

        return (
          <button
            key={theme.id}
            onClick={() => setThemePreset(theme.id)}
            className={`
              relative group flex flex-col items-center gap-2 p-3 rounded-xl border-2
              transition-all duration-200 ease-out text-left
              ${isActive
                ? 'border-primary bg-primary/5 shadow-md ring-1 ring-primary/20'
                : 'border-border bg-card hover:border-primary/40 hover:shadow-sm'
              }
            `}
            style={{ minHeight: 0, minWidth: 0 }}
          >
            {/* Color swatches */}
            <div className="flex items-center gap-1.5 w-full">
              <div
                className="w-6 h-6 rounded-full border border-black/10 shadow-sm"
                style={{ backgroundColor: previewColors.primary }}
              />
              <div
                className="w-5 h-5 rounded-full border border-black/10"
                style={{ backgroundColor: previewColors.bg }}
              />
              <div
                className="w-4 h-4 rounded-full border border-black/10"
                style={{ backgroundColor: previewColors.card }}
              />
            </div>

            {/* Theme name */}
            <div className="w-full">
              <div className="text-xs font-semibold text-foreground leading-tight truncate">
                {theme.name}
              </div>
              <div className="text-[10px] text-muted-foreground leading-tight mt-0.5 line-clamp-2">
                {theme.description}
              </div>
            </div>

            {/* Active checkmark */}
            {isActive && (
              <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
