import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ChevronLeft, ChevronRight, Filter, ChevronDown, Activity } from "lucide-react";
import { api } from "@/lib/api";

interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_label: string | null;
  details: any;
  ip: string | null;
  created_at: string;
}

interface AuditResponse {
  logs: AuditEntry[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  actions: { action: string; c: number }[];
}

const ACTION_COLORS: Record<string, string> = {
  "user.create": "bg-emerald-500/15 text-emerald-300",
  "user.update": "bg-blue-500/15 text-blue-300",
  "user.delete": "bg-red-500/15 text-red-300",
  "user.change_plan": "bg-purple-500/15 text-purple-300",
  "user.reset_password": "bg-amber-500/15 text-amber-300",
  "user.export_csv": "bg-slate-500/15 text-slate-300",
  "ticket.update": "bg-blue-500/15 text-blue-300",
  "ticket.reply": "bg-emerald-500/15 text-emerald-300",
  "broadcast.send": "bg-purple-500/15 text-purple-300",
  "broadcast.dry_run": "bg-slate-500/15 text-slate-300",
  "admin.password_change_failed": "bg-red-500/15 text-red-300",
  "admin.password_change_initiated": "bg-amber-500/15 text-amber-300",
};

function fmtTs(d: string) {
  return new Date(d).toLocaleString();
}

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("all");
  const [actor, setActor] = useState("");
  const [target, setTarget] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const params = useMemo(() => {
    const sp = new URLSearchParams();
    if (actionFilter !== "all") sp.set("action", actionFilter);
    if (actor) sp.set("actor", actor);
    if (target) sp.set("target", target);
    sp.set("page", String(page));
    sp.set("limit", "50");
    return sp.toString();
  }, [actionFilter, actor, target, page]);

  const { data, isLoading, error } = useQuery<AuditResponse>({
    queryKey: ["admin-audit", params],
    queryFn: () => api<AuditResponse>(`/api/admin/audit-log?${params}`),
    keepPreviousData: true,
  } as any);

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          {data ? `${data.total.toLocaleString()} entries — every admin action is logged.` : "Loading…"}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> Filters
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            <option value="all">All actions</option>
            {data?.actions.map((a) => (
              <option key={a.action} value={a.action}>{a.action} ({a.c})</option>
            ))}
          </select>
          <input value={actor} onChange={(e) => { setActor(e.target.value); setPage(1); }} placeholder="Actor (username)" className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
          <input value={target} onChange={(e) => { setTarget(e.target.value); setPage(1); }} placeholder="Target (email/ID/label)" className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
          <button onClick={() => { setActionFilter("all"); setActor(""); setTarget(""); setPage(1); }} className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm hover:bg-accent">
            Clear filters
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && <div className="p-6 text-sm text-destructive">{(error as Error).message}</div>}
        {data && data.logs.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <Activity className="mx-auto mb-2 h-6 w-6 opacity-50" />
            No entries match these filters.
          </div>
        )}
        <ul className="divide-y divide-border">
          {data?.logs.map((e) => (
            <li key={e.id}>
              <button onClick={() => toggleExpanded(e.id)} className="block w-full px-5 py-3 text-left hover:bg-accent/30">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium font-mono ${ACTION_COLORS[e.action] || "bg-slate-500/15 text-slate-300"}`}>
                      {e.action}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">
                        <span className="font-medium">{e.actor}</span>
                        {e.target_label && <span className="text-muted-foreground"> → </span>}
                        {e.target_label && <span className="font-medium">{e.target_label}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-muted-foreground tabular-nums">{fmtTs(e.created_at)}</span>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expanded.has(e.id) ? "rotate-180" : ""}`} />
                  </div>
                </div>
              </button>
              {expanded.has(e.id) && (
                <div className="border-t border-border bg-background/40 px-5 py-3 text-xs">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <KV label="Target type" value={e.target_type || "—"} />
                    <KV label="Target ID" value={e.target_id || "—"} />
                    <KV label="IP" value={e.ip || "—"} />
                    <KV label="ID" value={e.id} />
                  </div>
                  {e.details && (
                    <pre className="mt-3 max-h-64 overflow-auto rounded-md border border-border bg-background p-2 font-mono text-[11px] leading-relaxed">
                      {JSON.stringify(e.details, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>

        {data && data.pages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
            <div className="text-muted-foreground">
              Page {data.page} of {data.pages} · {data.total.toLocaleString()} entries
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
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="break-all font-mono text-xs">{value}</div>
    </div>
  );
}
