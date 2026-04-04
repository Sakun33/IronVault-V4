import { Badge } from '@/components/ui/badge';

export type ProCycle = 'monthly' | 'yearly';

export interface ProCycleToggleProps {
  value: ProCycle;
  onChange: (value: ProCycle) => void;
  disabled?: boolean;
  savingsPercent?: number | null;
}

export function ProCycleToggle({ value, onChange, disabled = false, savingsPercent }: ProCycleToggleProps) {
  const showSavingsBadge = savingsPercent && savingsPercent >= 5;

  return (
    <div className="flex justify-center">
      <div className="inline-flex rounded-lg border bg-muted p-1 gap-1">
        <button
          onClick={() => onChange('monthly')}
          disabled={disabled}
          className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
            value === 'monthly'
              ? 'bg-background shadow-sm'
              : 'hover:bg-background/50'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-pressed={value === 'monthly'}
          aria-label="Monthly billing"
        >
          Monthly
        </button>
        <button
          onClick={() => onChange('yearly')}
          disabled={disabled}
          className={`px-6 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
            value === 'yearly'
              ? 'bg-background shadow-sm'
              : 'hover:bg-background/50'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-pressed={value === 'yearly'}
          aria-label="Yearly billing"
        >
          Yearly
          {showSavingsBadge && (
            <Badge variant="secondary" className="bg-green-500 text-white hover:bg-green-600">
              Save {savingsPercent}%
            </Badge>
          )}
        </button>
      </div>
    </div>
  );
}
