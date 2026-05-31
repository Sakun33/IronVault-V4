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
        isSuspended
          ? "bg-red-500/15 text-red-300"
          : "bg-emerald-500/15 text-emerald-300"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isSuspended ? "bg-red-400" : "bg-emerald-400"
        }`}
      />
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

export default function UsersPage() {
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput, 350);
  const [plan, setPlan] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null);
  const qc = useQueryClient();

  useEffect(() => setPage(1), [search, plan, status]);

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
      api<{ success: boolean; status: string }>(
        `/api/admin/users/${id}/block`,
        { method: "POST", body: JSON.stringify({ action }) }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-analytics"] });
      qc.invalidateQueries({ queryKey: ["admin-user-detail"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api<{ success: boolean }>(`/api/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-analytics"] });
      setConfirmDelete(null);
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${data.total.toLocaleString()} total users` : "Loading…"}
          </p>
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

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
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
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              )}
              {error && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-destructive">
                    {(error as Error).message}
                  </td>
                </tr>
              )}
              {data && data.users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    No users match these filters.
                  </td>
                </tr>
              )}
              {data?.users.map((u) => (
                <tr key={u.id} className="hover:bg-accent/30">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setDetailId(u.id)}
                      className="flex items-center gap-3 text-left"
                    >
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
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {fmt(u.created_at)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {fmt(u.last_active_at)}
                  </td>
                  <td className="relative px-4 py-3 text-right">
                    <button
                      onClick={() =>
                        setOpenMenu((cur) => (cur === u.id ? null : u.id))
                      }
                      className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {openMenu === u.id && (
                      <>
                        <div
                          className="fixed inset-0 z-30"
                          onClick={() => setOpenMenu(null)}
                        />
                        <div className="absolute right-3 top-10 z-40 w-44 overflow-hidden rounded-md border border-border bg-popover text-sm shadow-lg">
                          <button
                            onClick={() => {
                              setOpenMenu(null);
                              setDetailId(u.id);
                            }}
                            className="block w-full px-3 py-2 text-left hover:bg-accent"
                          >
                            View details
                          </button>
                          <button
                            onClick={() => {
                              setOpenMenu(null);
                              blockMutation.mutate({
                                id: u.id,
                                action: u.status === "suspended" ? "unblock" : "block",
                              });
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent"
                          >
                            {u.status === "suspended" ? (
                              <>
                                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                Unsuspend
                              </>
                            ) : (
                              <>
                                <Ban className="h-4 w-4 text-amber-400" />
                                Suspend
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setOpenMenu(null);
                              setConfirmDelete(u);
                            }}
                            className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
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

      {detailId && (
        <UserDetailDrawer
          id={detailId}
          onClose={() => setDetailId(null)}
          onBlock={(action) => blockMutation.mutate({ id: detailId, action })}
          onDelete={(row) => {
            setDetailId(null);
            setConfirmDelete(row);
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmDeleteModal
          user={confirmDelete}
          loading={deleteMutation.isPending}
          error={(deleteMutation.error as Error | null)?.message ?? null}
          onClose={() => {
            if (!deleteMutation.isPending) setConfirmDelete(null);
          }}
          onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
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
}: {
  id: string;
  onClose: () => void;
  onBlock: (action: "block" | "unblock") => void;
  onDelete: (row: UserRow) => void;
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
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent"
          >
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
                <button
                  onClick={() => onBlock(data.status === "suspended" ? "unblock" : "block")}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-md text-sm font-medium ${
                    data.status === "suspended"
                      ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                      : "bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
                  }`}
                >
                  {data.status === "suspended" ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" /> Unsuspend
                    </>
                  ) : (
                    <>
                      <Ban className="h-4 w-4" /> Suspend
                    </>
                  )}
                </button>
                <button
                  onClick={() => onDelete(data)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-red-500/15 text-sm font-medium text-red-300 hover:bg-red-500/25"
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
              This will permanently remove <strong>{user.email}</strong> and all
              their cloud vaults, tickets, notes, and entitlements. This cannot be undone.
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
          <button
            disabled={loading}
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
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
