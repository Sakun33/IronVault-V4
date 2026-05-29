import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSubscription } from '@/hooks/use-subscription';
import { usePlan } from '@/lib/plan-service';
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
  Shield, Lock, AlertCircle, Search, Code,
  CalendarClock, ExternalLink, Tag as TagIcon, ArrowUpDown, X,
  ChevronDown, ChevronRight, CreditCard, Cloud, Hash, Sparkles, Activity, ShieldCheck,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { VerifyAccessModal } from '@/components/verify-access-modal';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ListSkeleton } from '@/components/list-skeleton';
import { ViewToggle } from '@/components/view-toggle';
import { SwipeRow, type SwipeAction } from '@/components/ios';
import { scheduleCredentialExpiryNotification } from '@/native/notifications';
import { PageHero } from '@/components/page-hero';

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

const CATEGORY_META: Record<Category, { icon: typeof CreditCard; gradient: string; accent: string; pill: string; border: string }> = {
  Payment: {
    icon: CreditCard,
    gradient: 'from-violet-500 to-fuchsia-500',
    accent: 'text-violet-300',
    pill: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    border: 'border-violet-500/40 hover:border-violet-500/60',
  },
  Cloud: {
    icon: Cloud,
    gradient: 'from-sky-500 to-cyan-500',
    accent: 'text-sky-300',
    pill: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    border: 'border-sky-500/40 hover:border-sky-500/60',
  },
  Social: {
    icon: Hash,
    gradient: 'from-pink-500 to-rose-500',
    accent: 'text-pink-300',
    pill: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
    border: 'border-pink-500/40 hover:border-pink-500/60',
  },
  Development: {
    icon: Code,
    gradient: 'from-emerald-500 to-teal-500',
    accent: 'text-emerald-300',
    pill: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    border: 'border-emerald-500/40 hover:border-emerald-500/60',
  },
  Other: {
    icon: Key,
    gradient: 'from-slate-500 to-zinc-500',
    accent: 'text-white/70',
    pill: 'bg-white/10 text-white/70 border-white/15',
    border: 'border-white/20 hover:border-white/30',
  },
};

const ENV_LABEL: Record<APIKey['environment'], string> = {
  production: 'LIVE',
  staging: 'TEST',
  development: 'DEV',
};

const ENV_PILL: Record<APIKey['environment'], string> = {
  production: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_-2px_rgba(16,185,129,0.6)]',
  staging:    'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-[0_0_10px_-2px_rgba(245,158,11,0.5)]',
  development:'bg-sky-500/15 text-sky-300 border-sky-500/40 shadow-[0_0_10px_-2px_rgba(56,189,248,0.5)]',
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

function daysUntil(d?: Date): number | null {
  if (!d) return null;
  const ms = new Date(d).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
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
  const { isLoading: licenseLoading } = useSubscription();
  const plan = usePlan();
  const { apiKeys, addApiKey, updateApiKey, deleteApiKey, bulkDeleteApiKeys, isLoading } = useVault();
  const { toast } = useToast();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingKey, setEditingKey] = useState<APIKey | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [pendingRevealId, setPendingRevealId] = useState<string | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [pulsedCard, setPulsedCard] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | Category>('all');
  const [envFilter, setEnvFilter] = useState<'all' | APIKey['environment']>('all');
  const [sortBy, setSortBy] = useState<'name' | 'updated' | 'expires'>('updated');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (typeof window === 'undefined') return 'grid';
    return localStorage.getItem('iv_apikeys_view') === 'list' ? 'list' : 'grid';
  });
  const [grouped, setGrouped] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('iv_apikeys_grouped') !== '0';
  });
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => { try { localStorage.setItem('iv_apikeys_view', viewMode); } catch {} }, [viewMode]);
  useEffect(() => { try { localStorage.setItem('iv_apikeys_grouped', grouped ? '1' : '0'); } catch {} }, [grouped]);

  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [deleteTargetKey, setDeleteTargetKey] = useState<{ id: string; name: string } | null>(null);

  const [formData, setFormData] = useState(blankForm());

  // Schedule OS-level expiry alert (1 day before) for any key expiring
  // within the next 30 days. Session-scoped Set prevents re-scheduling on
  // every render — and we cap the look-ahead so a vault full of long-lived
  // keys doesn't dump a notification per key into the OS scheduler.
  const scheduledKeysRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!apiKeys || apiKeys.length === 0) return;
    const now = Date.now();
    const horizon = now + 30 * 24 * 60 * 60 * 1000;
    apiKeys.forEach((key: APIKey) => {
      if (!key.expiresAt) return;
      const expiry = new Date(key.expiresAt);
      const ts = expiry.getTime();
      if (ts < now || ts > horizon) return;
      const dedupeKey = `${key.id}:${expiry.toISOString().slice(0, 10)}`;
      if (scheduledKeysRef.current.has(dedupeKey)) return;
      scheduledKeysRef.current.add(dedupeKey);
      void scheduleCredentialExpiryNotification(key.id, key.name, expiry);
    });
  }, [apiKeys]);

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

  const toggleRevealSecret = (id: string) => {
    if (revealedSecrets.has(id)) {
      const next = new Set(revealedSecrets);
      next.delete(id);
      setRevealedSecrets(next);
      return;
    }
    if (!isUnlocked) {
      setShowVerifyModal(true);
      return;
    }
    setRevealedSecrets(prev => new Set(prev).add(id));
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
      setRevealedSecrets(new Set());
    }, 5 * 60 * 1000);
  };

  const copyToClipboard = async (text: string, label: string, cardId?: string) => {
    if (!isUnlocked) {
      setShowVerifyModal(true);
      return;
    }
    const { copyToClipboardSecure } = await import('@/native/clipboard');
    const ok = await copyToClipboardSecure(text, { showToast: false });
    if (ok) {
      setCopiedField(label);
      if (cardId) {
        setPulsedCard(cardId);
        setTimeout(() => setPulsedCard(null), 700);
      }
      toast({ title: 'Copied', description: `${label} copied — clears in 30s.` });
      setTimeout(() => setCopiedField(null), 1500);
    } else {
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

  const groupedKeys = useMemo(() => {
    const buckets: Record<string, APIKey[]> = { Payment: [], Cloud: [], Social: [], Development: [], Other: [] };
    filteredKeys.forEach((k: APIKey) => {
      const cat = (CATEGORIES as readonly string[]).includes(k.category || '') ? (k.category as Category) : 'Other';
      buckets[cat].push(k);
    });
    return buckets;
  }, [filteredKeys]);

  const toggleCategoryCollapse = (cat: string) => {
    setCollapsedCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  // ── Locked screen ──────────────────────────────────────────────────────────
  if (!isUnlocked) {
    return (
      <>
        <PageHero
          icon={Key}
          title="API Keys"
          subtitle="Encrypted credentials, ready when you are. Verify your identity to unlock."
          badges={[
            { icon: <Lock className="w-3 h-3" />,         label: 'AES-256' },
            { icon: <ShieldCheck className="w-3 h-3" />,  label: 'Master password gated' },
            { icon: <Cloud className="w-3 h-3" />,        label: 'Cloud synced' },
          ]}
          cta={{
            label: 'Unlock with Master Password',
            icon: Lock,
            onClick: () => setShowVerifyModal(true),
            testId: 'api-keys-unlock-cta',
          }}
        />
        <VerifyAccessModal
          open={showVerifyModal}
          onOpenChange={setShowVerifyModal}
          onVerified={handleVerified}
          title="Unlock API Keys"
          description="Enter your master password or use biometrics to access your API keys."
        />
      </>
    );
  }

  if (!licenseLoading && !plan.isPaid) return <UpgradeGate feature="API Key Manager" />;

  const counts = {
    all: apiKeys.length,
    Payment: apiKeys.filter(k => (k.category || 'Other') === 'Payment').length,
    Cloud: apiKeys.filter(k => (k.category || 'Other') === 'Cloud').length,
    Social: apiKeys.filter(k => (k.category || 'Other') === 'Social').length,
    Development: apiKeys.filter(k => (k.category || 'Other') === 'Development').length,
    Other: apiKeys.filter(k => (k.category || 'Other') === 'Other').length,
  };

  const expiringCount = apiKeys.filter(k => isExpiringSoon(k.expiresAt)).length;
  const expiredCount = apiKeys.filter(k => isExpired(k.expiresAt)).length;

  // ── Card renderer ─────────────────────────────────────────────────────────
  const renderKeyCard = (key: APIKey, idx: number, denseGrid = false) => {
    const expiringSoon = isExpiringSoon(key.expiresAt);
    const expired = isExpired(key.expiresAt);
    const cat = ((CATEGORIES as readonly string[]).includes(key.category || '') ? key.category : 'Other') as Category;
    const meta = CATEGORY_META[cat];
    const expiryDays = daysUntil(key.expiresAt);
    const pulsing = pulsedCard === key.id;
    const isKeyRevealed = revealedKeys.has(key.id);
    const isSecretRevealed = revealedSecrets.has(key.id);

    return (
      <motion.div
        key={key.id}
        layout
        variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        whileHover={{ y: -2 }}
        animate={pulsing ? { boxShadow: ['0 0 0 0 rgba(16,185,129,0)', '0 0 0 4px rgba(16,185,129,0.4)', '0 0 0 0 rgba(16,185,129,0)'] } : {}}
        className={`relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/[0.07] transition-colors group ${
          expired ? 'border-rose-500/30 bg-rose-500/[0.04]' : `hover:${meta.border.split(' ')[1] || 'border-emerald-500/40'}`
        }`}
        data-testid={`api-key-card-${key.id}`}
      >
        {/* gradient left accent */}
        <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${meta.gradient}`} />

        {/* subtle inner glow on hover */}
        <div className={`pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br ${meta.gradient} mix-blend-overlay`}
             style={{ background: `radial-gradient(140% 60% at 0% 0%, rgba(255,255,255,0.04), transparent 50%)` }} />

        <div className={`relative ${denseGrid ? 'p-3 space-y-2' : 'p-4 space-y-3'}`}>
          {/* Header row */}
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`font-bold text-white truncate ${denseGrid ? 'text-[14px]' : 'text-[16px]'}`} data-testid={`api-key-name-${key.id}`}>
                  {key.name}
                </span>
                <span className={`px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] rounded border ${ENV_PILL[key.environment]}`}>
                  {ENV_LABEL[key.environment]}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-white/55 mt-1 flex-wrap">
                <span className="truncate">{key.service}</span>
                <span className={`text-[10px] px-1.5 py-px rounded-full border inline-flex items-center gap-1 ${meta.pill}`}>
                  <meta.icon className="w-2.5 h-2.5" />
                  {cat}
                </span>
              </div>
            </div>
          </div>

          {/* Key display */}
          {!denseGrid && (
            <div className="flex items-center gap-1.5 p-2.5 rounded-lg bg-black/20 backdrop-blur-sm border border-white/[0.06]">
              <code className={`flex-1 text-xs font-mono truncate ${isKeyRevealed ? 'text-emerald-200' : 'text-white/85'}`} data-testid={`api-key-value-${key.id}`}>
                {isKeyRevealed ? key.apiKey : maskKey(key.apiKey)}
              </code>
              <button
                onClick={() => toggleReveal(key.id)}
                className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors"
                aria-label={isKeyRevealed ? `Hide ${key.name}` : `Reveal ${key.name}`}
                title={isKeyRevealed ? 'Hide' : 'Reveal'}
              >
                {isKeyRevealed ? <EyeOff className="w-3.5 h-3.5 text-white/80" /> : <Eye className="w-3.5 h-3.5 text-white/70" />}
              </button>
              <button
                onClick={() => copyToClipboard(key.apiKey, `key-${key.id}`, key.id)}
                className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors"
                aria-label={`Copy ${key.name}`}
                title="Copy"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {copiedField === `key-${key.id}` ? (
                    <motion.span
                      key="check"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                    </motion.span>
                  ) : (
                    <motion.span key="copy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <Copy className="w-3.5 h-3.5 text-white/70" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </div>
          )}

          {/* Dense view: small key preview */}
          {denseGrid && (
            <code className="block text-[11px] font-mono text-white/55 truncate">
              {maskKey(key.apiKey)}
            </code>
          )}

          {/* Secret display */}
          {!denseGrid && key.apiSecret && (
            <div className="flex items-center gap-1.5 p-2.5 rounded-lg bg-black/20 backdrop-blur-sm border border-white/[0.06]">
              <span className="text-[10px] uppercase tracking-[0.12em] text-white/40 mr-0.5 font-semibold">Secret</span>
              <code className={`flex-1 text-xs font-mono truncate ${isSecretRevealed ? 'text-emerald-200' : 'text-white/85'}`}>
                {isSecretRevealed ? key.apiSecret : maskKey(key.apiSecret)}
              </code>
              <button
                onClick={() => toggleRevealSecret(key.id)}
                className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors"
                aria-label={isSecretRevealed ? 'Hide secret' : 'Reveal secret'}
                title={isSecretRevealed ? 'Hide' : 'Reveal'}
              >
                {isSecretRevealed ? <EyeOff className="w-3.5 h-3.5 text-white/80" /> : <Eye className="w-3.5 h-3.5 text-white/70" />}
              </button>
              <button
                onClick={() => copyToClipboard(key.apiSecret!, `secret-${key.id}`, key.id)}
                className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors"
                title="Copy secret"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {copiedField === `secret-${key.id}` ? (
                    <motion.span
                      key="check"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                    </motion.span>
                  ) : (
                    <motion.span key="copy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <Copy className="w-3.5 h-3.5 text-white/70" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </div>
          )}

          {/* Tags */}
          {!denseGrid && key.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {key.tags.slice(0, 5).map(t => (
                <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/55">
                  #{t}
                </span>
              ))}
            </div>
          )}

          {/* Health indicators */}
          {!denseGrid && (
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
              <div className="flex items-center gap-2 text-[11px] flex-wrap min-w-0">
                {/* Last used */}
                <span className={`inline-flex items-center gap-1 ${key.lastUsed ? 'text-white/55' : 'text-white/35'}`}>
                  <Activity className="w-3 h-3" />
                  {key.lastUsed
                    ? `Used ${formatDistanceToNow(new Date(key.lastUsed), { addSuffix: true })}`
                    : 'Never used'}
                </span>
                {/* Expiry */}
                {key.expiresAt && (
                  <span className={`inline-flex items-center gap-1 ${
                    expired ? 'text-rose-300 font-medium' : expiringSoon ? 'text-amber-300 font-medium' : 'text-white/55'
                  }`}>
                    <CalendarClock className="w-3 h-3" />
                    {expired
                      ? 'Expired'
                      : expiryDays !== null && expiryDays <= 14
                        ? `Expires in ${expiryDays}d`
                        : `Expires ${format(new Date(key.expiresAt), 'MMM d, yyyy')}`}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {key.endpoint && (
                  <button
                    onClick={() => {
                      const raw = (key.endpoint || '').trim();
                      if (!raw) return;
                      const safe = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
                      window.open(safe, '_blank', 'noopener,noreferrer');
                    }}
                    className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors"
                    title="Open endpoint"
                    aria-label="Open endpoint"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-white/60" />
                  </button>
                )}
                <button
                  onClick={() => openEdit(key)}
                  className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors"
                  title="Edit"
                  aria-label={`Edit ${key.name}`}
                  data-testid={`button-edit-api-key-${key.id}`}
                >
                  <Edit className="w-3.5 h-3.5 text-white/60" />
                </button>
                <button
                  onClick={() => setDeleteTargetKey({ id: key.id, name: key.name })}
                  className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-rose-500/15 hover:text-rose-300 text-white/60 transition-colors"
                  title="Delete"
                  aria-label={`Delete ${key.name}`}
                  data-testid={`button-delete-api-key-${key.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Dense view footer */}
          {denseGrid && (
            <div className="flex items-center justify-between text-[10px] text-white/45 pt-1">
              <span>{format(new Date(key.updatedAt), 'MMM d')}</span>
              {key.expiresAt && (expired || expiringSoon) && (
                <span className={expired ? 'text-rose-300' : 'text-amber-300'}>
                  {expired ? 'Expired' : `${expiryDays}d`}
                </span>
              )}
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  const gridClass = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3';

  return (
    <div className="space-y-5 p-4 overflow-x-hidden">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-teal-500/20 backdrop-blur-sm border border-emerald-500/30 flex items-center justify-center shadow-[0_0_20px_-4px_rgba(16,185,129,0.4)]">
              <Key className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight text-white">API Keys</h1>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-white/5 backdrop-blur-sm text-white/80 border border-white/10">
                  {counts.all}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <ShieldCheck className="w-2.5 h-2.5" /> Locked
                </span>
              </div>
              <p className="text-white/55 text-sm flex items-center gap-2">
                Encrypted credentials
                {(expiringCount > 0 || expiredCount > 0) && (
                  <>
                    <span className="text-white/25">·</span>
                    {expiredCount > 0 && (
                      <span className="text-rose-300 font-medium">{expiredCount} expired</span>
                    )}
                    {expiredCount > 0 && expiringCount > 0 && <span className="text-white/25">·</span>}
                    {expiringCount > 0 && (
                      <span className="text-amber-300 font-medium">{expiringCount} expiring soon</span>
                    )}
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setIsUnlocked(false);
              setRevealedKeys(new Set());
              setRevealedSecrets(new Set());
              toast({ title: 'Locked', description: 'API Keys vault locked' });
            }}
            className="h-9 w-9 rounded-xl bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10"
            title="Lock Vault"
            aria-label="Lock vault"
          >
            <Lock className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => { setEditingKey(null); resetForm(); setShowAddModal(true); }}
            className="h-9 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-semibold shadow-[0_0_16px_-2px_rgba(16,185,129,0.5)] border-0"
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
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
            <Input
              type="search"
              name="iv-api-keys-search"
              placeholder="Search keys, services, or tags…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-form-type="other"
              data-lpignore="true"
              data-1p-ignore="true"
              className="pl-10 pr-3 h-11 rounded-xl bg-white/5 backdrop-blur-sm border-white/10 placeholder:text-white/30 focus-visible:border-emerald-500/50 focus-visible:ring-emerald-500/20 truncate"
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
            className={`px-3 py-1.5 text-xs rounded-full border transition-all font-medium ${
              categoryFilter === 'all'
                ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-200 border-emerald-500/40 shadow-[0_0_12px_-4px_rgba(16,185,129,0.6)]'
                : 'bg-white/5 backdrop-blur-sm border-white/10 text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            All <span className="ml-1 opacity-70 tabular-nums">{counts.all}</span>
          </button>
          {CATEGORIES.map(cat => {
            const meta = CATEGORY_META[cat];
            const active = categoryFilter === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 text-xs rounded-full border transition-all font-medium inline-flex items-center gap-1.5 ${
                  active
                    ? `bg-gradient-to-r ${meta.gradient} bg-opacity-20 text-white border-white/20 shadow-[0_0_12px_-4px_rgba(255,255,255,0.3)]`
                    : 'bg-white/5 backdrop-blur-sm border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                <meta.icon className="w-3 h-3" />
                {cat} <span className="opacity-70 tabular-nums">{counts[cat]}</span>
              </button>
            );
          })}

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setGrouped(g => !g)}
              className={`h-8 px-2.5 text-xs rounded-lg border transition-colors inline-flex items-center gap-1 ${
                grouped
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                  : 'bg-white/5 backdrop-blur-sm border-white/10 text-white/60 hover:text-white'
              }`}
              title="Toggle category grouping"
            >
              <Sparkles className="w-3 h-3" /> Group
            </button>
            <select
              value={envFilter}
              onChange={(e) => setEnvFilter(e.target.value as any)}
              className="h-8 px-2 text-xs rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 text-white/80 focus:outline-none focus:border-emerald-500/50"
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
              className="h-8 px-2 text-xs rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 text-white/60 hover:text-white inline-flex items-center gap-1 transition-colors"
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
                className="h-8 text-xs rounded-lg bg-white/5 backdrop-blur-sm border-white/10 hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-300"
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
        <Card className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Code className="w-8 h-8 text-emerald-300" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No API Keys</h3>
            <p className="text-white/55 mb-4 text-sm">
              {apiKeys.length === 0 ? 'Get started by adding your first API key' : 'No keys match your filters'}
            </p>
            {apiKeys.length === 0 && (
              <Button
                onClick={() => { setEditingKey(null); resetForm(); setShowAddModal(true); }}
                className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-semibold shadow-[0_0_20px_-4px_rgba(16,185,129,0.5)] border-0"
              >
                <Plus className="w-4 h-4 mr-2" /> Add Your First API Key
              </Button>
            )}
          </CardContent>
        </Card>
      ) : grouped && viewMode === 'grid' && categoryFilter === 'all' ? (
        // Grouped grid view
        <div className="space-y-5">
          {CATEGORIES.map(cat => {
            const items = groupedKeys[cat];
            if (!items || items.length === 0) return null;
            const meta = CATEGORY_META[cat];
            const collapsed = collapsedCats.has(cat);
            return (
              <div key={cat} className="space-y-2">
                <button
                  type="button"
                  onClick={() => toggleCategoryCollapse(cat)}
                  className="w-full flex items-center gap-2 px-1 py-1 group"
                >
                  <motion.span animate={{ rotate: collapsed ? -90 : 0 }} transition={{ duration: 0.18 }}>
                    <ChevronDown className="w-4 h-4 text-white/40 group-hover:text-white/70 transition-colors" />
                  </motion.span>
                  <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${meta.gradient} bg-opacity-20 flex items-center justify-center`}>
                    <meta.icon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">{cat}</h3>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/60 tabular-nums">
                    {items.length}
                  </span>
                  <span className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent ml-2" />
                </button>
                <AnimatePresence initial={false}>
                  {!collapsed && (
                    <motion.div
                      key={`${cat}-grid`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.22 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <motion.div
                        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
                        initial="hidden"
                        animate="show"
                        className={gridClass}
                      >
                        {items.map((k, i) => renderKeyCard(k, i))}
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      ) : viewMode === 'grid' ? (
        <motion.div
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.035 } } }}
          initial="hidden"
          animate="show"
          className={gridClass}
        >
          {filteredKeys.map((k, i) => renderKeyCard(k, i))}
        </motion.div>
      ) : (
        // List view
        <div className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 overflow-hidden">
          {filteredKeys.map((key: APIKey, idx: number) => {
            const expiringSoon = isExpiringSoon(key.expiresAt);
            const expired = isExpired(key.expiresAt);
            const cat = ((CATEGORIES as readonly string[]).includes(key.category || '') ? key.category : 'Other') as Category;
            const meta = CATEGORY_META[cat];
            const expiryDays = daysUntil(key.expiresAt);
            const swipeActions: SwipeAction[] = [
              { id: 'copy', label: 'Copy', icon: Copy, background: 'bg-slate-500',
                onAction: () => copyToClipboard(key.apiKey, `key-${key.id}`, key.id) },
              { id: 'edit', label: 'Edit', icon: Edit, background: 'bg-blue-500',
                onAction: () => openEdit(key) },
              { id: 'delete', label: 'Delete', icon: Trash2, background: 'bg-red-600', destructive: true,
                onAction: () => setDeleteTargetKey({ id: key.id, name: key.name }) },
            ];
            return (
              <SwipeRow
                key={key.id}
                actions={swipeActions}
                className={idx < filteredKeys.length - 1 ? 'border-b border-white/[0.06]' : ''}
              >
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                  className={`relative flex items-center gap-3 px-4 py-3 min-h-[64px] hover:bg-white/[0.04] transition-colors group ${expired ? 'bg-rose-500/[0.04]' : ''}`}
                  data-testid={`api-key-card-${key.id}`}
                >
                  <span className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full bg-gradient-to-b ${meta.gradient} opacity-80`} />
                  <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${meta.gradient} bg-opacity-20 border border-white/10 flex items-center justify-center flex-shrink-0`}>
                    <meta.icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[15px] font-semibold text-white truncate" data-testid={`api-key-name-${key.id}`}>{key.name}</span>
                      <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] rounded border ${ENV_PILL[key.environment]}`}>
                        {ENV_LABEL[key.environment]}
                      </span>
                    </div>
                    <div className="text-[12px] text-white/55 flex items-center gap-1.5 mt-0.5 truncate">
                      <span>{key.service}</span>
                      <span className="text-white/25">·</span>
                      <code className="font-mono text-white/40">{maskKey(key.apiKey)}</code>
                      {key.expiresAt && (expired || expiringSoon) && (
                        <>
                          <span className="text-white/25">·</span>
                          <span className={expired ? 'text-rose-300 font-medium' : 'text-amber-300 font-medium'}>
                            {expired ? 'Expired' : `${expiryDays}d`}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button onClick={() => toggleReveal(key.id)} className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors" aria-label="Reveal">
                      {revealedKeys.has(key.id) ? <EyeOff className="w-3.5 h-3.5 text-white/70" /> : <Eye className="w-3.5 h-3.5 text-white/70" />}
                    </button>
                    <button onClick={() => copyToClipboard(key.apiKey, `key-${key.id}`, key.id)} className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors" aria-label="Copy">
                      {copiedField === `key-${key.id}` ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5 text-white/70" />}
                    </button>
                    <button onClick={() => openEdit(key)} className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors" aria-label="Edit">
                      <Edit className="w-3.5 h-3.5 text-white/70" />
                    </button>
                  </div>
                </motion.div>
              </SwipeRow>
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
                        : 'border-white/10 bg-white/5 hover:bg-white/10 text-white/80'
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
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-semibold border-0"
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
