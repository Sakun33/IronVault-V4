import { Lock, Sparkles } from 'lucide-react';
import { useLocation } from 'wouter';

export function UpgradeGate({ feature }: { feature: string }) {
  const [, setLocation] = useLocation();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
      <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/20 dark:to-purple-500/20 rounded-3xl p-12 max-w-md text-center border border-indigo-200 dark:border-indigo-800">
        <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Lock className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h2 className="text-2xl font-bold mb-3">{feature}</h2>
        <p className="text-muted-foreground mb-6">
          This feature is available with the Pro plan. Upgrade to unlock {feature.toLowerCase()} and more.
        </p>
        <button
          onClick={() => setLocation('/upgrade')}
          className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          Upgrade to Pro
        </button>
      </div>
    </div>
  );
}
