import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { 
  Menu, 
  X, 
  BarChart3, 
  Users, 
  CreditCard, 
  MessageSquare, 
  Settings, 
  LogOut,
  Bell,
  Search,
  ChevronRight,
  Moon,
  Sun,
  Check,
  CheckCheck,
  TrendingUp,
  Mail,
  Tag,
  Activity,
  Megaphone
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

interface LayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: BarChart3 },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Analytics', href: '/analytics', icon: TrendingUp },
  { name: 'Plans', href: '/plans', icon: CreditCard },
  { name: 'Support', href: '/support', icon: MessageSquare },
  { name: 'Email Center', href: '/email-center', icon: Mail },
  { name: 'Broadcasts', href: '/notifications', icon: Megaphone },
  { name: 'Promotions', href: '/promotions', icon: Tag },
  { name: 'Activity Log', href: '/activity', icon: Activity },
  { name: 'Settings', href: '/settings', icon: Settings },
];

interface Notification {
  id: number;
  type: 'customer_signup' | 'ticket_created' | 'ticket_updated' | 'system';
  title: string;
  message: string;
  link?: string;
  read: boolean;
  created_at: string;
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    logout();
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  // Fetch notifications
  const { data: notifications = [], refetch: refetchNotifications } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/notifications', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
          }
        });
        if (!response.ok) {
          if (response.status === 401) return [];
          throw new Error('Failed to fetch notifications');
        }
        return response.json();
      } catch (error) {
        console.error('Notification fetch error:', error);
        return [];
      }
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    enabled: !!user,
    retry: false
  });

  // Fetch unread count
  const { data: unreadCount = { count: 0 } } = useQuery<{ count: number }>({
    queryKey: ['notifications-count'],
    queryFn: async () => {
      const response = await fetch('/api/notifications/count', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        }
      });
      if (!response.ok) return { count: 0 };
      return response.json();
    },
    refetchInterval: 30000,
    enabled: !!user,
    retry: false
  });

  const markAsRead = async (notificationId: number) => {
    try {
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        }
      });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications/read-all', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        }
      });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
      setNotificationOpen(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-64 p-0 border-r">
          <div className="flex h-full flex-col">
            <div className="flex h-16 items-center justify-between px-6 border-b">
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                SecureVault
              </h1>
              <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="flex-1 space-y-2 px-4 py-6">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center justify-between px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                        : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="h-5 w-5" />
                      {item.name}
                    </div>
                    {isActive && <ChevronRight className="h-4 w-4" />}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t p-4">
              <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-muted/50">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                  {user?.username?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{user?.username}</p>
                  <p className="text-xs text-muted-foreground capitalize truncate">{user?.role}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={handleLogout} className="h-8 w-8 p-0">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col border-r bg-card">
        <div className="flex flex-col flex-grow">
          <div className="flex h-16 items-center px-6 border-b">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              SecureVault Admin
            </h1>
          </div>
          <nav className="flex-1 space-y-2 px-4 py-6">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center justify-between px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                      : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </div>
                  {isActive && <ChevronRight className="h-4 w-4" />}
                </Link>
              );
            })}
          </nav>
          <div className="border-t p-4">
            <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-muted/50">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{user?.username}</p>
                <p className="text-xs text-muted-foreground capitalize truncate">{user?.role?.replace('_', ' ')}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="h-9 w-9 p-0 hover:bg-destructive/10 hover:text-destructive">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Top navigation */}
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b bg-card px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6 items-center">
            <form
              className="relative flex flex-1 max-w-md"
              onSubmit={(e) => {
                e.preventDefault();
                if (searchQuery.trim()) {
                  navigate(`/customers?search=${encodeURIComponent(searchQuery.trim())}`);
                }
              }}
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customers, tickets..."
                className="pl-10 font-medium border-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </form>
            <div className="flex items-center gap-x-3 lg:gap-x-4 ml-auto">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={toggleDarkMode}
                className="h-9 w-9 rounded-full"
              >
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Popover open={notificationOpen} onOpenChange={setNotificationOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9 rounded-full relative">
                    <Bell className="h-4 w-4" />
                    {unreadCount.count > 0 && (
                      <Badge 
                        variant="destructive" 
                        className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full p-0 text-[10px] font-bold"
                      >
                        {unreadCount.count > 99 ? '99+' : unreadCount.count}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                  <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="font-semibold text-sm">Notifications</h3>
                    {unreadCount.count > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={markAllAsRead}
                      >
                        <CheckCheck className="h-3 w-3 mr-1" />
                        Mark all read
                      </Button>
                    )}
                  </div>
                  <ScrollArea className="h-[400px]">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        <Bell className="h-8 w-8 mx-auto mb-2 opacity-20" />
                        <p className="text-sm">No notifications yet</p>
                        <p className="text-xs mt-1">You'll see notifications here when customers sign up or create tickets</p>
                      </div>
                    ) : (
                      <div className="divide-y">
                        {notifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={`p-4 cursor-pointer hover:bg-accent transition-colors ${
                              !notification.read ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                            }`}
                            onClick={() => handleNotificationClick(notification)}
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className={`text-sm font-semibold ${!notification.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                                    {notification.title}
                                  </p>
                                  {!notification.read && (
                                    <div className="h-2 w-2 rounded-full bg-primary" />
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {notification.message}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {formatTimeAgo(notification.created_at)}
                                </p>
                              </div>
                              {!notification.read && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markAsRead(notification.id);
                                  }}
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
