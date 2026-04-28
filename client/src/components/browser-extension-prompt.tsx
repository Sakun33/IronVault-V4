import { useEffect, useState } from 'react';
import { ShieldCheck, X, Download, Check } from 'lucide-react';

const DISMISSED_KEY = 'ironvault.extensionPromptDismissedAt';
const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SHOW_DELAY_MS = 4000;
const ZIP_HREF = '/chrome-extension.zip';

function isExtensionInstalled(): boolean {
  // The extension content script sets a marker on every page it runs on
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
  const [step, setStep] = useState<'idle' | 'downloaded'>('idle');

  useEffect(() => {
    if (isDismissed() || isExtensionInstalled()) return;
    const id = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(id);
  }, []);

  function handleDismiss() {
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch {}
    setVisible(false);
  }

  function handleDownload() {
    // Native <a download> handles the actual fetch — we just flip our UI to
    // step 2 so the install instructions appear right after the click.
    setStep('downloaded');
  }

  if (!visible) return null;

  if (step === 'downloaded') {
    return (
      <div
        className="fixed bottom-4 right-4 z-50 max-w-sm animate-in fade-in slide-in-from-bottom-3 duration-300"
        data-testid="browser-extension-prompt-steps"
      >
        <div className="rounded-2xl border border-primary/30 bg-card/95 p-4 shadow-lg backdrop-blur-md">
          <div className="mb-3 flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight text-foreground">
                Install IronVault Extension
              </p>
              <p className="text-xs leading-snug text-muted-foreground">
                4 quick steps in Chrome
              </p>
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={handleDismiss}
              className="-mr-1 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/70 hover:bg-muted hover:text-foreground"
              data-testid="button-dismiss-extension-prompt"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <ol className="space-y-1.5 text-xs text-foreground">
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>Download started — unzip the file</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-muted-foreground">2</span>
              <span>Open <code className="rounded bg-muted px-1 text-[11px]">chrome://extensions</code></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-muted-foreground">3</span>
              <span>Toggle <strong>Developer mode</strong> (top right)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-muted-foreground">4</span>
              <span>Click <strong>Load unpacked</strong> and pick the unzipped folder</span>
            </li>
          </ol>

          <div className="mt-3 flex gap-2">
            <a
              href={ZIP_HREF}
              download="ironvault-extension.zip"
              className="flex-1 rounded-md bg-primary/10 px-3 py-1.5 text-center text-xs font-semibold text-primary hover:bg-primary/15"
              data-testid="link-redownload-extension"
            >
              Re-download
            </a>
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50 max-w-xs animate-in fade-in slide-in-from-bottom-3 duration-300"
      data-testid="browser-extension-prompt"
    >
      <div className="group flex items-center gap-3 rounded-2xl border border-primary/30 bg-card/95 px-3.5 py-3 pr-2.5 shadow-lg backdrop-blur-md transition-all hover:border-primary/60 hover:shadow-xl">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight text-foreground">
            Get the IronVault Extension
          </p>
          <p className="text-xs leading-snug text-muted-foreground">
            Auto-fill passwords for safer browsing
          </p>
        </div>
        <a
          href={ZIP_HREF}
          download="ironvault-extension.zip"
          onClick={handleDownload}
          aria-label="Download extension"
          className="ml-1 flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-transform hover:scale-105"
          data-testid="link-download-extension"
        >
          <Download className="h-4 w-4" />
        </a>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={handleDismiss}
          className="ml-1 -mr-1 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/70 hover:bg-muted hover:text-foreground"
          data-testid="button-dismiss-extension-prompt"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
