import { useEffect, useState } from 'react';
import { Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import {
  FONT_SCALE_PRESETS,
  FONT_SCALE_MIN,
  FONT_SCALE_MAX,
  FONT_SCALE_DEFAULT,
  readFontScale,
  writeFontScale,
  matchPreset,
  type FontScalePresetId,
} from '@/lib/font-scale';

const SLIDER_STEP = 0.025;

function pxLabel(scale: number): string {
  return `${Math.round(16 * scale)}px`;
}

export function FontSizeSettings() {
  const [scale, setScale] = useState<number>(() => readFontScale());

  // Stay in sync with changes from other surfaces (e.g. another tab).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'iv_font_scale') return;
      setScale(readFontScale());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const activePreset: FontScalePresetId | null = matchPreset(scale);

  function setPreset(id: FontScalePresetId) {
    const preset = FONT_SCALE_PRESETS.find(p => p.id === id);
    if (!preset) return;
    setScale(preset.scale);
    writeFontScale(preset.scale);
  }

  function handleSlider(values: number[]) {
    const next = values[0] ?? FONT_SCALE_DEFAULT;
    setScale(next);
    writeFontScale(next);
  }

  function reset() {
    setScale(FONT_SCALE_DEFAULT);
    writeFontScale(FONT_SCALE_DEFAULT);
  }

  return (
    <div className="space-y-5" data-testid="font-size-settings">
      <div>
        <Label className="text-sm font-medium mb-3 block">Presets</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {FONT_SCALE_PRESETS.map(({ id, label, px }) => (
            <Button
              key={id}
              variant={activePreset === id ? 'default' : 'outline'}
              size="sm"
              className="flex-col h-auto py-2 gap-0.5"
              onClick={() => setPreset(id)}
              data-testid={`font-preset-${id}`}
            >
              <span className="text-sm font-semibold">{label}</span>
              <span className="text-[10px] opacity-70">{px}px</span>
            </Button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-medium">Custom</Label>
          <span className="text-xs font-mono text-muted-foreground" data-testid="font-scale-value">
            {pxLabel(scale)} · {scale.toFixed(2)}×
          </span>
        </div>
        <Slider
          min={FONT_SCALE_MIN}
          max={FONT_SCALE_MAX}
          step={SLIDER_STEP}
          value={[scale]}
          onValueChange={handleSlider}
          aria-label="Font size scale"
          data-testid="font-scale-slider"
        />
        <div className="flex items-center justify-between mt-1.5 text-[10px] text-muted-foreground">
          <span>{pxLabel(FONT_SCALE_MIN)}</span>
          <span>{pxLabel(FONT_SCALE_MAX)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 px-3 py-3">
        <div className="flex items-center gap-2">
          <Type className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm">Preview</span>
        </div>
        <Button variant="ghost" size="sm" onClick={reset} data-testid="font-scale-reset">
          Reset
        </Button>
      </div>
    </div>
  );
}
