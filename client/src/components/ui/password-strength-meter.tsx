import { cn } from "@/lib/utils";
import { PasswordGenerator } from "@/lib/password-generator";

interface PasswordStrengthMeterProps {
  password: string;
  className?: string;
}

export function PasswordStrengthMeter({ password, className }: PasswordStrengthMeterProps) {
  const { score, level, feedback } = PasswordGenerator.calculateStrength(password);

  const getColorClass = () => {
    switch (level) {
      case 'weak': return 'bg-red-500';
      case 'medium': return 'bg-amber-500';
      case 'strong': return 'bg-primary';
      case 'very-strong': return 'bg-green-500';
      default: return 'bg-muted';
    }
  };

  const getLevelText = () => {
    switch (level) {
      case 'weak': return 'Weak';
      case 'medium': return 'Medium';
      case 'strong': return 'Strong';
      case 'very-strong': return 'Very Strong';
      default: return 'Enter password';
    }
  };

  const getLevelColor = () => {
    switch (level) {
      case 'weak': return 'text-red-600';
      case 'medium': return 'text-amber-600';
      case 'strong': return 'text-primary';
      case 'very-strong': return 'text-green-600';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">Password Strength</span>
        <span className={cn("text-xs font-medium", getLevelColor())}>
          {getLevelText()}
        </span>
      </div>
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-300", getColorClass())}
          style={{ width: `${password ? score : 0}%` }}
        />
      </div>
      {feedback.length > 0 && password.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <ul className="list-disc list-inside space-y-1">
            {feedback.slice(0, 2).map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
