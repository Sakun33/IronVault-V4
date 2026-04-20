import { useState, useMemo } from 'react';
import { useSubscription } from '@/hooks/use-subscription';
import { UpgradeGate } from '@/components/upgrade-gate';
import { useVault } from '@/contexts/vault-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandCard } from '@/components/brand-card';

const envBrandColor = (env: string) => {
  if (env === 'production') return '#ef4444';
  if (env === 'staging') return '#f59e0b';
  return '#3b82f6';
};
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { POPULAR_API_SERVICES } from '@/lib/popular-services';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Key, 
  Eye, 
  EyeOff, 
  Copy, 
  Check,
  Shield,
  Lock,
  AlertCircle,
  Search,
  Code
} from 'lucide-react';
import { format } from 'date-fns';
import { VerifyAccessModal } from '@/components/verify-access-modal';

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

export default function APIKeys() {
  const { isFeatureAvailable, isLoading: licenseLoading } = useSubscription();
  const { apiKeys, addApiKey, updateApiKey, deleteApiKey } = useVault();

  const { toast } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [editingKey, setEditingKey] = useState<APIKey | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEnv, setSelectedEnv] = useState<string>('all');
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [pendingRevealId, setPendingRevealId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    service: '',
    apiKey: '',
    apiSecret: '',
    environment: 'production' as 'development' | 'staging' | 'production',
    category: '',
    endpoint: '',
    accessToken: '',
    refreshToken: '',
    clientId: '',
    clientSecret: '',
    projectId: '',
    expiresAt: '',
    notes: '',
    tags: [] as string[],
  });

  const handleAddKey = async () => {
    if (!formData.name || !formData.service || !formData.apiKey) {
      toast({
        title: "Error",
        description: "Name, service, and API key are required",
        variant: "destructive",
      });
      return;
    }

    const newKey: APIKey = {
      id: crypto.randomUUID(),
      ...formData,
      expiresAt: formData.expiresAt ? new Date(formData.expiresAt) : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await addApiKey(newKey);

    setFormData({
      name: '',
      service: '',
      apiKey: '',
      apiSecret: '',
      environment: 'production',
      category: '',
      endpoint: '',
      accessToken: '',
      refreshToken: '',
      clientId: '',
      clientSecret: '',
      projectId: '',
      expiresAt: '',
      notes: '',
      tags: [],
    });
    setShowAddModal(false);

    toast({
      title: "Success",
      description: "API key added successfully",
    });
  };

  const handleUpdateKey = async () => {
    if (!editingKey || !formData.name || !formData.service || !formData.apiKey) {
      toast({
        title: "Error",
        description: "Name, service, and API key are required",
        variant: "destructive",
      });
      return;
    }

    const updates = {
      ...formData,
      expiresAt: formData.expiresAt ? new Date(formData.expiresAt) : undefined,
    };

    await updateApiKey(editingKey.id, updates);

    setEditingKey(null);
    setShowAddModal(false);
    setFormData({
      name: '',
      service: '',
      apiKey: '',
      apiSecret: '',
      environment: 'production',
      category: '',
      endpoint: '',
      accessToken: '',
      refreshToken: '',
      clientId: '',
      clientSecret: '',
      projectId: '',
      expiresAt: '',
      notes: '',
      tags: [],
    });

    toast({
      title: "Success",
      description: "API key updated successfully",
    });
  };

  const handleDeleteKey = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      await deleteApiKey(id);
      toast({
        title: "Deleted",
        description: "API key deleted successfully",
      });
    }
  };

  const handleEditKey = (key: APIKey) => {
    setEditingKey(key);
    setFormData({
      name: key.name,
      service: key.service,
      apiKey: key.apiKey,
      apiSecret: key.apiSecret || '',
      environment: key.environment,
      category: key.category || '',
      endpoint: key.endpoint || '',
      accessToken: key.accessToken || '',
      refreshToken: key.refreshToken || '',
      clientId: key.clientId || '',
      clientSecret: key.clientSecret || '',
      projectId: key.projectId || '',
      expiresAt: key.expiresAt ? key.expiresAt.toISOString().split('T')[0] : '',
      notes: key.notes || '',
      tags: [...key.tags],
    });
    setShowAddModal(true);
  };

  const toggleReveal = (id: string) => {
    // If already visible, just hide it
    if (revealedKeys.has(id)) {
      const newRevealed = new Set(revealedKeys);
      newRevealed.delete(id);
      setRevealedKeys(newRevealed);
      return;
    }
    
    // If not unlocked, require verification
    if (!isUnlocked) {
      setPendingRevealId(id);
      setShowVerifyModal(true);
      return;
    }
    
    // Already unlocked, show the key
    const newRevealed = new Set(revealedKeys);
    newRevealed.add(id);
    setRevealedKeys(newRevealed);
  };

  const handleVerified = () => {
    setIsUnlocked(true);
    if (pendingRevealId) {
      const newRevealed = new Set(revealedKeys);
      newRevealed.add(pendingRevealId);
      setRevealedKeys(newRevealed);
      setPendingRevealId(null);
    }
    
    // Auto-lock after 5 minutes
    setTimeout(() => {
      setIsUnlocked(false);
      setRevealedKeys(new Set());
    }, 5 * 60 * 1000);
  };

  const copyToClipboard = async (text: string, label: string) => {
    if (!isUnlocked) {
      // Require verification before copying sensitive data
      setShowVerifyModal(true);
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(label);
      toast({
        title: "Copied",
        description: `${label} copied to clipboard`,
      });
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const maskKey = (key: string) => {
    if (key.length <= 8) return '••••••••';
    return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4);
  };

  const getEnvBadgeColor = (env: string) => {
    switch (env) {
      case 'production': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'staging': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'development': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const filteredKeys = useMemo(() => {
    return apiKeys.filter(key => {
      const matchesSearch = !searchQuery || 
        key.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        key.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
        key.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesEnv = selectedEnv === 'all' || key.environment === selectedEnv;

      return matchesSearch && matchesEnv;
    });
  }, [apiKeys, searchQuery, selectedEnv]);

  if (!isUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="w-5 h-5" />
              API Keys Vault
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center space-y-2">
              <Lock className="w-10 h-10 mx-auto text-muted-foreground" />
              <h3 className="font-semibold text-foreground">Vault Locked</h3>
              <p className="text-sm text-muted-foreground">
                Verify your identity to access API keys
              </p>
            </div>

            <Button onClick={() => setShowVerifyModal(true)} className="w-full">
              <Lock className="w-4 h-4 mr-2" />
              Unlock Vault
            </Button>

            <div className="flex items-start gap-2 p-3 bg-primary/10 rounded-lg border border-primary/30">
              <AlertCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                API keys are encrypted and require your master password or biometric verification to access. 
                The vault will auto-lock after 5 minutes of inactivity.
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

  return (
    <div className="space-y-6 p-4 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold flex items-center gap-2 text-foreground">
            <Key className="w-5 h-5" />
            API Keys
          </h1>
          <p className="text-muted-foreground text-sm">
            Secure API key storage
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setIsUnlocked(false);
              setRevealedKeys(new Set());
              toast({ title: "Locked", description: "API Keys vault locked" });
            }}
            className="h-9 w-9"
            title="Lock Vault"
          >
            <Lock className="w-4 h-4" />
          </Button>
          <Button size="icon" onClick={() => setShowAddModal(true)} className="h-9 w-9" title="Add API Key">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search API keys..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={selectedEnv}
              onChange={(e) => setSelectedEnv(e.target.value)}
              className="px-3 py-2 border rounded-md bg-background text-sm"
            >
              <option value="all">All Categories</option>
              <option value="development">Development</option>
              <option value="staging">Staging</option>
              <option value="production">Production</option>
              <option value="ai">AI Services</option>
              <option value="cloud">Cloud Providers</option>
              <option value="database">Database</option>
              <option value="payment">Payment Gateway</option>
              <option value="social">Social Media</option>
              <option value="analytics">Analytics</option>
              <option value="communication">Communication</option>
              <option value="storage">Storage</option>
              <option value="authentication">Authentication</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="text-sm text-muted-foreground">
            {filteredKeys.length} API key{filteredKeys.length !== 1 ? 's' : ''}
          </div>
        </CardContent>
      </Card>

      {/* API Keys Grid */}
      {filteredKeys.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Code className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No API Keys</h3>
            <p className="text-muted-foreground text-center mb-4">
              {apiKeys.length === 0 
                ? "Get started by adding your first API key"
                : "No API keys match your search criteria"
              }
            </p>
            {apiKeys.length === 0 && (
              <Button onClick={() => setShowAddModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First API Key
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {filteredKeys.map(key => (
            <BrandCard key={key.id} name={key.service || key.name} brandColor={envBrandColor(key.environment)}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{key.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{key.service}</p>
                  </div>
                  <Badge className={getEnvBadgeColor(key.environment)}>
                    {key.environment}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* API Key */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">API Key</Label>
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                    <code className="flex-1 text-xs font-mono truncate">
                      {revealedKeys.has(key.id) ? key.apiKey : maskKey(key.apiKey)}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => toggleReveal(key.id)}
                    >
                      {revealedKeys.has(key.id) ? (
                        <EyeOff className="w-3 h-3" />
                      ) : (
                        <Eye className="w-3 h-3" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => copyToClipboard(key.apiKey, 'API Key')}
                    >
                      {copiedField === 'API Key' ? (
                        <Check className="w-3 h-3 text-primary" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* API Secret (if exists) */}
                {key.apiSecret && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">API Secret</Label>
                    <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                      <code className="flex-1 text-xs font-mono truncate">
                        {revealedKeys.has(key.id) ? key.apiSecret : maskKey(key.apiSecret)}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => copyToClipboard(key.apiSecret!, 'API Secret')}
                      >
                        {copiedField === 'API Secret' ? (
                          <Check className="w-3 h-3 text-primary" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xs text-muted-foreground">
                    Updated {format(key.updatedAt, 'MMM d, yyyy')}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handleEditKey(key)}
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                      onClick={() => handleDeleteKey(key.id, key.name)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </BrandCard>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingKey ? 'Edit' : 'Add'} API Key</DialogTitle>
          </DialogHeader>

          <div className="space-y-4" onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); (editingKey ? handleUpdateKey : handleAddKey)(); } }}>
            <div>
              <Label htmlFor="service">Service *</Label>
              <Input
                id="service"
                placeholder="e.g., Stripe, AWS, OpenAI"
                value={formData.service}
                onChange={(e) => setFormData(prev => ({ ...prev, service: e.target.value, name: e.target.value ? `${e.target.value} Key` : prev.name }))}
                className=""
              />
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {POPULAR_API_SERVICES.slice(0, 10).map(svc => (
                  <button
                    key={svc}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, service: svc, name: `${svc} Key` }))}
                    className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${formData.service === svc ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60 bg-muted/40 hover:bg-muted text-foreground'}`}
                  >
                    {svc}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Stripe Production Key"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className=""
              />
            </div>

            <div>
              <Label htmlFor="apiKey">API Key *</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="Enter API key"
                value={formData.apiKey}
                onChange={(e) => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
                className=""
              />
            </div>

            <div>
              <Label htmlFor="apiSecret">API Secret (Optional)</Label>
              <Input
                id="apiSecret"
                type="password"
                placeholder="Enter API secret if applicable"
                value={formData.apiSecret}
                onChange={(e) => setFormData(prev => ({ ...prev, apiSecret: e.target.value }))}
                className=""
              />
            </div>

            <div>
              <Label htmlFor="environment">Environment *</Label>
              <select
                id="environment"
                value={formData.environment}
                onChange={(e) => setFormData(prev => ({ ...prev, environment: e.target.value as any }))}
                className="w-full px-3 py-2 border rounded-md bg-background text-foreground border-border"
              >
                <option value="development">Development</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </select>
            </div>

            <div>
              <Label htmlFor="notes" className="text-foreground">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes about this API key..."
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="min-h-20 text-foreground"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                className=""
                onClick={() => {
                  setShowAddModal(false);
                  setEditingKey(null);
                  setFormData({
                    name: '',
                    service: '',
                    apiKey: '',
                    apiSecret: '',
                    environment: 'production',
                    category: '',
                    endpoint: '',
                    accessToken: '',
                    refreshToken: '',
                    clientId: '',
                    clientSecret: '',
                    projectId: '',
                    expiresAt: '',
                    notes: '',
                    tags: [],
                  });
                }}
              >
                Cancel
              </Button>
              <Button onClick={editingKey ? handleUpdateKey : handleAddKey}>
                {editingKey ? 'Update' : 'Add'} API Key
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <VerifyAccessModal
        open={showVerifyModal}
        onOpenChange={setShowVerifyModal}
        onVerified={handleVerified}
        title="Reveal API Key"
        description="Verify your identity to view API key details."
      />
    </div>
  );
}

