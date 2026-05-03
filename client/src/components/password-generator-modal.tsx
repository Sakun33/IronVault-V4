import { useState, useEffect } from 'react';
import { MobileDialog } from '@/components/mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Copy, RefreshCw, Check } from 'lucide-react';
import { PasswordGenerator, PasswordOptions } from '@/lib/password-generator';
import { PasswordStrengthMeter } from '@/components/ui/password-strength-meter';
import { useToast } from '@/hooks/use-toast';

interface PasswordGeneratorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPasswordGenerated?: (password: string) => void;
}

export function PasswordGeneratorModal({ 
  open, 
  onOpenChange, 
  onPasswordGenerated 
}: PasswordGeneratorModalProps) {
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [options, setOptions] = useState<PasswordOptions>({
    length: 16,
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: true,
    excludeSimilar: false,
  });

  useEffect(() => {
    if (open) {
      generatePassword();
    }
  }, [open, options]);

  const generatePassword = () => {
    try {
      const newPassword = PasswordGenerator.generate(options);
      setPassword(newPassword);
      setCopied(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate password. Please check your options.",
        variant: "destructive",
      });
    }
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      toast({
        title: "Copied",
        description: "Password copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy password",
        variant: "destructive",
      });
    }
  };

  const usePassword = () => {
    onPasswordGenerated?.(password);
    onOpenChange(false);
    toast({
      title: "Password Applied",
      description: "Generated password has been applied to your form",
    });
  };

  return (
    <MobileDialog 
      open={open} 
      onOpenChange={onOpenChange}
      title="Password Generator"
      contentClassName="space-y-6"
      footer={
        <div className="flex gap-3 w-full">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
            data-testid="cancel-button"
          >
            Cancel
          </Button>
          <Button
            onClick={usePassword}
            className="flex-1"
            data-testid="use-password-button"
          >
            Use Password
          </Button>
        </div>
      }
    >
        <div className="space-y-4">
          {/* Generated Password Display */}
          <div className="space-y-2">
            <Label htmlFor="generated-password">Generated Password</Label>
            <div className="flex gap-2">
              <Input
                id="generated-password"
                value={password}
                readOnly
                className="font-mono text-sm"
                data-testid="generated-password-input"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={copyPassword}
                data-testid="copy-password-button"
                aria-label={copied ? 'Password copied' : 'Copy password'}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={generatePassword}
                data-testid="regenerate-password-button"
                aria-label="Regenerate password"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Password Length */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Length</Label>
              <span className="text-sm font-medium text-primary" data-testid="length-value">
                {options.length}
              </span>
            </div>
            <div onPointerDown={(e) => e.stopPropagation()}>
              <Slider
                value={[options.length]}
                onValueChange={(value) =>
                  setOptions(prev => ({ ...prev, length: value[0] }))
                }
                max={50}
                min={8}
                step={1}
                className="w-full"
                data-testid="length-slider"
              />
            </div>
          </div>

          {/* Character Type Options */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="uppercase"
                checked={options.includeUppercase}
                onCheckedChange={(checked) =>
                  setOptions(prev => ({ ...prev, includeUppercase: Boolean(checked) }))
                }
                data-testid="uppercase-checkbox"
              />
              <Label htmlFor="uppercase" className="text-sm">
                Uppercase (A-Z)
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="lowercase"
                checked={options.includeLowercase}
                onCheckedChange={(checked) =>
                  setOptions(prev => ({ ...prev, includeLowercase: Boolean(checked) }))
                }
                data-testid="lowercase-checkbox"
              />
              <Label htmlFor="lowercase" className="text-sm">
                Lowercase (a-z)
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="numbers"
                checked={options.includeNumbers}
                onCheckedChange={(checked) =>
                  setOptions(prev => ({ ...prev, includeNumbers: Boolean(checked) }))
                }
                data-testid="numbers-checkbox"
              />
              <Label htmlFor="numbers" className="text-sm">
                Numbers (0-9)
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="symbols"
                checked={options.includeSymbols}
                onCheckedChange={(checked) =>
                  setOptions(prev => ({ ...prev, includeSymbols: Boolean(checked) }))
                }
                data-testid="symbols-checkbox"
              />
              <Label htmlFor="symbols" className="text-sm">
                Symbols (!@#$)
              </Label>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="exclude-similar"
              checked={options.excludeSimilar}
              onCheckedChange={(checked) =>
                setOptions(prev => ({ ...prev, excludeSimilar: Boolean(checked) }))
              }
              data-testid="exclude-similar-checkbox"
            />
            <Label htmlFor="exclude-similar" className="text-sm">
              Exclude similar characters (0,O,l,I)
            </Label>
          </div>

          {/* Password Strength */}
          <PasswordStrengthMeter password={password} />
        </div>
    </MobileDialog>
  );
}
