import { InfoLayout } from "@/components/info-layout";
import { Badge } from "@/components/ui/badge";
import { BookOpen } from "lucide-react";

export default function BlogPage() {
  return (
    <InfoLayout title="Blog">
      <div className="max-w-2xl mx-auto py-16 text-center space-y-6">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
          <BookOpen className="w-8 h-8 text-primary" aria-hidden="true" />
        </div>
        <Badge variant="secondary" className="text-xs uppercase tracking-wide">
          Coming soon
        </Badge>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          The IronVault Blog
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          We're working on articles about privacy, security best practices, zero-knowledge
          architecture, and how to take back control of your digital life. Check back soon.
        </p>
        <p className="text-sm text-muted-foreground">
          In the meantime, questions?{" "}
          <a
            href="mailto:support@ironvault.app"
            className="text-primary hover:underline focus-visible:outline-none focus-visible:underline"
          >
            support@ironvault.app
          </a>
        </p>
      </div>
    </InfoLayout>
  );
}
