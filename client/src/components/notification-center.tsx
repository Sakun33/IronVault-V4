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
import { NotificationService, Notification } from '@/lib/notifications';
import { formatDistanceToNow, isToday, isYesterday } from 'date-fns';

interface NotificationCenterProps {
  userId: string;
  /** Optional className for the trigger button — for layout overrides. */
  triggerClassName?: string;
}

type Section = { key: 'today' | 'yesterday' | 'earlier'; label: string; items: Notification[] };

/**
 * Slide-in notification center. Replaces the older popover-style bell —
 * surfaces full history, grouped by day, with mark-all-read and per-row
 * actions. Talks to NotificationService (now keyed at `iv_notifications`)
 * for storage. Escape closes the panel via Radix Sheet defaults.
 */
export function NotificationCenter({ userId, triggerClassName }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

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

  const sections: Section[] = useMemo(() => {
    const today: Notification[] = [];
    const yesterday: Notification[] = [];
    const earlier: Notification[] = [];
    for (const n of notifications) {
      const ts = new Date(n.timestamp);
      if (isToday(ts)) today.push(n);
      else if (isYesterday(ts)) yesterday.push(n);
      else earlier.push(n);
    }
    return [
      { key: 'today', label: 'Today', items: today },
      { key: 'yesterday', label: 'Yesterday', items: yesterday },
      { key: 'earlier', label: 'Earlier', items: earlier },
    ];
  }, [notifications]);

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

  const getIcon = (type: Notification['type']) => {
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

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`relative h-9 w-9 rounded-xl flex-shrink-0 hover:bg-accent ${triggerClassName ?? ''}`}
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
          data-testid="notification-center-trigger"
        >
          <Bell className="w-4 h-4 text-muted-foreground" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 w-4 h-4 min-w-0 flex items-center justify-center text-[10px] leading-none p-0"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col"
      >
        <SheetHeader className="p-4 border-b border-border space-y-0">
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

        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Bell className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">You're all caught up</p>
              <p className="text-xs mt-1">New notifications will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {sections.filter(s => s.items.length > 0).map(section => (
                <div key={section.key}>
                  <div className="px-4 py-2 bg-muted/40 sticky top-0 z-10 backdrop-blur">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {section.label}
                    </h3>
                  </div>
                  <ul>
                    {section.items.map(n => (
                      <li
                        key={n.id}
                        className={`group flex items-start gap-3 px-4 py-3 hover:bg-accent/50 transition-colors ${
                          !n.read ? 'bg-primary/[0.03]' : ''
                        }`}
                        onClick={() => !n.read && handleMarkAsRead(n.id)}
                      >
                        <div className="flex-shrink-0 mt-0.5">{getIcon(n.type)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            <p className={`text-sm font-medium truncate ${
                              !n.read ? 'text-foreground' : 'text-muted-foreground'
                            }`}>
                              {n.title}
                            </p>
                            {!n.read && (
                              <span className="flex-shrink-0 mt-1.5 w-2 h-2 rounded-full bg-primary" />
                            )}
                          </div>
                          {n.message && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {n.message}
                            </p>
                          )}
                          <p className="text-[11px] text-muted-foreground/80 mt-1">
                            {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true })}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); handleDelete(n.id); }}
                          className="opacity-0 group-hover:opacity-100 h-7 w-7 flex-shrink-0"
                          aria-label="Dismiss"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
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
