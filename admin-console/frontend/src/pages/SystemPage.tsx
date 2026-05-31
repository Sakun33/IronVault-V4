import { useQuery } from "@tanstack/react-query";
import { Activity, Database, Mail, Server, Users, LifeBuoy, RefreshCw, AlertTriangle, CheckCircle2, Globe } from "lucide-react";
import { api } from "@/lib/api";

interface SystemHealth {
  users: { total: number; last_24h: number };
  tickets: { open: number; pending: number; resolved: number; closed: number; last_24h: number };
  vaults: { total: number };
  plan_changes_24h: number;
  email: { configured: boolean; sent_7d: number; failed_7d: number };
  main_app: { status: "up" | "down" | "unknown"; latency_ms: number | null };
  cron: { schedule: string; provider: string; last_run: string | null };
  db: { connected: boolean };
  server: { uptime_sec: number; node: string; memory_mb: number };
}

function fmtUptime(sec: number) {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  return `${Math.floor(sec / 86400)}d ${Math.floor((sec % 86400) / 3600)}h`;
}

export default function SystemPage() {
  const { data, isLoading, error, refetch, isFetching } = useQuery<SystemHealth>({
    queryKey: ["admin-system"],
    queryFn: () => api<SystemHealth>("/api/admin/system"),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">System health</h1>
          <p className="text-sm text-muted-foreground">Live status, integrations, and capacity metrics.</p>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {isLoading && <Skeleton />}
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {(error as Error).message}
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon={Users} label="Total users" value={data.users.total.toLocaleString()} sub={`+${data.users.last_24h} in 24h`} />
            <Stat icon={Database} label="Cloud vaults" value={data.vaults.total.toLocaleString()} />
            <Stat icon={LifeBuoy} label="Open tickets" value={data.tickets.open.toLocaleString()} sub={`+${data.tickets.last_24h} in 24h`} highlight={data.tickets.open > 0 ? "amber" : undefined} />
            <Stat icon={Activity} label="Plan changes 24h" value={data.plan_changes_24h.toLocaleString()} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Main app" icon={Globe}>
              <Status ok={data.main_app.status === "up"} label={data.main_app.status === "up" ? "Operational" : data.main_app.status === "down" ? "Down" : "Unknown"} />
              {data.main_app.latency_ms !== null && (
                <KV label="Latency" value={`${data.main_app.latency_ms} ms`} />
              )}
              <KV label="Endpoint" value="https://www.ironvault.app/api/health" />
            </Card>

            <Card title="Database" icon={Database}>
              <Status ok={data.db.connected} label={data.db.connected ? "Connected" : "Disconnected"} />
              <KV label="Provider" value="Neon PostgreSQL" />
            </Card>

            <Card title="Email" icon={Mail}>
              <Status ok={data.email.configured} label={data.email.configured ? "SMTP configured" : "SMTP not configured"} />
              <KV label="Sent (7d)" value={data.email.sent_7d.toLocaleString()} />
              <KV label="Failed (7d)" value={data.email.failed_7d.toLocaleString()} />
              <KV label="Provider" value="Zoho SMTP (smtppro.zoho.in:587)" />
            </Card>

            <Card title="Cron" icon={Activity}>
              <KV label="Schedule" value={data.cron.schedule} />
              <KV label="Provider" value={data.cron.provider} />
              <KV label="Last run" value={data.cron.last_run || "—"} />
            </Card>

            <Card title="Tickets queue" icon={LifeBuoy}>
              <KV label="Open" value={data.tickets.open.toLocaleString()} />
              <KV label="Pending" value={data.tickets.pending.toLocaleString()} />
              <KV label="Resolved" value={data.tickets.resolved.toLocaleString()} />
              <KV label="Closed" value={data.tickets.closed.toLocaleString()} />
            </Card>

            <Card title="Function runtime" icon={Server}>
              <KV label="Uptime" value={fmtUptime(data.server.uptime_sec)} />
              <KV label="Memory" value={`${data.server.memory_mb} MB`} />
              <KV label="Node" value={data.server.node} />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-card/50" />
      ))}
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub, highlight }: { icon: any; label: string; value: string; sub?: string; highlight?: "amber" }) {
  return (
    <div className={`rounded-xl border border-border bg-card p-4 ${highlight === "amber" ? "ring-1 ring-amber-500/30" : ""}`}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Card({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 text-base font-semibold">
        <Icon className="h-4 w-4" /> {title}
      </div>
      <dl className="mt-4 space-y-2 text-sm">{children}</dl>
    </section>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium break-words">{value}</dd>
    </div>
  );
}

function Status({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`mb-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${ok ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />} {label}
    </div>
  );
}
