import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Activity, UserPlus, MessageSquare, Mail, Bell, RefreshCw,
  Clock, Filter, ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const fetchWithAuth = async (url: string) => {
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
  });
  if (!response.ok) throw new Error('Failed to fetch');
  return response.json();
};

export default function ActivityLogPage() {
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState('all');

  const { data: activities = [], isLoading, refetch } = useQuery({
    queryKey: ['activity-feed'],
    queryFn: () => fetchWithAuth('/api/activity-feed?limit=100'),
    refetchInterval: 30000,
  });

  const { data: adminLogs } = useQuery({
    queryKey: ['admin-logs'],
    queryFn: () => fetchWithAuth('/api/admin-logs'),
  });

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'customer_signup': return <UserPlus className="h-4 w-4 text-green-500" />;
      case 'ticket_created': return <MessageSquare className="h-4 w-4 text-orange-500" />;
      case 'email_sent': return <Mail className="h-4 w-4 text-blue-500" />;
      case 'notification': return <Bell className="h-4 w-4 text-purple-500" />;
      default: return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'customer_signup': return 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400';
      case 'ticket_created': return 'bg-orange-100 text-orange-800 dark:bg-orange-950/30 dark:text-orange-400';
      case 'email_sent': return 'bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-400';
      case 'notification': return 'bg-purple-100 text-purple-800 dark:bg-purple-950/30 dark:text-purple-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-950/30 dark:text-gray-400';
    }
  };

  const getEventLabel = (type: string) => {
    switch (type) {
      case 'customer_signup': return 'Customer Signup';
      case 'ticket_created': return 'Support Ticket';
      case 'email_sent': return 'Email Sent';
      case 'notification': return 'Broadcast';
      default: return type;
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
    return format(date, 'MMM d, yyyy');
  };

  const filteredActivities = typeFilter === 'all'
    ? activities
    : activities.filter((a: any) => a.type === typeFilter);

  const eventTypes = [...new Set(activities.map((a: any) => a.type))];

  const typeCounts = activities.reduce((acc: Record<string, number>, a: any) => {
    acc[a.type] = (acc[a.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Activity Log</h1>
          <p className="text-muted-foreground mt-1">Real-time feed of all system activities</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              <SelectItem value="customer_signup">Signups</SelectItem>
              <SelectItem value="ticket_created">Tickets</SelectItem>
              <SelectItem value="email_sent">Emails</SelectItem>
              <SelectItem value="notification">Broadcasts</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setTypeFilter('customer_signup')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950/20">
              <UserPlus className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{typeCounts.customer_signup || 0}</p>
              <p className="text-xs text-muted-foreground">Signups</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setTypeFilter('ticket_created')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-950/20">
              <MessageSquare className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{typeCounts.ticket_created || 0}</p>
              <p className="text-xs text-muted-foreground">Tickets</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setTypeFilter('email_sent')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20">
              <Mail className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{typeCounts.email_sent || 0}</p>
              <p className="text-xs text-muted-foreground">Emails</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setTypeFilter('notification')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/20">
              <Bell className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{typeCounts.notification || 0}</p>
              <p className="text-xs text-muted-foreground">Broadcasts</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Timeline */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">
            {typeFilter === 'all' ? 'All Activity' : getEventLabel(typeFilter)}
            <span className="text-sm font-normal text-muted-foreground ml-2">({filteredActivities.length} events)</span>
          </CardTitle>
          {typeFilter !== 'all' && (
            <Button variant="ghost" size="sm" onClick={() => setTypeFilter('all')}>Clear filter</Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredActivities.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No activity found</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredActivities.map((activity: any, index: number) => (
                <div
                  key={`${activity.type}-${activity.resource_id}-${index}`}
                  className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {getEventIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">{activity.title}</p>
                      <Badge variant="outline" className={`text-xs ${getEventColor(activity.type)}`}>
                        {getEventLabel(activity.type)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 truncate">{activity.description}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTimeAgo(activity.timestamp)}
                    </span>
                    {activity.type === 'customer_signup' && (
                      <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => navigate(`/customers/${activity.resource_id}`)}>
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    )}
                    {activity.type === 'ticket_created' && (
                      <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => navigate('/support')}>
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin Audit Logs */}
      {adminLogs?.logs && adminLogs.logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Admin Audit Trail</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {adminLogs.logs.slice(0, 20).map((log: any) => (
                <div key={log.log_id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono text-xs">{log.action}</Badge>
                    <span>{log.resource} #{log.resource_id}</span>
                    <span className="text-muted-foreground">by {log.username || 'System'}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {log.created_at ? format(new Date(log.created_at), 'MMM d, HH:mm') : '-'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
