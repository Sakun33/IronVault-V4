import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

const TAWK_DIRECT_URL =
  "https://tawk.to/chat/6a184abf549ee11c36b0d928/1jpne7vlu";

declare global {
  interface Window {
    Tawk_API?: {
      maximize?: () => void;
      minimize?: () => void;
      toggle?: () => void;
      showWidget?: () => void;
      hideWidget?: () => void;
      onLoad?: () => void;
    };
  }
}

export async function openSupportChat(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      await Browser.open({
        url: TAWK_DIRECT_URL,
        windowName: "_blank",
        presentationStyle: "fullscreen",
      });
      return true;
    } catch (err) {
      console.warn("[support-chat] Browser.open failed, falling back", err);
      try {
        window.open(TAWK_DIRECT_URL, "_blank", "noopener,noreferrer");
        return true;
      } catch {
        return false;
      }
    }
  }

  const tawk = window.Tawk_API;
  if (tawk) {
    try {
      if (typeof tawk.showWidget === "function") tawk.showWidget();
      if (typeof tawk.maximize === "function") {
        tawk.maximize();
        return true;
      }
      if (typeof tawk.toggle === "function") {
        tawk.toggle();
        return true;
      }
    } catch (err) {
      console.warn("[support-chat] tawk open failed", err);
    }
  }

  try {
    window.open(TAWK_DIRECT_URL, "_blank", "noopener,noreferrer");
    return true;
  } catch {
    return false;
  }
}
