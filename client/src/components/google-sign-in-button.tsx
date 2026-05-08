import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';

interface Props {
  /** Redirect path for existing users after successful sign-in. Defaults to "/". */
  existingUserRedirect?: string;
  /** Redirect path for brand-new accounts (need to set a master password). Defaults to "/". */
  newUserRedirect?: string;
  /** Visual label, e.g. "Continue with Google" or "Sign in with Google". */
  label?: string;
  /** data-testid attribute for e2e tests. */
  testId?: string;
  className?: string;
}

// Google's brand "G" logo. Inline SVG so we don't ship a network image.
function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 18" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
    </svg>
  );
}

export function GoogleSignInButton({
  existingUserRedirect = '/',
  newUserRedirect = '/',
  label = 'Continue with Google',
  testId = 'button-google-signin',
  className,
}: Props) {
  const { googleLogin } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const result = await googleLogin();
      if (!result.ok) {
        toast({
          title: 'Google sign-in failed',
          description: 'Could not complete Google sign-in. Please try again or use email + password.',
          variant: 'destructive',
        });
        return;
      }
      // New users land somewhere they can set up their vault master password.
      // Existing users go to the standard post-login redirect (vault picker).
      setLocation(result.isNewUser ? newUserRedirect : existingUserRedirect);
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
      <GoogleLogo className="w-4 h-4" />
      {loading ? 'Signing in…' : label}
    </Button>
  );
}
