import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Copy, Share2, Shield, Clock, Check, ExternalLink } from 'lucide-react';
import { createShareLink, type SharePayload } from '@/lib/share-link';

interface ShareItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Short human-readable name shown in the modal header and stored as the
   *  server-side label (search/listing). Never decrypts. */
  itemLabel: string;
  /** Kind hint surfaced to the recipient — e.g. "wifi", "license", "wallet". */
  itemKind?: SharePayload['itemKind'];
  /** The payload to encrypt and share. Any JSON-serialisable object. The
   *  recipient sees this verbatim after decrypting with the URL fragment key. */
  data: unknown;
  /** Optional sender label (e.g. account email) merged into the payload. */
  sharedBy?: string;
}

const TTL_OPTIONS = [
  { value: String(60 * 60),         label: '1 hour'   },
  { value: String(24 * 60 * 60),    label: '24 hours' },
  { value: String(7 * 24 * 60 * 60),label: '7 days'   },
];

const VIEW_OPTIONS = [
  { value: '1',  label: 'One-time view' },
  { value: '3',  label: 'Up to 3 views' },
  { value: '10', label: 'Up to 10 views' },
];

export function ShareItemModal({
  open, onOpenChange, itemLabel, itemKind, data, sharedBy,
}: ShareItemModalProps) {
  const { toast } = useToast();
  const [ttl, setTtl] = useState(String(24 * 60 * 60));
  const [maxViews, setMaxViews] = useState('1');
  const [link, setLink] = useState('');
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCreate() {
    setCreating(true);
    try {
      const merged = sharedBy ? { ...(data as object), sharedBy } : data;
      const result = await createShareLink(
        { itemLabel, itemKind, data: merged },
        { maxViews: Number(maxViews), ttlSeconds: Number(ttl) },
      );
      if (!result.ok) {
        toast({ title: 'Could not create share', description: result.error, variant: 'destructive' });
        return;
      }
      setLink(result.link.url);
    } catch (e: any) {
      toast({ title: 'Could not create share', description: e?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  }

  function copyLink() {
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      toast({ variant: 'success', title: 'Link copied' });
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function reset() {
    setLink('');
    setTtl(String(24 * 60 * 60));
    setMaxViews('1');
    setCopied(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-4 h-4" /> Share securely
          </DialogTitle>
          <DialogDescription>
            Creates an encrypted link. The decryption key never touches our servers — it lives only in the URL fragment.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border/60 bg-card p-3">
          <div className="text-xs text-muted-foreground">Sharing</div>
          <div className="font-medium truncate">{itemLabel}</div>
          {itemKind && <div className="text-[11px] text-muted-foreground uppercase tracking-wider mt-0.5">{itemKind}</div>}
        </div>

        {!link ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Expires after</Label>
              <Select value={ttl} onValueChange={setTtl}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TTL_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> View limit</Label>
              <Select value={maxViews} onValueChange={setMaxViews}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VIEW_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                <Shield className="w-3 h-3 mt-0.5 shrink-0" />
                <span>Link becomes invalid once view limit is hit or TTL expires.</span>
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Share link</Label>
            <div className="flex gap-2">
              <Input value={link} readOnly className="font-mono text-xs" />
              <Button size="icon" variant="secondary" onClick={copyLink} aria-label="Copy">
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Send this link via your normal channel (Signal, WhatsApp, email). Anyone with the full URL can view the contents until the view limit or expiry.
            </p>
            <a href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
              Preview link <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        <DialogFooter className="gap-2">
          {!link ? (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? 'Creating…' : 'Create link'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={reset}>Create another</Button>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
