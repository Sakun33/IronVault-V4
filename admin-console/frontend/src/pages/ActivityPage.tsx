import { useQuery } from "@tanstack/react-query";
import {
  UserPlus,
  RefreshCw,
  LifeBuoy,
  Ban,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api";

interface ActivityEvent {
  type: "signup" | "plan_change" | "status_change" | "ticket";
  title: string;
  subject: string | null;
  actor?: string;
  reason?: string;
  status?: string;
  timestamp: string;
}

interface ActivityResponse {
  events: ActivityEvent[];
  total: number;
}

const ICON: Record<ActivityEvent["type"], React.ComponentType<{ className?: string }>> = {
  signup: UserPlus,
  plan_change: RefreshCw,
  status_change: Ban,
  ticket: LifeBuoy,
};

const COLOR: Record<ActivityEvent["type"], string> = {
  signup: "bg-blue-500/15 text-blue-300",
  plan_change: "bg-purple-500/15 text-purple-300",
  status_change: "bg-amber-500/15 text-amber-300",
  ticket: "bg-emerald-500/15 text-emerald-300",
};

function fmt(d: string) {
  return new Date(d).toLocaleString();
}

export default function ActivityPage() {
  const { data, isLoading, error } = useQuery<ActivityResponse>({
    queryKey: ["admin-activity"],
    queryFn: () => api<ActivityResponse>("/api/admin/activity?limit=100"),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Activity log</h1>
        <p className="text-sm text-muted-foreground">
          Signups, plan changes, suspensions, and ticket events across the platform.
        </p>
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
        {data && data.events.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No activity yet.
          </div>
        )}
        <ul className="divide-y divide-border">
          {data?.events.map((e, i) => {
            const Icon = ICON[e.type];
            return (
              <li
                key={`${e.type}-${e.timestamp}-${i}`}
                className="flex items-start gap-3 px-5 py-4 hover:bg-accent/30"
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${COLOR[e.type]}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="truncate text-sm font-medium">{e.title}</div>
                    <div className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {fmt(e.timestamp)}
                    </div>
                  </div>
                  {e.subject && (
                    <div className="truncate text-xs text-muted-foreground">{e.subject}</div>
                  )}
                  {(e.actor || e.reason || e.status) && (
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {e.actor && <span>by {e.actor}</span>}
                      {e.status && <span>status: {e.status}</span>}
                      {e.reason && <span>· {e.reason}</span>}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
