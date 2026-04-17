import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useVault } from '@/contexts/vault-context';
import { CryptoService, KDFConfig, CryptoKDFConfig } from '@/lib/crypto';
import { Shield, Clock, Zap, AlertTriangle, Info, Eye, EyeOff } from 'lucide-react';

interface SecuritySettingsModalProps {
  trigger: React.ReactNode;
  onSettingsChanged?: (kdfConfig: KDFConfig) => void;
}

interface BenchmarkResult {
  preset: string;
  config: KDFConfig;
  timeMs: number;
}

export function SecuritySettingsModal({ trigger, onSettingsChanged }: SecuritySettingsModalProps) {
  const [open, setOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('standard');
  const [benchmarkResults, setBenchmarkResults] = useState<BenchmarkResult[]>([]);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [benchmarkProgress, setBenchmarkProgress] = useState(0);
  const [masterPassword, setMasterPassword] = useState('');
  const [showMasterPassword, setShowMasterPassword] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [applyProgress, setApplyProgress] = useState(0);
  const { toast } = useToast();
  const { getKDFConfig, updateKDFConfig } = useVault();

  // Load current KDF configuration on open
  useEffect(() => {
    if (open) {
      loadCurrentKDFConfig();
    }
  }, [open]);

  const loadCurrentKDFConfig = async () => {
    try {
      const currentConfig = await getKDFConfig();
      if (currentConfig) {
        // Find the preset that matches current config
        const matchingPreset = Object.entries(CryptoService.KDF_PRESETS).find(([_, config]) => 
          config.algorithm === currentConfig.algorithm &&
          config.iterations === currentConfig.iterations &&
          config.hash === currentConfig.hash
        );
        
        if (matchingPreset) {
          setSelectedPreset(matchingPreset[0]);
        }
      }
    } catch (error) {
      console.error('Failed to load current KDF config:', error);
    }
  };

  // Get preset details with icons and colors
  const getPresetInfo = (preset: string) => {
    switch (preset) {
      case 'fast':
        return {
          icon: <Zap className="w-4 h-4" />,
          color: 'text-primary',
          bgColor: 'bg-primary/10',
          label: 'Fast (Development)',
          description: '100K iterations - For testing only'
        };
      case 'standard':
        return {
          icon: <Shield className="w-4 h-4" />,
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-50 dark:bg-green-950',
          label: 'Standard Security',
          description: '600K iterations - Recommended for most users'
        };
      case 'high':
        return {
          icon: <Shield className="w-4 h-4" />,
          color: 'text-orange-600 dark:text-orange-400',
          bgColor: 'bg-orange-50 dark:bg-orange-950',
          label: 'High Security',
          description: '1M iterations - For sensitive data'
        };
      case 'maximum':
        return {
          icon: <Shield className="w-4 h-4" />,
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-50 dark:bg-red-950',
          label: 'Maximum Security',
          description: '2M iterations SHA-512 - Strongest protection'
        };
      default:
        return {
          icon: <Shield className="w-4 h-4" />,
          color: 'text-muted-foreground',
          bgColor: 'bg-muted',
          label: preset,
          description: 'Custom configuration'
        };
    }
  };

  // Run performance benchmark
  const runBenchmark = async () => {
    if (isBenchmarking) return;
    
    setIsBenchmarking(true);
    setBenchmarkProgress(0);
    
    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setBenchmarkProgress(prev => Math.min(prev + 10, 90));
      }, 200);
      
      const timeMs = await CryptoService.benchmarkKDF(testPassword, CryptoService.KDF_PRESETS[selectedPreset as keyof typeof CryptoService.KDF_PRESETS].iterations);
      
      clearInterval(progressInterval);
      setBenchmarkProgress(100);
      setBenchmarkResults([{
        preset: selectedPreset,
        config: {
          ...CryptoService.KDF_PRESETS[selectedPreset as keyof typeof CryptoService.KDF_PRESETS],
          salt: new Uint8Array(16) // Mock salt for display
        },
        timeMs
      }]);
      
      toast({
        title: "Benchmark Complete",
        description: `Tested ${selectedPreset} preset on your device in ${formatTime(timeMs)}.`,
      });
    } catch (error) {
      console.error('Benchmark failed:', error);
      toast({
        title: "Benchmark Failed",
        description: "Could not test KDF performance. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsBenchmarking(false);
      setTimeout(() => setBenchmarkProgress(0), 1000);
    }
  };

  // Get benchmark time for a preset
  const getBenchmarkTime = (preset: string): number | null => {
    const result = benchmarkResults.find(r => r.preset === preset);
    return result ? result.timeMs : null;
  };

  // Format time display
  const formatTime = (timeMs: number): string => {
    if (timeMs < 1000) return `${timeMs}ms`;
    return `${(timeMs / 1000).toFixed(1)}s`;
  };

  // Apply security settings
  const applySettings = async () => {
    const config = CryptoService.KDF_PRESETS[selectedPreset as keyof typeof CryptoService.KDF_PRESETS];
    if (!config) return;

    if (!masterPassword.trim()) {
      toast({
        title: "Master Password Required",
        description: "Please enter your master password to apply security settings.",
        variant: "destructive",
      });
      return;
    }

    setIsApplying(true);
    setApplyProgress(0);

    try {
      const cryptoConfig: CryptoKDFConfig = {
        algorithm: config.algorithm,
        iterations: config.iterations,
        hash: config.hash
      };
      
      await updateKDFConfig(masterPassword, cryptoConfig as any, (progress) => {
        setApplyProgress(progress);
      });

      const kdfConfig: KDFConfig = {
        algorithm: config.algorithm,
        iterations: config.iterations,
        hash: config.hash,
        salt: new Uint8Array(16) // Mock salt for callback
      };
      
      onSettingsChanged?.(kdfConfig);
      toast({
        title: "Security Settings Updated",
        description: `Applied ${getPresetInfo(selectedPreset).label} configuration. Vault re-encrypted successfully.`,
      });
      
      // Reset form and close modal
      setMasterPassword('');
      setApplyProgress(0);
      setOpen(false);
    } catch (error) {
      console.error('Failed to update security settings:', error);
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update security settings. Please check your password and try again.",
        variant: "destructive",
      });
    } finally {
      setIsApplying(false);
    }
  };

  // Test password strength recommendation
  const [testPassword, setTestPassword] = useState('');
  const [recommendation, setRecommendation] = useState<{
    preset: string;
    reason: string;
    config: KDFConfig;
  } | null>(null);

  useEffect(() => {
    const updateRecommendation = async () => {
      if (testPassword.length > 0) {
        const rec = await CryptoService.recommendKDFPreset();
        setRecommendation({
          preset: rec,
          reason: `Recommended based on device performance`,
          config: {
            ...CryptoService.KDF_PRESETS[rec],
            salt: new Uint8Array(16) // Mock salt for display
          }
        });
      } else {
        setRecommendation(null);
      }
    };
    
    updateRecommendation();
  }, [testPassword]);

  // Auto-apply recommendation when using master password
  useEffect(() => {
    const updateMasterPasswordRecommendation = async () => {
      if (masterPassword.length >= 8) {
        const rec = await CryptoService.recommendKDFPreset();
        // Only auto-suggest if current selection is weaker than recommended
        const currentConfig = CryptoService.KDF_PRESETS[selectedPreset as keyof typeof CryptoService.KDF_PRESETS];
        const recommendedConfig = CryptoService.KDF_PRESETS[rec];
        
        if (recommendedConfig.iterations > currentConfig.iterations) {
          setSelectedPreset(rec);
        }
      }
    };
    
    updateMasterPasswordRecommendation();
  }, [masterPassword, selectedPreset]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild data-testid="button-security-settings">
        {trigger}
      </DialogTrigger>
      <DialogContent className="w-[min(96vw,64rem)] max-w-4xl max-h-[90svh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Security Settings
          </DialogTitle>
          <DialogDescription>
            Configure encryption strength and key derivation settings for your vault.
            Higher security levels provide better protection but take longer to unlock.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
          {/* KDF Preset Selection */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="kdf-preset" className="text-sm font-medium">
                Security Level
              </Label>
              <Select value={selectedPreset} onValueChange={setSelectedPreset}>
                <SelectTrigger data-testid="select-security-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CryptoService.KDF_PRESETS).map(([preset, config]) => {
                    const info = getPresetInfo(preset);
                    const benchmarkTime = getBenchmarkTime(preset);
                    
                    return (
                      <SelectItem key={preset} value={preset}>
                        <div className="flex items-center gap-2 w-full">
                          <div className={info.color}>{info.icon}</div>
                          <div className="flex-1">
                            <div className="font-medium">{info.label}</div>
                            <div className="text-xs text-muted-foreground">
                              {config.iterations.toLocaleString()} iterations
                              {benchmarkTime && ` • ${formatTime(benchmarkTime)}`}
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Current Selection Details */}
            {selectedPreset && (
              <div className={`p-4 rounded-lg border ${getPresetInfo(selectedPreset).bgColor} min-w-0 overflow-hidden`}>
                <div className="flex items-start gap-3">
                  <div className={getPresetInfo(selectedPreset).color}>
                    {getPresetInfo(selectedPreset).icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium">{getPresetInfo(selectedPreset).label}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {getPresetInfo(selectedPreset).description}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="outline">
                        {CryptoService.KDF_PRESETS[selectedPreset as keyof typeof CryptoService.KDF_PRESETS].algorithm}
                      </Badge>
                      <Badge variant="outline">
                        {CryptoService.KDF_PRESETS[selectedPreset as keyof typeof CryptoService.KDF_PRESETS].iterations.toLocaleString()} iterations
                      </Badge>
                      <Badge variant="outline" className="max-w-full break-words">
                        {CryptoService.KDF_PRESETS[selectedPreset as keyof typeof CryptoService.KDF_PRESETS].hash}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Performance Benchmark */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Performance Test</Label>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={runBenchmark}
                  disabled={isBenchmarking}
                  data-testid="button-run-benchmark"
                >
                  <Clock className="w-4 h-4 mr-2" />
                  {isBenchmarking ? 'Testing...' : 'Run Benchmark'}
                </Button>
              </div>
              
              {isBenchmarking && (
                <div>
                  <Progress value={benchmarkProgress} className="w-full" />
                  <p className="text-xs text-muted-foreground mt-1">
                    Testing security presets on your device...
                  </p>
                </div>
              )}

              {benchmarkResults.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Performance results on this device:
                  </p>
                  {benchmarkResults.map((result) => {
                    const info = getPresetInfo(result.preset);
                    return (
                      <div key={result.preset} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2">
                          <div className={info.color}>{info.icon}</div>
                          <span className="text-sm">{info.label}</span>
                        </div>
                        <span className="text-sm font-mono">
                          {result.timeMs === -1 ? 'Error' : formatTime(result.timeMs)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Password Strength Recommendation */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="test-password" className="text-sm font-medium">
                Password Strength Analyzer
              </Label>
              <input
                id="test-password"
                type="password"
                placeholder="Enter a test password..."
                value={testPassword}
                onChange={(e) => setTestPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm bg-background text-foreground placeholder:text-muted-foreground"
                data-testid="input-test-password"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Test password strength to get security level recommendations
              </p>
            </div>

            {recommendation && (
              <div className="p-4 rounded-lg border bg-card min-w-0 overflow-hidden">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-primary mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium">Recommended Setting</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {recommendation.reason}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge 
                        className={`${getPresetInfo(recommendation.preset).bgColor} ${getPresetInfo(recommendation.preset).color} border-current`}
                      >
                        {getPresetInfo(recommendation.preset).label}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Security Information */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Security Information</h4>
              
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Important Notes</p>
                    <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                      <li>Higher security = slower vault unlock times</li>
                      <li>Settings apply to new vaults and re-encrypted data</li>
                      <li>Consider device performance when choosing</li>
                      <li>Standard level is recommended for most users</li>
                    </ul>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Technical Details</p>
                    <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                      <li>Uses PBKDF2 key derivation function</li>
                      <li>AES-GCM encryption with 256-bit keys</li>
                      <li>Cryptographically secure random salts</li>
                      <li>Client-side encryption (zero-knowledge)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Master Password Input */}
        <div className="space-y-3 mt-6 pt-4 border-t">
          <div>
            <Label htmlFor="master-password" className="text-sm font-medium">
              Master Password Required
            </Label>
            <div className="relative mt-1">
              <Input
                id="master-password"
                type={showMasterPassword ? "text" : "password"}
                placeholder="Enter your master password..."
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                className="pr-10"
                data-testid="input-master-password"
                disabled={isApplying}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowMasterPassword(!showMasterPassword)}
                disabled={isApplying}
                data-testid="button-toggle-master-password"
              >
                {showMasterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Your master password is required to re-encrypt the vault with new security settings
            </p>
          </div>

          {/* Re-encryption Progress */}
          {isApplying && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Re-encrypting Vault</Label>
                <span className="text-sm text-muted-foreground">{applyProgress}%</span>
              </div>
              <Progress value={applyProgress} className="w-full" />
              <p className="text-xs text-muted-foreground mt-1">
                Applying new security settings and re-encrypting all vault data...
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 mt-6">
          <Button 
            variant="outline" 
            onClick={() => {
              setMasterPassword('');
              setOpen(false);
            }} 
            disabled={isApplying}
            data-testid="button-cancel-security"
          >
            Cancel
          </Button>
          <Button 
            onClick={applySettings} 
            disabled={isApplying || !masterPassword.trim()}
            data-testid="button-apply-security"
          >
            {isApplying ? 'Applying...' : 'Apply Settings'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}