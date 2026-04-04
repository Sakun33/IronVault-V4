import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import CustomersPage from './pages/CustomersPage';
import CustomerDetailPage from './pages/CustomerDetailPage';
import PlansPage from './pages/PlansPage';
import SupportTicketsPage from './pages/SupportTicketsPage';
import NotificationsPage from './pages/NotificationsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import EmailCenterPage from './pages/EmailCenterPage';
import PromotionsPage from './pages/PromotionsPage';
import ActivityLogPage from './pages/ActivityLogPage';
import SettingsPage from './pages/SettingsPage';
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
    },
  },
});

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/customers/:id" element={<CustomerDetailPage />} />
        <Route path="/plans" element={<PlansPage />} />
        <Route path="/support" element={<SupportTicketsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/email-center" element={<EmailCenterPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/promotions" element={<PromotionsPage />} />
        <Route path="/activity" element={<ActivityLogPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="admin-ui-theme">
        <AuthProvider>
          <Router>
            <div className="min-h-screen bg-background">
              <AppRoutes />
              <Toaster />
            </div>
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
