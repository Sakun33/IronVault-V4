import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Ban,
  CheckCircle2,
  Trash2,
  Mail,
  Globe,
  Database,
  X,
  Loader2,
  Plus,
  Pencil,
  KeyRound,
  ArrowUpRight,
  Download,
  Send,
} from "lucide-react";
import { api } from "@/lib/api";

interface UserRow {
  id: string;
  email: string;
  name: string;
  country: string | null;
  platform: string | null;
  status: string;
  created_at: string;
  last_active_at: string | null;
  has_vault: boolean;
  plan: string;
  vault_count: number;
}

interface UsersResponse {
  users: UserRow[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

interface UserDetail extends UserRow {
  phone: string | null;
  vault_created_at: string | null;
  plan_status: string;
  admin_override: boolean;
}

const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  family: "Family",
  lifetime: "Lifetime",
};

const PLAN_BADGE: Record<string, string> = {
  free: "bg-slate-500/15 text-slate-300",
  pro: "bg-blue-500/15 text-blue-300",
  family: "bg-purple-500/15 text-purple-300",
  lifetime: "bg-amber-500/15 text-amber-300",
};

function PlanBadge({ plan }: { plan: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        PLAN_BADGE[plan] || PLAN_BADGE.free
      }`}
    >
      {PLAN_LABEL[plan] || plan}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isSuspended = status === "suspended";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        isSuspended ? "bg-red-500/15 text-red-300" : "bg-emerald-500/15 text-emerald-300"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isSuspended ? "bg-red-400" : "bg-emerald-400"}`} />
      {isSuspended ? "Suspended" : "Active"}
    </span>
  );
}

function fmt(d: string | null | undefined) {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function getToken(): string | null {
  return localStorage.getItem("admin_token");
}

export default function UsersPage() {
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput, 350);
  const [plan, setPlan] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [planChangeUser, setPlanChangeUser] = useState<UserRow | null>(null);
  const [resetPwUser, setResetPwUser] = useState<UserRow | null>(null);
  const [bulkAction, setBulkAction] = useState<null | "delete" | "block" | "unblock" | "change_plan" | "email">(null);
  const [toast, setToast] = useState<string | null>(null);
  const qc = useQueryClient();

  useEffect(() => setPage(1), [search, plan, status]);
  useEffect(() => setSelected(new Set()), [page, search, plan, status]);

  const params = useMemo(() => {
    const sp = new URLSearchParams();
    if (search) sp.set("search", search);
    if (plan !== "all") sp.set("plan", plan);
    if (status !== "all") sp.set("status", status);
    sp.set("page", String(page));
    sp.set("limit", "25");
    return sp.toString();
  }, [search, plan, status, page]);

  const { data, isLoading, error } = useQuery<UsersResponse>({
    queryKey: ["admin-users", params],
    queryFn: () => api<UsersResponse>(`/api/admin/users?${params}`),
    keepPreviousData: true,
  } as any);

  const blockMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "block" | "unblock" }) =>
      api<{ success: boolean; status: string }>(`/api/admin/users/${id}/block`, {
        method: "POST",
        body: JSON.stringify({ action }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-analytics"] });
      qc.invalidateQueries({ queryKey: ["admin-user-detail"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api<{ success: boolean }>(`/api/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-analytics"] });
      setConfirmDelete(null);
    },
  });

  const resetPwMutation = useMutation({
    mutationFn: (id: string) =>
      api<{ success: boolean; delivered: boolean; email: string }>(`/api/admin/users/${id}/reset-password`, {
        method: "POST",
      }),
    onSuccess: (r) => {
      setToast(r.delivered ? `Password reset email sent to ${r.email}` : `Reset queued for ${r.email} (email not delivered)`);
      setResetPwUser(null);
      setTimeout(() => setToast(null), 4000);
    },
    onError: (e: any) => {
      setToast(`Failed: ${e?.message || "unknown"}`);
      setTimeout(() => setToast(null), 4000);
    },
  });

  const allOnPage = data?.users.map((u) => u.id) || [];
  const allChecked = allOnPage.length > 0 && allOnPage.every((id) => selected.has(id));
  const someChecked = allOnPage.some((id) => selected.has(id)) && !allChecked;

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) allOnPage.forEach((id) => next.delete(id));
      else allOnPage.forEach((id) => next.add(id));
      return next;
    });
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function downloadCsv() {
    const sp = new URLSearchParams();
    if (search) sp.set("search", search);
    if (plan !== "all") sp.set("plan", plan);
    if (status !== "all") sp.set("status", status);
    const url = `/api/admin/users/export?${sp.toString()}`;
    const tok = getToken();
    const res = await fetch(url, { headers: tok ? { Authorization: `Bearer ${tok}` } : {} });
    if (!res.ok) {
      setToast(`Export failed: ${res.statusText}`);
      setTimeout(() => setToast(null), 4000);
      return;
    }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    setToast("CSV download started");
    setTimeout(() => setToast(null), 2500);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${data.total.toLocaleString()} total users` : "Loading…"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={downloadCsv}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Create user
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by email or name"
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All plans</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="family">Family</option>
          <option value="lifetime">Lifetime</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
          <div className="text-sm font-medium text-primary">
            {selected.size} selected
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setBulkAction("change_plan")} className="inline-flex h-8 items-center gap-1 rounded-md border border-primary/40 bg-background px-3 text-xs font-medium hover:bg-accent">
              <ArrowUpRight className="h-3.5 w-3.5" /> Change plan
            </button>
            <button onClick={() => setBulkAction("email")} className="inline-flex h-8 items-center gap-1 rounded-md border border-primary/40 bg-background px-3 text-xs font-medium hover:bg-accent">
              <Send className="h-3.5 w-3.5" /> Email
            </button>
            <button onClick={() => setBulkAction("block")} className="inline-flex h-8 items-center gap-1 rounded-md border border-amber-400/40 bg-background px-3 text-xs font-medium text-amber-300 hover:bg-accent">
              <Ban className="h-3.5 w-3.5" /> Suspend
            </button>
            <button onClick={() => setBulkAction("unblock")} className="inline-flex h-8 items-center gap-1 rounded-md border border-emerald-400/40 bg-background px-3 text-xs font-medium text-emerald-300 hover:bg-accent">
              <CheckCircle2 className="h-3.5 w-3.5" /> Unsuspend
            </button>
            <button onClick={() => setBulkAction("delete")} className="inline-flex h-8 items-center gap-1 rounded-md border border-red-400/40 bg-background px-3 text-xs font-medium text-red-300 hover:bg-accent">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
            <button onClick={() => setSelected(new Set())} className="text-xs text-muted-foreground hover:text-foreground">
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(el) => {
                      if (el) el.indeterminate = someChecked;
                    }}
                    onChange={toggleAll}
                    className="h-4 w-4 cursor-pointer accent-primary"
                  />
                </th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Vaults</th>
                <th className="px-4 py-3 font-medium">Signed up</th>
                <th className="px-4 py-3 font-medium">Last active</th>
                <th className="w-12 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              )}
              {error && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-destructive">
                    {(error as Error).message}
                  </td>
                </tr>
              )}
              {data && data.users.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    No users match these filters.
                  </td>
                </tr>
              )}
              {data?.users.map((u) => (
                <tr key={u.id} className={`hover:bg-accent/30 ${selected.has(u.id) ? "bg-primary/5" : ""}`}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(u.id)}
                      onChange={() => toggleOne(u.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 cursor-pointer accent-primary"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setDetailId(u.id)} className="flex items-center gap-3 text-left">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold uppercase text-primary">
                        {(u.name || u.email).slice(0, 1)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">{u.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                      </div>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <PlanBadge plan={u.plan} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="px-4 py-3 tabular-nums">{u.vault_count}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{fmt(u.created_at)}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{fmt(u.last_active_at)}</td>
                  <td className="relative px-4 py-3 text-right">
                    <button
                      onClick={() => setOpenMenu((cur) => (cur === u.id ? null : u.id))}
                      className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {openMenu === u.id && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={() => setOpenMenu(null)} />
                        <div className="absolute right-3 top-10 z-40 w-48 overflow-hidden rounded-md border border-border bg-popover text-sm shadow-lg">
                          <button onClick={() => { setOpenMenu(null); setDetailId(u.id); }} className="block w-full px-3 py-2 text-left hover:bg-accent">
                            View details
                          </button>
                          <button onClick={() => { setOpenMenu(null); setEditUser(u); }} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent">
                            <Pencil className="h-4 w-4 text-muted-foreground" /> Edit
                          </button>
                          <button onClick={() => { setOpenMenu(null); setPlanChangeUser(u); }} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent">
                            <ArrowUpRight className="h-4 w-4 text-blue-400" /> Change plan
                          </button>
                          <button onClick={() => { setOpenMenu(null); setResetPwUser(u); }} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent">
                            <KeyRound className="h-4 w-4 text-amber-400" /> Reset password
                          </button>
                          <button
                            onClick={() => {
                              setOpenMenu(null);
                              blockMutation.mutate({ id: u.id, action: u.status === "suspended" ? "unblock" : "block" });
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent"
                          >
                            {u.status === "suspended" ? (
                              <><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Unsuspend</>
                            ) : (
                              <><Ban className="h-4 w-4 text-amber-400" /> Suspend</>
                            )}
                          </button>
                          <button
                            onClick={() => { setOpenMenu(null); setConfirmDelete(u); }}
                            className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" /> Delete
                          </button>
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data && data.pages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
            <div className="text-muted-foreground">
              Page {data.page} of {data.pages} · {data.total.toLocaleString()} users
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-background px-2 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-accent"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>
              <button
                disabled={page >= data.pages}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-background px-2 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-accent"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border border-border bg-card px-4 py-3 text-sm shadow-lg">
          {toast}
        </div>
      )}

      {detailId && (
        <UserDetailDrawer
          id={detailId}
          onClose={() => setDetailId(null)}
          onBlock={(action) => blockMutation.mutate({ id: detailId, action })}
          onDelete={(row) => { setDetailId(null); setConfirmDelete(row); }}
          onEdit={(row) => { setDetailId(null); setEditUser(row); }}
          onChangePlan={(row) => { setDetailId(null); setPlanChangeUser(row); }}
          onResetPassword={(row) => { setDetailId(null); setResetPwUser(row); }}
        />
      )}

      {confirmDelete && (
        <ConfirmDeleteModal
          user={confirmDelete}
          loading={deleteMutation.isPending}
          error={(deleteMutation.error as Error | null)?.message ?? null}
          onClose={() => { if (!deleteMutation.isPending) setConfirmDelete(null); }}
          onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
        />
      )}

      {createOpen && (
        <CreateEditDialog
          mode="create"
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            qc.invalidateQueries({ queryKey: ["admin-users"] });
            setToast("User created");
            setTimeout(() => setToast(null), 3000);
          }}
        />
      )}

      {editUser && (
        <CreateEditDialog
          mode="edit"
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={() => {
            setEditUser(null);
            qc.invalidateQueries({ queryKey: ["admin-users"] });
            qc.invalidateQueries({ queryKey: ["admin-user-detail"] });
            setToast("User updated");
            setTimeout(() => setToast(null), 3000);
          }}
        />
      )}

      {planChangeUser && (
        <ChangePlanDialog
          user={planChangeUser}
          onClose={() => setPlanChangeUser(null)}
          onSaved={() => {
            setPlanChangeUser(null);
            qc.invalidateQueries({ queryKey: ["admin-users"] });
            qc.invalidateQueries({ queryKey: ["admin-user-detail"] });
            setToast("Plan changed");
            setTimeout(() => setToast(null), 3000);
          }}
        />
      )}

      {resetPwUser && (
        <ResetPasswordDialog
          user={resetPwUser}
          loading={resetPwMutation.isPending}
          onCancel={() => setResetPwUser(null)}
          onConfirm={() => resetPwMutation.mutate(resetPwUser.id)}
        />
      )}

      {bulkAction && (
        <BulkActionDialog
          action={bulkAction}
          ids={Array.from(selected)}
          onClose={() => setBulkAction(null)}
          onSuccess={(summary) => {
            setBulkAction(null);
            setSelected(new Set());
            qc.invalidateQueries({ queryKey: ["admin-users"] });
            setToast(summary);
            setTimeout(() => setToast(null), 4000);
          }}
        />
      )}
    </div>
  );
}

function UserDetailDrawer({
  id,
  onClose,
  onBlock,
  onDelete,
  onEdit,
  onChangePlan,
  onResetPassword,
}: {
  id: string;
  onClose: () => void;
  onBlock: (action: "block" | "unblock") => void;
  onDelete: (row: UserRow) => void;
  onEdit: (row: UserRow) => void;
  onChangePlan: (row: UserRow) => void;
  onResetPassword: (row: UserRow) => void;
}) {
  const { data, isLoading, error } = useQuery<UserDetail>({
    queryKey: ["admin-user-detail", id],
    queryFn: () => api<UserDetail>(`/api/admin/users/${id}`),
  });

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <aside className="relative ml-auto h-full w-full max-w-md overflow-y-auto border-l border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="text-base font-semibold">User details</div>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">
          {isLoading && (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {(error as Error).message}
            </div>
          )}
          {data && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-base font-semibold uppercase text-primary">
                  {(data.name || data.email).slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold">{data.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{data.email}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <PlanBadge plan={data.plan} />
                <StatusBadge status={data.status} />
                {data.admin_override && (
                  <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300">
                    Admin override
                  </span>
                )}
              </div>

              <dl className="space-y-3 rounded-lg border border-border bg-background/40 p-4 text-sm">
                <Row icon={Mail} label="Email" value={data.email} />
                <Row icon={Globe} label="Country" value={data.country || "—"} />
                <Row icon={Database} label="Cloud vaults" value={String(data.vault_count)} />
                <Row label="Platform" value={data.platform || "web"} />
                <Row label="Plan status" value={data.plan_status} />
                <Row label="Signed up" value={fmt(data.created_at)} />
                <Row label="Last active" value={fmt(data.last_active_at)} />
                <Row label="Vault created" value={fmt(data.vault_created_at)} />
                {data.phone && <Row label="Phone" value={data.phone} />}
              </dl>

              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => onEdit(data)} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent">
                  <Pencil className="h-4 w-4" /> Edit
                </button>
                <button onClick={() => onChangePlan(data)} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-500/15 text-sm font-medium text-blue-300 hover:bg-blue-500/25">
                  <ArrowUpRight className="h-4 w-4" /> Change plan
                </button>
                <button onClick={() => onResetPassword(data)} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-amber-500/15 text-sm font-medium text-amber-300 hover:bg-amber-500/25">
                  <KeyRound className="h-4 w-4" /> Reset password
                </button>
                <button
                  onClick={() => onBlock(data.status === "suspended" ? "unblock" : "block")}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-md text-sm font-medium ${
                    data.status === "suspended"
                      ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                      : "bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
                  }`}
                >
                  {data.status === "suspended" ? (
                    <><CheckCircle2 className="h-4 w-4" /> Unsuspend</>
                  ) : (
                    <><Ban className="h-4 w-4" /> Suspend</>
                  )}
                </button>
                <button
                  onClick={() => onDelete(data)}
                  className="col-span-2 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-red-500/15 text-sm font-medium text-red-300 hover:bg-red-500/25"
                >
                  <Trash2 className="h-4 w-4" /> Delete user
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <dt className="flex w-32 shrink-0 items-center gap-2 text-xs text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </dt>
      <dd className="min-w-0 flex-1 break-words text-sm">{value}</dd>
    </div>
  );
}

function ConfirmDeleteModal({
  user,
  loading,
  error,
  onClose,
  onConfirm,
}: {
  user: UserRow;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const canDelete = confirmText.trim().toLowerCase() === "delete";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-400">
            <Trash2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold">Delete this user?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This will permanently remove <strong>{user.email}</strong> and all their cloud vaults, tickets, notes, and entitlements. This cannot be undone.
            </p>
          </div>
        </div>
        <div className="mt-5">
          <label className="text-xs font-medium text-muted-foreground">
            Type <code className="rounded bg-muted px-1 py-0.5 text-foreground">delete</code> to confirm
          </label>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoFocus
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {error && (
          <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
            {error}
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button disabled={loading} onClick={onClose} className="inline-flex h-10 items-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent disabled:opacity-50">
            Cancel
          </button>
          <button
            disabled={!canDelete || loading}
            onClick={onConfirm}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete user
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateEditDialog({
  mode,
  user,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  user?: UserRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [email, setEmail] = useState(user?.email || "");
  const [name, setName] = useState(user?.name || "");
  const [country, setCountry] = useState(user?.country || "");
  const [platform, setPlatform] = useState(user?.platform || "web");
  const [planVal, setPlanVal] = useState(user?.plan || "free");
  const [statusVal, setStatusVal] = useState(user?.status || "active");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const body = { email: email.trim(), full_name: name.trim(), country: country.trim() || "US", platform, plan: planVal, status: statusVal };
      if (mode === "create") {
        await api(`/api/admin/users`, { method: "POST", body: JSON.stringify(body) });
      } else {
        await api(`/api/admin/users/${user!.id}`, { method: "PUT", body: JSON.stringify(body) });
      }
      onSaved();
    } catch (e: any) {
      setErr(e?.message || "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{mode === "create" ? "Create user" : "Edit user"}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          <Field label="Email" required>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={mode === "edit"} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60" />
          </Field>
          <Field label="Full name">
            <input value={name} onChange={(e) => setName(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Country (ISO-2)">
              <input value={country} onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 2))} placeholder="US" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </Field>
            <Field label="Platform">
              <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="web">Web</option>
                <option value="ios">iOS</option>
                <option value="android">Android</option>
                <option value="extension">Extension</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Plan">
              <select value={planVal} onChange={(e) => setPlanVal(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="family">Family</option>
                <option value="lifetime">Lifetime</option>
              </select>
            </Field>
            <Field label="Status">
              <select value={statusVal} onChange={(e) => setStatusVal(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </Field>
          </div>
        </div>
        {err && (
          <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{err}</div>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} disabled={saving} className="inline-flex h-10 items-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent disabled:opacity-50">
            Cancel
          </button>
          <button onClick={save} disabled={saving || !email.trim()} className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "create" ? "Create user" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

function ChangePlanDialog({ user, onClose, onSaved }: { user: UserRow; onClose: () => void; onSaved: () => void }) {
  const [newPlan, setNewPlan] = useState(user.plan);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      await api(`/api/admin/users/${user.id}/change-plan`, {
        method: "POST",
        body: JSON.stringify({ plan: newPlan, reason }),
      });
      onSaved();
    } catch (e: any) {
      setErr(e?.message || "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
        <h2 className="text-base font-semibold">Change plan</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          <strong>{user.email}</strong> · current: <PlanBadge plan={user.plan} />
        </p>
        <div className="mt-4 space-y-3">
          <Field label="New plan">
            <select value={newPlan} onChange={(e) => setNewPlan(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="family">Family</option>
              <option value="lifetime">Lifetime</option>
            </select>
          </Field>
          <Field label="Reason (audit log)">
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Refund issued, comp account, support escalation..." className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </Field>
        </div>
        {err && (
          <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{err}</div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} disabled={saving} className="inline-flex h-10 items-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent disabled:opacity-50">
            Cancel
          </button>
          <button onClick={save} disabled={saving || newPlan === user.plan} className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Change plan
          </button>
        </div>
      </div>
    </div>
  );
}

function ResetPasswordDialog({
  user,
  loading,
  onCancel,
  onConfirm,
}: {
  user: UserRow;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Send password reset email?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              An email will be sent to <strong>{user.email}</strong> with instructions to reset their account password. This action is audit-logged.
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} disabled={loading} className="inline-flex h-10 items-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-md bg-amber-600 px-4 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Send reset email
          </button>
        </div>
      </div>
    </div>
  );
}

function BulkActionDialog({
  action,
  ids,
  onClose,
  onSuccess,
}: {
  action: "delete" | "block" | "unblock" | "change_plan" | "email";
  ids: string[];
  onClose: () => void;
  onSuccess: (summary: string) => void;
}) {
  const [planVal, setPlanVal] = useState("free");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const label =
    action === "delete" ? "Delete users" :
    action === "block" ? "Suspend users" :
    action === "unblock" ? "Unsuspend users" :
    action === "change_plan" ? "Change plan" : "Send email";

  async function run() {
    setSaving(true);
    setErr(null);
    try {
      const payload: any = { action, ids };
      if (action === "change_plan") payload.plan = planVal;
      if (action === "email") { payload.subject = subject; payload.body = body; }
      const r = await api<{ ok: number; failed: number }>(`/api/admin/users/bulk`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      onSuccess(`${label}: ${r.ok} succeeded, ${r.failed} failed`);
    } catch (e: any) {
      setErr(e?.message || "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl">
        <h2 className="text-base font-semibold">{label}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{ids.length} user{ids.length === 1 ? "" : "s"} selected</p>
        {action === "change_plan" && (
          <div className="mt-4">
            <Field label="New plan">
              <select value={planVal} onChange={(e) => setPlanVal(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="family">Family</option>
                <option value="lifetime">Lifetime</option>
              </select>
            </Field>
          </div>
        )}
        {action === "email" && (
          <div className="mt-4 space-y-3">
            <Field label="Subject" required>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
            </Field>
            <Field label="Body (HTML allowed)" required>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </Field>
          </div>
        )}
        {action === "delete" && (
          <div className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            This will permanently delete {ids.length} user{ids.length === 1 ? "" : "s"} along with their vaults, tickets, notes, and entitlements. This cannot be undone.
          </div>
        )}
        {err && (
          <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{err}</div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} disabled={saving} className="inline-flex h-10 items-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={run}
            disabled={saving || (action === "email" && (!subject.trim() || !body.trim()))}
            className={`inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-medium text-white disabled:opacity-50 ${action === "delete" ? "bg-red-600 hover:bg-red-500" : "bg-primary hover:bg-primary/90"}`}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} {label}
          </button>
        </div>
      </div>
    </div>
  );
}
