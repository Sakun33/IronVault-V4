import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  MessageSquare,
  X,
  Send,
  EyeOff,
  Timer,
  AlertTriangle,
  User,
  Mail,
  Globe,
} from "lucide-react";
import { api } from "@/lib/api";

interface Ticket {
  id: string;
  subject: string;
  description: string | null;
  status: string;
  priority: string;
  customer_email: string;
  customer_name: string | null;
  customer_country: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  assigned_to: string | null;
}

interface TicketReply {
  id: string;
  ticket_id: string;
  author_type: string;
  author_id: string;
  message: string;
  is_internal: boolean;
  created_at: string;
}

interface TicketDetail extends Ticket {
  replies: TicketReply[];
}

interface TicketsResponse {
  tickets: Ticket[];
  counts: Record<string, number>;
  total: number;
}

const STATUS_STYLES: Record<string, string> = {
  open: "bg-amber-500/15 text-amber-300",
  pending: "bg-blue-500/15 text-blue-300",
  resolved: "bg-emerald-500/15 text-emerald-300",
  closed: "bg-slate-500/15 text-slate-300",
};

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-slate-500/15 text-slate-300",
  normal: "bg-blue-500/15 text-blue-300",
  high: "bg-amber-500/15 text-amber-300",
  urgent: "bg-red-500/15 text-red-300",
};

// SLA targets in hours by priority.
const SLA_HOURS: Record<string, number> = { urgent: 4, high: 12, normal: 24, low: 72 };

function slaInfo(t: { priority: string; status: string; created_at: string; resolved_at: string | null }) {
  if (t.status === "resolved" || t.status === "closed") return { breached: false, label: "Resolved" };
  const targetHours = SLA_HOURS[t.priority] ?? 24;
  const ageMs = Date.now() - new Date(t.created_at).getTime();
  const remainingMs = targetHours * 3600_000 - ageMs;
  const breached = remainingMs <= 0;
  const hours = Math.abs(remainingMs) / 3600_000;
  const label = breached
    ? `SLA breached ${hours < 24 ? `${Math.round(hours)}h` : `${Math.round(hours / 24)}d`} ago`
    : `${hours < 1 ? `${Math.round(hours * 60)}m` : `${Math.round(hours)}h`} left`;
  return { breached, label };
}

function fmtDateTime(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function timeAgo(d: string) {
  const ms = Date.now() - new Date(d).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3600_000) return `${Math.round(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.round(ms / 3600_000)}h ago`;
  return `${Math.round(ms / 86_400_000)}d ago`;
}

export default function TicketsPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery<TicketsResponse>({
    queryKey: ["admin-tickets", statusFilter],
    queryFn: () =>
      api<TicketsResponse>(
        `/api/admin/tickets${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`
      ),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Support tickets</h1>
        <p className="text-sm text-muted-foreground">
          {data ? `${data.total} matching tickets` : "Loading…"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["open", "pending", "resolved", "closed"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent/50 ${
              statusFilter === s ? "ring-2 ring-primary" : ""
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {s === "open" && <AlertCircle className="h-3.5 w-3.5 text-amber-400" />}
              {s === "pending" && <Clock className="h-3.5 w-3.5 text-blue-400" />}
              {s === "resolved" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
              {s === "closed" && <MessageSquare className="h-3.5 w-3.5 text-slate-400" />}
              {s}
            </div>
            <div className="mt-1.5 text-2xl font-semibold tabular-nums">
              {(data?.counts[s] ?? 0).toLocaleString()}
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
        <span className="ml-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Filter</span>
        {(["all", "open", "pending", "resolved", "closed"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              statusFilter === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            {s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && (
          <div className="p-6 text-sm text-destructive">{(error as Error).message}</div>
        )}
        {data && data.tickets.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No tickets match this filter.
          </div>
        )}
        <ul className="divide-y divide-border">
          {data?.tickets.map((t) => {
            const sla = slaInfo(t);
            return (
              <li key={t.id}>
                <button
                  onClick={() => setOpenId(t.id)}
                  className="block w-full px-5 py-4 text-left hover:bg-accent/30"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[t.status] || STATUS_STYLES.open}`}>
                          {t.status}
                        </span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[t.priority] || PRIORITY_STYLES.normal}`}>
                          {t.priority}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${sla.breached ? "bg-red-500/15 text-red-300" : "bg-slate-500/15 text-slate-300"}`}>
                          {sla.breached ? <AlertTriangle className="h-3 w-3" /> : <Timer className="h-3 w-3" />}
                          {sla.label}
                        </span>
                        <span className="text-xs text-muted-foreground">{timeAgo(t.created_at)}</span>
                      </div>
                      <div className="mt-1 truncate text-sm font-medium">{t.subject}</div>
                      {t.description && (
                        <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.description}</div>
                      )}
                      <div className="mt-1 truncate text-xs text-muted-foreground">
                        {t.customer_name ? `${t.customer_name} · ` : ""}
                        {t.customer_email}
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {openId && <TicketDetailDrawer id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function TicketDetailDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const [internal, setInternal] = useState(false);
  const [sendErr, setSendErr] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<TicketDetail>({
    queryKey: ["admin-ticket-detail", id],
    queryFn: () => api<TicketDetail>(`/api/admin/tickets/${id}`),
    refetchInterval: 15_000,
  });

  const sendReply = useMutation({
    mutationFn: () =>
      api<{ success: boolean; email_delivered: boolean }>(`/api/admin/tickets/${id}/reply`, {
        method: "POST",
        body: JSON.stringify({ message, is_internal: internal }),
      }),
    onSuccess: (r) => {
      setMessage("");
      setSendErr(null);
      qc.invalidateQueries({ queryKey: ["admin-ticket-detail", id] });
      qc.invalidateQueries({ queryKey: ["admin-tickets"] });
      if (!internal && !r.email_delivered) {
        setSendErr("Reply saved but customer email not delivered (SMTP not configured).");
      }
    },
    onError: (e: any) => setSendErr(e?.message || "Failed to send"),
  });

  const updateTicket = useMutation({
    mutationFn: (payload: Partial<Ticket>) =>
      api<Ticket>(`/api/admin/tickets/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-ticket-detail", id] });
      qc.invalidateQueries({ queryKey: ["admin-tickets"] });
    },
  });

  const sla = useMemo(() => (data ? slaInfo(data) : null), [data]);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <aside className="relative ml-auto flex h-full w-full max-w-2xl flex-col border-l border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="text-base font-semibold">Ticket detail</div>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        {isLoading && (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && (
          <div className="m-5 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {(error as Error).message}
          </div>
        )}
        {data && (
          <>
            <div className="space-y-4 overflow-y-auto px-5 py-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[data.status] || STATUS_STYLES.open}`}>
                    {data.status}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[data.priority] || PRIORITY_STYLES.normal}`}>
                    {data.priority}
                  </span>
                  {sla && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${sla.breached ? "bg-red-500/15 text-red-300" : "bg-slate-500/15 text-slate-300"}`}>
                      {sla.breached ? <AlertTriangle className="h-3 w-3" /> : <Timer className="h-3 w-3" />}
                      {sla.label}
                    </span>
                  )}
                </div>
                <h2 className="mt-2 text-lg font-semibold">{data.subject}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <User className="h-3 w-3" /> {data.customer_name || "Anonymous"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Mail className="h-3 w-3" /> {data.customer_email}
                  </span>
                  {data.customer_country && (
                    <span className="inline-flex items-center gap-1">
                      <Globe className="h-3 w-3" /> {data.customer_country}
                    </span>
                  )}
                  <span>Opened {fmtDateTime(data.created_at)}</span>
                  {data.resolved_at && <span>Resolved {fmtDateTime(data.resolved_at)}</span>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Status</label>
                  <select
                    value={data.status}
                    onChange={(e) => updateTicket.mutate({ status: e.target.value })}
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="open">Open</option>
                    <option value="pending">Pending</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Priority</label>
                  <select
                    value={data.priority}
                    onChange={(e) => updateTicket.mutate({ priority: e.target.value })}
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {data.description && (
                <div className="rounded-lg border border-border bg-background/40 p-4">
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Original message
                  </div>
                  <div className="whitespace-pre-wrap text-sm">{data.description}</div>
                </div>
              )}

              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Reply thread ({data.replies.length})
                </div>
                <div className="space-y-2">
                  {data.replies.length === 0 && (
                    <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                      No replies yet.
                    </div>
                  )}
                  {data.replies.map((r) => (
                    <div
                      key={r.id}
                      className={`rounded-lg border p-3 ${
                        r.is_internal
                          ? "border-amber-500/30 bg-amber-500/5"
                          : r.author_type === "admin"
                          ? "border-blue-500/30 bg-blue-500/5"
                          : "border-border bg-background/40"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium">
                          {r.is_internal ? "Internal note" : r.author_type === "admin" ? `Admin (${r.author_id})` : "Customer"}
                        </span>
                        <span className="text-muted-foreground">{fmtDateTime(r.created_at)}</span>
                      </div>
                      <div className="whitespace-pre-wrap text-sm">{r.message}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-border bg-background/40 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Reply
                </span>
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="h-3.5 w-3.5 accent-amber-500" />
                  <EyeOff className="h-3 w-3" /> Internal note (not emailed)
                </label>
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder={internal ? "Note visible only to admins…" : "Reply will be emailed to the customer…"}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {sendErr && (
                <div className="mt-2 rounded-md border border-amber-400/40 bg-amber-500/10 p-2 text-xs text-amber-300">
                  {sendErr}
                </div>
              )}
              <div className="mt-2 flex justify-end">
                <button
                  onClick={() => sendReply.mutate()}
                  disabled={!message.trim() || sendReply.isPending}
                  className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {sendReply.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {internal ? "Save note" : "Send reply"}
                </button>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
