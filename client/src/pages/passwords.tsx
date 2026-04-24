import { useState, useMemo } from 'react';
import { useSubscription } from '@/hooks/use-subscription';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Copy, Edit, Trash2, Eye, EyeOff, Search, Share2, Globe, LayoutTemplate, Mail, CreditCard, Smartphone, ShoppingBag, Building2, CheckCircle, Lock, ChevronRight } from 'lucide-react';
import { useVault } from '@/contexts/vault-context';
import { useToast } from '@/hooks/use-toast';
import { PASSWORD_CATEGORIES } from '@shared/schema';
import { PasswordGenerator } from '@/lib/password-generator';
import { AddPasswordModal } from '@/components/add-password-modal';
import { Favicon } from '@/components/favicon';
import { ShareModal } from '@/components/share-modal';
import { VerifyAccessModal } from '@/components/verify-access-modal';
import { formatDistanceToNow } from 'date-fns';

export default function Passwords() {
  const { passwords, deletePassword, searchQuery, setSearchQuery } = useVault();
  const { toast } = useToast();
  const { getLimit, isPro } = useSubscription();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPassword, setEditingPassword] = useState<any>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [strengthFilter, setStrengthFilter] = useState<string>('all');
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedPassword, setSelectedPassword] = useState<any>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [pendingRevealId, setPendingRevealId] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [detailPassword, setDetailPassword] = useState<any>(null);

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

  const handleUseTemplate = (template: typeof PASSWORD_TEMPLATES[0]) => {
    setEditingPassword({ ...template.fields, category: template.category, isTemplate: true });
    setShowTemplatesModal(false);
    setShowAddModal(true);
  };

  const filteredPasswords = useMemo(() => {
    return passwords.filter(password => {
      const matchesSearch = searchQuery === '' ||
        password.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        password.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        password.url?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        password.category?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || password.category === categoryFilter;
      const { level } = PasswordGenerator.calculateStrength(password.password);
      const matchesStrength = strengthFilter === 'all' ||
        (strengthFilter === 'weak' && level === 'weak') ||
        (strengthFilter === 'medium' && level === 'medium') ||
        (strengthFilter === 'strong' && (level === 'strong' || level === 'very-strong'));
      return matchesSearch && matchesCategory && matchesStrength;
    });
  }, [passwords, searchQuery, categoryFilter, strengthFilter]);

  const copyToClipboard = async (text: string, key: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(key);
      toast({ title: "Copied", description: `${label} copied to clipboard` });
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
      toast({ title: "Deleted", description: "Password deleted successfully" });
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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Passwords</h1>
            {!isPro && (
              <p className="text-xs text-muted-foreground mt-0.5">{passwords.length} / {getLimit('passwords')} used</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowTemplatesModal(true)} className="rounded-xl">
              <LayoutTemplate className="w-4 h-4 mr-1" />
              Templates
            </Button>
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

        {/* Search + Filters */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              type="text"
              placeholder="Search passwords..."
              className="pl-10 rounded-xl border-input bg-muted/50"
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
          </div>
        </div>

        {/* Password List */}
        {filteredPasswords.length > 0 ? (
          <Card className="rounded-2xl shadow-sm border-border/50 overflow-hidden">
            {filteredPasswords.map((password, idx) => (
              <button
                key={password.id}
                data-testid={`password-row-${password.id}`}
                onClick={() => openDetail(password)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 active:bg-muted transition-colors ${idx < filteredPasswords.length - 1 ? 'border-b border-border/50' : ''}`}
              >
                <Favicon url={password.url} name={password.name} className="w-8 h-8 flex-shrink-0 rounded-lg" />
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-medium text-foreground truncate">{password.name}</div>
                  <div className="text-[13px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                    <Lock size={11} className="flex-shrink-0" />
                    <span className="truncate">{password.username}</span>
                  </div>
                </div>
                <ChevronRight size={16} className="text-muted-foreground/40 flex-shrink-0" />
              </button>
            ))}
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
                    >
                      {isVisible ? <EyeOff size={15} className="text-primary" /> : <Eye size={15} className="text-muted-foreground" />}
                    </button>
                    <button
                      onClick={() => copyToClipboard(pw.password, pw.id, 'Password')}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                      data-testid={`copy-password-${pw.id}`}
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
                      onClick={() => window.open(pw.url, '_blank')}
                      className="flex-shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors"
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
                  <ShareModal item={pw} itemType="password">
                    <Button variant="outline" className="flex-1 rounded-xl">
                      <Share2 size={14} className="mr-1.5" /> Share
                    </Button>
                  </ShareModal>
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
    </div>
  );
}
