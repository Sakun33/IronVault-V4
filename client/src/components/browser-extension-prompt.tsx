import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { ShieldCheck, X, ArrowRight } from 'lucide-react';

const DISMISSED_KEY = 'ironvault.extensionPromptDismissedAt';
const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SHOW_DELAY_MS = 4000;

function isExtensionInstalled(): boolean {
  // The extension content script sets a marker on every page it loads on
  // (window.__ironvaultInjected). If we see it, no need to nudge.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Boolean((window as any).__ironvaultInjected);
}

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

export function BrowserExtensionPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isDismissed() || isExtensionInstalled()) return;
    const id = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(id);
  }, []);

  function handleDismiss() {
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch {}
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 max-w-xs animate-in fade-in slide-in-from-bottom-3 duration-300"
      data-testid="browser-extension-prompt"
    >
      <Link
        href="/settings#browser-extension"
        onClick={handleDismiss}
        className="group flex items-center gap-3 rounded-2xl border border-primary/30 bg-card/95 px-3.5 py-3 pr-2.5 shadow-lg backdrop-blur-md transition-all hover:border-primary/60 hover:shadow-xl"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight text-foreground">
            Get the IronVault Browser Extension
          </p>
          <p className="text-xs leading-snug text-muted-foreground">
            Auto-fill passwords for safer browsing
          </p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
        <button
          type="button"
          aria-label="Dismiss"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDismiss(); }}
          className="ml-1 -mr-1 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/70 hover:bg-muted hover:text-foreground"
          data-testid="button-dismiss-extension-prompt"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </Link>
    </div>
  );
}
