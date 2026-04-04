import { Button } from '@/components/ui/button';
import { Sparkles, ExternalLink } from 'lucide-react';

export interface EntitlementBannerProps {
  mode: 'pro' | 'lifetime';
  showManageButton?: boolean;
  onManage?: () => void;
}

export function EntitlementBanner({ mode, showManageButton = false, onManage }: EntitlementBannerProps) {
  const isLifetime = mode === 'lifetime';

  return (
    <div className={`rounded-lg p-4 flex items-center gap-3 ${
      isLifetime 
        ? 'bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 border border-purple-200 dark:border-purple-800'
        : 'bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 border border-blue-200 dark:border-blue-800'
    }`}>
      <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
      <div className="flex-1">
        <p className="font-semibold">
          {isLifetime ? "Lifetime Unlocked" : "You're on Pro"}
        </p>
        <p className="text-sm text-muted-foreground">
          {isLifetime ? "You're all set with lifetime access" : "Enjoying premium features"}
        </p>
      </div>
      {showManageButton && onManage && (
        <Button variant="outline" size="sm" onClick={onManage}>
          <ExternalLink className="w-4 h-4 mr-2" />
          Manage
        </Button>
      )}
    </div>
  );
}
