import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Copy, Share2, Shield, Clock, Check, ExternalLink } from 'lucide-react';
import { CryptoService } from '@/lib/crypto';
import { apiBase } from '@/native/platform';
import { getCloudToken } from '@/lib/cloud-vault-sync';
import type { PasswordEntry } from '@shared/schema';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  password: PasswordEntry | null;
  sharedBy?: string;
}

const TTL_OPTIONS = [
  { value: '1', label: '1 hour' },
  { value: '24', label: '24 hours' },
  { value: '168', label: '7 days' },
];

function uint8ToUrlSafeB64(b: Uint8Array): string {
  return CryptoService.uint8ArrayToBase64(b)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function SharePasswordModal({ open, onOpenChange, password, sharedBy }: Props) {
  const { toast } = useToast();
  const [ttl, setTtl] = useState('24');
  const [link, setLink] = useState('');
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  async function createLink() {
    if (!password) return;
    setCreating(true);
    try {
      const token = getCloudToken();
      if (!token) throw new Error('Not signed in to cloud — sign in to create share links.');

      // Generate a random AES-256 key client-side. The key NEVER hits the
      // server: it's encoded into the URL fragment, which browsers do not
      // transmit in HTTP requests. The server only stores ciphertext.
      const rawKey = crypto.getRandomValues(new Uint8Array(32));
      const key = await crypto.subtle.importKey(
        'raw', rawKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt']
      );
      const payload = JSON.stringify({
        name: password.name,
        username: password.username,
        password: password.password,
        url: password.url,
        sharedBy,
      });
      const { encrypted, iv } = await CryptoService.encrypt(payload, key);

      const res = await fetch(`${apiBase()}/api/share/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          data: {
            v: 2,
            ct: CryptoService.uint8ArrayToBase64(encrypted),
            iv: CryptoService.uint8ArrayToBase64(iv),
          },
          expiresIn: Number(ttl),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.link) throw new Error(data.error || 'Server rejected the share request');

      const fragKey = uint8ToUrlSafeB64(rawKey);
      setLink(`${data.link}#k=${fragKey}`);
    } catch (e: any) {
      toast({ title: 'Could not create share', description: e.message, variant: 'destructive' });
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
    setTtl('24');
    setCopied(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-4 h-4" /> Share password securely
          </DialogTitle>
          <DialogDescription>
            Creates a one-time encrypted link. The decryption key never touches our servers — it lives only in the URL.
          </DialogDescription>
        </DialogHeader>

        {password && (
          <div className="rounded-lg border border-border/60 bg-card p-3">
            <div className="text-xs text-muted-foreground">Sharing</div>
            <div className="font-medium truncate">{password.name}</div>
            {password.username && <div className="text-xs text-muted-foreground truncate">{password.username}</div>}
          </div>
        )}

        {!link ? (
          <>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Expires after</Label>
              <Select value={ttl} onValueChange={setTtl}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TTL_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                <Shield className="w-3 h-3 mt-0.5 shrink-0" />
                <span>Single-use: the link becomes invalid the moment someone opens it, even before the timer runs out.</span>
              </p>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <Label>Share link</Label>
            <div className="flex gap-2">
              <Input value={link} readOnly className="font-mono text-xs" data-testid="share-link-input" />
              <Button size="icon" variant="secondary" onClick={copyLink} aria-label="Copy">
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Send this link via your normal channel (Signal, WhatsApp, email). Anyone with the full URL can view the password once.
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
              <Button onClick={createLink} disabled={creating || !password} data-testid="share-create-link">
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
