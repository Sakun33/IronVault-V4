/**
 * Customer Registration API
 * 
 * This module handles customer registration with the backend CRM system.
 * It's called when users create a new vault to capture customer information.
 */

export interface CustomerRegistrationData {
  email: string;
  fullName: string;
  country: string;
  phone?: string;
  marketingConsent?: boolean;
  supportConsent?: boolean;
  platform?: string;
  appVersion?: string;
  selectedPlan?: string;
}

export interface CustomerRegistrationResponse {
  success: boolean;
  message: string;
  userId?: string;
  entitlement?: {
    plan: string;
    status: string;
    trialActive: boolean;
    trialEndsAt?: string;
  };
}

/**
 * Register a new customer with the backend CRM
 */
export async function registerCustomer(data: CustomerRegistrationData): Promise<CustomerRegistrationResponse> {
  try {
    
    // Use production backend API or fallback to local proxy
    const apiUrl = import.meta.env.VITE_BACKEND_API_URL || '';
    const endpoint = apiUrl ? `${apiUrl}/api/crm/register` : '/api/crm/register';
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...data,
        vaultCreatedAt: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        message: 'Failed to register with CRM (non-critical)',
      };
    }

    const result = await response.json();
    
    // Store userId locally for future API calls (API returns `id` or `userId`)
    const storedId = result.userId || result.id;
    if (storedId) {
      localStorage.setItem('crmUserId', String(storedId));
    }
    
    return result;
  } catch (error) {
    console.error('❌ Customer registration error:', error);
    return {
      success: false,
      message: 'CRM registration unavailable (non-critical)',
    };
  }
}

/**
 * Auto-register customer when vault is created
 * This function is non-blocking and won't affect vault creation
 */
export async function autoRegisterOnVaultCreation(
  email: string, 
  fullName: string, 
  country: string,
  phone?: string,
  marketingConsent?: boolean,
  selectedPlan?: string
): Promise<void> {
  if (!email) {
    return;
  }

  // Detect platform
  const platform = typeof window !== 'undefined' 
    ? (navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad') ? 'ios' 
       : navigator.userAgent.includes('Android') ? 'android' : 'web')
    : 'web';

  registerCustomer({
    email,
    fullName: fullName || email.split('@')[0],
    country: country || 'US',
    phone,
    marketingConsent: marketingConsent || false,
    supportConsent: true,
    platform,
    appVersion: '1.0.0',
    selectedPlan: selectedPlan || 'free',
  }).catch(error => {
  });
}

/**
 * Get user's entitlement status
 */
export async function getEntitlementStatus(): Promise<CustomerRegistrationResponse['entitlement'] | null> {
  // QA-R2 C2: this endpoint now requires Bearer auth (own row or admin).
  const cloudToken = localStorage.getItem('iv_cloud_token');
  if (!cloudToken) return null;

  // P0 FIX (2026-05-06): localStorage crmUserId can become stale when the
  // user re-registers or when the CRM row was recreated by an admin action,
  // leading to a UUID that doesn't match the JWT's userId. The entitlement
  // endpoint then returns 403 (wrong user) and the app defaults to Free.
  //
  // Strategy: always extract the authoritative userId from the cloud JWT and
  // sync it to localStorage. Fall back to email if the JWT can't be decoded.
  let lookupId = localStorage.getItem('crmUserId');
  let jwtUserId: string | null = null;
  try {
    const parts = cloudToken.split('.');
    if (parts[1]) {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.userId) {
        jwtUserId = payload.userId;
        // Always keep crmUserId in sync with the JWT
        if (jwtUserId && jwtUserId !== lookupId) {
          localStorage.setItem('crmUserId', jwtUserId);
          lookupId = jwtUserId;
        }
      }
    }
  } catch { /* JWT decode failed — fall through to existing lookupId */ }

  // Fall back to email from account session for users who registered before
  // crmUserId was stored (key mismatch bug: API returned `id`, code read `userId`)
  if (!lookupId) {
    try {
      const account = JSON.parse(localStorage.getItem('iv_account') || '{}');
      if (account.email) lookupId = encodeURIComponent(account.email);
    } catch { /* ignore */ }
  }

  if (!lookupId) return null;

  try {
    // Always use the main Vercel API for entitlement lookup (customers table).
    const endpoint = `/api/crm/entitlement/${lookupId}`;
    const response = await fetch(endpoint, {
      headers: { 'Authorization': `Bearer ${cloudToken}` },
    });
    if (!response.ok) {
      // If we got 403 and haven't tried the JWT userId yet, retry with it
      if (response.status === 403 && jwtUserId && jwtUserId !== lookupId) {
        const retryResponse = await fetch(`/api/crm/entitlement/${jwtUserId}`, {
          headers: { 'Authorization': `Bearer ${cloudToken}` },
        });
        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          if (retryData.id) localStorage.setItem('crmUserId', String(retryData.id));
          return retryData.entitlement;
        }
      }
      return null;
    }
    const data = await response.json();
    // Cache the canonical UUID so future calls skip the email lookup
    if (data.id) {
      localStorage.setItem('crmUserId', String(data.id));
    }
    return data.entitlement;
  } catch (error) {
    console.error('Failed to fetch entitlement:', error);
    return null;
  }
}
