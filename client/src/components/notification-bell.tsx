import React, { useState, useEffect } from 'react';
import { Bell, X, Check, AlertTriangle, Info, CreditCard, Shield, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { NotificationService, Notification } from '@/lib/notifications';
import { formatDistanceToNow } from 'date-fns';

interface NotificationBellProps {
  userId: string;
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    loadNotifications();
    
    // Refresh notifications every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  const loadNotifications = async () => {
    // Fetch CRM notifications from backend first
    await NotificationService.fetchCrmNotifications();
    const [notifs, count] = await Promise.all([
      NotificationService.getNotifications(userId, 10),
      NotificationService.getUnreadCount(userId),
    ]);
    setNotifications(notifs);
    setUnreadCount(count);
  };

  const handleMarkAsRead = async (notificationId: string) => {
    await NotificationService.markAsRead(notificationId);
    loadNotifications();
  };

  const handleMarkAllAsRead = async () => {
    await NotificationService.markAllAsRead(userId);
    loadNotifications();
  };

  const handleDeleteNotification = async (notificationId: string) => {
    await NotificationService.deleteNotification(notificationId);
    loadNotifications();
  };

  const getNotificationIcon = (type: string) => {
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
      default:
        return <Info className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'border-l-green-500 bg-green-50 dark:bg-green-950/20';
      case 'error':
        return 'border-l-red-500 bg-red-50 dark:bg-red-950/20';
      case 'warning':
        return 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20';
      case 'subscription':
        return 'border-l-primary bg-primary/10';
      case 'payment':
        return 'border-l-purple-500 bg-purple-50 dark:bg-purple-950/20';
      case 'security':
        return 'border-l-orange-500 bg-orange-50 dark:bg-orange-950/20';
      default:
        return 'border-l-border bg-muted';
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative p-2 rounded-xl hover:bg-accent"
        >
          <Bell className="w-5 h-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center text-xs p-0"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                className="text-xs text-primary hover:text-primary/90"
              >
                Mark all read
              </Button>
            )}
          </div>
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              {notifications.map((notification) => (
                <Card
                  key={notification.id}
                  className={`border-l-4 rounded-none border-0 ${getNotificationColor(notification.type)} ${
                    !notification.read ? 'bg-opacity-100' : 'bg-opacity-50'
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className={`text-sm font-medium ${
                              !notification.read 
                                ? 'text-foreground' 
                                : 'text-muted-foreground'
                            }`}>
                              {notification.title}
                            </h4>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {!notification.read && (
                              <div className="w-2 h-2 bg-primary rounded-full" />
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteNotification(notification.id)}
                              className="p-1 h-6 w-6 hover:bg-red-100 dark:hover:bg-red-900"
                            >
                              <X className="w-3 h-3 text-muted-foreground" />
                            </Button>
                          </div>
                        </div>
                        
                        {notification.actionUrl && notification.actionText && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2 text-xs text-primary hover:text-primary/90 p-0 h-auto"
                            onClick={() => {
                              // Handle action
                              if (!notification.read) {
                                handleMarkAsRead(notification.id);
                              }
                            }}
                          >
                            {notification.actionText}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
        
        {notifications.length > 0 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-primary hover:text-primary/90"
              onClick={() => {
                // Navigate to full notifications page
                setIsOpen(false);
              }}
            >
              View all notifications
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
