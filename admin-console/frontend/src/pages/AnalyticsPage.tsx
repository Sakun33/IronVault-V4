import { useQuery } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";

interface Analytics {
  users: {
    total: number;
    newToday: number;
    newThisWeek: number;
    newThisMonth: number;
    active24h: number;
    active7d: number;
    active30d: number;
    withVault: number;
    suspended: number;
  };
  plans: Record<string, number>;
  revenue: { mrr: number; lifetimeRevenue: number; totalEstimated: number; paidUsers: number };
  vaults: { totalCloudVaults: number; activeVaultUsers7d: number; usersWithCloudVault: number };
  tickets: { total: number; open: number; resolved: number; closed: number };
  signupTrend: { day: string; signups: number }[];
}

const PLAN_COLORS: Record<string, string> = {
  free: "#64748b",
  pro: "#3b82f6",
  family: "#a855f7",
  lifetime: "#f59e0b",
};

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1.5 text-xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export default function AnalyticsPage() {
  const { data, isLoading, error } = useQuery<Analytics>({
    queryKey: ["admin-analytics"],
    queryFn: () => api<Analytics>("/api/admin/analytics"),
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
        Failed to load analytics: {(error as Error)?.message || "Unknown error"}
      </div>
    );
  }

  const planData = Object.entries(data.plans)
    .filter(([, c]) => c > 0)
    .map(([name, value]) => ({ name, value }));

  const weeks: { week: string; signups: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const slice = data.signupTrend.slice(i * 7, i * 7 + 7);
    if (!slice.length) continue;
    weeks.push({
      week: `W${i + 1}`,
      signups: slice.reduce((s, r) => s + r.signups, 0),
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Growth, retention, plan mix, and revenue.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <Tile label="Total" value={data.users.total.toLocaleString()} />
        <Tile label="New today" value={data.users.newToday.toLocaleString()} />
        <Tile label="New this week" value={data.users.newThisWeek.toLocaleString()} />
        <Tile label="New this month" value={data.users.newThisMonth.toLocaleString()} />
        <Tile label="Active 7d" value={data.users.active7d.toLocaleString()} />
        <Tile label="Active 30d" value={data.users.active30d.toLocaleString()} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold">Daily signups (30d)</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.signupTrend}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="day"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickFormatter={(v) => v.slice(5)}
                />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="signups" stroke="#3b82f6" strokeWidth={2} fill="url(#g1)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold">Plan mix</h2>
          <div className="mt-4 h-72">
            {planData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={planData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {planData.map((e) => (
                      <Cell key={e.name} fill={PLAN_COLORS[e.name] || "#64748b"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold">Weekly signups</h2>
          <div className="mt-4 h-60">
            {weeks.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Not enough data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeks}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="signups" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold">Revenue snapshot</h2>
          <p className="text-xs text-muted-foreground">
            Estimated from active entitlements × canonical plan prices.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Tile label="MRR" value={`$${data.revenue.mrr.toFixed(2)}`} hint="Pro + Family monthly" />
            <Tile label="Lifetime revenue" value={`$${data.revenue.lifetimeRevenue.toFixed(2)}`} hint="One-time" />
            <Tile label="Paid users" value={data.revenue.paidUsers.toLocaleString()} hint="Pro + Family + Lifetime" />
            <Tile label="Total est." value={`$${data.revenue.totalEstimated.toFixed(2)}`} hint="MRR×12 + lifetime" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Tile
          label="Cloud vaults"
          value={data.vaults.totalCloudVaults.toLocaleString()}
          hint={`${data.vaults.usersWithCloudVault.toLocaleString()} users syncing`}
        />
        <Tile
          label="Active vault users (7d)"
          value={data.vaults.activeVaultUsers7d.toLocaleString()}
        />
        <Tile label="Suspended accounts" value={data.users.suspended.toLocaleString()} />
      </div>
    </div>
  );
}
