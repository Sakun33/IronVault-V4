import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  RefreshCw, Users, DollarSign, TrendingUp, UserPlus, AlertTriangle,
  Activity, ArrowUp, ArrowDown, MessageSquare, Mail, Bell, Tag, BarChart3,
  Send, Clock, ArrowRight, Plus
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { format } from 'date-fns';

interface KPIData {
  totalCustomers: number;
  activeCustomers: number;
  totalRevenue: number;
  newSignups: number;
  churnRate: number;
  mrr: number;
}

const COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#06b6d4',
  purple: '#8b5cf6'
};

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

function RecentActivityFeed() {
  const { data: activities = [] } = useQuery({
    queryKey: ['dashboard-activity'],
    queryFn: async () => {
      const response = await fetch('/api/activity-feed?limit=8', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      });
      if (!response.ok) return [];
      return response.json();
    },
    refetchInterval: 30000,
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'customer_signup': return <UserPlus className="h-4 w-4 text-green-500" />;
      case 'ticket_created': return <MessageSquare className="h-4 w-4 text-orange-500" />;
      case 'email_sent': return <Mail className="h-4 w-4 text-blue-500" />;
      case 'notification': return <Bell className="h-4 w-4 text-purple-500" />;
      default: return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Activity className="h-8 w-8 mx-auto mb-2 opacity-20" />
        <p className="text-sm">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {activities.map((a: any, i: number) => (
        <div key={`${a.type}-${a.resource_id}-${i}`} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
          <div className="mt-0.5 flex-shrink-0">{getIcon(a.type)}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{a.title}</p>
            <p className="text-xs text-muted-foreground truncate">{a.description}</p>
          </div>
          <span className="text-xs text-muted-foreground flex-shrink-0 flex items-center gap-1">
            <Clock className="h-3 w-3" />{formatTimeAgo(a.timestamp)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();

  const { data: kpis, isLoading, refetch } = useQuery<KPIData>({
    queryKey: ['dashboard-kpis'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/kpis', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch KPIs');
      return response.json();
    },
    refetchInterval: 300000,
  });

  const { data: analytics } = useQuery({
    queryKey: ['dashboard-analytics'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/analytics', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return response.json();
    },
  });

  // Calculate plan distribution from real data - MUST be before early return
  const planDistribution = React.useMemo(() => {
    if (!analytics?.planStats) return [];
    
    const planStats = analytics.planStats;
    const total = Object.values(planStats).reduce((sum: number, count: any) => sum + (Number(count) || 0), 0 as number);
    
    if (total === 0) return [];
    
    return Object.entries(planStats).map(([name, value]: [string, any]) => {
      const numValue = Number(value) || 0;
      return {
        name,
        value: numValue,
        percentage: total > 0 ? Math.round((numValue / total) * 100) : 0
      };
    });
  }, [analytics]);

  const handleRefresh = () => {
    refetch();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-10 w-10 animate-spin text-primary" />
          <p className="text-lg font-medium text-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const kpiCards = [
    {
      title: 'Total Customers',
      value: (kpis?.totalCustomers || 0).toLocaleString(),
      icon: Users,
      color: COLORS.primary,
      bgColor: 'bg-blue-50 dark:bg-blue-950/20',
    },
    {
      title: 'Active Customers',
      value: (kpis?.activeCustomers || 0).toLocaleString(),
      icon: Activity,
      color: COLORS.success,
      bgColor: 'bg-green-50 dark:bg-green-950/20',
    },
    {
      title: 'Monthly Revenue (MRR)',
      value: `$${(kpis?.mrr || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: COLORS.purple,
      bgColor: 'bg-purple-50 dark:bg-purple-950/20',
    },
    {
      title: 'New Signups (24h)',
      value: (kpis?.newSignups || 0).toLocaleString(),
      icon: UserPlus,
      color: COLORS.warning,
      bgColor: 'bg-orange-50 dark:bg-orange-950/20',
    },
    {
      title: 'Churn Rate',
      value: `${(kpis?.churnRate || 0).toFixed(1)}%`,
      icon: AlertTriangle,
      color: COLORS.danger,
      bgColor: 'bg-red-50 dark:bg-red-950/20',
    },
    {
      title: 'Total Revenue',
      value: `$${(kpis?.totalRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: TrendingUp,
      color: COLORS.info,
      bgColor: 'bg-cyan-50 dark:bg-cyan-950/20',
    },
  ];

  // Use real analytics data or empty arrays if no data
  const dailyActiveUsers = analytics?.dailyActivity || [];

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1.5">Welcome back! Here's your business overview.</p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="default" className="shadow-sm hover:shadow-md transition-all">
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Data
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        {kpiCards.map((card, index) => (
          <Card key={index} className="border shadow-sm hover:shadow-md transition-all duration-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    {card.title}
                  </p>
                  <h3 className="text-2xl font-bold text-foreground">
                    {card.value}
                  </h3>
                </div>
                <div className={`p-3 rounded-xl ${card.bgColor}`}>
                  <card.icon className="h-6 w-6" style={{ color: card.color }} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Active Users Chart */}
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">Daily Active Users</CardTitle>
            <p className="text-sm text-muted-foreground">User activity over the past week</p>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {dailyActiveUsers && dailyActiveUsers.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyActiveUsers}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--popover-foreground))'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="users" 
                      stroke={COLORS.primary}
                      strokeWidth={3}
                      dot={{ fill: COLORS.primary, r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Activity className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">No activity data yet</p>
                    <p className="text-xs mt-1">Data will appear as customers use the app</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Plan Distribution Chart */}
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">Plan Distribution</CardTitle>
            <p className="text-sm text-muted-foreground">Customer distribution across plans</p>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center">
              {planDistribution && planDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={planDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {planDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--popover-foreground))'
                      }}
                    />
                    <Legend 
                      wrapperStyle={{
                        paddingTop: '20px',
                        fontSize: '14px',
                        color: 'hsl(var(--foreground))'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No customers yet</p>
                  <p className="text-xs mt-1">Plan distribution will appear here once customers sign up</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plan Details Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {planDistribution.map((plan, index) => (
          <Card key={index} className="border shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-foreground">{plan.name}</h4>
                <div 
                  className="h-3 w-3 rounded-full" 
                  style={{ backgroundColor: PIE_COLORS[index] }}
                />
              </div>
              <p className="text-2xl font-bold text-foreground mb-1">
                {plan.value.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">
                {plan.percentage}% of total
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/customers')}>
              <Users className="h-4 w-4 mr-3 text-blue-500" />View Customers
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/support')}>
              <MessageSquare className="h-4 w-4 mr-3 text-orange-500" />Manage Tickets
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/analytics')}>
              <BarChart3 className="h-4 w-4 mr-3 text-purple-500" />View Analytics
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/email-center')}>
              <Mail className="h-4 w-4 mr-3 text-green-500" />Email Center
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/notifications')}>
              <Bell className="h-4 w-4 mr-3 text-cyan-500" />Send Broadcast
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/promotions')}>
              <Tag className="h-4 w-4 mr-3 text-pink-500" />Manage Promos
            </Button>
          </CardContent>
        </Card>

        {/* Recent Activity Feed */}
        <Card className="border shadow-sm lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/activity')}>
              View All <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <RecentActivityFeed />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
