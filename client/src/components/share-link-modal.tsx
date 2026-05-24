import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Copy, Share2, Clock, Eye, Lock } from 'lucide-react';
import { createShareLink, type SharePayload } from '@/lib/share-link';
import { copyToClipboardSecure } from '@/native/clipboard';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: SharePayload | null;
}

const TTL_PRESETS = [
  { label: '1 hour',  seconds: 60 * 60 },
  { label: '24 hours', seconds: 24 * 60 * 60 },
  { label: '7 days',   seconds: 7 * 24 * 60 * 60 },
  { label: '30 days',  seconds: 30 * 24 * 60 * 60 },
];
const VIEW_PRESETS = [1, 3, 5, 10];

export function ShareLinkModal({ open, onOpenChange, payload }: Props) {
  const { toast } = useToast();
  const [ttl, setTtl] = useState(TTL_PRESETS[1].seconds);
  const [maxViews, setMaxViews] = useState(1);
  const [creating, setCreating] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  const create = async () => {
    if (!payload) return;
    setCreating(true);
    try {
      const r = await createShareLink(payload, { ttlSeconds: ttl, maxViews });
      if (!r.ok) {
        toast({ title: 'Could not create link', description: r.error, variant: 'destructive' });
        return;
      }
      setLink(r.link.url);
      toast({ title: 'Link ready', description: `Expires ${new Date(r.link.expiresAt).toLocaleString()}` });
    } finally {
      setCreating(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    const ok = await copyToClipboardSecure(link);
    toast({ title: ok ? 'Link copied' : 'Copy failed', variant: ok ? 'success' : 'destructive' });
  };

  const close = () => {
    setLink(null);
    setTtl(TTL_PRESETS[1].seconds);
    setMaxViews(1);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => o ? onOpenChange(o) : close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" /> Share {payload?.itemLabel || 'item'}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          {!link ? (
            <div className="space-y-4">
              <div className="rounded-xl border bg-emerald-500/5 border-emerald-500/20 px-3 py-2 flex items-start gap-2">
                <Lock className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Encrypted on this device. The decryption key lives only in the URL fragment — our server can never see your data.
                </p>
              </div>
              <div>
                <Label className="flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground">
                  <Clock className="w-3 h-3" /> Link expires after
                </Label>
                <div className="grid grid-cols-4 gap-1 mt-1.5">
                  {TTL_PRESETS.map(p => (
                    <Button
                      key={p.seconds}
                      variant={ttl === p.seconds ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTtl(p.seconds)}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground">
                  <Eye className="w-3 h-3" /> Self-destruct after
                </Label>
                <div className="grid grid-cols-4 gap-1 mt-1.5">
                  {VIEW_PRESETS.map(n => (
                    <Button
                      key={n}
                      variant={maxViews === n ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setMaxViews(n)}
                    >
                      {n} view{n === 1 ? '' : 's'}
                    </Button>
                  ))}
                </div>
              </div>
              <Button onClick={create} disabled={creating || !payload} className="w-full gap-2">
                <Share2 className="w-4 h-4" /> {creating ? 'Creating…' : 'Create share link'}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm">Send this link. It will <strong>self-destruct after {maxViews} view{maxViews === 1 ? '' : 's'}</strong>.</p>
              <div className="flex gap-2">
                <Input value={link} readOnly className="font-mono text-xs" />
                <Button onClick={copy}><Copy className="w-4 h-4" /></Button>
              </div>
              <Button variant="outline" onClick={close} className="w-full">Done</Button>
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
