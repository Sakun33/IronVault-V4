import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./styles/mobile.css";
// Initialize PWA service early
import "./lib/pwa";

// Scroll focused inputs into view on mobile (fixes keyboard obscuring inputs in modals)
document.addEventListener('focusin', (e) => {
  const el = e.target as HTMLElement;
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) {
    setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300); // wait for keyboard to finish animating
  }
}, { passive: true });

const rootElement = document.getElementById("root");
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
} else {
  console.error('Root element not found!');
}
