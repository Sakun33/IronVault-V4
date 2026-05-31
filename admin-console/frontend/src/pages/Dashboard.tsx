import { useQuery } from "@tanstack/react-query";
import {
  Users,
  TrendingUp,
  DollarSign,
  Database,
  ArrowUpRight,
  UserPlus,
  Activity as ActivityIcon,
  LifeBuoy,
} from "lucide-react";
import {
  AreaChart,
  Area,
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
import { Link } from "react-router-dom";
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
  revenue: {
    mrr: number;
    lifetimeRevenue: number;
    totalEstimated: number;
    paidUsers: number;
  };
  vaults: {
    totalCloudVaults: number;
    activeVaultUsers7d: number;
    usersWithCloudVault: number;
  };
  tickets: { total: number; open: number; resolved: number; closed: number };
  signupTrend: { day: string; signups: number }[];
  recentSignups: {
    id: string;
    email: string;
    name: string;
    country: string;
    platform: string;
    created_at: string;
  }[];
}

const PLAN_COLORS: Record<string, string> = {
  free: "#64748b",
  pro: "#3b82f6",
  family: "#a855f7",
  lifetime: "#f59e0b",
};

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
          {hint && (
            <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
          )}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading, error } = useQuery<Analytics>({
    queryKey: ["admin-analytics"],
    queryFn: () => api<Analytics>("/api/admin/analytics"),
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-9 w-48 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Live view of IronVault users, plans, and activity.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Users"
          value={data.users.total.toLocaleString()}
          hint={`+${data.users.newToday} today · +${data.users.newThisWeek} this week`}
          icon={Users}
          accent="bg-blue-500/15 text-blue-400"
        />
        <StatCard
          label="Active (30d)"
          value={data.users.active30d.toLocaleString()}
          hint={`${data.users.active7d} in last 7 days`}
          icon={TrendingUp}
          accent="bg-emerald-500/15 text-emerald-400"
        />
        <StatCard
          label="Paid Users"
          value={data.revenue.paidUsers.toLocaleString()}
          hint={`MRR ~$${data.revenue.mrr.toFixed(2)}`}
          icon={DollarSign}
          accent="bg-amber-500/15 text-amber-400"
        />
        <StatCard
          label="Cloud Vaults"
          value={data.vaults.totalCloudVaults.toLocaleString()}
          hint={`${data.vaults.activeVaultUsers7d} active in last 7d`}
          icon={Database}
          accent="bg-purple-500/15 text-purple-400"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Signups — last 30 days</h2>
              <p className="text-xs text-muted-foreground">
                {data.users.newThisMonth.toLocaleString()} new accounts this month
              </p>
            </div>
            <Link
              to="/analytics"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Open analytics <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.signupTrend}>
                <defs>
                  <linearGradient id="signupGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="day"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickFormatter={(v) => v.slice(5)}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="signups"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#signupGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold">Plan distribution</h2>
          <p className="text-xs text-muted-foreground">
            {data.revenue.paidUsers.toLocaleString()} paid · {(data.plans.free || 0).toLocaleString()} free
          </p>
          <div className="mt-4 h-64">
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
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {planData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={PLAN_COLORS[entry.name] || "#64748b"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend
                    iconType="circle"
                    wrapperStyle={{ fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold">Recent signups</h2>
            <Link
              to="/users"
              className="text-xs font-medium text-primary hover:underline"
            >
              View all
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {data.recentSignups.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-muted-foreground">
                No signups yet
              </li>
            )}
            {data.recentSignups.map((u) => (
              <li
                key={u.id}
                className="flex items-center gap-3 px-5 py-3 hover:bg-accent/40"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  <UserPlus className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{u.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                </div>
                <div className="hidden text-xs text-muted-foreground sm:block">
                  {u.platform || "web"}
                </div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {new Date(u.created_at).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 text-base font-semibold">
              <LifeBuoy className="h-4 w-4 text-amber-400" /> Tickets
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Open</dt>
                <dd className="font-medium">{data.tickets.open}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Resolved</dt>
                <dd className="font-medium">{data.tickets.resolved}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Closed</dt>
                <dd className="font-medium">{data.tickets.closed}</dd>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2">
                <dt className="font-medium">Total</dt>
                <dd className="font-semibold">{data.tickets.total}</dd>
              </div>
            </dl>
            <Link
              to="/tickets"
              className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Open tickets <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 text-base font-semibold">
              <ActivityIcon className="h-4 w-4 text-emerald-400" /> Health
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Users w/ vault</dt>
                <dd className="font-medium">{data.users.withVault.toLocaleString()}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Suspended</dt>
                <dd className="font-medium">{data.users.suspended.toLocaleString()}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Active vault users (7d)</dt>
                <dd className="font-medium">
                  {data.vaults.activeVaultUsers7d.toLocaleString()}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Lifetime revenue</dt>
                <dd className="font-medium">
                  ${data.revenue.lifetimeRevenue.toFixed(2)}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
