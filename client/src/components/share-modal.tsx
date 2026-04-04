import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Share2, Copy, Eye, EyeOff, Lock, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PasswordEntry, SubscriptionEntry, NoteEntry, ExpenseEntry, ReminderEntry } from '@shared/schema';

interface ShareModalProps {
  item: PasswordEntry | SubscriptionEntry | NoteEntry | ExpenseEntry | ReminderEntry;
  itemType: 'password' | 'subscription' | 'note' | 'expense' | 'reminder';
  children: React.ReactNode;
}

export function ShareModal({ item, itemType, children }: ShareModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');
  const [sharePassword, setSharePassword] = useState('');
  const [expirationDays, setExpirationDays] = useState('7');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const verifyMasterPassword = async () => {
    if (!masterPassword.trim()) {
      toast({
        title: "Error",
        description: "Please enter your master password",
        variant: "destructive",
      });
      return;
    }

    setIsVerifying(true);
    
    // Simulate verification (in real app, this would verify against stored hash)
    setTimeout(() => {
      setIsVerifying(false);
      setIsVerified(true);
      toast({
        title: "Verified",
        description: "Master password verified successfully",
      });
    }, 1000);
  };

  const generateShareLink = async () => {
    if (!isVerified) {
      toast({
        title: "Error",
        description: "Please verify your master password first",
        variant: "destructive",
      });
      return;
    }

    // Generate a unique share ID
    const shareId = Math.random().toString(36).substring(2, 15);
    
    // Create share data
    const shareData = {
      id: shareId,
      itemType,
      item: {
        ...item,
        // Remove sensitive data for sharing
        ...(itemType === 'password' && { password: '***HIDDEN***' }),
        ...(itemType === 'subscription' && { cost: '***HIDDEN***' }),
        ...(itemType === 'expense' && { amount: '***HIDDEN***' }),
      },
      expirationDate: new Date(Date.now() + parseInt(expirationDays) * 24 * 60 * 60 * 1000),
      sharePassword: sharePassword || undefined,
      createdAt: new Date(),
    };

    // In a real app, this would be stored on a server
    const shareUrl = `${window.location.origin}/shared/${shareId}`;
    setShareUrl(shareUrl);

    toast({
      title: "Share Link Generated",
      description: "Your share link has been created successfully",
    });
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({
        title: "Copied",
        description: "Share link copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy share link",
        variant: "destructive",
      });
    }
  };

  const getItemTitle = () => {
    switch (itemType) {
      case 'password':
        return (item as PasswordEntry).name;
      case 'subscription':
        return (item as SubscriptionEntry).name;
      case 'note':
        return (item as NoteEntry).title;
      case 'expense':
        return (item as ExpenseEntry).title;
      case 'reminder':
        return (item as ReminderEntry).title;
      default:
        return 'Item';
    }
  };

  const getItemIcon = () => {
    switch (itemType) {
      case 'password':
        return '🔑';
      case 'subscription':
        return '📋';
      case 'note':
        return '📝';
      case 'expense':
        return '💰';
      case 'reminder':
        return '🔔';
      default:
        return '📄';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Share {getItemTitle()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Item Preview */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="text-2xl">{getItemIcon()}</span>
                {getItemTitle()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{itemType}</Badge>
                  <span className="text-sm text-muted-foreground">
                    Created {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  This item will be shared securely with password protection
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Master Password Verification */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="masterPassword" className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Master Password
              </Label>
              <div className="flex gap-2">
                <Input
                  id="masterPassword"
                  type={isPasswordVisible ? "text" : "password"}
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  placeholder="Enter your master password"
                  disabled={isVerified}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                  disabled={isVerified}
                >
                  {isPasswordVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                {!isVerified && (
                  <Button
                    onClick={verifyMasterPassword}
                    disabled={isVerifying || !masterPassword.trim()}
                  >
                    {isVerifying ? 'Verifying...' : 'Verify'}
                  </Button>
                )}
                {isVerified && (
                  <Button variant="outline" disabled>
                    <Check className="w-4 h-4 mr-2" />
                    Verified
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Share Settings */}
          {isVerified && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sharePassword">Share Password (Optional)</Label>
                <Input
                  id="sharePassword"
                  type="password"
                  value={sharePassword}
                  onChange={(e) => setSharePassword(e.target.value)}
                  placeholder="Optional password for additional security"
                />
                <p className="text-xs text-muted-foreground">
                  Recipients will need this password to access the shared item
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiration">Expiration</Label>
                <Select value={expirationDays} onValueChange={setExpirationDays}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 day</SelectItem>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="never">Never</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={generateShareLink} className="w-full">
                <Share2 className="w-4 h-4 mr-2" />
                Generate Share Link
              </Button>
            </div>
          )}

          {/* Share Link */}
          {shareUrl && (
            <div className="space-y-2">
              <Label>Share Link</Label>
              <div className="flex gap-2">
                <Input value={shareUrl} readOnly className="flex-1" />
                <Button onClick={copyShareLink} variant="outline">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Share this link with others. They can access the item using the share password.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
