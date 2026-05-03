import { Clipboard } from '@capacitor/clipboard';
import { isNativeApp } from './platform';
import { hapticLight } from './haptics';

const DEFAULT_TIMEOUT_MS = 30000;
let clearTimeoutId: NodeJS.Timeout | null = null;
let appBackgroundListener: (() => void) | null = null;

export interface ClipboardOptions {
  timeoutMs?: number;
  clearOnBackground?: boolean;
  showToast?: boolean;
}

export async function copyToClipboardSecure(
  text: string,
  options: ClipboardOptions = {}
): Promise<boolean> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    clearOnBackground = true,
    showToast = true,
  } = options;

  try {
    if (isNativeApp()) {
      await Clipboard.write({ string: text });
    } else {
      await navigator.clipboard.writeText(text);
    }

    await hapticLight();

    if (clearTimeoutId) {
      clearTimeout(clearTimeoutId);
    }

    clearTimeoutId = setTimeout(() => {
      clearClipboard();
    }, timeoutMs);

    if (clearOnBackground) {
      setupBackgroundClearListener();
    }

    if (showToast) {
      showClipboardToast(`Copied - clears in ${timeoutMs / 1000}s`);
    }

    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

export async function clearClipboard(): Promise<void> {
  try {
    if (clearTimeoutId) {
      clearTimeout(clearTimeoutId);
      clearTimeoutId = null;
    }

    if (isNativeApp()) {
      await Clipboard.write({ string: '' });
    } else {
      await navigator.clipboard.writeText('');
    }

  } catch (error) {
    console.error('Failed to clear clipboard:', error);
  }
}

export async function readFromClipboard(): Promise<string> {
  try {
    if (isNativeApp()) {
      const result = await Clipboard.read();
      return result.value || '';
    } else {
      return await navigator.clipboard.readText();
    }
  } catch (error) {
    console.error('Failed to read from clipboard:', error);
    return '';
  }
}

function setupBackgroundClearListener(): void {
  if (appBackgroundListener) return;

  const handleVisibilityChange = () => {
    if (document.hidden) {
      clearClipboard();
    }
  };

  const handleBlur = () => {
    clearClipboard();
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('blur', handleBlur);

  appBackgroundListener = () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('blur', handleBlur);
    appBackgroundListener = null;
  };
}

export function cleanupClipboardListeners(): void {
  if (clearTimeoutId) {
    clearTimeout(clearTimeoutId);
    clearTimeoutId = null;
  }

  if (appBackgroundListener) {
    appBackgroundListener();
  }
}

function showClipboardToast(message: string): void {
  const existingToast = document.getElementById('clipboard-toast');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.id = 'clipboard-toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: calc(var(--sab, 0px) + 2rem);
    left: 50%;
    transform: translateX(-50%);
    background: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    z-index: 9999;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    animation: slideUp 0.3s ease-out;
  `;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(1rem);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideUp 0.3s ease-out reverse';
    setTimeout(() => {
      toast.remove();
      style.remove();
    }, 300);
  }, 3000);
}

export function getDefaultClipboardTimeout(): number {
  return DEFAULT_TIMEOUT_MS;
}

export function setClipboardTimeout(timeoutMs: number): void {
  if (clearTimeoutId) {
    clearTimeout(clearTimeoutId);
    clearTimeoutId = setTimeout(() => {
      clearClipboard();
    }, timeoutMs);
  }
}
