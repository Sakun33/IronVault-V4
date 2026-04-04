import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { vaultManager } from '@/lib/vault-manager';

export interface LogEntry {
  id: string;
  timestamp: Date;
  action: string;
  category: 'password' | 'subscription' | 'note' | 'expense' | 'reminder' | 'system' | 'security';
  description: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  vaultId?: string; // Track which vault this log belongs to
}

interface LoggingContextType {
  logs: LogEntry[];
  addLog: (action: string, category: LogEntry['category'], description: string, details?: any) => void;
  clearLogs: () => void;
  exportLogs: () => void;
  getLogsForCurrentVault: () => LogEntry[];
}

const LoggingContext = createContext<LoggingContextType | undefined>(undefined);

export function LoggingProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback((
    action: string,
    category: LogEntry['category'],
    description: string,
    details?: any
  ) => {
    const currentVaultId = vaultManager.getActiveVaultId();
    const newLog: LogEntry = {
      id: Math.random().toString(36).substring(2, 15),
      timestamp: new Date(),
      action,
      category,
      description,
      details,
      ipAddress: '127.0.0.1', // In a real app, this would be detected
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      vaultId: currentVaultId || undefined,
    };

    setLogs(prev => [newLog, ...prev].slice(0, 1000)); // Keep last 1000 logs
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // Get logs filtered by current vault
  const getLogsForCurrentVault = useCallback(() => {
    const currentVaultId = vaultManager.getActiveVaultId();
    if (!currentVaultId) return logs;
    return logs.filter(log => !log.vaultId || log.vaultId === currentVaultId);
  }, [logs]);

  const exportLogs = useCallback(() => {
    const vaultLogs = getLogsForCurrentVault();
    const csvContent = [
      'Timestamp,Action,Category,Description,IP Address,User Agent',
      ...vaultLogs.map(log => 
        `"${log.timestamp.toISOString()}","${log.action}","${log.category}","${log.description}","${log.ipAddress}","${log.userAgent}"`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `securevault-logs-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [logs]);

  return (
    <LoggingContext.Provider value={{
      logs,
      addLog,
      clearLogs,
      exportLogs,
      getLogsForCurrentVault,
    }}>
      {children}
    </LoggingContext.Provider>
  );
}

export function useLogging() {
  const context = useContext(LoggingContext);
  if (context === undefined) {
    throw new Error('useLogging must be used within a LoggingProvider');
  }
  return context;
}
