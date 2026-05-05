import { useState, useMemo } from 'react';
import { useSubscription } from '@/hooks/use-subscription';
import { UpgradeGate } from '@/components/upgrade-gate';
import { useVault } from '@/contexts/vault-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { POPULAR_API_SERVICES } from '@/lib/popular-services';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, Edit, Trash2, Key, Eye, EyeOff, Copy, Check,
  Shield, Lock, AlertCircle, Search, Code, LayoutGrid, List as ListIcon,
  CalendarClock, ExternalLink, Tag as TagIcon, ArrowUpDown, X,
} from 'lucide-react';
import { format } from 'date-fns';
import { VerifyAccessModal } from '@/components/verify-access-modal';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ListSkeleton } from '@/components/list-skeleton';
import { ViewToggle } from '@/components/view-toggle';

interface APIKey {
  id: string;
  name: string;
  service: string;
  apiKey: string;
  apiSecret?: string;
  environment: 'development' | 'staging' | 'production';
  category?: string;
  endpoint?: string;
  accessToken?: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  projectId?: string;
  expiresAt?: Date;
  notes?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  lastUsed?: Date;
}

const CATEGORIES = ['Payment', 'Cloud', 'Social', 'Development', 'Other'] as const;
type Category = typeof CATEGORIES[number];

const ENV_LABEL: Record<APIKey['environment'], string> = {
  production: 'Live',
  staging: 'Test',
  development: 'Dev',
};

const ENV_PILL: Record<APIKey['environment'], string> = {
  production: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  staging: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  development: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
};

const CATEGORY_PILL: Record<string, string> = {
  Payment: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
  Cloud: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  Social: 'bg-pink-500/10 text-pink-300 border-pink-500/30',
  Development: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  Other: 'bg-muted text-muted-foreground border-border/60',
};

function maskKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '••••••••';
  return '•••• •••• •••• ' + key.slice(-4);
}

function isExpiringSoon(d?: Date): boolean {
  if (!d) return false;
  const ms = new Date(d).getTime() - Date.now();
  return ms > 0 && ms < 14 * 24 * 60 * 60 * 1000;
}

function isExpired(d?: Date): boolean {
  if (!d) return false;
  return new Date(d).getTime() < Date.now();
}

const blankForm = () => ({
  name: '',
  service: '',
  apiKey: '',
  apiSecret: '',
  environment: 'production' as APIKey['environment'],
  category: 'Other' as Category,
  endpoint: '',
  expiresAt: '',
  notes: '',
  tagInput: '',
  tags: [] as string[],
});

export default function APIKeys() {
  const { isFeatureAvailable, isLoading: licenseLoading } = useSubscription();
  const { apiKeys, addApiKey, updateApiKey, deleteApiKey, bulkDeleteApiKeys, isLoading } = useVault();
  const { toast } = useToast();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingKey, setEditingKey] = useState<APIKey | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [pendingRevealId, setPendingRevealId] = useState<string | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | Category>('all');
  const [envFilter, setEnvFilter] = useState<'all' | APIKey['environment']>('all');
  const [sortBy, setSortBy] = useState<'name' | 'updated' | 'expires'>('updated');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [submitted, setSubmitted] = useState(false);

  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [deleteTargetKey, setDeleteTargetKey] = useState<{ id: string; name: string } | null>(null);

  const [formData, setFormData] = useState(blankForm());

  const resetForm = () => {
    setFormData(blankForm());
    setSubmitted(false);
  };

  const handleAddKey = async () => {
    setSubmitted(true);
    if (!formData.name.trim() || !formData.service.trim() || !formData.apiKey.trim()) {
      toast({ title: 'Missing required fields', description: 'Service, name, and key value are required.', variant: 'destructive' });
      return;
    }

    const newKey: APIKey = {
      id: crypto.randomUUID(),
      name: formData.name.trim(),
      service: formData.service.trim(),
      apiKey: formData.apiKey,
      apiSecret: formData.apiSecret || undefined,
      environment: formData.environment,
      category: formData.category,
      endpoint: formData.endpoint || undefined,
      expiresAt: formData.expiresAt ? new Date(formData.expiresAt) : undefined,
      notes: formData.notes || undefined,
      tags: formData.tags,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await addApiKey(newKey);
    resetForm();
    setShowAddModal(false);
    toast({ title: 'Saved', description: 'API key added.' });
  };

  const handleUpdateKey = async () => {
    if (!editingKey) return;
    setSubmitted(true);
    if (!formData.name.trim() || !formData.service.trim() || !formData.apiKey.trim()) {
      toast({ title: 'Missing required fields', description: 'Service, name, and key value are required.', variant: 'destructive' });
      return;
    }
    await updateApiKey(editingKey.id, {
      name: formData.name.trim(),
      service: formData.service.trim(),
      apiKey: formData.apiKey,
      apiSecret: formData.apiSecret || undefined,
      environment: formData.environment,
      category: formData.category,
      endpoint: formData.endpoint || undefined,
      expiresAt: formData.expiresAt ? new Date(formData.expiresAt) : undefined,
      notes: formData.notes || undefined,
      tags: formData.tags,
    });
    setEditingKey(null);
    resetForm();
    setShowAddModal(false);
    toast({ title: 'Updated', description: 'API key updated.' });
  };

  const confirmDeleteKey = async () => {
    if (!deleteTargetKey) return;
    const { id, name } = deleteTargetKey;
    setDeleteTargetKey(null);
    await deleteApiKey(id);
    toast({ title: 'Deleted', description: `"${name}" removed.` });
  };

  const openEdit = (key: APIKey) => {
    setEditingKey(key);
    setFormData({
      name: key.name,
      service: key.service,
      apiKey: key.apiKey,
      apiSecret: key.apiSecret || '',
      environment: key.environment,
      category: (CATEGORIES as readonly string[]).includes(key.category || '') ? (key.category as Category) : 'Other',
      endpoint: key.endpoint || '',
      expiresAt: key.expiresAt ? new Date(key.expiresAt).toISOString().split('T')[0] : '',
      notes: key.notes || '',
      tagInput: '',
      tags: [...(key.tags || [])],
    });
    setSubmitted(false);
    setShowAddModal(true);
  };

  const toggleReveal = (id: string) => {
    if (revealedKeys.has(id)) {
      const next = new Set(revealedKeys);
      next.delete(id);
      setRevealedKeys(next);
      return;
    }
    if (!isUnlocked) {
      setPendingRevealId(id);
      setShowVerifyModal(true);
      return;
    }
    setRevealedKeys(prev => new Set(prev).add(id));
  };

  const handleVerified = () => {
    setIsUnlocked(true);
    if (pendingRevealId) {
      setRevealedKeys(prev => new Set(prev).add(pendingRevealId));
      setPendingRevealId(null);
    }
    setTimeout(() => {
      setIsUnlocked(false);
      setRevealedKeys(new Set());
    }, 5 * 60 * 1000);
  };

  const copyToClipboard = async (text: string, label: string) => {
    if (!isUnlocked) {
      setShowVerifyModal(true);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(label);
      toast({ title: 'Copied', description: `${label} copied.` });
      setTimeout(() => setCopiedField(null), 1500);
    } catch {
      toast({ title: 'Error', description: 'Could not copy.', variant: 'destructive' });
    }
  };

  const addTag = () => {
    const t = formData.tagInput.trim().toLowerCase().replace(/^#/, '');
    if (!t || formData.tags.includes(t)) {
      setFormData(prev => ({ ...prev, tagInput: '' }));
      return;
    }
    setFormData(prev => ({ ...prev, tags: [...prev.tags, t], tagInput: '' }));
  };

  const removeTag = (t: string) => setFormData(prev => ({ ...prev, tags: prev.tags.filter(x => x !== t) }));

  const filteredKeys = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = apiKeys.filter((k: APIKey) => {
      if (envFilter !== 'all' && k.environment !== envFilter) return false;
      if (categoryFilter !== 'all' && (k.category || 'Other') !== categoryFilter) return false;
      if (!q) return true;
      return (
        k.name.toLowerCase().includes(q) ||
        k.service.toLowerCase().includes(q) ||
        (k.tags || []).some(t => t.toLowerCase().includes(q))
      );
    });
    if (sortBy === 'name') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'expires') {
      list = [...list].sort((a, b) => {
        const ea = a.expiresAt ? new Date(a.expiresAt).getTime() : Infinity;
        const eb = b.expiresAt ? new Date(b.expiresAt).getTime() : Infinity;
        return ea - eb;
      });
    } else {
      list = [...list].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    return list;
  }, [apiKeys, searchQuery, categoryFilter, envFilter, sortBy]);

  // ── Locked screen ──────────────────────────────────────────────────────────
  if (!isUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="w-5 h-5" /> API Keys Vault
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center space-y-2">
              <Lock className="w-10 h-10 mx-auto text-muted-foreground" />
              <h3 className="font-semibold text-foreground">Vault Locked</h3>
              <p className="text-sm text-muted-foreground">Verify your identity to access API keys</p>
            </div>
            <Button onClick={() => setShowVerifyModal(true)} className="w-full">
              <Lock className="w-4 h-4 mr-2" /> Unlock Vault
            </Button>
            <div className="flex items-start gap-2 p-3 bg-primary/10 rounded-lg border border-primary/30">
              <AlertCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                API keys are encrypted and require your master password or biometrics. The vault auto-locks after 5 minutes.
              </p>
            </div>
          </CardContent>
        </Card>
        <VerifyAccessModal
          open={showVerifyModal}
          onOpenChange={setShowVerifyModal}
          onVerified={handleVerified}
          title="Unlock API Keys"
          description="Enter your master password or use biometrics to access your API keys."
        />
      </div>
    );
  }

  if (!licenseLoading && !isFeatureAvailable('apiKeys')) return <UpgradeGate feature="API Key Manager" />;

  const counts = {
    all: apiKeys.length,
    Payment: apiKeys.filter(k => (k.category || 'Other') === 'Payment').length,
    Cloud: apiKeys.filter(k => (k.category || 'Other') === 'Cloud').length,
    Social: apiKeys.filter(k => (k.category || 'Other') === 'Social').length,
    Development: apiKeys.filter(k => (k.category || 'Other') === 'Development').length,
    Other: apiKeys.filter(k => (k.category || 'Other') === 'Other').length,
  };

  return (
    <div className="space-y-5 p-4 overflow-x-hidden">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Key className="w-6 h-6" /> API Keys
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              {counts.all}
            </span>
          </div>
          <p className="text-muted-foreground text-sm">Encrypted credentials, ready when you are</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setIsUnlocked(false);
              setRevealedKeys(new Set());
              toast({ title: 'Locked', description: 'API Keys vault locked' });
            }}
            className="h-9 w-9"
            title="Lock Vault"
            aria-label="Lock vault"
          >
            <Lock className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => { setEditingKey(null); resetForm(); setShowAddModal(true); }}
            className="h-9 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
            data-testid="button-add-api-key"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Add Key
          </Button>
        </div>
      </div>

      {/* ── Search + filters + view toggle ───────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, service, or tag…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 rounded-xl"
              data-testid="input-search-api-keys"
            />
          </div>
          <ViewToggle view={viewMode} onChange={setViewMode} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category chips */}
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              categoryFilter === 'all'
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                : 'border-border/60 bg-muted/30 hover:bg-muted/50 text-muted-foreground'
            }`}
          >
            All <span className="ml-1 opacity-60">{counts.all}</span>
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                categoryFilter === cat
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                  : 'border-border/60 bg-muted/30 hover:bg-muted/50 text-muted-foreground'
              }`}
            >
              {cat} <span className="ml-1 opacity-60">{counts[cat]}</span>
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            <select
              value={envFilter}
              onChange={(e) => setEnvFilter(e.target.value as any)}
              className="h-8 px-2 text-xs rounded-lg border border-border/60 bg-muted/30 text-foreground"
              aria-label="Environment filter"
            >
              <option value="all">All envs</option>
              <option value="production">Live</option>
              <option value="staging">Test</option>
              <option value="development">Dev</option>
            </select>
            <button
              type="button"
              onClick={() =>
                setSortBy(prev => (prev === 'updated' ? 'name' : prev === 'name' ? 'expires' : 'updated'))
              }
              className="h-8 px-2 text-xs rounded-lg border border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              title="Cycle sort"
              data-testid="button-sort-api-keys"
            >
              <ArrowUpDown className="w-3 h-3" />
              {sortBy === 'updated' ? 'Updated' : sortBy === 'name' ? 'Name' : 'Expires'}
            </button>
            {filteredKeys.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBulkDeleteConfirm(true)}
                className="h-8 text-xs"
                data-testid="button-bulk-delete-apikeys"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete {filteredKeys.length}
              </Button>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {filteredKeys.length} API key{filteredKeys.length !== 1 ? 's' : ''}?</DialogTitle>
            <DialogDescription>
              This will permanently delete the {filteredKeys.length} key{filteredKeys.length !== 1 ? 's' : ''} currently shown. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDeleteConfirm(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                const ids = filteredKeys.map(k => k.id);
                const removed = await bulkDeleteApiKeys(ids);
                setShowBulkDeleteConfirm(false);
                toast({ title: 'Deleted', description: `${removed} key${removed === 1 ? '' : 's'} removed.` });
              }}
            >
              Delete {filteredKeys.length}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Empty / loading / cards ─────────────────────────────────────── */}
      {isLoading && apiKeys.length === 0 ? (
        <ListSkeleton rows={5} showHeader={false} />
      ) : filteredKeys.length === 0 ? (
        <Card className="rounded-2xl shadow-sm border-0 bg-card">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Code className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No API Keys</h3>
            <p className="text-muted-foreground mb-4">
              {apiKeys.length === 0 ? 'Get started by adding your first API key' : 'No keys match your filters'}
            </p>
            {apiKeys.length === 0 && (
              <Button
                onClick={() => { setEditingKey(null); resetForm(); setShowAddModal(true); }}
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                <Plus className="w-4 h-4 mr-2" /> Add Your First API Key
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children'
              : 'flex flex-col gap-2'
          }
        >
          {filteredKeys.map((key: APIKey) => {
            const expiringSoon = isExpiringSoon(key.expiresAt);
            const expired = isExpired(key.expiresAt);
            const cat = key.category || 'Other';
            return (
              <Card
                key={key.id}
                className={`group rounded-2xl border transition-colors ${
                  expired
                    ? 'border-rose-500/30 bg-rose-500/[0.03]'
                    : 'border-border/40 hover:border-emerald-500/40 bg-card'
                }`}
                data-testid={`api-key-card-${key.id}`}
              >
                <CardContent className={viewMode === 'grid' ? 'p-4 space-y-3' : 'p-3 flex items-center gap-3'}>
                  {/* Header row */}
                  <div className={viewMode === 'grid' ? 'flex items-start justify-between gap-2' : 'flex items-center gap-2 flex-1 min-w-0'}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-foreground truncate text-[15px]" data-testid={`api-key-name-${key.id}`}>
                          {key.name}
                        </span>
                        <span className={`px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border ${ENV_PILL[key.environment]}`}>
                          {ENV_LABEL[key.environment]}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        <span className="truncate">{key.service}</span>
                        <span className={`px-1.5 py-px rounded border ${CATEGORY_PILL[cat] || CATEGORY_PILL.Other}`}>
                          {cat}
                        </span>
                      </div>
                    </div>
                    {viewMode === 'list' && (
                      <span className="text-xs text-muted-foreground/80 hidden sm:inline tabular-nums">
                        {format(new Date(key.updatedAt), 'MMM d')}
                      </span>
                    )}
                  </div>

                  {/* Masked key value */}
                  {viewMode === 'grid' && (
                    <div className="flex items-center gap-1.5 p-2 rounded-lg bg-muted/40 border border-border/30">
                      <code className="flex-1 text-xs font-mono truncate text-foreground" data-testid={`api-key-value-${key.id}`}>
                        {revealedKeys.has(key.id) ? key.apiKey : maskKey(key.apiKey)}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => toggleReveal(key.id)}
                        title={revealedKeys.has(key.id) ? 'Hide' : 'Reveal'}
                        aria-label={revealedKeys.has(key.id) ? `Hide ${key.name}` : `Reveal ${key.name}`}
                      >
                        {revealedKeys.has(key.id) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => copyToClipboard(key.apiKey, `key-${key.id}`)}
                        title="Copy"
                        aria-label={`Copy ${key.name}`}
                      >
                        {copiedField === `key-${key.id}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </div>
                  )}

                  {viewMode === 'grid' && key.apiSecret && (
                    <div className="flex items-center gap-1.5 p-2 rounded-lg bg-muted/40 border border-border/30">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mr-1">Secret</span>
                      <code className="flex-1 text-xs font-mono truncate text-foreground">
                        {revealedKeys.has(key.id) ? key.apiSecret : maskKey(key.apiSecret)}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => copyToClipboard(key.apiSecret!, `secret-${key.id}`)}
                        title="Copy secret"
                      >
                        {copiedField === `secret-${key.id}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </div>
                  )}

                  {/* Tags */}
                  {viewMode === 'grid' && key.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {key.tags.slice(0, 5).map(t => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/40 border border-border/30 text-muted-foreground">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Metadata + actions */}
                  <div className={viewMode === 'grid' ? 'flex items-center justify-between pt-2 border-t border-border/40' : 'flex items-center gap-1 ml-auto'}>
                    {viewMode === 'grid' && (
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground/80 flex-wrap">
                        <span className="tabular-nums">Created {format(new Date(key.createdAt), 'MMM d, yyyy')}</span>
                        {key.expiresAt && (
                          <span
                            className={`inline-flex items-center gap-1 ${
                              expired ? 'text-rose-400' : expiringSoon ? 'text-amber-400' : ''
                            }`}
                          >
                            <CalendarClock className="w-3 h-3" />
                            {expired ? 'Expired' : 'Expires'} {format(new Date(key.expiresAt), 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      {viewMode === 'list' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => toggleReveal(key.id)}
                          aria-label="Reveal"
                        >
                          {revealedKeys.has(key.id) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </Button>
                      )}
                      {viewMode === 'list' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => copyToClipboard(key.apiKey, `key-${key.id}`)}
                          aria-label="Copy"
                        >
                          {copiedField === `key-${key.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </Button>
                      )}
                      {key.endpoint && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => window.open(key.endpoint!, '_blank', 'noopener')}
                          title="Open endpoint"
                          aria-label="Open endpoint"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => openEdit(key)}
                        title="Edit"
                        aria-label={`Edit ${key.name}`}
                        data-testid={`button-edit-api-key-${key.id}`}
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-rose-400 hover:text-rose-300"
                        onClick={() => setDeleteTargetKey({ id: key.id, name: key.name })}
                        title="Delete"
                        aria-label={`Delete ${key.name}`}
                        data-testid={`button-delete-api-key-${key.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Add / Edit modal ─────────────────────────────────────────────── */}
      <Dialog
        open={showAddModal}
        onOpenChange={(o) => {
          setShowAddModal(o);
          if (!o) {
            setEditingKey(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingKey ? 'Edit API Key' : 'Add API Key'}</DialogTitle>
          </DialogHeader>
          <DialogBody
            className="space-y-4"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                (editingKey ? handleUpdateKey : handleAddKey)();
              }
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="service">Service *</Label>
              <Input
                id="service"
                placeholder="e.g., Stripe, AWS, OpenAI"
                value={formData.service}
                onChange={(e) =>
                  setFormData(prev => ({
                    ...prev,
                    service: e.target.value,
                    name: prev.name || (e.target.value ? `${e.target.value} Key` : ''),
                  }))
                }
                aria-invalid={submitted && !formData.service.trim()}
                className={submitted && !formData.service.trim() ? 'border-red-400/60 focus-visible:ring-red-400/40' : ''}
                data-testid="input-api-service"
              />
              {submitted && !formData.service.trim() && (
                <p className="text-sm text-red-400">Service is required</p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {POPULAR_API_SERVICES.slice(0, 10).map((svc: string) => (
                  <button
                    key={svc}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, service: svc, name: prev.name || `${svc} Key` }))}
                    className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                      formData.service === svc
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                        : 'border-border/60 bg-muted/40 hover:bg-muted text-foreground'
                    }`}
                  >
                    {svc}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Stripe Production Key"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                aria-invalid={submitted && !formData.name.trim()}
                className={submitted && !formData.name.trim() ? 'border-red-400/60 focus-visible:ring-red-400/40' : ''}
                data-testid="input-api-name"
              />
              {submitted && !formData.name.trim() && (
                <p className="text-sm text-red-400">Name is required</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="apiKey">Key Value *</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="sk_live_…"
                value={formData.apiKey}
                onChange={(e) => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
                aria-invalid={submitted && !formData.apiKey.trim()}
                className={submitted && !formData.apiKey.trim() ? 'border-red-400/60 focus-visible:ring-red-400/40' : ''}
                data-testid="input-api-value"
              />
              {submitted && !formData.apiKey.trim() && (
                <p className="text-sm text-red-400">Key value is required</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="apiSecret">Secret (optional)</Label>
              <Input
                id="apiSecret"
                type="password"
                placeholder="Used by services that require a paired secret"
                value={formData.apiSecret}
                onChange={(e) => setFormData(prev => ({ ...prev, apiSecret: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as Category }))}
                  className="w-full h-10 px-3 rounded-md bg-background border border-input text-foreground text-sm"
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="environment">Environment</Label>
                <select
                  id="environment"
                  value={formData.environment}
                  onChange={(e) => setFormData(prev => ({ ...prev, environment: e.target.value as APIKey['environment'] }))}
                  className="w-full h-10 px-3 rounded-md bg-background border border-input text-foreground text-sm"
                >
                  <option value="production">Live (production)</option>
                  <option value="staging">Test (staging)</option>
                  <option value="development">Dev (development)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="endpoint">URL / Endpoint</Label>
                <Input
                  id="endpoint"
                  type="url"
                  placeholder="https://api.example.com"
                  value={formData.endpoint}
                  onChange={(e) => setFormData(prev => ({ ...prev, endpoint: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="expiresAt">Expires</Label>
                <Input
                  id="expiresAt"
                  type="date"
                  value={formData.expiresAt}
                  onChange={(e) => setFormData(prev => ({ ...prev, expiresAt: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-1.5">
                {formData.tags.map(t => (
                  <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-muted border border-border/40">
                    <TagIcon className="w-2.5 h-2.5" /> {t}
                    <button type="button" onClick={() => removeTag(t)} aria-label={`Remove ${t}`}>
                      <X className="w-2.5 h-2.5 opacity-60 hover:opacity-100" />
                    </button>
                  </span>
                ))}
                <input
                  value={formData.tagInput}
                  onChange={(e) => setFormData(prev => ({ ...prev, tagInput: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="Add tag…"
                  className="bg-transparent text-xs outline-none w-24 placeholder:text-muted-foreground/60"
                  aria-label="Add tag"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any context about this key — usage limits, owner, rotation cadence…"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="min-h-20"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddModal(false);
                setEditingKey(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={editingKey ? handleUpdateKey : handleAddKey}
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
              data-testid="button-save-api-key"
            >
              {editingKey ? 'Update' : 'Add'} Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VerifyAccessModal
        open={showVerifyModal}
        onOpenChange={setShowVerifyModal}
        onVerified={handleVerified}
        title="Reveal API Key"
        description="Verify your identity to view API key details."
      />

      <AlertDialog open={!!deleteTargetKey} onOpenChange={(open) => { if (!open) setDeleteTargetKey(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API key?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTargetKey?.name}" will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteKey} className="bg-rose-500 hover:bg-rose-600">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
