/**
 * Export Sheet Component
 * Handles document export with optional AES-256 password protection
 * Premium feel with password strength indicator
 */

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Download,
  Lock,
  Eye,
  EyeOff,
  Shield,
  AlertTriangle,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { getPasswordStrength } from '@/lib/documents';
import { ExportProgress } from '@/lib/documents/types';

interface ExportSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filename: string;
  onExport: (password?: string) => Promise<void>;
}

export function ExportSheet({
  open,
  onOpenChange,
  filename,
  onExport,
}: ExportSheetProps) {
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const passwordStrength = getPasswordStrength(password);
  const passwordsMatch = password === confirmPassword;
  const canExport = !usePassword || (password.length >= 4 && passwordsMatch);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setError(null);
    setProgress({ stage: 'decrypting', progress: 0, message: 'Starting export...' });

    try {
      await onExport(usePassword ? password : undefined);
      setProgress({ stage: 'complete', progress: 100, message: 'Export complete!' });
      
      // Close after success
      setTimeout(() => {
        onOpenChange(false);
        resetForm();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
      setProgress(null);
    } finally {
      setIsExporting(false);
    }
  }, [onExport, usePassword, password, onOpenChange]);

  const resetForm = useCallback(() => {
    setUsePassword(false);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setProgress(null);
    setError(null);
  }, []);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  }, [onOpenChange, resetForm]);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="rounded-t-xl">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Document
          </SheetTitle>
          <SheetDescription className="text-sm">
            Export "{filename}" to your device
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-6">
          {/* Quick Export Option */}
          <div className="p-4 rounded-lg border border-border bg-card">
            <div className="flex items-start gap-3">
              <Download className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-foreground">Quick Export</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Download or share without password protection
                </p>
              </div>
            </div>
          </div>

          {/* Password Protection Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-primary" />
              <div>
                <Label htmlFor="use-password" className="font-medium text-foreground">
                  Protect with password
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  AES-256 encrypted ZIP file
                </p>
              </div>
            </div>
            <Switch
              id="use-password"
              checked={usePassword}
              onCheckedChange={setUsePassword}
              disabled={isExporting}
            />
          </div>

          {/* Password Fields */}
          {usePassword && (
            <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/50">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    disabled={isExporting}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                
                {/* Password Strength */}
                {password.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Strength:</span>
                      <span className={passwordStrength.color}>{passwordStrength.label}</span>
                    </div>
                    <Progress
                      value={(passwordStrength.score / 5) * 100}
                      className="h-1"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-sm font-medium">
                  Confirm Password
                </Label>
                <Input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  disabled={isExporting}
                />
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Passwords do not match
                  </p>
                )}
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2 p-3 rounded-md bg-yellow-500/10 border border-yellow-500/30">
                <Lock className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                  Keep this password safe. Without it, the file cannot be opened.
                </p>
              </div>
            </div>
          )}

          {/* Progress */}
          {progress && (
            <div className="p-4 rounded-lg border border-border bg-card">
              <div className="flex items-center gap-3">
                {progress.stage === 'complete' ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{progress.message}</p>
                  <Progress value={progress.progress} className="h-1 mt-2" />
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/10">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            </div>
          )}
        </div>

        <SheetFooter className="flex-row gap-3">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isExporting}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={!canExport || isExporting}
            className="flex-1"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default ExportSheet;
