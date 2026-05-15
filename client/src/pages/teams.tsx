// Teams page — list, create, invite, manage shared vaults.
//
// Available to any signed-in user; the "Team" / "Business" plan tier gates
// per-seat pricing and SSO/audit-log features. Free users can still create a
// team but the API will start rejecting writes once a plan-enforcement
// middleware is added.

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, Plus, Mail, Trash2, Database, Shield, Crown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSubscription } from '@/hooks/use-subscription';
import { FeaturePreview } from '@/components/feature-preview';
import {
  listTeams,
  createTeam,
  inviteMember,
  removeMember,
  listMembers,
  listSharedVaults,
  createSharedVault,
  type Team,
  type TeamMember,
  type SharedVault,
} from '@/lib/teams-api';

export default function TeamsPage() {
  const { toast } = useToast();
  const { isPro, isLoading: planLoading } = useSubscription();
  // Free-plan paywall — gate the whole page behind the soft-paywall preview.
  // The license context may still be loading on first paint; we render
  // nothing rather than flashing the paywall to a paid user.
  if (!planLoading && !isPro) {
    return (
      <FeaturePreview
        feature="Teams & Shared Vaults"
        description="Create teams, invite members, and share encrypted vaults with role-based access."
        bullets={[
          'Invite teammates by email with admin / member / viewer roles',
          'Shared encrypted vaults — credentials accessible only to invited members',
          'Audit log of team activity and member changes',
        ]}
        mock="api-keys"
      />
    );
  }
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [sharedVaults, setSharedVaults] = useState<SharedVault[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [creating, setCreating] = useState(false);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [inviting, setInviting] = useState(false);

  const [showSharedVault, setShowSharedVault] = useState(false);
  const [sharedVaultName, setSharedVaultName] = useState('');
  const [creatingVault, setCreatingVault] = useState(false);

  const activeTeam = teams.find(t => t.id === activeTeamId) || null;
  const isAdmin = activeTeam?.role === 'owner' || activeTeam?.role === 'admin';

  const loadTeams = async () => {
    setLoading(true);
    try {
      const list = await listTeams();
      setTeams(list);
      if (list.length > 0 && !activeTeamId) {
        setActiveTeamId(list[0].id);
      }
    } catch (e: any) {
      toast({ title: 'Could not load teams', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadTeamDetails = async (teamId: string) => {
    try {
      const [m, sv] = await Promise.all([listMembers(teamId), listSharedVaults(teamId)]);
      setMembers(m);
      setSharedVaults(sv);
    } catch (e: any) {
      toast({ title: 'Could not load team details', description: e.message, variant: 'destructive' });
    }
  };

  useEffect(() => { loadTeams(); }, []);
  useEffect(() => {
    if (activeTeamId) loadTeamDetails(activeTeamId);
  }, [activeTeamId]);

  const handleCreate = async () => {
    if (!newTeamName.trim()) return;
    setCreating(true);
    try {
      const team = await createTeam(newTeamName.trim());
      setShowCreate(false);
      setNewTeamName('');
      await loadTeams();
      setActiveTeamId(team.id);
      toast({ title: 'Team created', description: team.name });
    } catch (e: any) {
      toast({ title: 'Could not create team', description: e.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleInvite = async () => {
    if (!activeTeamId || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      await inviteMember(activeTeamId, inviteEmail.trim(), inviteRole);
      setShowInvite(false);
      setInviteEmail('');
      setInviteRole('member');
      await loadTeamDetails(activeTeamId);
      toast({ title: 'Invite sent', description: inviteEmail });
    } catch (e: any) {
      toast({ title: 'Could not invite', description: e.message, variant: 'destructive' });
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (email: string) => {
    if (!activeTeamId) return;
    if (!confirm(`Remove ${email} from team?`)) return;
    try {
      await removeMember(activeTeamId, email);
      await loadTeamDetails(activeTeamId);
      toast({ title: 'Member removed', description: email });
    } catch (e: any) {
      toast({ title: 'Could not remove', description: e.message, variant: 'destructive' });
    }
  };

  const handleCreateSharedVault = async () => {
    if (!activeTeamId || !sharedVaultName.trim()) return;
    setCreatingVault(true);
    try {
      await createSharedVault(activeTeamId, sharedVaultName.trim());
      setShowSharedVault(false);
      setSharedVaultName('');
      await loadTeamDetails(activeTeamId);
      toast({ title: 'Shared vault created', description: sharedVaultName });
    } catch (e: any) {
      toast({ title: 'Could not create vault', description: e.message, variant: 'destructive' });
    } finally {
      setCreatingVault(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-5xl space-y-6" data-testid="teams-page">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Teams
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Collaborate on shared vaults with role-based access.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} data-testid="create-team">
          <Plus className="w-4 h-4 mr-2" />
          New Team
        </Button>
      </header>

      {loading ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Loading…</CardContent></Card>
      ) : teams.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h2 className="font-semibold mb-1">No teams yet</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Create a team to start sharing vaults with colleagues.
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create your first team
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-[260px,1fr]">
          {/* Team list */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Your Teams</CardTitle></CardHeader>
            <CardContent className="p-2 space-y-1">
              {teams.map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTeamId(t.id)}
                  className={`w-full text-left p-2 rounded-lg hover:bg-muted ${activeTeamId === t.id ? 'bg-muted ring-1 ring-primary/30' : ''}`}
                  data-testid={`team-${t.id}`}
                >
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-sm flex-1 truncate">{t.name}</span>
                    {t.role === 'owner' && <Crown className="w-3 h-3 text-amber-500" />}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 capitalize">{t.role}</div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Active team detail */}
          <div className="space-y-4">
            {activeTeam && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{activeTeam.name}</span>
                      <Badge variant="outline" className="capitalize">{activeTeam.plan}</Badge>
                    </CardTitle>
                  </CardHeader>
                </Card>

                {/* Members */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Members ({members.length})
                      </CardTitle>
                      {isAdmin && (
                        <Button size="sm" onClick={() => setShowInvite(true)} data-testid="invite-member">
                          <Mail className="w-3.5 h-3.5 mr-1.5" />
                          Invite
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {members.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No members yet.</p>
                    ) : (
                      members.map(m => (
                        <div key={m.email} className="flex items-center gap-2 p-2 rounded-lg border border-border">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{m.email}</div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="capitalize">{m.role}</span>
                              <span>·</span>
                              <span className={m.status === 'active' ? 'text-green-600' : 'text-amber-600'}>
                                {m.status}
                              </span>
                            </div>
                          </div>
                          {isAdmin && m.role !== 'owner' && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleRemove(m.email)}
                              data-testid={`remove-${m.email}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* Shared Vaults */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Shared Vaults ({sharedVaults.length})
                      </CardTitle>
                      {isAdmin && (
                        <Button size="sm" onClick={() => setShowSharedVault(true)} data-testid="create-shared-vault">
                          <Plus className="w-3.5 h-3.5 mr-1.5" />
                          New Vault
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {sharedVaults.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No shared vaults yet.</p>
                    ) : (
                      sharedVaults.map(v => (
                        <div key={v.id} className="flex items-center gap-2 p-2 rounded-lg border border-border">
                          <Database className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium flex-1 truncate">{v.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(v.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      )}

      {/* Create-team dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Create Team</DialogTitle>
            <DialogDescription>Start collaborating on shared vaults.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="team-name">Team name</Label>
            <Input
              id="team-name"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Acme Inc."
              data-testid="team-name-input"
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !newTeamName.trim()} data-testid="confirm-create-team">
              {creating ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
            <DialogDescription>They'll receive an email invite to join this team.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                data-testid="invite-email-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={inviteRole} onValueChange={(v: any) => setInviteRole(v)}>
                <SelectTrigger id="invite-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin — manage members & vaults</SelectItem>
                  <SelectItem value="member">Member — read & edit shared vaults</SelectItem>
                  <SelectItem value="viewer">Viewer — read-only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()} data-testid="confirm-invite">
              {inviting ? 'Sending…' : 'Send Invite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shared-vault dialog */}
      <Dialog open={showSharedVault} onOpenChange={setShowSharedVault}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>New Shared Vault</DialogTitle>
            <DialogDescription>All team members will have access based on their role.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="shared-vault-name">Vault name</Label>
            <Input
              id="shared-vault-name"
              value={sharedVaultName}
              onChange={(e) => setSharedVaultName(e.target.value)}
              placeholder="Engineering Secrets"
              data-testid="shared-vault-name-input"
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateSharedVault(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSharedVault(false)}>Cancel</Button>
            <Button onClick={handleCreateSharedVault} disabled={creatingVault || !sharedVaultName.trim()} data-testid="confirm-create-shared-vault">
              {creatingVault ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
