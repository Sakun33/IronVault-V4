import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, Send, Users, Filter, AlertCircle, Info, CheckCircle, X, Plus, Mail } from 'lucide-react';
import { format } from 'date-fns';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  target: 'all' | 'free' | 'pro' | 'lifetime' | 'specific';
  target_user_ids?: string[];
  status: 'draft' | 'scheduled' | 'sent';
  scheduled_at?: string;
  sent_at?: string;
  created_at: string;
  created_by: string;
  created_by_name?: string;
  delivered_count?: number;
  read_count?: number;
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'draft' | 'scheduled' | 'sent'>('all');

  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'success' | 'warning' | 'error',
    target: 'all' as 'all' | 'free' | 'pro' | 'lifetime' | 'specific',
    targetUserIds: [] as string[],
    scheduled: false,
    scheduledAt: '',
  });

  const { data: notifications, isLoading } = useQuery<Notification[]>({
    queryKey: ['admin-notifications', filter],
    queryFn: async () => {
      const response = await fetch(`/api/admin/notifications?filter=${filter}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch notifications');
      return response.json();
    },
  });

  const createNotificationMutation = useMutation({
    mutationFn: async (notification: typeof formData) => {
      const response = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        },
        body: JSON.stringify(notification),
      });
      if (!response.ok) throw new Error('Failed to create notification');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      setShowCreateModal(false);
      resetForm();
    },
  });

  const sendNotificationMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/notifications/${id}/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        },
      });
      if (!response.ok) throw new Error('Failed to send notification');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      message: '',
      type: 'info',
      target: 'all',
      targetUserIds: [],
      scheduled: false,
      scheduledAt: '',
    });
  };

  const handleCreateNotification = () => {
    createNotificationMutation.mutate(formData);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Info className="w-4 h-4 text-blue-600" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-100 text-green-800';
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notifications & Broadcasts</h1>
          <p className="text-muted-foreground">Send notifications and messages to users</p>
        </div>
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Notification
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Notification</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="Notification title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  placeholder="Notification message"
                  value={formData.message}
                  onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select 
                    value={formData.type} 
                    onValueChange={(value: any) => setFormData(prev => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="target">Target Audience</Label>
                  <Select 
                    value={formData.target} 
                    onValueChange={(value: any) => setFormData(prev => ({ ...prev, target: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      <SelectItem value="free">Free Plan Users</SelectItem>
                      <SelectItem value="pro">Pro Plan Users</SelectItem>
                      <SelectItem value="lifetime">Lifetime Users</SelectItem>
                      <SelectItem value="specific">Specific Users</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.scheduled}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, scheduled: checked }))}
                />
                <Label>Schedule for later</Label>
              </div>

              {formData.scheduled && (
                <div className="space-y-2">
                  <Label htmlFor="scheduledAt">Schedule Date & Time</Label>
                  <Input
                    id="scheduledAt"
                    type="datetime-local"
                    value={formData.scheduledAt}
                    onChange={(e) => setFormData(prev => ({ ...prev, scheduledAt: e.target.value }))}
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateNotification} disabled={createNotificationMutation.isPending}>
                  {formData.scheduled ? 'Schedule' : 'Send Now'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{notifications?.filter(n => n.status === 'sent').length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{notifications?.filter(n => n.status === 'scheduled').length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Drafts</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{notifications?.filter(n => n.status === 'draft').length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Delivered</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {notifications?.reduce((sum, n) => sum + (n.delivered_count || 0), 0) || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={(v: any) => setFilter(v)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="draft">Drafts</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Notifications List */}
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : !notifications || notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No notifications found
            </div>
          ) : (
            <div className="space-y-4">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start space-x-3 flex-1">
                    {getTypeIcon(notification.type)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{notification.title}</h4>
                        <Badge variant="outline" className={getTypeColor(notification.type)}>
                          {notification.type}
                        </Badge>
                        <Badge variant="outline" className={getStatusColor(notification.status)}>
                          {notification.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{notification.message}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          Target: {notification.target}
                        </span>
                        {notification.delivered_count !== undefined && (
                          <span>Delivered: {notification.delivered_count}</span>
                        )}
                        {notification.read_count !== undefined && (
                          <span>Read: {notification.read_count}</span>
                        )}
                        <span>
                          {notification.sent_at 
                            ? `Sent: ${format(new Date(notification.sent_at), 'MMM d, yyyy HH:mm')}`
                            : notification.scheduled_at
                            ? `Scheduled: ${format(new Date(notification.scheduled_at), 'MMM d, yyyy HH:mm')}`
                            : `Created: ${format(new Date(notification.created_at), 'MMM d, yyyy HH:mm')}`
                          }
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {notification.status === 'draft' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => sendNotificationMutation.mutate(notification.id)}
                        disabled={sendNotificationMutation.isPending}
                      >
                        <Send className="w-4 h-4 mr-1" />
                        Send
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

