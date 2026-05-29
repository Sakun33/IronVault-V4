import { MessageCircle, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCallback } from "react";
import { openSupportChat } from "@/lib/open-support-chat";

/**
 * Header-style icon button. Matches notification-bell / theme-toggle sizing.
 */
export function ChatSupportHeaderButton({ size = "desktop" }: { size?: "desktop" | "mobile" }) {
  const onClick = useCallback(() => {
    void openSupportChat().then((opened) => {
      if (!opened) {
        try {
          const ev = new CustomEvent("chat-support-unavailable");
          window.dispatchEvent(ev);
        } catch {
          /* noop */
        }
      }
    });
  }, []);

  if (size === "mobile") {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={onClick}
        className="h-9 w-9 rounded-xl flex-shrink-0"
        title="Live Chat Support"
        aria-label="Open live chat support"
        data-testid="chat-support-mobile"
      >
        <MessageCircle className="w-4 h-4" />
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClick}
          className="p-2 rounded-xl"
          title="Live Chat Support"
          aria-label="Open live chat support"
          data-testid="chat-support-desktop"
        >
          <MessageCircle className="w-5 h-5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Live Chat Support</TooltipContent>
    </Tooltip>
  );
}

/**
 * Floating, minimal Help pill for unauthenticated pages (landing, login, signup).
 * Sits in the bottom-right corner above the safe area, with quiet styling so it
 * never competes with primary CTAs.
 */
export function FloatingHelpButton() {
  const onClick = useCallback(() => {
    void openSupportChat();
  }, []);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open live chat help"
      data-testid="floating-help-button"
      className="fixed bottom-4 right-4 md:bottom-5 md:right-5 z-[60] flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground/80 shadow-sm backdrop-blur-md transition-all hover:bg-background hover:text-foreground hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/40"
      style={{ paddingBottom: "calc(0.375rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <HelpCircle className="h-3.5 w-3.5" />
      Help
    </button>
  );
}
