import { useEffect, useState } from 'react';
import { Cloud, CloudOff, Check, RefreshCw, AlertTriangle } from 'lucide-react';
import {
  getSyncStatus,
  getLastSyncAt,
  getLastSyncError,
  isCloudSyncEligible,
  retryNow,
  type SyncStatus,
} from '@/lib/cloud-sync-queue';

interface Props {
  /** Active vault id; used to decide whether sync is even applicable. */
  vaultId: string | null | undefined;
  /** Use a tighter compact pill (no "Last synced" subtext). */
  compact?: boolean;
}

function formatRelative(ts: number | null): string {
  if (!ts) return '';
  const delta = Date.now() - ts;
  if (delta < 60_000) return 'just now';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return `${Math.floor(delta / 86_400_000)}d ago`;
}

/**
 * Always-visible cloud-sync status pill. Renders next to the vault name in
 * the header so the user can see at a glance whether their data is on the
 * server. Clicking the pill in the failed state retries the push.
 *
 * State diagram (driven by `cloud-sync-queue` + the push-status events):
 *   - no token / opted into local-only      → CloudOff "Local only"
 *   - idle (initial mount, never synced)    → Cloud "Not synced yet"
 *   - syncing / pending / retrying          → spinner "Syncing…"
 *   - synced                                → Check "Synced N min ago"
 *   - failed                                → AlertTriangle "Sync failed · Retry"
 */
export function CloudSyncPill({ vaultId, compact }: Props) {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus());
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(getLastSyncAt());
  const [lastError, setLastError] = useState<string | null>(getLastSyncError());
  const [, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => {
      setStatus(getSyncStatus());
      setLastSyncAt(getLastSyncAt());
      setLastError(getLastSyncError());
    };
    const onStart = () => refresh();
    const onDone = () => refresh();
    const onFailed = () => refresh();
    window.addEventListener('vault:cloud:push:start', onStart);
    window.addEventListener('vault:cloud:push:done', onDone);
    window.addEventListener('vault:cloud:push:failed', onFailed);
    // Tick once a minute so "Synced 2m ago" updates while the user idles.
    const tickId = window.setInterval(() => setTick(t => t + 1), 60_000);
    return () => {
      window.removeEventListener('vault:cloud:push:start', onStart);
      window.removeEventListener('vault:cloud:push:done', onDone);
      window.removeEventListener('vault:cloud:push:failed', onFailed);
      window.clearInterval(tickId);
    };
  }, []);

  const eligible = isCloudSyncEligible(vaultId ?? null);

  if (!eligible) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/40 text-muted-foreground ${
          compact ? 'h-6 px-2 text-[11px]' : 'h-7 px-2.5 text-xs'
        }`}
        title="This vault is stored only on this device"
        data-testid="cloud-sync-pill-local"
      >
        <CloudOff className="w-3 h-3 flex-shrink-0" /> Local only
      </span>
    );
  }

  if (status === 'syncing' || status === 'pending' || status === 'retrying') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 ${
          compact ? 'h-6 px-2 text-[11px]' : 'h-7 px-2.5 text-xs'
        }`}
        data-testid="cloud-sync-pill-syncing"
      >
        <RefreshCw className="w-3 h-3 flex-shrink-0 animate-spin" />
        {status === 'retrying' ? 'Retrying…' : 'Syncing…'}
      </span>
    );
  }

  if (status === 'failed') {
    return (
      <button
        type="button"
        onClick={() => retryNow()}
        title={lastError || 'Tap to retry'}
        className={`inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15 transition-colors ${
          compact ? 'h-6 px-2 text-[11px]' : 'h-7 px-2.5 text-xs'
        }`}
        data-testid="cloud-sync-pill-failed"
      >
        <AlertTriangle className="w-3 h-3 flex-shrink-0" />
        Sync failed
        {!compact && <span className="opacity-70">· Retry</span>}
      </button>
    );
  }

  // 'idle' or 'synced' — both render as the green-dot variant when we have
  // a lastSyncAt; otherwise show the neutral "not synced yet" state.
  if (lastSyncAt) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 ${
          compact ? 'h-6 px-2 text-[11px]' : 'h-7 px-2.5 text-xs'
        }`}
        title={`Last synced ${new Date(lastSyncAt).toLocaleString()}`}
        data-testid="cloud-sync-pill-synced"
      >
        <Check className="w-3 h-3 flex-shrink-0" />
        {compact ? 'Synced' : `Synced ${formatRelative(lastSyncAt)}`}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/40 text-muted-foreground ${
        compact ? 'h-6 px-2 text-[11px]' : 'h-7 px-2.5 text-xs'
      }`}
      title="Cloud sync is on for this vault — first push will run after your next save"
      data-testid="cloud-sync-pill-ready"
    >
      <Cloud className="w-3 h-3 flex-shrink-0" /> Cloud sync on
    </span>
  );
}
