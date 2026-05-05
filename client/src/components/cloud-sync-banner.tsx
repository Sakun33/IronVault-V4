import { useEffect, useState } from 'react';
import { Check, RefreshCw, AlertTriangle } from 'lucide-react';

type Status = 'idle' | 'syncing' | 'synced' | 'failed';

interface Props {
  /** True while a pull is in flight (replaces local data with cloud blob). */
  isCloudSyncing: boolean;
  /** Push status from vault-context. Fires for every CRUD mutation. */
  cloudSyncStatus: Status;
  /** Last push error message; only meaningful when status === 'failed'. */
  lastSyncError: string | null;
  /** Manually retry the last push. */
  onRetry: () => void;
}

/**
 * Top-of-page sync indicator. Renders only when there is something to say
 * (sync in flight, just succeeded, or just failed). Hides itself on idle so
 * it never adds chrome to the page when the vault is quiet.
 *
 * Each state has its own color so it's readable at a glance:
 *  - syncing: indigo, animated spinner
 *  - synced:  emerald, check icon (auto-hides after a few seconds)
 *  - failed:  amber, retry button with the actual error message
 */
export function CloudSyncBanner({ isCloudSyncing, cloudSyncStatus, lastSyncError, onRetry }: Props) {
  // Render nothing on `idle`. We track a brief "just-succeeded" animation
  // ourselves so the banner can fade out instead of disappearing instantly.
  const [visible, setVisible] = useState<Status | 'pulling' | 'idle'>('idle');

  useEffect(() => {
    if (isCloudSyncing) { setVisible('pulling'); return; }
    if (cloudSyncStatus === 'syncing') { setVisible('syncing'); return; }
    if (cloudSyncStatus === 'synced')  { setVisible('synced');  return; }
    if (cloudSyncStatus === 'failed')  { setVisible('failed');  return; }
    setVisible('idle');
  }, [isCloudSyncing, cloudSyncStatus]);

  if (visible === 'idle') return null;

  if (visible === 'pulling' || visible === 'syncing') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border-b border-indigo-500/20 text-indigo-300 text-sm"
        data-testid="cloud-sync-banner-syncing"
      >
        <RefreshCw className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
        {visible === 'pulling' ? 'Syncing from cloud…' : 'Syncing changes…'}
      </div>
    );
  }

  if (visible === 'synced') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-300 text-sm transition-opacity"
        data-testid="cloud-sync-banner-synced"
      >
        <Check className="w-3.5 h-3.5 flex-shrink-0" />
        Synced to cloud
      </div>
    );
  }

  // failed
  return (
    <div
      role="alert"
      className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 text-amber-300 text-sm"
      data-testid="cloud-sync-banner-failed"
    >
      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="flex-1 min-w-0 truncate">
        Sync failed{lastSyncError ? `: ${lastSyncError}` : ''}
      </span>
      <button
        type="button"
        onClick={onRetry}
        className="px-2 py-0.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-semibold transition-colors flex-shrink-0"
        data-testid="cloud-sync-retry"
      >
        Retry
      </button>
    </div>
  );
}
