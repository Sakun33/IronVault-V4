import { useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';

declare global {
  interface Window {
    $zoho?: {
      salesiq?: {
        visitor: {
          name: (name: string) => void;
          email: (email: string) => void;
          id: (id: string) => void;
        };
        reset: () => void;
      };
    };
  }
}

// Ties the authenticated user's identity to the SalesIQ chat widget.
// Prevents cross-user session bleed by resetting visitor state on logout.
export function ZohoSalesIQIdentity() {
  const { isAccountLoggedIn, accountEmail } = useAuth();

  useEffect(() => {
    const salesiq = window.$zoho?.salesiq;
    if (!salesiq) return;

    if (isAccountLoggedIn && accountEmail) {
      salesiq.visitor?.email(accountEmail);
      salesiq.visitor?.id(accountEmail);
    } else {
      salesiq.reset?.();
    }
  }, [isAccountLoggedIn, accountEmail]);

  return null;
}
