import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Fingerprint } from 'lucide-react';
import { authenticateWithPasskey, isPasskeySupported } from '@/lib/passkey-auth';

interface Props {
  label?: string;
  email?: string;
  redirectTo?: string;
  className?: string;
  testId?: string;
}

export function PasskeySignInButton({
  label = 'Sign in with passkey',
  email,
  redirectTo = '/',
  className,
  testId = 'button-passkey-signin',
}: Props) {
  const { finalizePasskeyLogin } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);

  if (!isPasskeySupported()) return null;

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const outcome = await authenticateWithPasskey(email);
      if (!outcome.ok) {
        toast({
          title: 'Passkey sign-in failed',
          description: outcome.error,
          variant: 'destructive',
        });
        return;
      }
      const ok = await finalizePasskeyLogin(outcome.result);
      if (!ok) {
        toast({ title: 'Sign-in failed', description: 'Token rejected by the app.', variant: 'destructive' });
        return;
      }
      setLocation(redirectTo);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      data-testid={testId}
      onClick={handleClick}
      disabled={loading}
      className={`w-full h-11 gap-2 font-medium bg-background hover:bg-muted/40 ${className || ''}`}
    >
      <Fingerprint className="w-4 h-4" />
      {loading ? 'Authenticating…' : label}
    </Button>
  );
}
