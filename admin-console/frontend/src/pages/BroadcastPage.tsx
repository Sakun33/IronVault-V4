import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Send, Users, Loader2, AlertTriangle, CheckCircle2, Eye } from "lucide-react";
import { api } from "@/lib/api";

type Audience = "all" | "active" | "suspended" | "paid" | "free";

const AUDIENCE_LABEL: Record<Audience, string> = {
  all: "All users (with email)",
  active: "Active users",
  suspended: "Suspended users",
  paid: "Paid users (Pro/Family/Lifetime)",
  free: "Free users only",
};

interface BroadcastResult {
  success: boolean;
  recipients: number;
  sent?: number;
  failed?: number;
  dry_run?: boolean;
}

export default function BroadcastPage() {
  const [audience, setAudience] = useState<Audience>("all");
  const [plan, setPlan] = useState("all");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [lastDry, setLastDry] = useState<BroadcastResult | null>(null);
  const [lastSend, setLastSend] = useState<BroadcastResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const dryRun = useMutation({
    mutationFn: () =>
      api<BroadcastResult>("/api/admin/broadcast", {
        method: "POST",
        body: JSON.stringify({ audience, plan, subject, body, dry_run: true }),
      }),
    onSuccess: (r) => { setLastDry(r); setErr(null); },
    onError: (e: any) => setErr(e?.message || "Failed"),
  });

  const send = useMutation({
    mutationFn: () =>
      api<BroadcastResult>("/api/admin/broadcast", {
        method: "POST",
        body: JSON.stringify({ audience, plan, subject, body, dry_run: false }),
      }),
    onSuccess: (r) => {
      setLastSend(r);
      setErr(null);
      setConfirm(false);
    },
    onError: (e: any) => { setErr(e?.message || "Failed"); setConfirm(false); },
  });

  const canSubmit = subject.trim().length > 0 && body.trim().length > 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Broadcast email</h1>
        <p className="text-sm text-muted-foreground">Send an announcement to all users or a filtered audience. Respects email-preferences.</p>
      </div>

      <div className="rounded-md border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-300">
        <div className="inline-flex items-center gap-1.5 font-medium"><AlertTriangle className="h-4 w-4" /> Broadcasts are rate-limited by SMTP.</div>
        <div className="mt-1 text-xs">Use <strong>Preview recipients</strong> first to confirm the audience size before sending. Send-rate is sequential to stay under provider limits.</div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="text-sm font-medium">Compose</div>
            <div className="mt-3 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Subject</label>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} placeholder="Important update to your IronVault account" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                <div className="mt-1 text-right text-[10px] text-muted-foreground">{subject.length}/200</div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Body (HTML allowed)</label>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} placeholder="<p>Hi there,</p><p>We've shipped new features…</p>" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setPreview((p) => !p)} className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent">
                  <Eye className="h-4 w-4" /> {preview ? "Hide preview" : "Show preview"}
                </button>
              </div>
            </div>
          </div>

          {preview && (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-2 text-sm font-medium">Preview</div>
              <div className="rounded-lg border border-border bg-background p-4">
                <div className="mb-3 border-b border-border pb-2 text-sm">
                  <div className="text-xs text-muted-foreground">Subject</div>
                  <div className="font-medium">{subject || "(empty)"}</div>
                </div>
                <div className="prose prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{ __html: body || "(empty)" }} />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="text-sm font-medium">Audience</div>
            <div className="mt-3 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Segment</label>
                <select value={audience} onChange={(e) => setAudience(e.target.value as Audience)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {(Object.keys(AUDIENCE_LABEL) as Audience[]).map((k) => (
                    <option key={k} value={k}>{AUDIENCE_LABEL[k]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Plan filter</label>
                <select value={plan} onChange={(e) => setPlan(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="all">All plans</option>
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="family">Family</option>
                  <option value="lifetime">Lifetime</option>
                </select>
              </div>
              <button
                onClick={() => dryRun.mutate()}
                disabled={!canSubmit || dryRun.isPending}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
              >
                {dryRun.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                Preview recipients
              </button>
              {lastDry && (
                <div className="rounded-md border border-emerald-400/40 bg-emerald-500/10 p-2 text-xs text-emerald-300">
                  <div className="font-medium">{lastDry.recipients.toLocaleString()} recipients match</div>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setConfirm(true)}
            disabled={!canSubmit || send.isPending}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {send.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            Send broadcast
          </button>

          {err && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">{err}</div>
          )}

          {lastSend && (
            <div className="rounded-md border border-emerald-400/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">
              <div className="inline-flex items-center gap-1.5 font-medium"><CheckCircle2 className="h-4 w-4" /> Broadcast sent</div>
              <div className="mt-1 text-xs">
                Recipients: {lastSend.recipients} · Sent: {lastSend.sent ?? 0} · Failed: {lastSend.failed ?? 0}
              </div>
            </div>
          )}
        </div>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setConfirm(false)} />
          <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
                <Send className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Send broadcast?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  You're about to send an email to <strong>{lastDry?.recipients.toLocaleString() ?? "?"}</strong> recipients ({AUDIENCE_LABEL[audience]}{plan !== "all" ? ` · ${plan}` : ""}).
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  This action is audit-logged and cannot be undone.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setConfirm(false)} disabled={send.isPending} className="inline-flex h-10 items-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent disabled:opacity-50">
                Cancel
              </button>
              <button onClick={() => send.mutate()} disabled={send.isPending} className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {send.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Send now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
