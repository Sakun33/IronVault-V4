import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, Trash2, Search, Calendar, Filter, Clock, Shield, Key, Bookmark, FileText, DollarSign, Bell, Settings } from 'lucide-react';
import { useLogging } from '@/contexts/logging-context';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { isNativeApp } from '@/native/platform';

export default function Logging() {
  const { logs, clearLogs } = useLogging();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');

  const handleExportLogs = async () => {
    try {
      const csvContent = [
        'Timestamp,Action,Category,Description,IP Address',
        ...logs.map(log =>
          `"${new Date(log.timestamp).toISOString()}","${log.action}","${log.category}","${log.description}","${log.ipAddress || ''}"`
        ),
      ].join('\n');
      const filename = `ironvault-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;

      if (isNativeApp()) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');
        await Filesystem.writeFile({ path: filename, data: csvContent, directory: Directory.Cache, encoding: 'utf8' as any });
        const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
        await Share.share({ title: 'IronVault Logs', url: uri, dialogTitle: 'Save Logs' });
      } else {
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      toast({ title: 'Logs Exported', description: `${logs.length} entr${logs.length === 1 ? 'y' : 'ies'} exported` });
    } catch {
      toast({ title: 'Export Failed', description: 'Failed to export logs', variant: 'destructive' });
    }
  };

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Search filter
      const matchesSearch = searchQuery === '' || 
        log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.description.toLowerCase().includes(searchQuery.toLowerCase());

      // Category filter
      const matchesCategory = categoryFilter === 'all' || 
        log.category === categoryFilter;

      // Date filter
      const matchesDate = (() => {
        if (dateFilter === 'all') return true;
        
        const now = new Date();
        const logDate = new Date(log.timestamp);
        
        switch (dateFilter) {
          case 'today':
            return logDate.toDateString() === now.toDateString();
          case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return logDate >= weekAgo;
          case 'month':
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            return logDate >= monthAgo;
          default:
            return true;
        }
      })();

      return matchesSearch && matchesCategory && matchesDate;
    });
  }, [logs, searchQuery, categoryFilter, dateFilter]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'password':
        return <Key className="w-4 h-4" />;
      case 'subscription':
        return <Bookmark className="w-4 h-4" />;
      case 'note':
        return <FileText className="w-4 h-4" />;
      case 'expense':
        return <DollarSign className="w-4 h-4" />;
      case 'reminder':
        return <Bell className="w-4 h-4" />;
      case 'system':
        return <Settings className="w-4 h-4" />;
      case 'security':
        return <Shield className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'password':
        return 'bg-primary/10 text-primary';
      case 'subscription':
        return 'bg-green-100 text-green-800';
      case 'note':
        return 'bg-yellow-100 text-yellow-800';
      case 'expense':
        return 'bg-purple-100 text-purple-800';
      case 'reminder':
        return 'bg-orange-100 text-orange-800';
      case 'system':
        return 'bg-muted text-muted-foreground';
      case 'security':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getActionColor = (action: string) => {
    if (action.toLowerCase().includes('create') || action.toLowerCase().includes('add')) {
      return 'text-green-600';
    } else if (action.toLowerCase().includes('update') || action.toLowerCase().includes('edit')) {
      return 'text-primary';
    } else if (action.toLowerCase().includes('delete') || action.toLowerCase().includes('remove')) {
      return 'text-red-600';
    } else if (action.toLowerCase().includes('login') || action.toLowerCase().includes('auth')) {
      return 'text-purple-600';
    } else {
      return 'text-muted-foreground';
    }
  };

  return (
    <div className="p-4 space-y-6 overflow-x-hidden" data-testid="logging-page">
      {/* Header */}
      <div className="flex justify-between items-center gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Activity Logs</h1>
          <p className="text-muted-foreground text-sm">
            Track vault activities
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button onClick={handleExportLogs} variant="outline" size="icon" className="h-9 w-9" title="Export Logs">
            <Download className="w-4 h-4" />
          </Button>
          <Button onClick={clearLogs} variant="outline" size="icon" className="h-9 w-9 text-destructive" title="Clear Logs">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Logs</p>
                <p className="text-xl font-bold">{logs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Security Events</p>
                <p className="text-xl font-bold">
                  {logs.filter(log => log.category === 'security').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Key className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Password Actions</p>
                <p className="text-xl font-bold">
                  {logs.filter(log => log.category === 'password').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Today's Activity</p>
                <p className="text-xl font-bold">
                  {logs.filter(log => {
                    const today = new Date();
                    const logDate = new Date(log.timestamp);
                    return logDate.toDateString() === today.toDateString();
                  }).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="password">Passwords</SelectItem>
                <SelectItem value="subscription">Subscriptions</SelectItem>
                <SelectItem value="note">Notes</SelectItem>
                <SelectItem value="expense">Expenses</SelectItem>
                <SelectItem value="reminder">Reminders</SelectItem>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="security">Security</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      <Card>
        <CardHeader>
          <CardTitle>
            Activity Logs ({filteredLogs.length} of {logs.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center">
              <Clock className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                No logs found
              </h3>
              <p className="text-muted-foreground">
                {logs.length === 0 
                  ? 'No activity logs yet. Start using the app to see logs here.'
                  : 'Try adjusting your search terms or filters'
                }
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredLogs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                      {getCategoryIcon(log.category)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-medium ${getActionColor(log.action)}`}>
                          {log.action}
                        </span>
                        <Badge variant="outline" className={getCategoryColor(log.category)}>
                          {log.category}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {format(log.timestamp, 'MMM d, yyyy HH:mm:ss')}
                        </span>
                      </div>
                      <p className="text-sm text-foreground mb-2">
                        {log.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {log.ipAddress && (
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary/50 inline-block"/>
                            {log.ipAddress}
                          </span>
                        )}
                        {log.device && (
                          <span className="flex items-center gap-1" title={log.userAgent}>
                            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 inline-block"/>
                            {log.device}
                          </span>
                        )}
                        {log.location && <span>{log.location}</span>}
                      </div>
                    </div>
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
