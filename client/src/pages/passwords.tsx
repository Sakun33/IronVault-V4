import { useState, useMemo } from 'react';
import { useSubscription } from '@/hooks/use-subscription';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Copy, Edit, Trash2, Eye, EyeOff, Search, Share2, Globe, LayoutTemplate, Mail, CreditCard, Smartphone, ShoppingBag, Building2, MoreVertical, CheckCircle, User } from 'lucide-react';
import { useVault } from '@/contexts/vault-context';
import { useToast } from '@/hooks/use-toast';
import { PASSWORD_CATEGORIES } from '@shared/schema';
import { PasswordGenerator } from '@/lib/password-generator';
import { AddPasswordModal } from '@/components/add-password-modal';
import { Favicon } from '@/components/favicon';
import { BrandCard } from '@/components/brand-card';
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
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedPassword, setSelectedPassword] = useState<any>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [pendingRevealId, setPendingRevealId] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

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

  const copyPassword = async (password: string, id: string) => {
    try {
      await navigator.clipboard.writeText(password);
      setCopiedId(id);
      toast({ title: "Copied", description: "Password copied to clipboard" });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ title: "Error", description: "Failed to copy password", variant: "destructive" });
    }
  };

  const copyUsername = async (username: string, id: string) => {
    try {
      await navigator.clipboard.writeText(username);
      setCopiedId(`${id}-username`);
      toast({ title: "Copied", description: "Username copied to clipboard" });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ title: "Error", description: "Failed to copy username", variant: "destructive" });
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
    } catch {
      toast({ title: "Error", description: "Failed to delete password", variant: "destructive" });
    } finally {
      setDeleteTargetId(null);
    }
  };

  const handleShare = (password: any) => { setSelectedPassword(password); setShowShareModal(true); };

  const strengthStyle = (level: string) => {
    if (level === 'strong' || level === 'very-strong')
      return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400';
    if (level === 'weak')
      return 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400';
    return 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400';
  };

  return (
    <div>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Password Vault</h1>
            <p className="text-muted-foreground text-sm">Manage your passwords securely with end-to-end encryption</p>
          </div>
          <div className="flex items-center gap-2">
            {!isPro && (
              <span className="text-xs text-muted-foreground">{passwords.length}/{getLimit('passwords')}</span>
            )}
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
              {!isPro && passwords.length >= getLimit('passwords') ? 'Upgrade to Add' : 'Add'}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="rounded-2xl shadow-sm border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 transition-colors group-focus-within:text-primary" />
                <Input
                  type="text"
                  placeholder="Search passwords & services..."
                  className="pl-10 rounded-xl border-input bg-muted/50"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="rounded-xl border-input bg-muted">
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
                <SelectTrigger className="rounded-xl border-input bg-muted">
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
          </CardContent>
        </Card>

        {/* Password List */}
        {filteredPasswords.length > 0 ? (
          <div className="space-y-2.5 stagger-children">
            {filteredPasswords.map((password) => {
              const { level } = PasswordGenerator.calculateStrength(password.password);
              const isVisible = visiblePasswords.has(password.id);
              const lastUsed = password.lastUsed || password.updatedAt;

              return (
                <BrandCard key={password.id} name={password.name} url={password.url} data-testid={`password-row-${password.id}`}>
                  <div className="px-4 py-3">
                    {/* Main row: favicon + name/username + actions */}
                    <div className="flex items-center gap-3">
                      <Favicon url={password.url} name={password.name} className="w-10 h-10 flex-shrink-0" />

                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-[15px] text-foreground truncate leading-tight">
                          {password.name}
                        </h3>
                        <p className="text-[13px] text-muted-foreground truncate leading-tight mt-0.5">
                          {password.username}
                        </p>
                      </div>

                      {/* Inline actions: copy username + copy password + kebab */}
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => copyUsername(password.username, password.id)}
                          data-testid={`copy-username-${password.id}`}
                          title="Copy username"
                        >
                          {copiedId === `${password.id}-username`
                            ? <CheckCircle className="w-4 h-4 text-primary" />
                            : <User className="w-4 h-4 text-muted-foreground" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => copyPassword(password.password, password.id)}
                          data-testid={`copy-password-${password.id}`}
                          title="Copy password"
                        >
                          {copiedId === password.id
                            ? <CheckCircle className="w-4 h-4 text-primary" />
                            : <Copy className="w-4 h-4 text-muted-foreground" />}
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4 text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                              onClick={() => togglePasswordVisibility(password.id)}
                              data-testid={`reveal-password-${password.id}`}
                            >
                              {isVisible
                                ? <><EyeOff className="w-4 h-4 mr-2" />Hide password</>
                                : <><Eye className="w-4 h-4 mr-2" />Reveal password</>}
                            </DropdownMenuItem>
                            {password.url && (
                              <DropdownMenuItem onClick={() => window.open(password.url, '_blank')}>
                                <Globe className="w-4 h-4 mr-2" />
                                Open site
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleShare(password)}>
                              <Share2 className="w-4 h-4 mr-2" />
                              Share
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setEditingPassword(password)}
                              data-testid={`edit-password-${password.id}`}
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDelete(password.id)}
                              data-testid={`delete-password-${password.id}`}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Revealed password (only when visible) */}
                    {isVisible && (
                      <div className="mt-2.5 px-3 py-2 bg-muted/60 rounded-lg text-[13px] font-mono text-foreground break-all">
                        {password.password}
                      </div>
                    )}

                    {/* Bottom row: strength + last used */}
                    <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-border/40">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${strengthStyle(level)}`}>
                        {level === 'very-strong' ? 'very strong' : level}
                      </span>
                      {lastUsed && (
                        <span className="text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(lastUsed), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </div>
                </BrandCard>
              );
            })}
          </div>
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

      {selectedPassword && (
        <ShareModal
          open={showShareModal}
          onOpenChange={setShowShareModal}
          password={selectedPassword}
        />
      )}

      {/* Templates Modal */}
      <Dialog open={showTemplatesModal} onOpenChange={setShowTemplatesModal}>
        <DialogContent className="max-w-lg max-h-[80svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutTemplate className="w-5 h-5" />
              Password Templates
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-4">
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
          </div>
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
