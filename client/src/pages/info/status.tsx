import { InfoLayout } from "@/components/info-layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Activity } from "lucide-react";

const services = [
  { name: "IronVault Web App", status: "operational" },
  { name: "API Gateway", status: "operational" },
  { name: "Cloud Sync (Supabase)", status: "operational" },
  { name: "Authentication Service", status: "operational" },
  { name: "OCR / Bank Statement Import", status: "operational" },
  { name: "Push Notifications", status: "operational" },
];

function StatusBadge({ status }: { status: string }) {
  if (status === "operational") {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs">
        <CheckCircle2 className="w-3 h-3 mr-1" aria-hidden="true" />
        Operational
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="text-xs">
      Degraded
    </Badge>
  );
}

export default function StatusPage() {
  const allOperational = services.every((s) => s.status === "operational");

  return (
    <InfoLayout title="System Status">
      <div className="max-w-2xl mx-auto space-y-8 py-6">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto">
            <Activity className="w-6 h-6 text-primary" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            System Status
          </h1>
          {allOperational ? (
            <p className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center justify-center gap-2">
              <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
              All systems operational
            </p>
          ) : (
            <p className="text-destructive font-medium">Some services degraded</p>
          )}
        </div>

        <Card className="border-border/50">
          <CardContent className="pt-6 divide-y divide-border/40">
            {services.map((svc) => (
              <div
                key={svc.name}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
              >
                <span className="text-sm font-medium text-foreground">{svc.name}</span>
                <StatusBadge status={svc.status} />
              </div>
            ))}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Incident history and uptime SLA reports coming soon. For urgent issues email{" "}
          <a
            href="mailto:support@ironvault.app"
            className="text-primary hover:underline"
          >
            support@ironvault.app
          </a>
          .
        </p>
      </div>
    </InfoLayout>
  );
}
