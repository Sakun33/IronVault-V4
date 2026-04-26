import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Download, Trash2, Search, Shield, Key, Bookmark, FileText, DollarSign, Bell, Settings, Clock, Monitor } from 'lucide-react';
import { useLogging } from '@/contexts/logging-context';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { isNativeApp } from '@/native/platform';

type TabKey = 'all' | 'login' | 'create' | 'edit' | 'delete';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'login', label: 'Login' },
  { key: 'create', label: 'Create' },
  { key: 'edit', label: 'Edit' },
  { key: 'delete', label: 'Delete' },
];

function getCategoryIcon(category: string) {
  switch (category) {
    case 'password':    return Key;
    case 'subscription': return Bookmark;
    case 'note':        return FileText;
    case 'expense':     return DollarSign;
    case 'reminder':    return Bell;
    case 'security':    return Shield;
    default:            return Settings;
  }
}

function getCategoryBg(category: string): string {
  switch (category) {
    case 'password':    return 'bg-primary/10 text-primary';
    case 'subscription': return 'bg-green-500/10 text-green-500';
    case 'note':        return 'bg-yellow-500/10 text-yellow-500';
    case 'expense':     return 'bg-purple-500/10 text-purple-500';
    case 'reminder':    return 'bg-orange-500/10 text-orange-500';
    case 'security':    return 'bg-red-500/10 text-red-500';
    default:            return 'bg-muted text-muted-foreground';
  }
}

function matchesTab(log: { action: string; category: string }, tab: TabKey): boolean {
  if (tab === 'all') return true;
  if (tab === 'login') return log.category === 'security' || /login|unlock|auth/i.test(log.action);
  if (tab === 'create') return /add|creat|import/i.test(log.action);
  if (tab === 'edit') return /update|edit|chang/i.test(log.action);
  if (tab === 'delete') return /delet|remov/i.test(log.action);
  return true;
}

export default function Logging() {
  const { logs, clearLogs } = useLogging();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('all');

  const handleExportLogs = async () => {
    try {
      const csvContent = [
        'Timestamp,Action,Category,Description,IP Address,Device',
        ...logs.map(log =>
          `"${new Date(log.timestamp).toISOString()}","${log.action}","${log.category}","${log.description}","${log.ipAddress || ''}","${log.device || ''}"`
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

  const filteredLogs = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return logs.filter(log => {
      const matchesSearch = !q ||
        log.action.toLowerCase().includes(q) ||
        log.description.toLowerCase().includes(q) ||
        (log.device || '').toLowerCase().includes(q);
      return matchesSearch && matchesTab(log, activeTab);
    });
  }, [logs, searchQuery, activeTab]);

  const tabCounts = useMemo(() =>
    Object.fromEntries(
      TABS.map(t => [t.key, logs.filter(l => matchesTab(l, t.key)).length])
    ) as Record<TabKey, number>,
    [logs]
  );

  const todayCount = useMemo(() => {
    const today = new Date().toDateString();
    return logs.filter(l => new Date(l.timestamp).toDateString() === today).length;
  }, [logs]);

  return (
    <div className="space-y-6" data-testid="logging-page">

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Activity Log</h1>
          <p className="text-sm text-muted-foreground">{logs.length} events · {todayCount} today</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExportLogs} variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
          <Button onClick={clearLogs} variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive">
            <Trash2 className="w-4 h-4" />
            Clear
          </Button>
        </div>
      </div>

      {/* Search + Filter Tabs */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search actions, descriptions, devices…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 p-1 bg-muted/40 rounded-xl w-fit">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 text-[11px] ${activeTab === tab.key ? 'text-primary' : 'text-muted-foreground/60'}`}>
                {tabCounts[tab.key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Log entries */}
      <div className="rounded-2xl shadow-sm border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Clock className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {logs.length === 0 ? 'No activity yet' : 'No events match your filters'}
            </p>
          </div>
        ) : (
          <div>
            {filteredLogs.map((log, index) => {
              const Icon = getCategoryIcon(log.category);
              const bgColor = getCategoryBg(log.category);
              const isLoginEvent = log.category === 'security' || /login|unlock|auth/i.test(log.action);
              return (
                <div key={log.id || index} className={`flex items-start gap-4 p-4 hover:bg-muted/50 active:bg-muted transition-colors ${index < filteredLogs.length - 1 ? 'border-b border-border/50' : ''}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${bgColor}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-medium text-foreground leading-tight">{log.description}</p>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                        {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className={`text-[10px] capitalize px-2 py-0 h-5 ${bgColor}`}>
                        {log.category}
                      </Badge>
                      {log.device && (
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Monitor className="w-3 h-3" />
                          {log.device}
                        </span>
                      )}
                      {isLoginEvent && log.ipAddress && (
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {log.ipAddress}
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground/50 ml-auto">
                        {format(new Date(log.timestamp), 'MMM d, HH:mm')}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
