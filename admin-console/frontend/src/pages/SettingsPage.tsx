import { useQuery } from "@tanstack/react-query";
import { Shield, Mail, User, Calendar, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "../contexts/AuthContext";

interface AdminInfo {
  id: number;
  username: string;
  email: string | null;
  role: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string | null;
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { data } = useQuery<AdminInfo[]>({
    queryKey: ["admins"],
    queryFn: () => api<AdminInfo[]>("/api/admins"),
  });

  const admin = data?.[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Admin account, deployment, and platform info.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-base font-semibold">
            <User className="h-4 w-4" /> Admin account
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            <Row label="Username" value={admin?.username || user?.username || "—"} />
            <Row label="Role" value={admin?.role || user?.role || "super_admin"} />
            <Row label="Email" value={admin?.email || "—"} />
            <Row
              label="Last login"
              value={admin?.last_login ? new Date(admin.last_login).toLocaleString() : "—"}
            />
          </dl>
          <button
            onClick={logout}
            className="mt-5 inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent"
          >
            Sign out
          </button>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-base font-semibold">
            <Shield className="h-4 w-4" /> Security
          </div>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
              <span>
                <strong>scrypt password hashing</strong> with per-deploy salt and N=2¹⁷.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
              <span>
                <strong>HS256 JWT</strong> with explicit algorithm pinning + issuer + audience checks.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
              <span>
                <strong>Per-IP brute-force gate</strong> on login (5 attempts / 15 min, 1h lockout).
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
              <span>
                <strong>Strict CORS</strong> — only <code>admin.ironvault.app</code> is allowlisted.
              </span>
            </li>
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-base font-semibold">
            <Mail className="h-4 w-4" /> Integrations
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Database</span>
              <span className="font-medium">Neon PostgreSQL</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Mail</span>
              <span className="font-medium">Zoho SMTP</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Payments</span>
              <span className="font-medium">Razorpay</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Hosting</span>
              <span className="font-medium">Vercel</span>
            </li>
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-base font-semibold">
            <Calendar className="h-4 w-4" /> Links
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <a
                href="https://www.ironvault.app"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Main app <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </li>
            <li>
              <a
                href="https://www.ironvault.app/api/health"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Main API health <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </li>
            <li>
              <a
                href="/api/health"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Admin API health <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
