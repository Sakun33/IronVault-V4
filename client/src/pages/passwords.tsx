import { useState, useMemo, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'motion/react';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { SwipeableRow } from '@/components/swipeable-row';
import { useSubscription } from '@/hooks/use-subscription';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Copy, Edit, Trash2, Eye, EyeOff, Search, Share2, Globe, LayoutTemplate, Mail, CreditCard, Smartphone, ShoppingBag, Building2, CheckCircle, Lock, ChevronRight, CheckSquare, LayoutGrid, List as ListIcon } from 'lucide-react';
import { useVault } from '@/contexts/vault-context';
import { useToast } from '@/hooks/use-toast';
import { PASSWORD_CATEGORIES } from '@shared/schema';
import { PasswordGenerator } from '@/lib/password-generator';
import { CryptoService } from '@/lib/crypto';
import { ListSkeleton } from '@/components/list-skeleton';
import { AddPasswordModal } from '@/components/add-password-modal';
import { Favicon } from '@/components/favicon';
import { VerifyAccessModal } from '@/components/verify-access-modal';
import { GuidedImportButton } from '@/components/guided-import';
import { ViewToggle } from '@/components/view-toggle';
import { useMultiSelect } from '@/hooks/use-multi-select';
import { SelectionBar, SelectionCheckbox } from '@/components/selection-bar';
import { formatDistanceToNow } from 'date-fns';

export default function Passwords() {
  const { passwords, deletePassword, bulkDeletePasswords, isLoading } = useVault();
  const { toast } = useToast();
  const { getLimit, isPro } = useSubscription();

  // Local search — independent of the global header search so typing in one
  // doesn't propagate to the other.
  const [searchQuery, setSearchQuery] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPassword, setEditingPassword] = useState<any>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  // Strength filter respects ?strength=weak|medium|strong from the URL so
  // dashboard "fix now" tiles deep-link straight into a filtered view.
  // wouter v2 doesn't ship useSearch — useLocation re-renders on in-app
  // navigation, and we read window.location.search directly inside the effect.
  const [location] = useLocation();
  const readStrengthParam = (): 'weak' | 'medium' | 'strong' | null => {
    if (typeof window === 'undefined') return null;
    const param = new URLSearchParams(window.location.search).get('strength');
    return param === 'weak' || param === 'medium' || param === 'strong' ? param : null;
  };
  const [strengthFilter, setStrengthFilter] = useState<string>(() => readStrengthParam() ?? 'all');
  useEffect(() => {
    const next = readStrengthParam();
    if (next) setStrengthFilter(next);
  }, [location]);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedPassword, setSelectedPassword] = useState<any>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [pendingRevealId, setPendingRevealId] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [detailPassword, setDetailPassword] = useState<any>(null);
  // View mode: 'list' (current row layout) or 'grid' (3-col card layout).
  // Persisted so the user's choice sticks across reloads.
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    if (typeof window === 'undefined') return 'list';
    return (localStorage.getItem('iv_passwords_view') as 'list' | 'grid') || 'list';
  });
  useEffect(() => {
    try { localStorage.setItem('iv_passwords_view', viewMode); } catch {}
  }, [viewMode]);
  // Multi-select state populated below once filteredPasswords is known.

  const PASSWORD_TEMPLATES = [
    { id: 'gmail', name: 'Gmail', icon: Mail, category: 'Email', fields: { name: 'Gmail', username: '', url: 'https://mail.google.com' } },
    { id: 'outlook', name: 'Outlook/Microsoft', icon: Mail, category: 'Email', fields: { name: 'Microsoft Account', username: '', url: 'https://outlook.live.com' } },
    { id: 'facebook', name: 'Facebook', icon: Globe, category: 'Social', fields: { name: 'Facebook', username: '', url: 'https://facebook.com' } },
    { id: 'instagram', name: 'Instagram', icon: Globe, category: 'Social', fields: { name: 'Instagram', username: '', url: 'https://instagram.com' } },
    { id: 'twitter', name: 'X (Twitter)', icon: Globe, category: 'Social', fields: { name: 'X (Twitter)', username: '', url: 'https://x.com' } },
    { id: 'linkedin', name: 'LinkedIn', icon: Globe, category: 'Social', fields: { name: 'LinkedIn', username: '', url: 'https://linkedin.com' } },
    { id: 'amazon', name: 'Amazon', icon: ShoppingBag, category: 'Shopping', fields: { name: 'Amazon', username: '', url: 'https://amazon.com' } },
    { id: 'netflix', name: 'Netflix', icon: Smartphone, category: 'Entertainment', fields: { name: 'Netflix', username: '', url: 'https://netflix.com' } },
    { id: 'spotify', name: 'Spotify', icon: Smartphone, category: 'Entertainment', fields: { name: 'Spotify', username: '', url: 'https://spotify.com' } },
    { id: 'apple', name: 'Apple ID', icon: Smartphone, category: 'Technology', fields: { name: 'Apple ID', username: '', url: 'https://appleid.apple.com' } },
    { id: 'google', name: 'Google Account', icon: Globe, category: 'Technology', fields: { name: 'Google Account', username: '', url: 'https://accounts.google.com' } },
    { id: 'github', name: 'GitHub', icon: Globe, category: 'Development', fields: { name: 'GitHub', username: '', url: 'https://github.com' } },
    { id: 'banking', name: 'Online Banking', icon: Building2, category: 'Finance', fields: { name: '', username: '', url: '' } },
    { id: 'paypal', name: 'PayPal', icon: CreditCard, category: 'Finance', fields: { name: 'PayPal', username: '', url: 'https://paypal.com' } },
    { id: 'wifi', name: 'WiFi Network', icon: Globe, category: 'Network', fields: { name: '', username: 'admin', url: '' } },
  ];

  const handleShare = async (pw: any) => {
    try {
      const payload = JSON.stringify({
        name: pw.name,
        username: pw.username || pw.email || '',
        password: pw.password,
        url: pw.url || '',
        sharedBy: 'IronVault User',
      });

      // Client-side encrypt: key never leaves the browser. Server only sees ciphertext + IV.
      const key = await CryptoService.generateKey();
      const { encrypted, iv } = await CryptoService.encrypt(payload, key);
      const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', key));

      const res = await fetch('/api/share/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: {
            v: 2,
            ct: CryptoService.uint8ArrayToBase64(encrypted),
            iv: CryptoService.uint8ArrayToBase64(iv),
          },
          expiresIn: 24,
        }),
      });
      if (!res.ok) throw new Error('Failed to create share link');
      const { link } = await res.json();

      // The fragment is never sent in HTTP requests — server cannot read the key.
      const linkWithKey = `${link}#k=${CryptoService.uint8ArrayToBase64(rawKey)
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;

      if (navigator.share) {
        await navigator.share({
          title: `Password for ${pw.name}`,
          text: `Here's the login for ${pw.name}. One-time link — save the details.`,
          url: linkWithKey,
        });
      } else {
        await navigator.clipboard.writeText(linkWithKey);
        toast({ variant: 'success', title: 'Share link copied!', description: 'One-time link valid for 24 hours' });
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      toast({ title: 'Share failed', description: 'Could not create share link', variant: 'destructive' });
    }
  };

  const handleUseTemplate = (template: typeof PASSWORD_TEMPLATES[0]) => {
    setEditingPassword({ ...template.fields, category: template.category, isTemplate: true });
    setShowTemplatesModal(false);
    setShowAddModal(true);
  };

  const filteredPasswords = useMemo(() => {
    return passwords.filter(password => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = searchQuery === '' ||
        (password.name ?? '').toLowerCase().includes(q) ||
        (password.username ?? '').toLowerCase().includes(q) ||
        (password.url ?? '').toLowerCase().includes(q) ||
        (password.category ?? '').toLowerCase().includes(q) ||
        (password.notes ?? '').toLowerCase().includes(q);
      const matchesCategory = categoryFilter === 'all' || password.category === categoryFilter;
      const { level } = PasswordGenerator.calculateStrength(password.password);
      const matchesStrength = strengthFilter === 'all' ||
        (strengthFilter === 'weak' && level === 'weak') ||
        (strengthFilter === 'medium' && level === 'medium') ||
        (strengthFilter === 'strong' && (level === 'strong' || level === 'very-strong'));
      return matchesSearch && matchesCategory && matchesStrength;
    });
  }, [passwords, searchQuery, categoryFilter, strengthFilter]);

  const selection = useMultiSelect(filteredPasswords);

  const handleBulkDelete = async () => {
    const ids = Array.from(selection.selectedIds);
    if (ids.length === 0) return;
    const removed = await bulkDeletePasswords(ids);
    selection.exitSelectionMode();
    toast({
      title: removed === ids.length ? 'Passwords deleted' : 'Some passwords could not be deleted',
      description: `${removed} of ${ids.length} removed.`,
      variant: removed === ids.length ? 'default' : 'destructive',
    });
  };

  const copyToClipboard = async (text: string, key: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      void hapticSuccess();
      setCopiedId(key);
      toast({ variant: 'success', title: "Copied", description: `${label} copied to clipboard` });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ title: "Error", description: `Failed to copy ${label}`, variant: "destructive" });
    }
  };

  const togglePasswordVisibility = (id: string) => {
    if (visiblePasswords.has(id)) {
      const s = new Set(visiblePasswords); s.delete(id); setVisiblePasswords(s); return;
    }
    if (!isVerified) { setPendingRevealId(id); setShowVerifyModal(true); return; }
    const s = new Set(visiblePasswords); s.add(id); setVisiblePasswords(s);
  };

  const handleVerified = () => {
    setIsVerified(true);
    if (pendingRevealId) {
      const s = new Set(visiblePasswords); s.add(pendingRevealId); setVisiblePasswords(s);
      setPendingRevealId(null);
    }
  };

  const handleDelete = (id: string) => setDeleteTargetId(id);

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await deletePassword(deleteTargetId);
      toast({ variant: 'success', title: "Deleted", description: "Password deleted successfully" });
      if (detailPassword?.id === deleteTargetId) setDetailPassword(null);
    } catch {
      toast({ title: "Error", description: "Failed to delete password", variant: "destructive" });
    } finally {
      setDeleteTargetId(null);
    }
  };

  const strengthStyle = (level: string) => {
    if (level === 'strong' || level === 'very-strong')
      return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400';
    if (level === 'weak')
      return 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400';
    return 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400';
  };

  const openDetail = (password: any) => setDetailPassword(password);

  return (
    <div>
      <div className="space-y-5">
        {/* Header — top row: title + primary actions (Select, Add) always visible.
            Import/Templates move to a secondary row below the title on small
            screens, where the four-button row would otherwise overflow and
            clip Select/Add off the right edge. */}
        <div className="space-y-2.5 md:space-y-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Passwords</h1>
              {!isPro && (
                <p className="text-xs text-muted-foreground mt-0.5">{passwords.length} / {getLimit('passwords')} used</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Desktop-only Import + Templates */}
              <div className="hidden md:flex items-center gap-2">
                <GuidedImportButton />
                <Button variant="outline" size="sm" onClick={() => setShowTemplatesModal(true)} className="rounded-xl">
                  <LayoutTemplate className="w-4 h-4 mr-1" />
                  Templates
                </Button>
              </div>
              {filteredPasswords.length > 0 && !selection.isSelectionMode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selection.enterSelectionMode()}
                  className="rounded-xl px-2.5 sm:px-3"
                  data-testid="button-enter-selection-passwords"
                  aria-label="Select passwords"
                >
                  <CheckSquare className="w-4 h-4 sm:mr-1" />
                  <span className="hidden sm:inline">Select</span>
                </Button>
              )}
              <Button
                onClick={() => {
                  if (!isPro && passwords.length >= getLimit('passwords')) {
                    toast({ title: "Limit Reached", description: `Free plan allows up to ${getLimit('passwords')} passwords. Upgrade to Pro for unlimited.`, variant: "destructive" });
                    return;
                  }
                  setEditingPassword(null);
                  setShowAddModal(true);
                }}
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl"
                disabled={!isPro && passwords.length >= getLimit('passwords')}
                data-testid="add-password-button"
              >
                <Plus className="w-4 h-4 mr-1" />
                {!isPro && passwords.length >= getLimit('passwords') ? 'Upgrade' : 'Add'}
              </Button>
            </div>
          </div>
          {/* Mobile-only secondary row for Import + Templates */}
          <div className="flex items-center gap-2 md:hidden">
            <div className="flex-1">
              <GuidedImportButton />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTemplatesModal(true)}
              className="rounded-xl flex-1"
            >
              <LayoutTemplate className="w-4 h-4 mr-1" />
              Templates
            </Button>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 w-4 h-4 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search passwords..."
              className="pl-10 rounded-xl"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="rounded-xl border-input bg-muted flex-1 text-sm h-9">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {PASSWORD_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={strengthFilter} onValueChange={setStrengthFilter}>
              <SelectTrigger className="rounded-xl border-input bg-muted flex-1 text-sm h-9">
                <SelectValue placeholder="All Strength" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Strength</SelectItem>
                <SelectItem value="weak">Weak</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="strong">Strong</SelectItem>
              </SelectContent>
            </Select>
            <ViewToggle view={viewMode} onChange={setViewMode} className="flex-shrink-0" />
          </div>
        </div>

        {/* Password List / Grid */}
        {isLoading && passwords.length === 0 ? (
          <ListSkeleton rows={6} showHeader={false} />
        ) : filteredPasswords.length > 0 && viewMode === 'grid' ? (
          <motion.div
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.035 } } }}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
          >
            {/* TODO QA-R2 H4: virtualize this list once it routinely exceeds
                ~500 items. We've benchmarked 256 cards rendering smoothly,
                but @tanstack/react-virtual will be required as users with
                Pro plans grow their vaults into the thousands. Tracking
                ticket: introduce virtualization in a focused refactor PR. */}
            {filteredPasswords.map(password => {
              const checked = selection.isSelected(password.id);
              const { score } = PasswordGenerator.calculateStrength(password.password);
              const strengthColor = score < 30 ? 'from-red-500 to-rose-400' : score < 60 ? 'from-amber-500 to-yellow-400' : 'from-emerald-500 to-teal-400';
              const strengthLabel = score < 30 ? 'Weak' : score < 60 ? 'Medium' : 'Strong';
              return (
                <motion.div
                  key={password.id}
                  data-testid={`password-card-${password.id}`}
                  variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
                  transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                  whileHover={{ y: -3, scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => {
                    if (selection.isSelectionMode) selection.toggle(password.id);
                    else openDetail(password);
                  }}
                  onContextMenu={(e) => { e.preventDefault(); selection.enterSelectionMode(password.id); }}
                  className={`group glass-card cursor-pointer p-4 ${checked ? 'ring-2 ring-emerald-400/40' : ''}`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <Favicon url={password.url} name={password.name} className="w-10 h-10 flex-shrink-0 rounded-xl" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] font-semibold text-foreground truncate">{password.name}</div>
                      <div className="text-xs text-muted-foreground truncate font-mono">{password.username || '—'}</div>
                    </div>
                    {selection.isSelectionMode && (
                      <SelectionCheckbox checked={checked} onChange={() => selection.toggle(password.id)} label={`Select ${password.name}`} />
                    )}
                  </div>
                  {/* Strength bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Strength</span>
                      <span className="text-[11px] font-medium text-foreground/80">{strengthLabel}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(8, score)}%` }}
                        transition={{ type: 'spring', stiffness: 120, damping: 22 }}
                        className={`h-full bg-gradient-to-r ${strengthColor}`}
                      />
                    </div>
                  </div>
                  {/* Quick actions */}
                  <div className="flex items-center justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      aria-label="Copy password"
                      onClick={(e) => { e.stopPropagation(); copyToClipboard(password.password, password.id, 'Password'); }}
                      className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white/[0.08] transition-colors"
                    >
                      {copiedId === password.id
                        ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                        : <Copy className="w-4 h-4 text-muted-foreground" />}
                    </button>
                    <button
                      type="button"
                      aria-label="Edit password"
                      onClick={(e) => { e.stopPropagation(); setEditingPassword(password); setShowAddModal(true); }}
                      className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white/[0.08] transition-colors"
                    >
                      <Edit className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        ) : filteredPasswords.length > 0 ? (
          <Card className={`rounded-2xl shadow-sm border-border/50 overflow-hidden ${selection.isSelectionMode ? 'pb-20' : ''}`}>
            <motion.div
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
              initial="hidden"
              animate="show"
            >
              {filteredPasswords.map((password, idx) => {
                const checked = selection.isSelected(password.id);
                return (
                <SwipeableRow
                  key={password.id}
                  onDelete={() => handleDelete(password.id)}
                  deleteLabel="Delete"
                  disabled={selection.isSelectionMode}
                  className={idx < filteredPasswords.length - 1 ? 'border-b border-border/50' : ''}
                >
                  <motion.button
                    variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
                    transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                    whileHover={{ scale: 1.005 }}
                    whileTap={{ scale: 0.995 }}
                    data-testid={`password-row-${password.id}`}
                    onClick={() => {
                      if (selection.isSelectionMode) selection.toggle(password.id);
                      else openDetail(password);
                    }}
                    onContextMenu={(e) => { e.preventDefault(); selection.enterSelectionMode(password.id); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 active:bg-muted transition-colors ${checked ? 'bg-primary/5' : ''}`}
                  >
                    {selection.isSelectionMode && (
                      <SelectionCheckbox checked={checked} onChange={() => selection.toggle(password.id)} label={`Select ${password.name}`} />
                    )}
                    <Favicon url={password.url} name={password.name} className="w-8 h-8 flex-shrink-0 rounded-lg" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] font-medium text-foreground truncate">{password.name}</div>
                      <div className="text-[13px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                        <Lock size={11} className="flex-shrink-0" />
                        <span className="truncate">{password.username}</span>
                      </div>
                    </div>
                    {!selection.isSelectionMode && (
                      <ChevronRight size={16} className="text-muted-foreground/40 flex-shrink-0" />
                    )}
                  </motion.button>
                </SwipeableRow>
                );
              })}
            </motion.div>
          </Card>
        ) : (
          <Card className="rounded-2xl shadow-sm border-0 bg-card">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No passwords yet</h3>
              <p className="text-muted-foreground mb-6">Get started by adding your first password entry</p>
              <Button
                onClick={() => {
                  if (!isPro && passwords.length >= getLimit('passwords')) {
                    toast({ title: "Limit Reached", description: `Free plan allows up to ${getLimit('passwords')} passwords. Upgrade to Pro for unlimited.`, variant: "destructive" });
                    return;
                  }
                  setShowAddModal(true);
                }}
                disabled={!isPro && passwords.length >= getLimit('passwords')}
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-6 py-3"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Password
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Detail Modal */}
      {detailPassword && (() => {
        const pw = detailPassword;
        const { level } = PasswordGenerator.calculateStrength(pw.password);
        const isVisible = visiblePasswords.has(pw.id);
        const lastUsed = pw.lastUsed || pw.updatedAt;
        return (
          <Dialog open={!!detailPassword} onOpenChange={(open) => { if (!open) setDetailPassword(null); }}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Favicon url={pw.url} name={pw.name} className="w-9 h-9 rounded-lg flex-shrink-0" />
                  <span className="truncate">{pw.name}</span>
                </DialogTitle>
              </DialogHeader>
              <DialogBody className="space-y-3">
                {/* Username */}
                <div className="rounded-xl bg-muted/50 px-4 py-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-0.5">Username / Email</div>
                    <div className="text-[14px] text-foreground truncate">{pw.username}</div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(pw.username, `${pw.id}-username`, 'Username')}
                    className="flex-shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors"
                    aria-label={`Copy username for ${pw.name}`}
                    type="button"
                  >
                    {copiedId === `${pw.id}-username`
                      ? <CheckCircle size={15} className="text-primary" />
                      : <Copy size={15} className="text-muted-foreground" />}
                  </button>
                </div>

                {/* Password */}
                <div className="rounded-xl bg-muted/50 px-4 py-3 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-0.5">Password</div>
                    <div className="text-[14px] font-mono text-foreground truncate">
                      {isVisible ? pw.password : '••••••••••••'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => togglePasswordVisibility(pw.id)}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                      data-testid={`reveal-password-${pw.id}`}
                      aria-label={isVisible ? `Hide password for ${pw.name}` : `Show password for ${pw.name}`}
                      aria-pressed={isVisible}
                      type="button"
                    >
                      {isVisible ? <EyeOff size={15} className="text-primary" /> : <Eye size={15} className="text-muted-foreground" />}
                    </button>
                    <button
                      onClick={() => copyToClipboard(pw.password, pw.id, 'Password')}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                      data-testid={`copy-password-${pw.id}`}
                      aria-label={`Copy password for ${pw.name}`}
                      type="button"
                    >
                      {copiedId === pw.id
                        ? <CheckCircle size={15} className="text-primary" />
                        : <Copy size={15} className="text-muted-foreground" />}
                    </button>
                  </div>
                </div>

                {/* URL */}
                {pw.url && (
                  <div className="rounded-xl bg-muted/50 px-4 py-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-0.5">Website</div>
                      <div className="text-[14px] text-foreground truncate">{pw.url}</div>
                    </div>
                    <button
                      onClick={() => window.open(pw.url, '_blank', 'noopener,noreferrer')}
                      className="flex-shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors"
                      aria-label={`Open ${pw.name} website in new tab`}
                      type="button"
                    >
                      <Globe size={15} className="text-muted-foreground" />
                    </button>
                  </div>
                )}

                {/* Notes */}
                {pw.notes && (
                  <div className="rounded-xl bg-muted/50 px-4 py-3">
                    <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-0.5">Notes</div>
                    <div className="text-[14px] text-foreground whitespace-pre-wrap">{pw.notes}</div>
                  </div>
                )}

                {/* Meta row */}
                <div className="flex items-center gap-2 pt-1">
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${strengthStyle(level)}`}>
                    {level === 'very-strong' ? 'very strong' : level}
                  </span>
                  {pw.category && (
                    <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{pw.category}</span>
                  )}
                  {lastUsed && (
                    <span className="text-[11px] text-muted-foreground ml-auto">
                      {formatDistanceToNow(new Date(lastUsed), { addSuffix: true })}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="flex-1 rounded-xl" onClick={() => handleShare(pw)}>
                    <Share2 size={14} className="mr-1.5" /> Share
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl"
                    onClick={() => { setDetailPassword(null); setEditingPassword(pw); setShowAddModal(true); }}
                    data-testid={`edit-password-${pw.id}`}
                  >
                    <Edit size={14} className="mr-1.5" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl text-destructive hover:text-destructive border-destructive/30"
                    onClick={() => handleDelete(pw.id)}
                    data-testid={`delete-password-${pw.id}`}
                  >
                    <Trash2 size={14} className="mr-1.5" /> Delete
                  </Button>
                </div>
              </DialogBody>
            </DialogContent>
          </Dialog>
        );
      })()}

      <AddPasswordModal
        open={showAddModal || !!editingPassword}
        onOpenChange={(open) => {
          if (!open) { setShowAddModal(false); setEditingPassword(null); }
          else setShowAddModal(true);
        }}
        editingPassword={editingPassword}
      />

      <VerifyAccessModal
        open={showVerifyModal}
        onOpenChange={setShowVerifyModal}
        onVerified={handleVerified}
        title="Reveal Password"
        description="Verify your identity to view this password."
      />


      {/* Templates Modal */}
      <Dialog open={showTemplatesModal} onOpenChange={setShowTemplatesModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutTemplate className="w-5 h-5" />
              Password Templates
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="grid grid-cols-2 gap-3">
            {PASSWORD_TEMPLATES.map(template => {
              const IconComponent = template.icon;
              return (
                <Card
                  key={template.id}
                  className="cursor-pointer hover:shadow-md transition-shadow p-3"
                  onClick={() => handleUseTemplate(template)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <IconComponent className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{template.name}</p>
                      <p className="text-xs text-muted-foreground">{template.category}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </DialogBody>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete password?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the password. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selection.isSelectionMode && (
        <SelectionBar
          selectedCount={selection.selectedCount}
          totalCount={filteredPasswords.length}
          allSelected={selection.allSelected}
          itemLabel="password"
          onSelectAll={selection.selectAll}
          onClear={selection.clear}
          onExit={selection.exitSelectionMode}
          onBulkDelete={handleBulkDelete}
        />
      )}

      {/* Mobile floating "Add Password" button.
          The header has Import / Templates / Select / Add lined up on the
          right, which overflows past the viewport on phones — Add (last
          child) gets clipped off-screen. The FAB guarantees the primary
          action stays reachable. Hidden on lg+ where the header button is
          fully visible, and suppressed during selection mode so it doesn't
          collide with the SelectionBar. */}
      {!selection.isSelectionMode && (
        <motion.button
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.15 }}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => {
            void hapticLight();
            if (!isPro && passwords.length >= getLimit('passwords')) {
              toast({ title: "Limit Reached", description: `Free plan allows up to ${getLimit('passwords')} passwords. Upgrade to Pro for unlimited.`, variant: "destructive" });
              return;
            }
            setEditingPassword(null);
            setShowAddModal(true);
          }}
          className="lg:hidden fixed right-4 bottom-[calc(96px+env(safe-area-inset-bottom))] w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-[0_12px_32px_-6px_rgba(16,185,129,0.7)] hover:shadow-[0_16px_40px_-6px_rgba(16,185,129,0.85)] z-40 flex items-center justify-center"
          aria-label={!isPro && passwords.length >= getLimit('passwords') ? 'Upgrade to add more passwords' : 'Add password'}
          data-testid="add-password-fab"
        >
          <Plus className="w-6 h-6" />
        </motion.button>
      )}
    </div>
  );
}
