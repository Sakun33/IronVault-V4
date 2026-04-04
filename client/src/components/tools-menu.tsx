import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Wrench, RefreshCw, Upload, Download, Smartphone, Key } from 'lucide-react';

interface ToolsMenuProps {
  onPasswordGenerator: () => void;
  onImportExport: () => void;
  onExtensionPairing: () => void;
}

export function ToolsMenu({ 
  onPasswordGenerator, 
  onImportExport, 
  onExtensionPairing 
}: ToolsMenuProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative text-foreground hover:bg-accent"
          aria-label="Tools"
        >
          <Wrench className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-72 bg-card border-border p-0" 
        align="end"
      >
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Wrench className="w-4 h-4" />
            Tools
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Quick access to password tools and utilities
          </p>
        </div>
        
        <div className="p-2 space-y-1">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-auto py-3 px-3 rounded-lg hover:bg-accent text-foreground"
            onClick={onPasswordGenerator}
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <RefreshCw className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-medium text-sm">Password Generator</div>
              <div className="text-xs text-muted-foreground">
                Create strong passwords
              </div>
            </div>
          </Button>
          
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-auto py-3 px-3 rounded-lg hover:bg-accent text-foreground"
            onClick={onImportExport}
          >
            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
              <Upload className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-medium text-sm">Import / Export</div>
              <div className="text-xs text-muted-foreground">
                Backup and restore vault
              </div>
            </div>
          </Button>
          
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-auto py-3 px-3 rounded-lg hover:bg-accent text-foreground"
            onClick={onExtensionPairing}
          >
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-medium text-sm">Browser Extension</div>
              <div className="text-xs text-muted-foreground">
                Pair with browser extension
              </div>
            </div>
          </Button>
        </div>
        
        <div className="px-4 py-3 border-t border-border bg-muted">
          <p className="text-xs text-muted-foreground text-center">
            More tools coming soon
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

