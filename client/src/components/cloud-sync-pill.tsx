import { useEffect, useState } from 'react';
import { Cloud, CloudOff, Check, RefreshCw, AlertTriangle } from 'lucide-react';
import {
  getSyncStatus,
  getLastSyncAt,
  getLastSyncError,
  isLocalOnly,
  retryNow,
  type SyncStatus,
} from '@/lib/cloud-sync-queue';
import { getCloudToken } from '@/lib/cloud-vault-sync';

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
 * Always-visible cloud-sync status pill.
 *
 * State priority (highest first):
 *   1. Vault opted into local-only      → CloudOff "Local only"
 *   2. Push in flight / queued / retry  → spinner "Syncing…"
 *   3. Push failed                      → AlertTriangle "Sync failed · Retry"
 *   4. Has a recorded successful push   → Check "Synced N min ago"
 *   5. Cloud token missing (paid user mid token-refresh after cache clear)
 *                                       → Cloud "Reconnecting…"
 *   6. Otherwise (eligible, never synced yet)
 *                                       → Cloud "Cloud sync on"
 *
 * Only state 1 reads "Local only" — and that ONLY happens for users who
 * explicitly opted in (or whose server replied 403 PLAN_UPGRADE_REQUIRED
 * on a push). A Lifetime/Pro user mid token-refresh now reads
 * "Reconnecting…" instead of the alarming "Local only".
 */
export function CloudSyncPill({ vaultId, compact }: Props) {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus());
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(getLastSyncAt());
  const [lastError, setLastError] = useState<string | null>(getLastSyncError());
  const [hasToken, setHasToken] = useState<boolean>(!!getCloudToken());
  const [, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => {
      setStatus(getSyncStatus());
      setLastSyncAt(getLastSyncAt());
      setLastError(getLastSyncError());
      setHasToken(!!getCloudToken());
    };
    const onStart = () => refresh();
    const onDone = () => refresh();
    const onFailed = () => refresh();
    // The token can land at any point during reconnect — re-check on a
    // localStorage change so we flip out of "Reconnecting…" the instant
    // it arrives (login flow stores it via storeCloudToken which triggers
    // a `storage` event in other tabs and we also poll once a minute as
    // a fallback for same-tab writes).
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'iv_cloud_token') refresh();
    };
    window.addEventListener('vault:cloud:push:start', onStart);
    window.addEventListener('vault:cloud:push:done', onDone);
    window.addEventListener('vault:cloud:push:failed', onFailed);
    window.addEventListener('storage', onStorage);
    const tickId = window.setInterval(() => {
      setHasToken(!!getCloudToken());
      setTick(t => t + 1);
    }, 60_000);
    return () => {
      window.removeEventListener('vault:cloud:push:start', onStart);
      window.removeEventListener('vault:cloud:push:done', onDone);
      window.removeEventListener('vault:cloud:push:failed', onFailed);
      window.removeEventListener('storage', onStorage);
      window.clearInterval(tickId);
    };
  }, []);

  // Explicit opt-out — the only state that reads "Local only".
  if (vaultId && isLocalOnly(vaultId)) {
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

  if (!vaultId) {
    return null;
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

  // 'idle' or 'synced' — render the green-dot variant when we have a
  // recorded lastSyncAt.
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

  // No token yet — paid user mid token-refresh after a cache clear, or a
  // newly-signed-up user whose token-acquire hasn't landed yet. Showing
  // "Local only" here would scare a Lifetime customer into thinking their
  // data is stranded; show a soft "Reconnecting…" instead. The queue's
  // retry loop will surface a real success or failure once the next push
  // attempt runs.
  if (!hasToken) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-300 ${
          compact ? 'h-6 px-2 text-[11px]' : 'h-7 px-2.5 text-xs'
        }`}
        title="Reconnecting to cloud sync — your local data is safe"
        data-testid="cloud-sync-pill-reconnecting"
      >
        <RefreshCw className="w-3 h-3 flex-shrink-0 animate-spin" />
        Reconnecting…
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 ${
        compact ? 'h-6 px-2 text-[11px]' : 'h-7 px-2.5 text-xs'
      }`}
      title="Cloud sync is on for this vault — first push will run after your next save"
      data-testid="cloud-sync-pill-ready"
    >
      <Cloud className="w-3 h-3 flex-shrink-0" /> Cloud sync on
    </span>
  );
}
