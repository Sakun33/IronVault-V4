import React, { useState, useEffect } from 'react';

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

interface KPIData {
  totalCustomers: number;
  activeCustomers: number;
  totalRevenue: number;
  newSignups: number;
  churnRate: number;
  mrr: number;
}

interface Customer {
  id: number;
  email: string;
  name: string;
  region: string;
  plan_name: string;
  status: string;
  created_at: string;
  last_active: string;
}

const API_BASE = 'http://localhost:3001/api';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [currentTab, setCurrentTab] = useState('dashboard');

  // Login function
  const login = async (username: string, password: string) => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Login failed');
      }

      const data = await response.json();
      localStorage.setItem('admin_token', data.token);
      setUser(data.user);
      await loadDashboardData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // Load dashboard data
  const loadDashboardData = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      
      // Load KPIs
      const kpisResponse = await fetch(`${API_BASE}/dashboard/kpis`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (kpisResponse.ok) {
        const kpisData = await kpisResponse.json();
        setKpis(kpisData);
      }

      // Load customers
      const customersResponse = await fetch(`${API_BASE}/customers`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (customersResponse.ok) {
        const customersData = await customersResponse.json();
        setCustomers(customersData);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  // Check if user is logged in
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      // Verify token and load data
      loadDashboardData();
    }
  }, []);

  // Logout function
  const logout = () => {
    localStorage.removeItem('admin_token');
    setUser(null);
    setKpis(null);
    setCustomers([]);
  };

  // Login form component
  if (!user) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#f5f5f5',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{ 
          maxWidth: '400px', 
          width: '100%', 
          padding: '2rem',
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#333' }}>
              SecureVault Admin Console
            </h1>
            <p style={{ color: '#666', marginTop: '0.5rem' }}>
              Sign in to access the admin dashboard
            </p>
          </div>

          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target as HTMLFormElement);
            const username = formData.get('username') as string;
            const password = formData.get('password') as string;
            login(username, password);
          }}>
            {error && (
              <div style={{ 
                backgroundColor: '#fee2e2', 
                color: '#dc2626', 
                padding: '0.75rem', 
                borderRadius: '4px', 
                marginBottom: '1rem',
                fontSize: '0.875rem'
              }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Username
              </label>
              <input
                type="text"
                name="username"
                required
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '1rem'
                }}
                placeholder="Enter your username"
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Password
              </label>
              <input
                type="password"
                name="password"
                required
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '1rem'
                }}
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                backgroundColor: '#3b82f6',
                color: 'white',
                padding: '0.75rem',
                border: 'none',
                borderRadius: '4px',
                fontSize: '1rem',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div style={{ 
            marginTop: '1.5rem', 
            padding: '1rem', 
            backgroundColor: '#f9fafb', 
            borderRadius: '4px',
            fontSize: '0.875rem',
            color: '#6b7280'
          }}>
            <p style={{ fontWeight: '500', marginBottom: '0.5rem' }}>Default Credentials:</p>
            <p>Username: <code style={{ backgroundColor: '#e5e7eb', padding: '0.125rem 0.25rem', borderRadius: '2px' }}>admin</code></p>
            <p>Password: <code style={{ backgroundColor: '#e5e7eb', padding: '0.125rem 0.25rem', borderRadius: '2px' }}>admin123</code></p>
          </div>
        </div>
      </div>
    );
  }

  // Main dashboard
  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f9fafb',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      <header style={{ 
        backgroundColor: 'white', 
        borderBottom: '1px solid #e5e7eb',
        padding: '1rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827' }}>
          SecureVault Admin Console
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: '#6b7280' }}>Welcome, {user.username}</span>
          <button
            onClick={logout}
            style={{
              backgroundColor: '#ef4444',
              color: 'white',
              padding: '0.5rem 1rem',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Navigation */}
      <nav style={{ 
        backgroundColor: 'white', 
        borderBottom: '1px solid #e5e7eb',
        padding: '0 2rem'
      }}>
        <div style={{ display: 'flex', gap: '2rem' }}>
          {[
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'customers', label: 'Customers' },
            { id: 'plans', label: 'Plans' },
            { id: 'support', label: 'Support' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              style={{
                padding: '1rem 0',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                fontSize: '1rem',
                color: currentTab === tab.id ? '#3b82f6' : '#6b7280',
                borderBottom: currentTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main style={{ padding: '2rem' }}>
        {currentTab === 'dashboard' && (
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
              Dashboard Overview
            </h2>
            
            {kpis && (
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: '1rem',
                marginBottom: '2rem'
              }}>
                <div style={{ 
                  backgroundColor: 'white', 
                  padding: '1.5rem', 
                  borderRadius: '8px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                }}>
                  <h3 style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                    Total Customers
                  </h3>
                  <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#111827' }}>
                    {kpis.totalCustomers}
                  </p>
                </div>
                
                <div style={{ 
                  backgroundColor: 'white', 
                  padding: '1.5rem', 
                  borderRadius: '8px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                }}>
                  <h3 style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                    Active Customers
                  </h3>
                  <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#111827' }}>
                    {kpis.activeCustomers}
                  </p>
                </div>
                
                <div style={{ 
                  backgroundColor: 'white', 
                  padding: '1.5rem', 
                  borderRadius: '8px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                }}>
                  <h3 style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                    Monthly Revenue
                  </h3>
                  <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#111827' }}>
                    ${kpis.mrr.toFixed(2)}
                  </p>
                </div>
                
                <div style={{ 
                  backgroundColor: 'white', 
                  padding: '1.5rem', 
                  borderRadius: '8px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                }}>
                  <h3 style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                    New Signups (24h)
                  </h3>
                  <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#111827' }}>
                    {kpis.newSignups}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {currentTab === 'customers' && (
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
              Customers ({customers.length})
            </h2>
            
            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb' }}>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '500' }}>Customer</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '500' }}>Plan</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '500' }}>Status</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '500' }}>Region</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '500' }}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(customer => (
                    <tr key={customer.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '1rem' }}>
                        <div>
                          <div style={{ fontWeight: '500' }}>{customer.name}</div>
                          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{customer.email}</div>
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ 
                          backgroundColor: customer.plan_name === 'Free' ? '#f3f4f6' : '#dbeafe',
                          color: customer.plan_name === 'Free' ? '#374151' : '#1e40af',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.875rem'
                        }}>
                          {customer.plan_name}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ 
                          backgroundColor: customer.status === 'active' ? '#dcfce7' : '#fee2e2',
                          color: customer.status === 'active' ? '#166534' : '#dc2626',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.875rem'
                        }}>
                          {customer.status}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', color: '#6b7280' }}>{customer.region}</td>
                      <td style={{ padding: '1rem', color: '#6b7280' }}>
                        {new Date(customer.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {currentTab === 'plans' && (
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
              Subscription Plans
            </h2>
            <div style={{ 
              backgroundColor: 'white', 
              padding: '1.5rem', 
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
            }}>
              <p style={{ color: '#6b7280' }}>Plan management interface will be implemented here.</p>
            </div>
          </div>
        )}

        {currentTab === 'support' && (
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
              Support Tickets
            </h2>
            <div style={{ 
              backgroundColor: 'white', 
              padding: '1.5rem', 
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
            }}>
              <p style={{ color: '#6b7280' }}>Support ticket management interface will be implemented here.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
