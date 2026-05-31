import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle, CheckCircle2, Clock, MessageSquare } from "lucide-react";
import { api } from "@/lib/api";

interface Ticket {
  id: string;
  subject: string;
  description: string | null;
  status: string;
  priority: string;
  customer_email: string;
  customer_name: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
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

export default function TicketsPage() {
  const [statusFilter, setStatusFilter] = useState("all");
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
        <span className="ml-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Filter
        </span>
        {(["all", "open", "pending", "resolved", "closed"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              statusFilter === s
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
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
          {data?.tickets.map((t) => (
            <li key={t.id} className="px-5 py-4 hover:bg-accent/30">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_STYLES[t.status] || STATUS_STYLES.open
                      }`}
                    >
                      {t.status}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        PRIORITY_STYLES[t.priority] || PRIORITY_STYLES.normal
                      }`}
                    >
                      {t.priority}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(t.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-sm font-medium">{t.subject}</div>
                  {t.description && (
                    <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {t.description}
                    </div>
                  )}
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {t.customer_name ? `${t.customer_name} · ` : ""}
                    {t.customer_email}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
