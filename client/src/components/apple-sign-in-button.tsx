import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';

interface Props {
  /** Redirect path for existing users after successful sign-in. Defaults to "/". */
  existingUserRedirect?: string;
  /** Redirect path for brand-new accounts. Defaults to "/". */
  newUserRedirect?: string;
  /** Visual label, e.g. "Sign in with Apple" or "Continue with Apple". */
  label?: string;
  /** data-testid attribute for e2e tests. */
  testId?: string;
  className?: string;
}

// Apple's "Apple" logo — solid black mark, used inside both light and dark
// pill buttons. Inline SVG so we don't ship a network image.
function AppleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" fill="currentColor">
      <path d="M11.182.008C11.148-.03 9.923.023 8.857 1.18c-1.066 1.156-.902 2.482-.878 2.516.024.034 1.52.087 2.475-1.258.955-1.345.762-2.391.728-2.43Zm3.314 11.733c-.048-.096-2.325-1.234-2.113-3.422.212-2.189 1.675-2.789 1.698-2.854.023-.065-.597-.79-1.254-1.157a3.692 3.692 0 0 0-1.563-.434c-.108-.003-.483-.095-1.254.116-.508.139-1.653.589-1.968.607-.316.018-1.256-.522-2.267-.665-.647-.125-1.333.131-1.824.328-.49.196-1.422.754-2.074 2.237-.652 1.482-.311 3.83-.067 4.56.244.729.625 1.924 1.273 2.796.576.984 1.34 1.667 1.659 1.899.319.232 1.219.386 1.843.067.502-.308 1.408-.485 1.766-.472.357.013 1.061.154 1.782.539.571.197 1.111.115 1.652-.105.541-.221 1.324-1.059 2.238-2.758.347-.79.505-1.217.473-1.282Z"/>
    </svg>
  );
}

export function AppleSignInButton({
  existingUserRedirect = '/',
  newUserRedirect = '/',
  label = 'Sign in with Apple',
  testId = 'button-apple-signin',
  className,
}: Props) {
  const { appleLogin } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const result = await appleLogin();
      if (!result.ok) {
        toast({
          title: 'Apple sign-in failed',
          description: result.error
            ? `${result.error}. Try again or use email + password.`
            : 'Could not complete Apple sign-in. Please try again or use email + password.',
          variant: 'destructive',
        });
        return;
      }
      setLocation(result.isNewUser ? newUserRedirect : existingUserRedirect);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      data-testid={testId}
      onClick={handleClick}
      disabled={loading}
      className={`w-full h-11 gap-2 font-medium bg-black hover:bg-black/90 text-white border-0 ${className || ''}`}
    >
      <AppleLogo className="w-4 h-4" />
      {loading ? 'Signing in…' : label}
    </Button>
  );
}
