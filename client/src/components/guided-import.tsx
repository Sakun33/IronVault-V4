import { useState, useCallback } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, ChevronDown, ArrowRight, ArrowLeft, ExternalLink, ShieldCheck } from 'lucide-react';
import ImportPasswords from '@/components/import-passwords';
import type { ImportSourceId } from '@/lib/password-import';

type GuidedSourceId = Extract<
  ImportSourceId,
  'chrome' | 'firefox' | 'safari' | 'edge' | 'brave' | 'opera' |
  'onepassword' | 'lastpass' | 'bitwarden' | 'dashlane' | 'keepass'
>;

interface GuidedSource {
  id: GuidedSourceId;
  name: string;
  category: 'browser' | 'manager';
  /** Brand color used in the icon tile background. */
  accent: string;
  /** Single-letter monogram fallback rendered inside the tile. */
  monogram: string;
  /** Optional URL the user can open with one click to start the export. */
  shortcut?: { label: string; url: string };
  steps: string[];
}

const SOURCES: GuidedSource[] = [
  {
    id: 'chrome',
    name: 'Google Chrome',
    category: 'browser',
    accent: 'from-blue-500 to-emerald-500',
    monogram: 'C',
    shortcut: { label: 'Open chrome://settings/passwords', url: 'chrome://settings/passwords' },
    steps: [
      'In Chrome, paste chrome://settings/passwords into the address bar and press Enter.',
      'Click the ⋮ (three-dot) menu next to "Saved Passwords".',
      'Choose "Export passwords…" and confirm with your system password.',
      'Save the resulting CSV file to your Downloads folder.',
      'Come back here and upload that CSV in the next step.',
    ],
  },
  {
    id: 'firefox',
    name: 'Mozilla Firefox',
    category: 'browser',
    accent: 'from-orange-500 to-red-500',
    monogram: 'F',
    shortcut: { label: 'Open about:logins', url: 'about:logins' },
    steps: [
      'In Firefox, paste about:logins into the address bar and press Enter.',
      'Click the ⋯ (three-dot) menu in the top right of Lockwise.',
      'Choose "Export Logins…" and confirm with your device password.',
      'Save the CSV file somewhere you can find it.',
      'Upload that CSV in the next step.',
    ],
  },
  {
    id: 'safari',
    name: 'Apple Safari',
    category: 'browser',
    accent: 'from-sky-500 to-blue-600',
    monogram: 'S',
    steps: [
      'Open Safari → menu bar → Safari → Settings (or Preferences).',
      'Click the "Passwords" tab and authenticate with Touch ID or your password.',
      'Click the ⋯ button (or "Export…" on newer macOS) and choose "Export All Passwords…".',
      'Save the CSV — Safari will warn that the file is unencrypted; that\'s expected.',
      'Upload that CSV in the next step.',
    ],
  },
  {
    id: 'edge',
    name: 'Microsoft Edge',
    category: 'browser',
    accent: 'from-cyan-500 to-blue-600',
    monogram: 'E',
    shortcut: { label: 'Open edge://settings/passwords', url: 'edge://settings/passwords' },
    steps: [
      'In Edge, paste edge://settings/passwords and press Enter.',
      'Click the ⋯ menu next to "Saved passwords".',
      'Choose "Export passwords" and confirm with your Windows / Mac password.',
      'Save the resulting CSV.',
      'Upload that CSV in the next step.',
    ],
  },
  {
    id: 'brave',
    name: 'Brave',
    category: 'browser',
    accent: 'from-orange-500 to-amber-500',
    monogram: 'B',
    shortcut: { label: 'Open brave://settings/passwords', url: 'brave://settings/passwords' },
    steps: [
      'In Brave, paste brave://settings/passwords and press Enter.',
      'Click the ⋮ menu next to "Saved Passwords".',
      'Choose "Export passwords" and authenticate.',
      'Save the CSV.',
      'Upload that CSV in the next step.',
    ],
  },
  {
    id: 'opera',
    name: 'Opera',
    category: 'browser',
    accent: 'from-red-500 to-rose-600',
    monogram: 'O',
    shortcut: { label: 'Open opera://settings/passwords', url: 'opera://settings/passwords' },
    steps: [
      'In Opera, paste opera://settings/passwords and press Enter.',
      'Click the ⋯ button next to "Saved passwords".',
      'Choose "Export passwords" and authenticate.',
      'Save the CSV.',
      'Upload that CSV in the next step.',
    ],
  },
  {
    id: 'onepassword',
    name: '1Password',
    category: 'manager',
    accent: 'from-blue-600 to-indigo-700',
    monogram: '1',
    steps: [
      'Open the 1Password desktop app and unlock your vault.',
      'From the top menu choose File → Export → All Items (or your selected vault).',
      'Choose "CSV" as the format and confirm.',
      'Save the CSV file somewhere safe.',
      'Upload that CSV in the next step.',
    ],
  },
  {
    id: 'lastpass',
    name: 'LastPass',
    category: 'manager',
    accent: 'from-red-600 to-rose-700',
    monogram: 'L',
    shortcut: { label: 'Open LastPass vault', url: 'https://lastpass.com/?ac=1&lpnorefresh=1' },
    steps: [
      'Sign in to LastPass at lastpass.com and open your vault.',
      'In the left sidebar click "Advanced Options" → "Export".',
      'Authenticate with your master password — LastPass shows your CSV in the browser.',
      'Copy that data into a .csv file (or use the desktop app File → Export → CSV).',
      'Upload that CSV in the next step.',
    ],
  },
  {
    id: 'bitwarden',
    name: 'Bitwarden',
    category: 'manager',
    accent: 'from-blue-500 to-sky-600',
    monogram: 'B',
    shortcut: { label: 'Open Bitwarden web vault', url: 'https://vault.bitwarden.com/#/tools/export' },
    steps: [
      'Sign in to Bitwarden at vault.bitwarden.com.',
      'Open Tools → Export Vault.',
      'Choose ".csv" as the file format and authenticate.',
      'Save the CSV — Bitwarden warns that the export is unencrypted.',
      'Upload that CSV in the next step.',
    ],
  },
  {
    id: 'dashlane',
    name: 'Dashlane',
    category: 'manager',
    accent: 'from-emerald-500 to-teal-600',
    monogram: 'D',
    shortcut: { label: 'Open Dashlane', url: 'https://app.dashlane.com/' },
    steps: [
      'Open Dashlane (web extension or app) and sign in.',
      'Click "My Account" → "Settings" → "Export Data".',
      'Choose "Export to CSV" and authenticate.',
      'Save the resulting CSV.',
      'Upload that CSV in the next step.',
    ],
  },
  {
    id: 'keepass',
    name: 'KeePass',
    category: 'manager',
    accent: 'from-slate-600 to-slate-800',
    monogram: 'K',
    steps: [
      'Open your KeePass database in the desktop app and unlock it.',
      'From the top menu choose File → Export.',
      'Pick "KeePass CSV (1.x)" or just CSV.',
      'Save the CSV — keep it somewhere safe; it contains all of your passwords.',
      'Upload that CSV in the next step.',
    ],
  },
];

interface GuidedImportButtonProps {
  /** Optional className override for the trigger button. */
  className?: string;
  /** Compact icon-only trigger for tight headers. */
  compact?: boolean;
}

export function GuidedImportButton({ className, compact = false }: GuidedImportButtonProps) {
  const [openSource, setOpenSource] = useState<GuidedSource | null>(null);
  const [stage, setStage] = useState<'instructions' | 'upload'>('instructions');

  const handlePick = useCallback((source: GuidedSource) => {
    setOpenSource(source);
    setStage('instructions');
  }, []);

  const handleClose = useCallback(() => {
    setOpenSource(null);
    setStage('instructions');
  }, []);

  const browsers = SOURCES.filter(s => s.category === 'browser');
  const managers = SOURCES.filter(s => s.category === 'manager');

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`rounded-xl ${className ?? ''}`}
            data-testid="guided-import-trigger"
          >
            <Download className="w-4 h-4 mr-1" />
            {compact ? '' : 'Import'}
            <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            Browsers
          </DropdownMenuLabel>
          {browsers.map(s => (
            <DropdownMenuItem
              key={s.id}
              onClick={() => handlePick(s)}
              className="gap-3 py-2.5 cursor-pointer"
              data-testid={`guided-import-source-${s.id}`}
            >
              <SourceTile source={s} size="sm" />
              <span className="font-medium">{s.name}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            Password Managers
          </DropdownMenuLabel>
          {managers.map(s => (
            <DropdownMenuItem
              key={s.id}
              onClick={() => handlePick(s)}
              className="gap-3 py-2.5 cursor-pointer"
              data-testid={`guided-import-source-${s.id}`}
            >
              <SourceTile source={s} size="sm" />
              <span className="font-medium">{s.name}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!openSource} onOpenChange={(o) => { if (!o) handleClose(); }}>
        <DialogContent className="sm:max-w-[640px] max-h-[90vh]" data-testid="guided-import-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {openSource && <SourceTile source={openSource} size="md" />}
              <span>Import from {openSource?.name}</span>
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            {openSource && stage === 'instructions' && (
              <InstructionsStage
                source={openSource}
                onContinue={() => setStage('upload')}
              />
            )}
            {openSource && stage === 'upload' && (
              <UploadStage
                source={openSource}
                onBack={() => setStage('instructions')}
                onDone={handleClose}
              />
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SourceTile({ source, size }: { source: GuidedSource; size: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-7 h-7 text-[12px]' : 'w-10 h-10 text-base';
  return (
    <div
      className={`flex-shrink-0 ${dim} rounded-lg bg-gradient-to-br ${source.accent} text-white font-bold flex items-center justify-center shadow-sm`}
      aria-hidden="true"
    >
      {source.monogram}
    </div>
  );
}

function InstructionsStage({
  source,
  onContinue,
}: {
  source: GuidedSource;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-4">
      <Card className="bg-muted/40 border-border/50">
        <CardContent className="p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            Files are parsed locally in your browser. Your CSV is never uploaded to a server in
            plaintext — passwords are encrypted before they touch the cloud.
          </div>
        </CardContent>
      </Card>

      {source.shortcut && (
        <Button
          variant="outline"
          className="w-full justify-between rounded-xl"
          onClick={() => {
            // Internal pages like chrome:// can't be opened from a regular page,
            // so we copy the URL to the clipboard as a fallback and surface the
            // user-friendly label.
            try {
              window.open(source.shortcut!.url, '_blank', 'noopener,noreferrer');
            } catch {
              navigator.clipboard?.writeText(source.shortcut!.url).catch(() => {});
            }
          }}
        >
          <span className="flex items-center gap-2">
            <ExternalLink className="w-4 h-4" />
            {source.shortcut.label}
          </span>
          <Badge variant="secondary" className="text-[10px]">Step 1</Badge>
        </Button>
      )}

      <ol className="space-y-3">
        {source.steps.map((step, idx) => (
          <li key={idx} className="flex gap-3 items-start">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center mt-0.5">
              {idx + 1}
            </div>
            <p className="text-sm text-foreground leading-relaxed">{step}</p>
          </li>
        ))}
      </ol>

      <div className="flex justify-end pt-2">
        <Button onClick={onContinue} className="rounded-xl gap-2" data-testid="guided-import-continue">
          I have my CSV ready
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function UploadStage({
  source,
  onBack,
  onDone,
}: {
  source: GuidedSource;
  onBack: () => void;
  onDone: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 -ml-2">
          <ArrowLeft className="w-4 h-4" /> Back to instructions
        </Button>
        <Badge variant="secondary" className="text-[10px]">
          Source: {source.name}
        </Badge>
      </div>
      <ImportPasswords />
      <div className="flex justify-end pt-2">
        <Button variant="ghost" onClick={onDone} className="rounded-xl">Close</Button>
      </div>
    </div>
  );
}
