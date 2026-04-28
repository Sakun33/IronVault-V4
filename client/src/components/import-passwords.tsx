import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Download,
  Info,
  XCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useVault } from '@/contexts/vault-context';
import { useSubscription } from '@/hooks/use-subscription';
import {
  parseCsvText,
  decodeBuffer,
  SOURCE_LIST,
  type ImportResult,
  type ImportSourceId,
  type LogicalField,
  type ParsedPassword,
} from '@/lib/password-import';

const FIELD_LABELS: Record<LogicalField, string> = {
  title: 'Title',
  url: 'URL',
  username: 'Username',
  password: 'Password',
  notes: 'Notes',
  totp: 'TOTP / 2FA',
  category: 'Category',
};

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

export default function ImportPasswords() {
  const { toast } = useToast();
  const { bulkImportPasswords, passwords } = useVault();
  const { getLimit, isPro } = useSubscription();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [rawText, setRawText] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);

  const [overrideMapping, setOverrideMapping] = useState<Partial<Record<LogicalField, number>>>({});
  const [sourceOverride, setSourceOverride] = useState<ImportSourceId | 'auto'>('auto');

  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [importSummary, setImportSummary] = useState<{ imported: number; duplicates: number; skipped: number } | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setParseError(null);
      setResult(null);
      setImportSummary(null);
      setOverrideMapping({});
      setProgress({ done: 0, total: 0 });

      if (file.size > MAX_FILE_BYTES) {
        setParseError(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum supported size is 50 MB.`);
        return;
      }

      setFileName(file.name);
      setParsing(true);

      try {
        const buf = await file.arrayBuffer();
        // Decode once so re-parsing with a different source override is
        // guaranteed to produce identical input to the initial parse.
        const text = decodeBuffer(buf);
        const parsed = parseCsvText(text);
        setRawText(text);
        setResult(parsed);
        if (parsed.entries.length === 0 && parsed.totalRows > 0) {
          setParseError(`Parsed ${parsed.totalRows} rows, but none had usable username/password. Try selecting a different source format below.`);
        }
      } catch (e) {
        setParseError(`Could not read file: ${(e as Error)?.message ?? 'unknown error'}`);
      } finally {
        setParsing(false);
      }
    },
    [],
  );

  const onFilePicked = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        void handleFile(file);
      }
      // Reset so picking the same file twice still triggers onChange
      e.target.value = '';
    },
    [handleFile],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  // Re-parse with manual source override
  const reparseWithSource = useCallback(
    (sourceId: ImportSourceId | 'auto') => {
      setSourceOverride(sourceId);
      if (!rawText) return;
      try {
        const parsed = parseCsvText(rawText, sourceId === 'auto' ? undefined : { sourceOverride: sourceId });
        setResult(parsed);
        setOverrideMapping({});
        setParseError(parsed.entries.length === 0 && parsed.totalRows > 0
          ? 'Still no usable rows. Try a different source or remap columns manually below.'
          : null);
      } catch (e) {
        setParseError(`Re-parse failed: ${(e as Error)?.message ?? 'unknown error'}`);
      }
    },
    [rawText],
  );

  // Effective mapping = result.mapping with manual overrides layered on top
  const effectiveMapping = useMemo<Record<LogicalField, number>>(() => {
    if (!result) {
      return { title: -1, url: -1, username: -1, password: -1, notes: -1, totp: -1, category: -1 };
    }
    return {
      ...result.mapping,
      ...overrideMapping,
    };
  }, [result, overrideMapping]);

  // When user changes a column override, recompute preview rows
  const previewEntries = useMemo<ParsedPassword[]>(() => {
    if (!result || !rawText) return [];
    // If overrides are empty, just use the existing parsed entries
    if (Object.keys(overrideMapping).length === 0) {
      return result.entries.slice(0, 5);
    }
    // Otherwise, manually re-map the first ~10 raw rows for preview
    return rebuildPreview(rawText, result, effectiveMapping).slice(0, 5);
  }, [result, rawText, overrideMapping, effectiveMapping]);

  const setMappingFor = useCallback((field: LogicalField, value: string) => {
    const idx = value === 'unset' ? -1 : parseInt(value, 10);
    setOverrideMapping(prev => ({ ...prev, [field]: idx }));
  }, []);

  const reset = useCallback(() => {
    setFileName(null);
    setRawText(null);
    setResult(null);
    setParseError(null);
    setOverrideMapping({});
    setSourceOverride('auto');
    setImportSummary(null);
    setProgress({ done: 0, total: 0 });
  }, []);

  const importNow = useCallback(async () => {
    if (!result || !rawText) return;
    setImporting(true);
    setImportSummary(null);

    try {
      // Build the final entries using the effective mapping
      const finalEntries = (Object.keys(overrideMapping).length === 0
        ? result.entries
        : rebuildPreview(rawText, result, effectiveMapping));

      // Map our ParsedPassword → vault PasswordEntry shape
      let items = finalEntries
        .map(e => ({
          name: (e.title || '').slice(0, 256),
          url: e.url || '',
          username: (e.username || '').slice(0, 256),
          password: e.password || '',
          notes: [e.notes, e.totp ? `TOTP: ${e.totp}` : '']
            .filter(Boolean)
            .join('\n')
            .slice(0, 8000),
          category: e.category || 'Imported',
        }))
        // Skip rows with empty password — vault schema rejects them
        .filter(e => e.password && e.password.length > 0 && e.username.length > 0 && e.name.length > 0);

      // Free plan: enforce password cap. The vault already has `passwords.length`
      // entries; only `headroom` more will fit. Truncate the import and warn
      // the user explicitly so they can choose to upgrade and import the rest.
      if (!isPro) {
        const limit = getLimit('passwords');
        const headroom = Math.max(0, limit - passwords.length);
        if (items.length > headroom) {
          const dropped = items.length - headroom;
          if (headroom === 0) {
            toast({
              title: 'Free plan limit reached',
              description: `You've already saved ${passwords.length} of ${limit} passwords on the Free plan. Upgrade to import more.`,
              variant: 'destructive',
              duration: 10000,
            });
            setImporting(false);
            setImportSummary({ imported: 0, duplicates: 0, skipped: items.length });
            return;
          }
          items = items.slice(0, headroom);
          toast({
            title: `Free plan limit (${limit} passwords)`,
            description: `Importing first ${headroom} entries — ${dropped} skipped. Upgrade to Pro for unlimited imports.`,
            variant: 'destructive',
            duration: 10000,
          });
        }
      }

      setProgress({ done: 0, total: items.length });

      const summary = await bulkImportPasswords(items, (done, total) => {
        setProgress({ done, total });
      });

      setImportSummary({ imported: summary.imported, duplicates: summary.duplicates, skipped: summary.skipped });

      if (summary.imported > 0) {
        // Cloud-sync status is the load-bearing signal: a "success" toast
        // when the cloud push didn't actually land would lull the user into
        // signing out, which then wipes the imports on next cloud unlock.
        if (summary.cloudSync === 'success') {
          toast({
            title: 'Import complete & synced',
            description: `${summary.imported} password${summary.imported === 1 ? '' : 's'} saved and synced to cloud.`,
          });
        } else if (summary.cloudSync === 'skipped') {
          toast({
            title: 'Import complete',
            description: `${summary.imported} password${summary.imported === 1 ? '' : 's'} saved to your local vault.`,
          });
        } else {
          // cloudSync === 'failed' — DO NOT log the user into a false sense of
          // safety. Show a destructive toast that says exactly what to do.
          toast({
            title: '⚠️ Saved locally, NOT synced to cloud',
            description:
              `${summary.imported} imported on this device. Cloud sync failed${summary.cloudError ? ` (${summary.cloudError})` : ''}. Stay signed in and try again — signing out before sync completes will lose them.`,
            variant: 'destructive',
            duration: 12000,
          });
        }
      } else {
        toast({
          title: 'Nothing to import',
          description: summary.duplicates > 0
            ? `All ${summary.duplicates} entries already exist in your vault.`
            : 'No passwords were imported. Check your column mapping.',
          variant: 'destructive',
        });
      }
    } catch (e) {
      toast({
        title: 'Import failed',
        description: (e as Error)?.message ?? 'Unexpected error',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  }, [result, rawText, overrideMapping, effectiveMapping, bulkImportPasswords, toast, isPro, getLimit, passwords.length]);

  /* ----------------------------- render ----------------------------- */

  const detectedSourceName = result?.sourceName ?? 'Unknown';
  const totalEntries = result?.entries.length ?? 0;
  const skippedCount = result?.skipped.length ?? 0;
  const headers = result?.headers ?? [];

  const skippedReasonCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of result?.skipped ?? []) {
      m.set(s.reason, (m.get(s.reason) ?? 0) + 1);
    }
    return m;
  }, [result]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Import Passwords</h1>
        <p className="text-muted-foreground">
          Bring your passwords in from any major password manager or browser. Files are parsed
          locally — nothing leaves your device unprotected.
        </p>
      </div>

      {/* File picker */}
      <Card className="rounded-2xl shadow-sm border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Choose CSV file
          </CardTitle>
          <CardDescription>
            Supports Apple Passwords, Chrome, Firefox, Safari, Edge, Brave, Opera, 1Password,
            LastPass, Bitwarden, Dashlane, KeePass, Enpass, RoboForm, NordPass, and generic CSV/TSV.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
            data-testid="import-passwords-dropzone"
          >
            <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-foreground font-medium">
              {fileName ? fileName : 'Click to choose, or drop a CSV file here'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Up to 50 MB · UTF-8, UTF-16, Latin-1 all supported
            </p>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt,text/csv,text/plain,application/csv"
              className="hidden"
              onChange={onFilePicked}
              data-testid="import-passwords-input"
            />
          </div>

          {parsing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Parsing file…
            </div>
          )}

          {parseError && (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertTitle>Couldn't parse this file</AlertTitle>
              <AlertDescription>{parseError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Detected + mapping */}
      {result && (
        <Card className="rounded-2xl shadow-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Detected: {detectedSourceName}
            </CardTitle>
            <CardDescription>
              {totalEntries} entries ready to import out of {result.totalRows} rows
              {skippedCount > 0 ? ` (${skippedCount} skipped)` : ''}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Source override */}
            <div className="grid gap-2 md:grid-cols-[200px_1fr] items-center">
              <Label>Source format</Label>
              <Select value={sourceOverride} onValueChange={(v) => reparseWithSource(v as ImportSourceId | 'auto')}>
                <SelectTrigger data-testid="import-passwords-source-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-detect ({detectedSourceName})</SelectItem>
                  {SOURCE_LIST.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Manual column mapping */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Column mapping</Label>
              <p className="text-xs text-muted-foreground mb-3">
                Auto-detected from headers. Override if a column landed in the wrong field.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {(['title', 'url', 'username', 'password', 'notes', 'totp', 'category'] as LogicalField[]).map(field => {
                  const idx = effectiveMapping[field];
                  return (
                    <div key={field} className="grid grid-cols-[110px_1fr] items-center gap-2">
                      <Label className="text-sm">
                        {FIELD_LABELS[field]}
                        {(field === 'username' || field === 'password' || field === 'title') && (
                          <span className="text-destructive ml-0.5">*</span>
                        )}
                      </Label>
                      <Select
                        value={idx >= 0 ? String(idx) : 'unset'}
                        onValueChange={(v) => setMappingFor(field, v)}
                      >
                        <SelectTrigger data-testid={`import-mapping-${field}`}>
                          <SelectValue placeholder="Not mapped" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unset">Not mapped</SelectItem>
                          {headers.map((h, i) => (
                            <SelectItem key={`${h}-${i}`} value={String(i)}>
                              {h || `(column ${i + 1})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Preview table */}
            {previewEntries.length > 0 && (
              <div>
                <Label className="text-sm font-medium mb-2 block">Preview (first 5 entries)</Label>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>URL</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Password</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewEntries.map((e, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="max-w-[160px] truncate">{e.title}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-muted-foreground">{e.url}</TableCell>
                          <TableCell className="max-w-[180px] truncate">{e.username}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {e.password ? '•'.repeat(Math.min(e.password.length, 12)) : <span className="text-destructive">missing</span>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Skipped breakdown */}
            {skippedCount > 0 && (
              <Alert>
                <Info className="w-4 h-4" />
                <AlertTitle>{skippedCount} rows will be skipped</AlertTitle>
                <AlertDescription>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {Array.from(skippedReasonCounts.entries()).map(([reason, n]) => (
                      <Badge key={reason} variant="secondary">
                        {n}× {humanizeReason(reason)}
                      </Badge>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <Alert>
                <AlertTriangle className="w-4 h-4" />
                <AlertTitle>Heads up</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4 mt-1 space-y-0.5 text-sm">
                    {result.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                onClick={importNow}
                disabled={importing || totalEntries === 0}
                className="gap-2"
                data-testid="import-passwords-confirm"
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {importing
                  ? `Importing… ${progress.done}/${progress.total}`
                  : `Import ${totalEntries} ${totalEntries === 1 ? 'password' : 'passwords'}`}
              </Button>
              <Button variant="outline" onClick={reset} disabled={importing} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Choose another file
              </Button>
            </div>

            {importing && progress.total > 0 && (
              <Progress value={(progress.done / Math.max(progress.total, 1)) * 100} />
            )}
          </CardContent>
        </Card>
      )}

      {/* Final summary */}
      {importSummary && (
        <Alert variant={importSummary.imported > 0 ? 'default' : 'destructive'}>
          {importSummary.imported > 0 ? (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          ) : (
            <XCircle className="w-4 h-4" />
          )}
          <AlertTitle>
            {importSummary.imported > 0 ? 'Import complete' : 'No passwords imported'}
          </AlertTitle>
          <AlertDescription>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="default">{importSummary.imported} imported</Badge>
              {importSummary.duplicates > 0 && (
                <Badge variant="secondary">{importSummary.duplicates} duplicates</Badge>
              )}
              {importSummary.skipped > 0 && (
                <Badge variant="outline">{importSummary.skipped} errors</Badge>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function humanizeReason(reason: string): string {
  switch (reason) {
    case 'missing_credentials': return 'missing credentials';
    case 'duplicate': return 'duplicate in file';
    case 'parse_error': return 'parse error';
    case 'empty': return 'empty row';
    default: return reason;
  }
}

/**
 * Re-apply a custom field mapping to all data rows of a CSV. Used for the live
 * preview when the user manually overrides column assignments.
 */
function rebuildPreview(
  rawText: string,
  result: ImportResult,
  mapping: Record<LogicalField, number>,
): ParsedPassword[] {
  const lines = simpleTokenize(rawText, result.delimiter);
  if (lines.length < 2) return [];
  const dataRows = lines.slice(1);
  const out: ParsedPassword[] = [];
  for (const row of dataRows) {
    const at = (idx: number) => (idx >= 0 && idx < row.length ? (row[idx] ?? '').trim() : '');
    const url = normUrl(at(mapping.url));
    let title = at(mapping.title);
    if (!title) {
      title = titleFromUrlLite(url) || at(mapping.username) || 'Imported Password';
    }
    out.push({
      title,
      url,
      username: at(mapping.username),
      password: at(mapping.password),
      notes: at(mapping.notes),
      totp: at(mapping.totp),
      category: at(mapping.category) || 'Imported',
    });
  }
  return out;
}

// Local copies of tokenizer/url/title — keeps rebuildPreview synchronous and
// avoids a dynamic import from a render pass.
function simpleTokenize(content: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  const text = content.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; continue; }
        inQuotes = false; continue;
      }
      field += ch; continue;
    }
    if (ch === '"' && field.length === 0) { inQuotes = true; continue; }
    if (ch === delimiter) { row.push(field); field = ''; continue; }
    if (ch === '\r' || ch === '\n') {
      row.push(field); rows.push(row); field = ''; row = [];
      if (ch === '\r' && text[i + 1] === '\n') i++;
      continue;
    }
    field += ch;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  while (rows.length > 0 && rows[rows.length - 1].every(c => !c || !c.trim())) rows.pop();
  return rows;
}

function normUrl(raw: string): string {
  const v = (raw || '').trim();
  if (!v) return '';
  const stripped = v.replace(/^<+|>+$/g, '').trim();
  if (!stripped) return '';
  if (/^[a-z][a-z0-9+.\-]*:\/\//i.test(stripped)) return stripped;
  if (/^[^\s/]+\.[^\s/]+/.test(stripped)) return `https://${stripped}`;
  return stripped;
}

function titleFromUrlLite(rawUrl: string): string {
  if (!rawUrl) return '';
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.replace(/^www\./, '');
    const parts = host.split('.');
    if (parts.length >= 2) {
      const main = parts[parts.length - 2];
      return main.charAt(0).toUpperCase() + main.slice(1);
    }
    return host;
  } catch { return ''; }
}
