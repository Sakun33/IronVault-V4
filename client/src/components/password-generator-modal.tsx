import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MobileDialog } from '@/components/mobile';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Copy, RefreshCw, Check, History } from 'lucide-react';
import { PasswordGenerator, PasswordOptions } from '@/lib/password-generator';
import { useToast } from '@/hooks/use-toast';

interface PasswordGeneratorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPasswordGenerated?: (password: string) => void;
}

// Approximate Shannon entropy of a generated password given which character
// classes are included. Charset sizes follow the standard ASCII pools the
// generator draws from.
function computeEntropyBits(opts: PasswordOptions): number {
  let charset = 0;
  if (opts.includeLowercase) charset += 26;
  if (opts.includeUppercase) charset += 26;
  if (opts.includeNumbers) charset += 10;
  if (opts.includeSymbols) charset += 32;
  if (opts.excludeSimilar) charset = Math.max(0, charset - 4);
  if (charset === 0) return 0;
  return Math.log2(charset) * opts.length;
}

function entropyTier(bits: number): { label: string; color: string; ring: string } {
  if (bits < 40) return { label: 'Weak', color: 'text-red-400', ring: '#ef4444' };
  if (bits < 60) return { label: 'Fair', color: 'text-amber-400', ring: '#f59e0b' };
  if (bits < 80) return { label: 'Strong', color: 'text-emerald-400', ring: '#10b981' };
  return { label: 'Excellent', color: 'text-teal-300', ring: '#14b8a6' };
}

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint: string;
  testId?: string;
}
function PillToggle({ checked, onChange, label, hint, testId }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-testid={testId}
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
        checked
          ? 'bg-emerald-500/12 border-emerald-400/40 text-emerald-200 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.25)]'
          : 'bg-white/[0.04] border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/[0.07]'
      }`}
    >
      <span className={`relative w-7 h-4 rounded-full transition-colors ${checked ? 'bg-emerald-400/80' : 'bg-white/15'}`}>
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          className={`absolute top-[2px] w-3 h-3 rounded-full bg-white shadow ${checked ? 'left-[14px]' : 'left-[2px]'}`}
        />
      </span>
      <span className="flex flex-col items-start min-w-0">
        <span className="text-xs font-semibold leading-tight">{label}</span>
        <span className="text-[10px] text-muted-foreground/70 font-mono">{hint}</span>
      </span>
    </button>
  );
}

// Sparkle burst — six tiny dots radiating out, animated via Motion. Triggered
// on copy. Pure DOM, no canvas, no library.
function CopySparkles({ play }: { play: boolean }) {
  const dots = Array.from({ length: 8 });
  return (
    <AnimatePresence>
      {play && (
        <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {dots.map((_, i) => {
            const angle = (i / dots.length) * Math.PI * 2;
            const dx = Math.cos(angle) * 28;
            const dy = Math.sin(angle) * 28;
            return (
              <motion.span
                key={i}
                initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                animate={{ opacity: 0, x: dx, y: dy, scale: 0.4 }}
                transition={{ duration: 0.55, ease: 'easeOut' }}
                className="absolute w-1.5 h-1.5 rounded-full bg-emerald-300 shadow-[0_0_6px_rgba(16,185,129,0.9)]"
              />
            );
          })}
        </span>
      )}
    </AnimatePresence>
  );
}

export function PasswordGeneratorModal({
  open,
  onOpenChange,
  onPasswordGenerated,
}: PasswordGeneratorModalProps) {
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [sparkleKey, setSparkleKey] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [options, setOptions] = useState<PasswordOptions>({
    length: 16,
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: true,
    excludeSimilar: false,
  });

  const generatePassword = () => {
    try {
      const newPassword = PasswordGenerator.generate(options);
      setPassword(newPassword);
      setCopied(false);
      // Track up to last 5 in session memory only — prepend, dedupe, cap.
      setHistory(prev => {
        if (prev[0] === newPassword) return prev;
        const next = [newPassword, ...prev.filter(p => p !== newPassword)];
        return next.slice(0, 5);
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate password. Please check your options.',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (open) generatePassword();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, options]);

  const copyPassword = async (value?: string) => {
    const text = value ?? password;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setSparkleKey(k => k + 1);
      toast({ title: 'Copied', description: 'Password copied to clipboard' });
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ title: 'Error', description: 'Failed to copy password', variant: 'destructive' });
    }
  };

  const usePassword = () => {
    onPasswordGenerated?.(password);
    onOpenChange(false);
    toast({ title: 'Password Applied', description: 'Generated password has been applied to your form' });
  };

  // Visual entropy arc — clamped to 120 bits at the high end so the ring
  // sits "full" for very long passwords without overflowing.
  const entropyBits = useMemo(() => computeEntropyBits(options), [options]);
  const tier = entropyTier(entropyBits);
  const ringSize = 96;
  const stroke = 8;
  const radius = (ringSize - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, entropyBits / 120));

  return (
    <MobileDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Password Generator"
      contentClassName="space-y-6"
      footer={
        <div className="flex gap-3 w-full">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1" data-testid="cancel-button">
            Cancel
          </Button>
          <Button onClick={usePassword} className="flex-1 cta-tap-pulse" data-testid="use-password-button">
            Use Password
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Hero: entropy arc + generated password */}
        <div className="relative glass-card p-4 flex items-center gap-4 overflow-visible">
          <div className="relative" style={{ width: ringSize, height: ringSize }}>
            <svg width={ringSize} height={ringSize} className="-rotate-90">
              <circle cx={ringSize / 2} cy={ringSize / 2} r={radius} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
              <motion.circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                stroke={tier.ring}
                strokeWidth={stroke}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={circumference}
                initial={false}
                animate={{ strokeDashoffset: circumference - circumference * pct }}
                transition={{ type: 'spring', stiffness: 80, damping: 22 }}
                style={{ filter: `drop-shadow(0 0 8px ${tier.ring}88)` }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground/70">Entropy</span>
              <span className="text-lg font-bold tabular-nums text-foreground">{Math.round(entropyBits)}</span>
              <span className={`text-[10px] font-semibold ${tier.color}`}>{tier.label}</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground/70">Password</Label>
            <div
              data-testid="generated-password-input"
              className="mt-1 font-mono text-lg break-all text-foreground select-all"
            >
              {password || '—'}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => copyPassword()}
                data-testid="copy-password-button"
                aria-label={copied ? 'Password copied' : 'Copy password'}
                className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/12 border border-emerald-400/30 text-emerald-200 text-xs font-semibold transition-colors hover:bg-emerald-500/20"
              >
                <CopySparkles key={sparkleKey} play={copied} />
                {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
              </button>
              <button
                type="button"
                onClick={generatePassword}
                data-testid="regenerate-password-button"
                aria-label="Regenerate password"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 text-foreground text-xs font-medium transition-colors hover:bg-white/[0.08]"
              >
                <RefreshCw className="w-3.5 h-3.5" /> New
              </button>
            </div>
          </div>
        </div>

        {/* Length slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Length</Label>
            <span className="text-sm font-mono font-semibold text-emerald-300" data-testid="length-value">{options.length}</span>
          </div>
          <div onPointerDown={(e) => e.stopPropagation()}>
            <Slider
              value={[options.length]}
              onValueChange={(value) => setOptions(prev => ({ ...prev, length: value[0] }))}
              max={50}
              min={8}
              step={1}
              className="w-full"
              data-testid="length-slider"
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground/60 font-mono">
            <span>8</span><span>16</span><span>24</span><span>32</span><span>40</span><span>50</span>
          </div>
        </div>

        {/* Character type pill toggles */}
        <div className="grid grid-cols-2 gap-2">
          <PillToggle
            checked={options.includeUppercase}
            onChange={(v) => setOptions(p => ({ ...p, includeUppercase: v }))}
            label="Uppercase"
            hint="A-Z"
            testId="uppercase-checkbox"
          />
          <PillToggle
            checked={options.includeLowercase}
            onChange={(v) => setOptions(p => ({ ...p, includeLowercase: v }))}
            label="Lowercase"
            hint="a-z"
            testId="lowercase-checkbox"
          />
          <PillToggle
            checked={options.includeNumbers}
            onChange={(v) => setOptions(p => ({ ...p, includeNumbers: v }))}
            label="Numbers"
            hint="0-9"
            testId="numbers-checkbox"
          />
          <PillToggle
            checked={options.includeSymbols}
            onChange={(v) => setOptions(p => ({ ...p, includeSymbols: v }))}
            label="Symbols"
            hint="!@#$%"
            testId="symbols-checkbox"
          />
        </div>

        <PillToggle
          checked={options.excludeSimilar}
          onChange={(v) => setOptions(p => ({ ...p, excludeSimilar: v }))}
          label="Exclude similar"
          hint="0, O, l, I"
          testId="exclude-similar-checkbox"
        />

        {/* Session history (last 5) */}
        {history.length > 1 && (
          <div className="pt-2">
            <div className="flex items-center gap-2 mb-2">
              <History className="w-3.5 h-3.5 text-muted-foreground/70" />
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-semibold">Recent (this session)</span>
            </div>
            <div className="space-y-1">
              {history.slice(1).map((p, i) => (
                <button
                  key={`${p}-${i}`}
                  type="button"
                  onClick={() => copyPassword(p)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-left transition-colors hover:bg-white/[0.06] hover:border-emerald-400/25 group"
                >
                  <span className="font-mono text-xs text-muted-foreground truncate flex-1">{p}</span>
                  <Copy className="w-3 h-3 text-muted-foreground/60 group-hover:text-emerald-300 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </MobileDialog>
  );
}
