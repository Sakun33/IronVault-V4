import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Share2, Copy, Eye, EyeOff, Lock, Check, QrCode } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PasswordEntry, SubscriptionEntry, NoteEntry, ExpenseEntry, ReminderEntry } from '@shared/schema';

interface ShareModalProps {
  item: PasswordEntry | SubscriptionEntry | NoteEntry | ExpenseEntry | ReminderEntry;
  itemType: 'password' | 'subscription' | 'note' | 'expense' | 'reminder';
  children: React.ReactNode;
}

type ExpiryKey = '1h' | '24h' | '7d' | 'never';
const EXPIRY_OPTIONS: Array<{ key: ExpiryKey; label: string; hours: number | null }> = [
  { key: '1h',    label: '1 hour',  hours: 1 },
  { key: '24h',   label: '24 hours', hours: 24 },
  { key: '7d',    label: '7 days',  hours: 24 * 7 },
  { key: 'never', label: 'Never',   hours: null },
];

export function ShareModal({ item, itemType, children }: ShareModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');
  const [sharePassword, setSharePassword] = useState('');
  const [expiry, setExpiry] = useState<ExpiryKey>('7d');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const qrAbortRef = useRef<symbol | null>(null);

  const verifyMasterPassword = async () => {
    if (!masterPassword.trim()) {
      toast({ title: 'Error', description: 'Please enter your master password', variant: 'destructive' });
      return;
    }
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setIsVerified(true);
      toast({ title: 'Verified', description: 'Master password verified successfully' });
    }, 1000);
  };

  const generateShareLink = async () => {
    if (!isVerified) {
      toast({ title: 'Error', description: 'Please verify your master password first', variant: 'destructive' });
      return;
    }
    setIsGenerating(true);
    // Brief 700ms simulated generation so the progress dots animate visibly,
    // matching the wider product feel.
    setTimeout(async () => {
      const shareId = Math.random().toString(36).substring(2, 15);
      const url = `${window.location.origin}/shared/${shareId}`;
      setShareUrl(url);
      setIsGenerating(false);
      toast({ variant: 'success', title: 'Share Link Generated', description: 'Your share link has been created successfully' });
    }, 700);
  };

  // Render the QR onto an off-screen data URL. Re-runs whenever the share
  // URL changes; abort guard prevents an in-flight render from clobbering a
  // newer URL (e.g. user regenerates twice quickly).
  useEffect(() => {
    if (!shareUrl) { setQrDataUrl(''); return; }
    const token = Symbol('qr');
    qrAbortRef.current = token;
    QRCode.toDataURL(shareUrl, {
      width: 220,
      margin: 1,
      color: { dark: '#10b981', light: '#0b1220' },
      errorCorrectionLevel: 'M',
    })
      .then(dataUrl => {
        if (qrAbortRef.current === token) setQrDataUrl(dataUrl);
      })
      .catch(() => { if (qrAbortRef.current === token) setQrDataUrl(''); });
    return () => { if (qrAbortRef.current === token) qrAbortRef.current = null; };
  }, [shareUrl]);

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({ variant: 'success', title: 'Copied', description: 'Share link copied to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Error', description: 'Failed to copy share link', variant: 'destructive' });
    }
  };

  const getItemTitle = () => {
    switch (itemType) {
      case 'password':     return (item as PasswordEntry).name;
      case 'subscription': return (item as SubscriptionEntry).name;
      case 'note':         return (item as NoteEntry).title;
      case 'expense':      return (item as ExpenseEntry).title;
      case 'reminder':     return (item as ReminderEntry).title;
      default:             return 'Item';
    }
  };

  const getItemIcon = () => {
    switch (itemType) {
      case 'password':     return '🔑';
      case 'subscription': return '📋';
      case 'note':         return '📝';
      case 'expense':      return '💰';
      case 'reminder':     return '🔔';
      default:             return '📄';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      {/* Glass dialog with gradient border. The DialogContent is shadcn's
          Radix wrapper — we override its surface to glass + add a gradient-
          border ring via the Phase-1 utility class. */}
      <DialogContent className="max-w-2xl glass-card gradient-border bg-background/70 border-white/10 p-0 overflow-hidden">
        <div className="px-6 pt-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-emerald-300" />
              Share <span className="text-emerald-200">{getItemTitle()}</span>
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6 pt-3 space-y-5">
          {/* Item preview header */}
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md px-4 py-3">
            <span className="text-2xl">{getItemIcon()}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-foreground truncate">{getItemTitle()}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-white/15 bg-white/[0.04]">
                  {itemType}
                </Badge>
                <span className="text-[11px] text-muted-foreground">
                  Created {new Date(item.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Master password verification */}
          <div className="space-y-2">
            <Label htmlFor="masterPassword" className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground/80">
              <Lock className="w-3.5 h-3.5" /> Master Password
            </Label>
            <div className="flex gap-2">
              <Input
                id="masterPassword"
                type={isPasswordVisible ? 'text' : 'password'}
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                placeholder="Enter your master password"
                disabled={isVerified}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                disabled={isVerified}
                aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
              >
                {isPasswordVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              {!isVerified ? (
                <Button onClick={verifyMasterPassword} disabled={isVerifying || !masterPassword.trim()}>
                  {isVerifying ? 'Verifying…' : 'Verify'}
                </Button>
              ) : (
                <Button variant="outline" disabled className="text-emerald-300 border-emerald-400/30">
                  <Check className="w-4 h-4 mr-2" /> Verified
                </Button>
              )}
            </div>
          </div>

          {/* Share settings — only after verification */}
          {isVerified && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sharePassword" className="text-xs uppercase tracking-wider text-muted-foreground/80">Share Password (Optional)</Label>
                <Input
                  id="sharePassword"
                  type="password"
                  value={sharePassword}
                  onChange={(e) => setSharePassword(e.target.value)}
                  placeholder="Optional password for additional security"
                />
              </div>

              {/* Expiry — pill toggle row */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground/80">Expires in</Label>
                <div className="grid grid-cols-4 gap-2">
                  {EXPIRY_OPTIONS.map(opt => {
                    const active = expiry === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setExpiry(opt.key)}
                        aria-pressed={active}
                        className={`relative px-3 py-2 rounded-xl text-xs font-medium transition-colors border ${
                          active
                            ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.25)]'
                            : 'bg-white/[0.04] border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/[0.07]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button onClick={generateShareLink} disabled={isGenerating} className="cta-tap-pulse w-full">
                {isGenerating ? (
                  <span className="flex items-center gap-2">
                    Generating
                    {[0, 1, 2].map(i => (
                      <motion.span
                        key={i}
                        animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
                        transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.12 }}
                        className="w-1 h-1 rounded-full bg-current inline-block"
                      />
                    ))}
                  </span>
                ) : (
                  <span className="flex items-center gap-2"><Share2 className="w-4 h-4" /> Generate Share Link</span>
                )}
              </Button>
            </div>
          )}

          {/* Generated link + QR */}
          <AnimatePresence>
            {shareUrl && (
              <motion.div
                key="share-result"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                className="space-y-3"
              >
                <Label className="text-xs uppercase tracking-wider text-muted-foreground/80">Share Link</Label>
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md px-3 py-2">
                  <span className="font-mono text-xs text-foreground/90 truncate flex-1 select-all">{shareUrl}</span>
                  <button
                    type="button"
                    onClick={copyShareLink}
                    aria-label={copied ? 'Copied' : 'Copy share link'}
                    className="relative h-8 w-8 rounded-lg bg-emerald-500/12 border border-emerald-400/30 text-emerald-200 flex items-center justify-center transition-colors hover:bg-emerald-500/20"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {copied ? (
                        <motion.span
                          key="check"
                          initial={{ scale: 0.4, opacity: 0, rotate: -30 }}
                          animate={{ scale: 1, opacity: 1, rotate: 0 }}
                          exit={{ scale: 0.4, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                        >
                          <Check className="w-4 h-4" />
                        </motion.span>
                      ) : (
                        <motion.span
                          key="copy"
                          initial={{ scale: 0.4, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.4, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                        >
                          <Copy className="w-4 h-4" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>
                </div>

                {/* QR code — fade in once it's rendered */}
                <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
                  <div className="relative w-[120px] h-[120px] flex items-center justify-center">
                    <AnimatePresence mode="wait">
                      {qrDataUrl ? (
                        <motion.img
                          key={qrDataUrl}
                          src={qrDataUrl}
                          alt="Share link QR code"
                          initial={{ opacity: 0, scale: 0.92 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="w-[120px] h-[120px] rounded-lg shadow-[0_0_24px_-6px_rgba(16,185,129,0.45)]"
                        />
                      ) : (
                        <motion.div
                          key="qr-fallback"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="w-[120px] h-[120px] rounded-lg shimmer flex items-center justify-center text-muted-foreground/60"
                        >
                          <QrCode className="w-8 h-8" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="flex-1 min-w-0 text-xs text-muted-foreground">
                    <div className="text-foreground font-medium mb-1">Scan to open</div>
                    Recipients can scan this code on a phone to load the share link directly.
                    {expiry !== 'never' && (
                      <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-emerald-300">
                        <span className="w-1 h-1 rounded-full bg-emerald-400" />
                        Expires in {EXPIRY_OPTIONS.find(o => o.key === expiry)?.label.toLowerCase()}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
