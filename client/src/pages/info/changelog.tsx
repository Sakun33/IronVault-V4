import { InfoLayout } from "@/components/info-layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Zap } from "lucide-react";

const releases = [
  {
    version: "4.1.0",
    date: "April 2026",
    tag: "Latest",
    tagVariant: "default" as const,
    changes: [
      "Marketing landing page with pricing, FAQ, and features overview",
      "Supabase identity layer for cloud sync (Phase 1 auth overhaul)",
      "Biometric card component for native Android unlock",
      "Multi-vault auth context improvements",
      "Improved route guards and session persistence",
    ],
  },
  {
    version: "4.0.0",
    date: "March 2026",
    tag: "Major",
    tagVariant: "secondary" as const,
    changes: [
      "Complete UI overhaul — Ocean Blue default theme, dark-mode aware",
      "Bank statement OCR import (PDF parsing, transaction categorisation)",
      "Investment portfolio tracking with performance charts",
      "Document vault with PDF, image, and text viewer",
      "Cross-device encrypted cloud sync (Pro)",
      "Family plan infrastructure groundwork",
    ],
  },
  {
    version: "3.5.0",
    date: "January 2026",
    tag: "Feature",
    tagVariant: "secondary" as const,
    changes: [
      "Subscription renewal reminders with push notifications",
      "Expense tracking with category budgets",
      "Activity log (tamper-evident vault audit trail)",
      "API Keys vault section",
      "Goals tracking linked to investment accounts",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <InfoLayout title="Changelog">
      <div className="max-w-3xl mx-auto space-y-8 py-6">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto">
            <Zap className="w-6 h-6 text-primary" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Changelog
          </h1>
          <p className="text-muted-foreground">
            What's new in IronVault. We ship improvements continuously.
          </p>
        </div>

        <div className="space-y-6">
          {releases.map((release) => (
            <Card key={release.version} className="border-border/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-lg font-bold text-foreground">
                    v{release.version}
                  </span>
                  <Badge variant={release.tagVariant}>{release.tag}</Badge>
                  <span className="text-sm text-muted-foreground ml-auto">
                    {release.date}
                  </span>
                </div>
                <ul className="space-y-2">
                  {release.changes.map((change) => (
                    <li
                      key={change}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <span
                        className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0"
                        aria-hidden="true"
                      />
                      {change}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Older releases are available on{" "}
          <a
            href="https://github.com/bytebookpro/ironvault/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            GitHub Releases
          </a>
          .
        </p>
      </div>
    </InfoLayout>
  );
}
