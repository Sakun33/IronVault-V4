import { useState, useMemo } from 'react';
import { useVault } from '@/contexts/vault-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, Search, Users, Mail, Crown, User, Baby, Activity } from 'lucide-react';
import type { FamilyMember } from '@shared/schema';
import { PageHero } from '@/components/page-hero';
import { apiBase } from '@/native/platform';
import { getCloudToken } from '@/lib/cloud-vault-sync';

async function sendFamilyInviteEmail(inviteeEmail: string): Promise<{ ok: boolean; error?: string }> {
  const token = getCloudToken();
  if (!token) return { ok: false, error: 'Not signed in to cloud' };
  try {
    const res = await fetch(`${apiBase()}/api/crm/family-invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ inviteeEmail }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (data as any).error || `HTTP ${res.status}` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error' };
  }
}

const ROLE_ICON = { admin: Crown, adult: User, child: Baby };
const ROLE_COLOR: Record<string, string> = {
  admin: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  adult: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  child: 'bg-sky-500/15 text-sky-300 border-sky-500/25',
};
const STATUS_COLOR: Record<string, string> = {
  invited:   'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
  active:    'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  suspended: 'bg-red-500/15 text-red-300 border-red-500/25',
};

function defaultPermsFor(role: FamilyMember['role']): FamilyMember['permissions'] {
  if (role === 'admin') {
    return { canViewPasswords: true, canEditPasswords: true, canAddItems: true, canDeleteItems: true, canExport: true };
  }
  if (role === 'adult') {
    return { canViewPasswords: true, canEditPasswords: false, canAddItems: true, canDeleteItems: false, canExport: false };
  }
  return { canViewPasswords: true, canEditPasswords: false, canAddItems: false, canDeleteItems: false, canExport: false };
}

function initials(name: string): string {
  return name.split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toUpperCase();
}

function blank(): Omit<FamilyMember, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: '',
    email: '',
    role: 'adult',
    sharedVaults: [],
    permissions: defaultPermsFor('adult'),
    status: 'invited',
    joinedAt: new Date().toISOString(),
    lastActive: undefined,
  };
}

export default function FamilyDashboardPage() {
  const { familyMembers, addFamilyMember, updateFamilyMember, deleteFamilyMember } = useVault();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<FamilyMember | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(blank());
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return familyMembers;
    return familyMembers.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q)
    );
  }, [familyMembers, query]);

  const counts = useMemo(() => ({
    total: familyMembers.length,
    active: familyMembers.filter(m => m.status === 'active').length,
    invited: familyMembers.filter(m => m.status === 'invited').length,
  }), [familyMembers]);

  const openInvite = () => { setEditing(null); setForm(blank()); setIsOpen(true); };
  const openEdit = (m: FamilyMember) => {
    setEditing(m);
    setForm({
      name: m.name, email: m.email, role: m.role,
      sharedVaults: m.sharedVaults || [], permissions: m.permissions,
      status: m.status, joinedAt: m.joinedAt, lastActive: m.lastActive,
      avatarUrl: m.avatarUrl,
    });
    setIsOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast({ title: 'Name and email required', variant: 'destructive' });
      return;
    }
    try {
      if (editing) {
        await updateFamilyMember(editing.id, form);
        toast({ title: 'Member updated', variant: 'success' });
      } else {
        await addFamilyMember(form);
        const inviteEmail = form.email.trim().toLowerCase();
        const emailResult = await sendFamilyInviteEmail(inviteEmail);
        if (emailResult.ok) {
          toast({
            title: 'Invitation sent',
            description: `An invite email has been sent to ${inviteEmail}.`,
            variant: 'success',
          });
        } else {
          toast({
            title: 'Member added — email not sent',
            description: emailResult.error || 'Could not send invite email. They can still be added manually.',
            variant: 'destructive',
          });
        }
      }
      setIsOpen(false);
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    }
  };

  const removeMember = async () => {
    if (!confirmRemoveId) return;
    try {
      await deleteFamilyMember(confirmRemoveId);
      toast({ title: 'Member removed', variant: 'success' });
    } finally { setConfirmRemoveId(null); }
  };

  if (familyMembers.length === 0) {
    return (
      <div className="px-6 py-10 max-w-3xl mx-auto">
        <PageHero
          icon={Users}
          title="Family Dashboard"
          subtitle="Share password categories with family members, manage permissions per person, and keep parental controls in one place."
          accent="emerald"
          badges={[{ label: 'Role-based access' }, { label: 'Parental controls' }]}
          cta={{ label: 'Invite member', onClick: openInvite, icon: Plus }}
        />
        <InviteDialog isOpen={isOpen} setIsOpen={setIsOpen} editing={editing} form={form} setForm={setForm} submit={submit} />
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 py-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Family</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {counts.total} member{counts.total === 1 ? '' : 's'} · {counts.active} active · {counts.invited} invited
          </p>
        </div>
        <Button onClick={openInvite} className="gap-2"><Plus className="w-4 h-4" /> Invite</Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search members…" className="pl-9" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(m => {
          const Icon = ROLE_ICON[m.role] || User;
          return (
            <Card key={m.id} className="rounded-2xl border bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-xl border-black/[0.08] dark:border-white/[0.08] shadow-none">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0 text-white font-bold">
                    {m.avatarUrl ? <img src={m.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover" /> : initials(m.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{m.name}</div>
                    <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                      <Mail className="w-3 h-3" /> {m.email}
                    </div>
                    <div className="flex gap-1 mt-2 flex-wrap">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider border flex items-center gap-1 ${ROLE_COLOR[m.role]}`}>
                        <Icon className="w-2.5 h-2.5" /> {m.role}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider border ${STATUS_COLOR[m.status]}`}>{m.status}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(m)} title="Edit"><Edit className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setConfirmRemoveId(m.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    {m.lastActive ? `Active ${new Date(m.lastActive).toLocaleDateString()}` : 'Never active'}
                  </span>
                  <span>{(Object.values(m.permissions).filter(Boolean) as boolean[]).length}/5 perms</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <InviteDialog isOpen={isOpen} setIsOpen={setIsOpen} editing={editing} form={form} setForm={setForm} submit={submit} />

      <AlertDialog open={!!confirmRemoveId} onOpenChange={(o) => !o && setConfirmRemoveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>This member will lose access to any shared vaults.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={removeMember} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InviteDialog(props: {
  isOpen: boolean; setIsOpen: (v: boolean) => void;
  editing: FamilyMember | null;
  form: ReturnType<typeof blank>; setForm: (v: ReturnType<typeof blank>) => void;
  submit: (e: React.FormEvent) => Promise<void>;
}) {
  const { isOpen, setIsOpen, editing, form, setForm, submit } = props;
  const setRole = (role: FamilyMember['role']) => {
    setForm({ ...form, role, permissions: defaultPermsFor(role) });
  };
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? 'Edit member' : 'Invite family member'}</DialogTitle></DialogHeader>
        <DialogBody>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required autoFocus />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div>
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v: any) => setRole(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="adult">Adult</SelectItem>
                    <SelectItem value="child">Child</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invited">Invited</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="border-t border-border/40 pt-3 space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Permissions</Label>
              {[
                ['canViewPasswords', 'View passwords'],
                ['canEditPasswords', 'Edit passwords'],
                ['canAddItems', 'Add items'],
                ['canDeleteItems', 'Delete items'],
                ['canExport', 'Export vault'],
              ].map(([k, label]) => (
                <div key={k} className="flex items-center justify-between">
                  <span className="text-sm">{label}</span>
                  <Switch
                    checked={(form.permissions as any)[k]}
                    onCheckedChange={(v) => setForm({ ...form, permissions: { ...form.permissions, [k]: v } })}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button type="submit">{editing ? 'Save' : 'Send invite'}</Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
