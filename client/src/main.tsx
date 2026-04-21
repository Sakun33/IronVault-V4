import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./styles/mobile.css";
// Initialize PWA service early
import "./lib/pwa";

// CRASH REPORTER — shows actual error on white screen instead of blank page
function showCrash(label: string, msg: string, stack?: string) {
  document.body.innerHTML = `<pre style="color:#ff6b6b;background:#0a0a0f;padding:24px;font-size:13px;line-height:1.6;margin:0;min-height:100dvh;white-space:pre-wrap;word-break:break-word;">
[IronVault ${label}]

${msg}

${stack ? 'Stack:\n' + stack : ''}
</pre>`;
}

window.addEventListener('error', (e) => {
  showCrash('JS ERROR', `${e.message}\nFile: ${e.filename}:${e.lineno}:${e.colno}`, e.error?.stack);
});

window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason;
  const msg = reason?.message || String(reason);
  showCrash('UNHANDLED PROMISE', msg, reason?.stack);
});

// Scroll focused inputs into view on mobile (fixes keyboard obscuring inputs in modals)
document.addEventListener('focusin', (e) => {
  const el = e.target as HTMLElement;
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) {
    setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300); // wait for keyboard to finish animating
  }
}, { passive: true });

// Last-resort handler: async errors that escape React's ErrorBoundary show a recoverable
// overlay instead of a blank white screen.
window.addEventListener('unhandledrejection', (e) => {
  console.error('[IronVault] Unhandled promise rejection:', e.reason);
  const root = document.getElementById('root');
  if (root && root.childElementCount === 0) {
    root.innerHTML = `
      <div style="min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#0a0a0f;font-family:sans-serif;padding:24px;">
        <div style="text-align:center;max-width:360px;">
          <div style="width:56px;height:56px;background:#ef444420;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
            <svg width="28" height="28" fill="none" stroke="#ef4444" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
          </div>
          <h2 style="color:#e2e8f0;font-size:18px;font-weight:600;margin-bottom:8px;">Something went wrong</h2>
          <p style="color:#94a3b8;font-size:14px;margin-bottom:20px;">Your encrypted data is safe. This is a display error.</p>
          <button onclick="window.location.reload()" style="background:#6366f1;color:#fff;border:none;padding:10px 24px;border-radius:12px;font-size:14px;cursor:pointer;font-weight:600;">Reload App</button>
        </div>
      </div>`;
  }
});

const rootElement = document.getElementById("root");
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
} else {
  console.error('Root element not found!');
}
