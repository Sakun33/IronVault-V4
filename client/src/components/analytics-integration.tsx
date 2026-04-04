// Analytics Integration Component
// Integrates privacy-preserving analytics into the main SecureVault app
// Tracks usage events without collecting personal data

import React, { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { AppIntegrationHooks } from '@/lib/app-integration-hooks';
import { useAuth } from '@/contexts/auth-context';
import { useVault } from '@/contexts/vault-context';

interface AnalyticsIntegrationProps {
  children: React.ReactNode;
}

export function AnalyticsIntegration({ children }: AnalyticsIntegrationProps) {
  const { isUnlocked, masterPassword } = useAuth();
  const { stats } = useVault();
  const [, setLocation] = useLocation();
  const appIntegrationRef = useRef<AppIntegrationHooks | null>(null);
  const lastLocationRef = useRef<string>('');

  // Initialize analytics when vault is unlocked
  useEffect(() => {
    if (isUnlocked && masterPassword && !appIntegrationRef.current) {
      const appIntegration = new AppIntegrationHooks({
        analyticsEnabled: true,
        supportTicketsEnabled: true,
        syncEnabled: false, // Disabled by default for privacy
        masterPassword: masterPassword
      });

      appIntegration.initialize().then(() => {
        appIntegrationRef.current = appIntegration;
        
        // Track vault unlock
        appIntegration.trackVaultUnlock();
      }).catch((error) => {
        console.error('Failed to initialize analytics:', error);
      });
    }
  }, [isUnlocked, masterPassword]);

  // Track section access when location changes
  useEffect(() => {
    if (appIntegrationRef.current && isUnlocked) {
      const currentLocation = window.location.pathname;
      
      if (currentLocation !== lastLocationRef.current) {
        lastLocationRef.current = currentLocation;
        
        // Map routes to section names
        const routeToSection: Record<string, string> = {
          '/': 'dashboard',
          '/passwords': 'passwords',
          '/subscriptions': 'subscriptions',
          '/notes': 'notes',
          '/expenses': 'expenses',
          '/reminders': 'reminders',
          '/bank-statements': 'bankStatements',
          '/investments': 'investments',
          '/pricing': 'pricing',
          '/logging': 'logging'
        };

        const section = routeToSection[currentLocation];
        if (section) {
          appIntegrationRef.current.trackSectionAccess(section);
        }
      }
    }
  }, [isUnlocked]);

  // Track record creation/deletion based on stats changes
  useEffect(() => {
    if (appIntegrationRef.current && isUnlocked) {
      // This would be called when stats change
      // In a real implementation, you'd track individual operations
      // For now, we'll just log that stats are being tracked
      console.log('Analytics: Tracking vault stats', stats);
    }
  }, [stats, isUnlocked]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (appIntegrationRef.current) {
        // Cleanup if needed
        appIntegrationRef.current = null;
      }
    };
  }, []);

  return <>{children}</>;
}

// Hook to access analytics integration
export function useAnalytics() {
  const { isUnlocked, masterPassword } = useAuth();
  
  const submitSupportTicket = async (ticketData: {
    title: string;
    description: string;
    category: 'bug' | 'feature' | 'performance' | 'ui' | 'other';
    priority: 'low' | 'medium' | 'high' | 'critical';
    featureContext?: string;
    errorStack?: string;
    logs?: string;
    screenshot?: string;
  }) => {
    if (!isUnlocked || !masterPassword) {
      throw new Error('Vault must be unlocked to submit support tickets');
    }

    const appIntegration = new AppIntegrationHooks({
      analyticsEnabled: true,
      supportTicketsEnabled: true,
      syncEnabled: false,
      masterPassword: masterPassword
    });

    await appIntegration.initialize();
    return await appIntegration.submitSupportTicket(ticketData);
  };

  const getAnalyticsSummary = async () => {
    if (!isUnlocked || !masterPassword) {
      return null;
    }

    const appIntegration = new AppIntegrationHooks({
      analyticsEnabled: true,
      supportTicketsEnabled: true,
      syncEnabled: false,
      masterPassword: masterPassword
    });

    await appIntegration.initialize();
    return await appIntegration.getAnalyticsSummary();
  };

  const getSupportTicketStats = async () => {
    if (!isUnlocked || !masterPassword) {
      return null;
    }

    const appIntegration = new AppIntegrationHooks({
      analyticsEnabled: true,
      supportTicketsEnabled: true,
      syncEnabled: false,
      masterPassword: masterPassword
    });

    await appIntegration.initialize();
    return await appIntegration.getSupportTicketStats();
  };

  return {
    submitSupportTicket,
    getAnalyticsSummary,
    getSupportTicketStats,
    isAnalyticsEnabled: isUnlocked && masterPassword
  };
}
