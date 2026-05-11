import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Bell,
  X,
  Check,
  AlertTriangle,
  Info,
  CreditCard,
  Shield,
  Calendar,
  Trophy,
  Cloud,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { NotificationService, type Notification as IVNotification } from '@/lib/notifications';
import { formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { requestNotificationPermission, checkNotificationPermission } from '@/native/notifications';

interface NotificationCenterProps {
  userId: string;
  /** Optional className for the trigger button — for layout overrides. */
  triggerClassName?: string;
}

type Section = { key: 'today' | 'yesterday' | 'earlier'; label: string; items: DisplayNotification[] };

/** A notification that may represent a group of consecutive sync entries. */
type DisplayNotification = IVNotification & { syncCount?: number };

/**
 * Slide-in notification center. Replaces the older popover-style bell —
 * surfaces full history, grouped by day, with mark-all-read and per-row
 * actions. Talks to NotificationService (now keyed at `iv_notifications`)
 * for storage. Escape closes the panel via Radix Sheet defaults.
 */
export function NotificationCenter({ userId, triggerClassName }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<IVNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  // Tracks OS-level notification permission so we can surface a one-tap
  // enable prompt at the top of the panel. Re-checked when the panel opens
  // because the user may have toggled it from system settings between opens.
  const [permission, setPermission] = useState<'default' | 'granted' | 'denied'>('default');
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const granted = await checkNotificationPermission();
        if (cancelled) return;
        if (granted) setPermission('granted');
        else if (typeof Notification !== 'undefined') setPermission(Notification.permission as typeof permission);
        else setPermission('default');
      } catch {
        if (!cancelled) setPermission('default');
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    setPermission(granted ? 'granted' : 'denied');
  };

  const reload = useCallback(async () => {
    await NotificationService.fetchCrmNotifications();
    const [items, count] = await Promise.all([
      NotificationService.getNotifications(userId, 50),
      NotificationService.getUnreadCount(userId),
    ]);
    setNotifications(items);
    setUnreadCount(count);
  }, [userId]);

  useEffect(() => {
    reload();
    const interval = setInterval(reload, 30_000);
    return () => clearInterval(interval);
  }, [reload]);

  // Listen for cross-component nudges (e.g. when an event helper writes a new
  // notification we want the panel to refresh without waiting for the 30s tick).
  useEffect(() => {
    const handler = () => { reload(); };
    window.addEventListener('iv:notifications-updated', handler);
    return () => window.removeEventListener('iv:notifications-updated', handler);
  }, [reload]);

  /** Deduplicate consecutive sync notifications — keep only the latest with a count. */
  // Bucket label flows in so the synthesized title matches the date group the
  // batch was binned into — "(N times yesterday)" under YESTERDAY, never the
  // contradictory "(N times today)" the old code produced.
  const deduplicateSync = useCallback((items: IVNotification[], bucket: 'today' | 'yesterday' | 'earlier'): DisplayNotification[] => {
    const result: DisplayNotification[] = [];
    let syncBatch: IVNotification[] = [];
    const bucketWord = bucket === 'today' ? 'today' : bucket === 'yesterday' ? 'yesterday' : 'earlier';
    const flushSync = () => {
      if (syncBatch.length === 0) return;
      const latest = syncBatch[0]; // items are already sorted newest-first
      result.push({
        ...latest,
        syncCount: syncBatch.length > 1 ? syncBatch.length : undefined,
        title: syncBatch.length > 1 ? `Vault synced (${syncBatch.length} times ${bucketWord})` : latest.title,
      });
      syncBatch = [];
    };
    for (const n of items) {
      if (n.type === 'sync') {
        syncBatch.push(n);
      } else {
        flushSync();
        result.push(n);
      }
    }
    flushSync();
    return result;
  }, []);

  const sections: Section[] = useMemo(() => {
    const today: IVNotification[] = [];
    const yesterday: IVNotification[] = [];
    const earlier: IVNotification[] = [];
    for (const n of notifications) {
      const ts = new Date(n.timestamp);
      if (isToday(ts)) today.push(n);
      else if (isYesterday(ts)) yesterday.push(n);
      else earlier.push(n);
    }
    return [
      { key: 'today' as const, label: 'Today', items: deduplicateSync(today, 'today') },
      { key: 'yesterday' as const, label: 'Yesterday', items: deduplicateSync(yesterday, 'yesterday') },
      { key: 'earlier' as const, label: 'Earlier', items: deduplicateSync(earlier, 'earlier') },
    ];
  }, [notifications, deduplicateSync]);

  const handleMarkAllRead = async () => {
    await NotificationService.markAllAsRead(userId);
    reload();
  };

  const handleMarkAsRead = async (id: string) => {
    await NotificationService.markAsRead(id);
    reload();
  };

  const handleDelete = async (id: string) => {
    await NotificationService.deleteNotification(id);
    reload();
  };

  const handleClearAll = async () => {
    await NotificationService.clearAllNotifications(userId);
    reload();
  };

  const getIcon = (type: IVNotification['type']) => {
    switch (type) {
      case 'success':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'error':
        return <X className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'subscription':
        return <Calendar className="w-4 h-4 text-primary" />;
      case 'payment':
        return <CreditCard className="w-4 h-4 text-purple-500" />;
      case 'security':
        return <Shield className="w-4 h-4 text-orange-500" />;
      case 'achievement':
        return <Trophy className="w-4 h-4 text-amber-500" />;
      case 'sync':
        return <Cloud className="w-4 h-4 text-sky-500" />;
      case 'welcome':
        return <Sparkles className="w-4 h-4 text-primary" />;
      default:
        return <Info className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getAccentBorder = (type: IVNotification['type']) => {
    switch (type) {
      case 'sync': return 'border-l-2 border-l-cyan-400/50';
      case 'security': return 'border-l-2 border-l-red-400/50';
      case 'achievement': return 'border-l-2 border-l-amber-400/50';
      case 'welcome': return 'border-l-2 border-l-emerald-400/50';
      default: return '';
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`relative h-9 w-9 rounded-xl flex-shrink-0 hover:bg-accent overflow-visible ${triggerClassName ?? ''}`}
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
          data-testid="notification-center-trigger"
        >
          <Bell className="w-4 h-4 text-muted-foreground" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-semibold leading-none ring-2 ring-background"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col [&>button]:z-50"
      >
        <SheetHeader className="pt-[calc(env(safe-area-inset-top,0px)+16px)] px-4 pb-4 border-b border-border space-y-0">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="text-left">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {unreadCount} unread
                </span>
              )}
            </SheetTitle>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllRead}
                className="text-xs text-primary hover:text-primary/90 mr-8"
              >
                Mark all read
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto bg-muted/20 dark:bg-muted/10">
          {/* Permission CTA — surfaces a one-tap enable prompt when the OS
              hasn't granted notification permission yet. Hidden once granted
              or explicitly denied (we don't badger after a denial). */}
          {permission === 'default' && (
            <div className="m-4 rounded-2xl bg-card border border-border/50 shadow-[0_1px_0_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="p-4 flex items-start gap-3">
                <span className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Bell className="w-5 h-5 text-primary" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium text-foreground leading-tight">Turn on push alerts</p>
                  <p className="text-[13px] text-muted-foreground mt-0.5 leading-snug">
                    Get reminders for renewals, expiring keys, and security warnings — even when the app is closed.
                  </p>
                  <Button
                    size="sm"
                    onClick={handleEnableNotifications}
                    className="mt-3 rounded-xl"
                    data-testid="notifications-enable-cta"
                  >
                    Enable
                  </Button>
                </div>
              </div>
            </div>
          )}

          {notifications.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Bell className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">You're all caught up</p>
              <p className="text-xs mt-1">New notifications will appear here.</p>
            </div>
          ) : (
            <div className="space-y-5 pt-2 pb-5">
              {sections.filter(s => s.items.length > 0).map(section => (
                <div key={section.key} className="px-4">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/80 px-3 pb-1.5">
                    {section.label}
                  </h3>
                  <div className="rounded-2xl bg-card overflow-hidden shadow-[0_1px_0_rgba(0,0,0,0.04)] border border-border/50">
                    {section.items.map((n, idx) => (
                      <div key={n.id}>
                        {idx > 0 && <div aria-hidden className="h-px bg-border/50 ml-[60px]" />}
                        {/* Outer is a div, not a button — the dismiss control is its own button.
                            Nested <button> elements are invalid HTML and trip a11y tooling. */}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => !n.read && handleMarkAsRead(n.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              if (!n.read) handleMarkAsRead(n.id);
                            }
                          }}
                          className={`w-full text-left flex items-start gap-3 px-4 py-3 ${getAccentBorder(n.type)} active:bg-muted/60 hover:bg-muted/40 transition-colors cursor-pointer`}
                        >
                          <span className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
                            {getIcon(n.type)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-2">
                              <p className={`text-[15px] leading-snug truncate ${
                                !n.read ? 'font-medium text-foreground' : 'text-muted-foreground'
                              }`}>
                                {n.title}
                              </p>
                              {!n.read && (
                                <span className="flex-shrink-0 mt-1.5 w-2 h-2 rounded-full bg-primary" />
                              )}
                            </div>
                            {n.message && (
                              <p className="text-[13px] text-muted-foreground mt-0.5 line-clamp-2 leading-snug">
                                {n.message}
                              </p>
                            )}
                            <p className="text-[11px] text-muted-foreground/80 mt-1">
                              {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true })}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDelete(n.id); }}
                            className="h-7 w-7 flex-shrink-0 rounded-md flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-muted/60"
                            aria-label="Dismiss"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {notifications.length > 0 && (
          <div className="p-3 border-t border-border bg-background">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="w-full text-xs text-muted-foreground hover:text-destructive"
            >
              Clear all notifications
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
