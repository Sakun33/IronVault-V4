import { useLocation } from 'wouter';
import { Sparkles, Lock } from 'lucide-react';

// Soft paywall — shows the feature in muted/blurred form behind a centered
// upgrade card so free users see what they're missing instead of a blank
// "upgrade to unlock" wall. The visual mock is decorative; nothing real is
// rendered, so no PII leaks behind the blur.
//
// The mock variant is chosen by the `mock` prop. Each is hand-rolled rather
// than a screenshot to keep the component self-contained and avoid bundling
// large assets.

interface FeaturePreviewProps {
  feature: string;        // e.g. "Documents Vault"
  description: string;    // longer pitch
  bullets?: string[];     // 3-5 short feature bullets
  mock: 'documents' | 'expenses' | 'investments' | 'bank-statements' | 'api-keys';
}

export function FeaturePreview({ feature, description, bullets, mock }: FeaturePreviewProps) {
  const [, setLocation] = useLocation();

  return (
    <div className="relative min-h-[70vh] overflow-hidden rounded-3xl" data-testid="feature-preview">
      {/* Blurred / muted mock backdrop */}
      <div className="absolute inset-0 pointer-events-none select-none opacity-50 blur-[2px]" aria-hidden="true">
        <MockBackdrop mock={mock} />
      </div>

      {/* Gradient veil so text never lands on busy mock content */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background pointer-events-none" />

      {/* CTA card */}
      <div className="relative flex items-center justify-center min-h-[70vh] p-6">
        <div className="bg-card/90 backdrop-blur-md border border-indigo-200 dark:border-indigo-800 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl shadow-indigo-500/10">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-foreground">{feature}</h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{description}</p>

          {bullets && bullets.length > 0 && (
            <ul className="mt-5 space-y-2 text-left">
              {bullets.map((b, i) => (
                <li key={i} className="text-sm text-foreground/85 flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0 mt-0.5" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}

          <button
            onClick={() => setLocation('/upgrade')}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold transition-all shadow-lg shadow-indigo-500/25"
            data-testid="feature-preview-upgrade"
          >
            <Sparkles className="w-4 h-4" />
            Upgrade to Pro
          </button>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Unlocks {feature.toLowerCase()} plus everything else in IronVault Pro.
          </p>
        </div>
      </div>
    </div>
  );
}

// Decorative mocks — pure visual fluff that gives a sense of the feature
// without leaking real data. All "rows" are placeholder shapes, never strings
// from the user's vault.
function MockBackdrop({ mock }: { mock: FeaturePreviewProps['mock'] }) {
  const rows = Array.from({ length: 8 });
  switch (mock) {
    case 'documents':
      return (
        <div className="p-6 space-y-3">
          <div className="h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {rows.slice(0, 6).map((_, i) => (
              <div key={i} className="aspect-square rounded-2xl bg-card border border-border/40 flex flex-col p-3">
                <div className="flex-1 rounded-xl bg-gradient-to-br from-emerald-500/15 to-teal-500/15" />
                <div className="h-2 mt-2 rounded-full bg-muted/60 w-3/4" />
                <div className="h-1.5 mt-1 rounded-full bg-muted/40 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      );
    case 'expenses':
      return (
        <div className="p-6 space-y-3">
          <div className="h-20 rounded-2xl bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-500/20" />
          {rows.map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border/40">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20" />
              <div className="flex-1 space-y-1.5">
                <div className="h-2 rounded-full bg-muted/60 w-2/3" />
                <div className="h-1.5 rounded-full bg-muted/40 w-1/3" />
              </div>
              <div className="h-3 w-14 rounded-full bg-muted/50" />
            </div>
          ))}
        </div>
      );
    case 'investments':
      return (
        <div className="p-6 space-y-3">
          <div className="h-32 rounded-2xl bg-gradient-to-br from-sky-500/15 to-indigo-500/15 border border-sky-500/20" />
          <div className="grid grid-cols-2 gap-3">
            {rows.slice(0, 4).map((_, i) => (
              <div key={i} className="h-20 rounded-2xl bg-card border border-border/40 p-3 flex flex-col justify-between">
                <div className="h-2 rounded-full bg-muted/60 w-1/2" />
                <div className="h-3 rounded-full bg-muted/50 w-2/3" />
              </div>
            ))}
          </div>
        </div>
      );
    case 'bank-statements':
      return (
        <div className="p-6 space-y-3">
          <div className="h-16 rounded-2xl bg-gradient-to-r from-blue-500/15 to-cyan-500/15 border border-blue-500/20" />
          {rows.map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-card border border-border/40">
              <div className="w-1.5 h-8 rounded-full bg-blue-500/30" />
              <div className="flex-1 space-y-1.5">
                <div className="h-2 rounded-full bg-muted/60 w-1/2" />
                <div className="h-1.5 rounded-full bg-muted/40 w-1/3" />
              </div>
              <div className="h-2.5 w-16 rounded-full bg-muted/50" />
            </div>
          ))}
        </div>
      );
    case 'api-keys':
      return (
        <div className="p-6 space-y-3">
          {rows.slice(0, 5).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-gradient-to-br from-purple-500/10 to-fuchsia-500/10 border border-purple-500/20 p-4 flex flex-col justify-between">
              <div className="h-3 rounded-full bg-muted/60 w-2/5" />
              <div className="h-2 rounded-full bg-muted/40 w-3/5" />
            </div>
          ))}
        </div>
      );
  }
}
