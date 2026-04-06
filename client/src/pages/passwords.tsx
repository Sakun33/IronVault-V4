import { useState, useMemo } from 'react';
import { useSubscription } from '@/hooks/use-subscription';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Copy, Edit, Trash2, Eye, EyeOff, Search, Share2, Lock, Globe, LayoutTemplate, Mail, CreditCard, Smartphone, Gamepad2, ShoppingBag, Building2, Plane, Heart, GraduationCap } from 'lucide-react';
import { useVault } from '@/contexts/vault-context';
import { useToast } from '@/hooks/use-toast';
import { PASSWORD_CATEGORIES } from '@shared/schema';
import { PasswordGenerator } from '@/lib/password-generator';
import { AddPasswordModal } from '@/components/add-password-modal';
import { Favicon } from '@/components/favicon';
import { ShareModal } from '@/components/share-modal';
import { VerifyAccessModal } from '@/components/verify-access-modal';
import { format } from 'date-fns';

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

  // Password Templates - More practical with pre-filled URLs
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
    { id: 'router', name: 'Router Admin', icon: Globe, category: 'Network', fields: { name: 'Router Admin', username: 'admin', url: 'http://192.168.1.1' } },
  ];

  const handleUseTemplate = (template: typeof PASSWORD_TEMPLATES[0]) => {
    setEditingPassword({
      ...template.fields,
      category: template.category,
      isTemplate: true,
    });
    setShowTemplatesModal(false);
    setShowAddModal(true);
  };

  // Filter and search passwords
  const filteredPasswords = useMemo(() => {
    return passwords.filter(password => {
      // Search filter
      const matchesSearch = searchQuery === '' || 
        password.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        password.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        password.url?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        password.category?.toLowerCase().includes(searchQuery.toLowerCase());

      // Category filter
      const matchesCategory = categoryFilter === 'all' || 
        password.category === categoryFilter;

      // Strength filter
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
      toast({
        title: "Copied",
        description: "Password copied to clipboard",
      });
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy password",
        variant: "destructive",
      });
    }
  };

  const copyUsername = async (username: string, id: string) => {
    try {
      await navigator.clipboard.writeText(username);
      setCopiedId(`${id}-username`);
      toast({
        title: "Copied",
        description: "Username copied to clipboard",
      });
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy username",
        variant: "destructive",
      });
    }
  };

  const togglePasswordVisibility = (id: string) => {
    // If already visible, just hide it
    if (visiblePasswords.has(id)) {
      const newVisible = new Set(visiblePasswords);
      newVisible.delete(id);
      setVisiblePasswords(newVisible);
      return;
    }
    
    // If not verified yet, require verification
    if (!isVerified) {
      setPendingRevealId(id);
      setShowVerifyModal(true);
      return;
    }
    
    // Already verified, show the password
    const newVisible = new Set(visiblePasswords);
    newVisible.add(id);
    setVisiblePasswords(newVisible);
  };

  const handleVerified = () => {
    setIsVerified(true);
    if (pendingRevealId) {
      const newVisible = new Set(visiblePasswords);
      newVisible.add(pendingRevealId);
      setVisiblePasswords(newVisible);
      setPendingRevealId(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePassword(id);
      toast({
        title: "Deleted",
        description: "Password deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete password",
        variant: "destructive",
      });
    }
  };

  const handleShare = (password: any) => {
    setSelectedPassword(password);
    setShowShareModal(true);
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
              <span className="text-xs text-muted-foreground">
                {passwords.length}/{getLimit('passwords')}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTemplatesModal(true)}
              className="rounded-xl"
            >
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
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
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
          <div className="space-y-3">
            {filteredPasswords.map((password) => {
              const { level, score } = PasswordGenerator.calculateStrength(password.password);
              const isVisible = visiblePasswords.has(password.id);
              
              return (
                <Card key={password.id} className="rounded-2xl shadow-sm border-border/40 bg-card hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5" data-testid={`password-row-${password.id}`}>
                  <CardContent className="p-4 space-y-3">
                    {/* Header Row - Name and Actions */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                          <Favicon url={password.url} name={password.name} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-foreground text-sm truncate">
                            {password.name}
                          </h3>
                          <Badge 
                            variant={level === 'weak' ? 'destructive' : level === 'medium' ? 'secondary' : 'default'}
                            className="text-[10px] mt-1"
                          >
                            {level}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => setEditingPassword(password)} className="h-8 w-8" data-testid={`edit-password-${password.id}`}>
                          <Edit className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(password.id)} className="h-8 w-8 text-red-500" data-testid={`delete-password-${password.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Username Row */}
                    <div className="bg-muted/50 rounded-lg p-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Username</p>
                          <p className="text-sm text-foreground font-mono break-all">
                            {password.username}
                          </p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); copyUsername(password.username, password.id); }} className="h-8 w-8 shrink-0">
                          <Copy className={`w-4 h-4 ${copiedId === `${password.id}-username` ? 'text-primary' : 'text-muted-foreground'}`} />
                        </Button>
                      </div>
                    </div>

                    {/* Password Row */}
                    <div className="bg-muted/50 rounded-lg p-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Password</p>
                          <p className="text-sm text-foreground font-mono break-all">
                            {isVisible ? password.password : '••••••••••••'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon" onClick={() => togglePasswordVisibility(password.id)} className="h-8 w-8" data-testid={`reveal-password-${password.id}`}>
                            {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => copyPassword(password.password, password.id)} className="h-8 w-8" data-testid={`copy-password-${password.id}`}>
                            <Copy className={`w-4 h-4 ${copiedId === password.id ? 'text-primary' : 'text-muted-foreground'}`} />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* URL and Share */}
                    {password.url && (
                      <div className="flex items-center justify-between gap-2">
                        <button onClick={() => password.url && window.open(password.url, '_blank')} className="text-xs text-primary hover:underline truncate flex-1 text-left">
                          {password.url}
                        </button>
                        <Button variant="ghost" size="icon" onClick={() => handleShare(password)} className="h-8 w-8 shrink-0">
                          <Share2 className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
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
          if (!open) {
            setShowAddModal(false);
            setEditingPassword(null);
          } else {
            setShowAddModal(true);
          }
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
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
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

    </div>
  );
}