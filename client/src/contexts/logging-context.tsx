import { createContext, useContext, useState, useRef, ReactNode, useCallback, useEffect } from 'react';
import { format } from 'date-fns';
import { vaultManager } from '@/lib/vault-manager';

export interface LogEntry {
  id: string;
  timestamp: Date;
  action: string;
  category: 'password' | 'subscription' | 'note' | 'expense' | 'reminder' | 'system' | 'security' | 'apikey' | 'investment' | 'bank_statement';
  description: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  device?: string;
  location?: string;
  vaultId?: string;
}

interface LoggingContextType {
  logs: LogEntry[];
  addLog: (action: string, category: LogEntry['category'], description: string, details?: any) => void;
  clearLogs: () => void;
  exportLogs: () => void;
  getLogsForCurrentVault: () => LogEntry[];
}

const LoggingContext = createContext<LoggingContextType | undefined>(undefined);

// ── localStorage persistence ───────────────────────────────────────────────────
const LOGS_KEY = 'iv_activity_logs';
const MAX_STORED = 150;

function loadStoredLogs(): LogEntry[] {
  try {
    const raw = localStorage.getItem(LOGS_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as any[]).map(l => ({ ...l, timestamp: new Date(l.timestamp) }));
  } catch { return []; }
}

function persistLogs(logs: LogEntry[]) {
  try {
    // Don't store userAgent (large); keep essential fields only
    const slim = logs.slice(0, MAX_STORED).map(({ userAgent: _ua, ...rest }) => rest);
    localStorage.setItem(LOGS_KEY, JSON.stringify(slim));
  } catch {}
}

// ── Device string from userAgent ──────────────────────────────────────────────
function parseDevice(ua: string): string {
  if (!ua || ua === 'Unknown') return 'Unknown Device';
  let os = 'Unknown';
  if (/iPad/.test(ua)) os = 'iPad';
  else if (/iPhone/.test(ua)) os = 'iPhone';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Windows NT/.test(ua)) os = 'Windows';
  else if (/Macintosh|Mac OS X/.test(ua)) os = 'Mac';
  else if (/Linux/.test(ua)) os = 'Linux';
  let browser = 'Browser';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua)) browser = 'Safari';
  return `${os} (${browser})`;
}

// ── IP fetch with 15-min localStorage cache ────────────────────────────────────
const IP_CACHE_KEY = 'iv_cached_ip';
const IP_CACHE_TTL = 15 * 60 * 1000;

function getCachedIP(): string | null {
  try {
    const raw = localStorage.getItem(IP_CACHE_KEY);
    if (!raw) return null;
    const { ip, ts } = JSON.parse(raw);
    if (Date.now() - ts < IP_CACHE_TTL) return ip;
  } catch {}
  return null;
}

function setCachedIP(ip: string) {
  try { localStorage.setItem(IP_CACHE_KEY, JSON.stringify({ ip, ts: Date.now() })); } catch {}
}

export function LoggingProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<LogEntry[]>(() => loadStoredLogs());
  const [resolvedIp, setResolvedIp] = useState<string>(getCachedIP() ?? '…');
  // Dedup: prevent the same action+category within 5s
  const lastLogRef = useRef<{ action: string; category: string; ts: number } | null>(null);

  // Fetch real public IP once per provider mount (uses cache if fresh)
  useEffect(() => {
    const cached = getCachedIP();
    if (cached) { setResolvedIp(cached); return; }
    const ctrl = new AbortController();
    fetch('https://api.ipify.org?format=json', { signal: ctrl.signal })
      .then(r => r.json())
      .then(({ ip }: { ip: string }) => {
        setCachedIP(ip);
        setResolvedIp(ip);
      })
      .catch(() => setResolvedIp('Private'));
    return () => ctrl.abort();
  }, []);

  const addLog = useCallback((
    action: string,
    category: LogEntry['category'],
    description: string,
    details?: any
  ) => {
    const now = Date.now();
    // Dedup: skip if same action+category fired within last 5 seconds
    if (
      lastLogRef.current &&
      lastLogRef.current.action === action &&
      lastLogRef.current.category === category &&
      now - lastLogRef.current.ts < 5000
    ) return;
    lastLogRef.current = { action, category, ts: now };

    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const currentVaultId = vaultManager.getActiveVaultId();
    const newLog: LogEntry = {
      id: Math.random().toString(36).substring(2, 15),
      timestamp: new Date(),
      action,
      category,
      description,
      details,
      ipAddress: resolvedIp !== '…' ? resolvedIp : undefined,
      userAgent: ua,
      device: parseDevice(ua),
      vaultId: currentVaultId || undefined,
    };

    setLogs(prev => {
      const next = [newLog, ...prev].slice(0, 500);
      persistLogs(next);
      return next;
    });
  // resolvedIp in deps means new logs pick up IP once it resolves
  }, [resolvedIp]);

  const clearLogs = useCallback(() => {
    setLogs([]);
    try { localStorage.removeItem(LOGS_KEY); } catch {}
  }, []);

  const getLogsForCurrentVault = useCallback(() => {
    const currentVaultId = vaultManager.getActiveVaultId();
    if (!currentVaultId) return logs;
    return logs.filter(log => !log.vaultId || log.vaultId === currentVaultId);
  }, [logs]);

  const exportLogs = useCallback(() => {
    const vaultLogs = getLogsForCurrentVault();
    const csvContent = [
      'Timestamp,Action,Category,Description,IP Address,Device',
      ...vaultLogs.map(log =>
        `"${log.timestamp.toISOString()}","${log.action}","${log.category}","${log.description}","${log.ipAddress ?? ''}","${log.device ?? ''}"`
      ),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ironvault-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [logs]);

  return (
    <LoggingContext.Provider value={{ logs, addLog, clearLogs, exportLogs, getLogsForCurrentVault }}>
      {children}
    </LoggingContext.Provider>
  );
}

export function useLogging() {
  const context = useContext(LoggingContext);
  if (context === undefined) throw new Error('useLogging must be used within a LoggingProvider');
  return context;
}
