import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  // When provided, the boundary remounts (and resets) whenever this key changes.
  // Useful for route-level boundaries: pass the current pathname so navigating
  // away from a crashed page recovers automatically.
  resetKey?: string;
  // "app" renders a full-screen fallback (default). "page" renders a contained
  // panel suitable for embedding inside an existing layout — a crash in one
  // page does not blank the rest of the app shell.
  level?: "app" | "page";
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, info.componentStack);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      const level = this.props.level ?? "app";
      if (level === "page") {
        return (
          <div className="flex items-center justify-center p-8">
            <div className="text-center max-w-md bg-card border border-border rounded-2xl p-8 shadow-sm">
              <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg
                  className="w-6 h-6 text-destructive"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-2">This section couldn't load</h2>
              <p className="text-muted-foreground mb-5 text-sm">
                Something on this page hit a snag. Other pages still work — try again or navigate elsewhere.
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={this.handleReset} variant="outline" className="rounded-xl">
                  Try again
                </Button>
                <Button onClick={() => window.location.reload()} className="rounded-xl">
                  Reload
                </Button>
              </div>
            </div>
          </div>
        );
      }
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-destructive"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-6 text-sm">
              An unexpected error occurred. Your encrypted data is safe — this is a display issue only.
            </p>
            <Button onClick={() => window.location.reload()} className="rounded-xl px-6">
              Reload App
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
