import React from 'react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import { useTheme } from '@/contexts/theme-context';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = React.useState(false);

  const themes = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ] as const;

  const currentTheme = themes.find(t => t.value === theme) || themes[0];
  const CurrentIcon = currentTheme.icon;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="p-2 rounded-xl" data-testid="theme-toggle-button">
          <CurrentIcon className="w-5 h-5" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {themes.map((themeOption) => {
          const Icon = themeOption.icon;
          return (
            <DropdownMenuItem
              key={themeOption.value}
              onSelect={() => {
                setTheme(themeOption.value);
                setOpen(false);
              }}
              className="flex items-center justify-between"
              data-testid={`theme-toggle-${themeOption.value}`}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span>{themeOption.label}</span>
              </div>
              {theme === themeOption.value && (
                <Check className="h-4 w-4" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SimpleThemeToggle() {
  const { toggleTheme, resolvedTheme } = useTheme();
  
  return (
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={toggleTheme}
      className="h-9 w-9 rounded-xl transition-all duration-200"
      data-testid="theme-toggle-simple"
    >
      {resolvedTheme === 'dark' ? (
        <Sun className="w-4 h-4" />
      ) : (
        <Moon className="w-4 h-4" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
