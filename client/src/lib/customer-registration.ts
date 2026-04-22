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
    console.log('📝 Registering customer with CRM:', data);
    
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
      console.warn('⚠️ Customer registration failed:', response.status);
      return {
        success: false,
        message: 'Failed to register with CRM (non-critical)',
      };
    }

    const result = await response.json();
    console.log('✅ Customer registered with CRM:', result);
    
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
    console.log('ℹ️ Skipping customer registration - no email provided');
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
    console.log('ℹ️ Background customer registration failed (non-critical):', error.message);
  });
}

/**
 * Get user's entitlement status
 */
export async function getEntitlementStatus(): Promise<CustomerRegistrationResponse['entitlement'] | null> {
  let lookupId = localStorage.getItem('crmUserId');

  // Fall back to email from account session for users who registered before
  // crmUserId was stored (key mismatch bug: API returned `id`, code read `userId`)
  if (!lookupId) {
    try {
      const session = JSON.parse(localStorage.getItem('accountSession') || '{}');
      if (session.email) lookupId = encodeURIComponent(session.email);
    } catch { /* ignore */ }
  }

  if (!lookupId) return null;

  try {
    const apiUrl = import.meta.env.VITE_BACKEND_API_URL || '';
    const endpoint = apiUrl ? `${apiUrl}/api/crm/entitlement/${lookupId}` : `/api/crm/entitlement/${lookupId}`;

    const response = await fetch(endpoint);
    if (!response.ok) return null;
    const data = await response.json();
    // Cache the canonical UUID so future calls skip the email lookup
    if (data.id && !localStorage.getItem('crmUserId')) {
      localStorage.setItem('crmUserId', String(data.id));
    }
    return data.entitlement;
  } catch (error) {
    console.error('Failed to fetch entitlement:', error);
    return null;
  }
}
