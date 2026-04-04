import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart3, TrendingUp, Users, Globe, DollarSign, Activity,
  ArrowUp, ArrowDown, RefreshCw, PieChart as PieChartIcon, Target
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import { format } from 'date-fns';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

const fetchWithAuth = async (url: string) => {
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
  });
  if (!response.ok) throw new Error('Failed to fetch');
  return response.json();
};

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('30');

  const { data: revenue, isLoading: revLoading } = useQuery({
    queryKey: ['analytics-revenue', period],
    queryFn: () => fetchWithAuth(`/api/analytics/revenue?period=${period}`),
  });

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['analytics-users'],
    queryFn: () => fetchWithAuth('/api/analytics/users'),
  });

  const { data: geo } = useQuery({
    queryKey: ['analytics-geo'],
    queryFn: () => fetchWithAuth('/api/analytics/geo'),
  });

  const { data: engagement } = useQuery({
    queryKey: ['analytics-engagement'],
    queryFn: () => fetchWithAuth('/api/analytics/engagement'),
  });

  const isLoading = revLoading || usersLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-10 w-10 animate-spin text-primary" />
          <p className="text-lg font-medium">Loading analytics...</p>
        </div>
      </div>
    );
  }

  const totals = revenue?.totals || {};
  const actBreakdown = engagement?.activityBreakdown || {};

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics & Reports</h1>
          <p className="text-muted-foreground mt-1">Deep insights into your business performance</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="revenue" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="revenue" className="flex items-center gap-2"><DollarSign className="h-4 w-4" />Revenue</TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2"><Users className="h-4 w-4" />Users</TabsTrigger>
          <TabsTrigger value="geo" className="flex items-center gap-2"><Globe className="h-4 w-4" />Geography</TabsTrigger>
          <TabsTrigger value="engagement" className="flex items-center gap-2"><Activity className="h-4 w-4" />Engagement</TabsTrigger>
        </TabsList>

        {/* REVENUE TAB */}
        <TabsContent value="revenue" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">MRR</p>
                    <p className="text-2xl font-bold">${parseFloat(totals.mrr || 0).toFixed(2)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20">
                    <DollarSign className="h-5 w-5 text-blue-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">ARR</p>
                    <p className="text-2xl font-bold">${parseFloat(totals.arr || 0).toFixed(2)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-green-50 dark:bg-green-950/20">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">ARPU</p>
                    <p className="text-2xl font-bold">${totals.arpu || '0.00'}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/20">
                    <Target className="h-5 w-5 text-purple-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Paying Customers</p>
                    <p className="text-2xl font-bold">{totals.paying_customers || 0}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-950/20">
                    <Users className="h-5 w-5 text-orange-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Revenue Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {revenue?.revenueTrend?.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenue.revenueTrend.map((r: any) => ({ ...r, date: format(new Date(r.date), 'MMM d'), revenue: parseFloat(r.revenue) }))}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                        <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--popover-foreground))' }} />
                        <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="#3b82f680" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      <p className="text-sm">No revenue data for this period</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">MRR by Plan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {revenue?.mrrByPlan?.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={revenue.mrrByPlan.map((r: any) => ({ ...r, mrr: parseFloat(r.mrr), subscribers: parseInt(r.subscribers) }))}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                        <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--popover-foreground))' }} />
                        <Bar dataKey="mrr" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      <p className="text-sm">No plan data available</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* USERS TAB */}
        <TabsContent value="users" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{users?.totalUsers || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Active Users</p>
                <p className="text-2xl font-bold text-green-600">{users?.activeUsers || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Retention Rate</p>
                <p className="text-2xl font-bold">{users?.retentionRate || 0}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Churn Rate</p>
                <p className="text-2xl font-bold text-red-600">{(100 - (users?.retentionRate || 0)).toFixed(1)}%</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">Signup Trend (30 days)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {users?.signupTrend?.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={users.signupTrend.map((r: any) => ({ ...r, date: format(new Date(r.date), 'MMM d'), count: parseInt(r.count) }))}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                        <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--popover-foreground))' }} />
                        <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground"><p className="text-sm">No signup data</p></div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Plan Distribution</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {users?.planDistribution?.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={users.planDistribution.map((r: any) => ({ ...r, value: parseInt(r.count) }))} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value}`} outerRadius={100} dataKey="value">
                          {users.planDistribution.map((_: any, index: number) => (
                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground"><p className="text-sm">No data</p></div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-lg">Status Breakdown</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {users?.statusBreakdown?.map((s: any) => (
                  <div key={s.status} className="p-4 rounded-lg border text-center">
                    <p className="text-2xl font-bold">{parseInt(s.count)}</p>
                    <Badge variant="outline" className="mt-1 capitalize">{s.status}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* GEO TAB */}
        <TabsContent value="geo" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">Customers by Region</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  {geo?.geoDistribution?.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={geo.geoDistribution.map((r: any) => ({ ...r, count: parseInt(r.count), active_count: parseInt(r.active_count) }))} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                        <YAxis dataKey="region" type="category" width={60} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--popover-foreground))' }} />
                        <Bar dataKey="count" fill="#3b82f6" name="Total" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="active_count" fill="#10b981" name="Active" radius={[0, 4, 4, 0]} />
                        <Legend />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground"><p className="text-sm">No geographic data</p></div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Revenue by Region</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {geo?.geoRevenue?.map((r: any, i: number) => (
                    <div key={r.region} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <div>
                          <p className="font-medium">{r.region || 'Unknown'}</p>
                          <p className="text-sm text-muted-foreground">{parseInt(r.customers)} customers</p>
                        </div>
                      </div>
                      <p className="font-bold">${parseFloat(r.revenue).toFixed(2)}</p>
                    </div>
                  ))}
                  {(!geo?.geoRevenue || geo.geoRevenue.length === 0) && (
                    <p className="text-center text-muted-foreground py-8">No revenue data by region</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ENGAGEMENT TAB */}
        <TabsContent value="engagement" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Active Today</p>
                <p className="text-2xl font-bold text-green-600">{parseInt(actBreakdown.active_today || 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Active This Week</p>
                <p className="text-2xl font-bold text-blue-600">{parseInt(actBreakdown.active_week || 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Active This Month</p>
                <p className="text-2xl font-bold">{parseInt(actBreakdown.active_month || 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Avg Resolution Time</p>
                <p className="text-2xl font-bold">{engagement?.avgResolutionHours || '0'}h</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">Ticket Volume (30 days)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {engagement?.ticketTrend?.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={engagement.ticketTrend.map((r: any) => ({ ...r, date: format(new Date(r.date), 'MMM d'), count: parseInt(r.count) }))}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                        <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--popover-foreground))' }} />
                        <Line type="monotone" dataKey="count" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground"><p className="text-sm">No ticket data</p></div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Ticket Status Distribution</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {engagement?.ticketStatus?.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={engagement.ticketStatus.map((r: any) => ({ name: r.status, value: parseInt(r.count) }))} cx="50%" cy="50%" outerRadius={100} labelLine={false} label={({ name, value }) => `${name}: ${value}`} dataKey="value">
                          {engagement.ticketStatus.map((_: any, index: number) => (
                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground"><p className="text-sm">No ticket data</p></div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
