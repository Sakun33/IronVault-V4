import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function PlanSkeleton() {
  return (
    <Card className="border-2">
      <CardHeader>
        <Skeleton className="h-6 w-24 mb-2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-12 w-32 mt-4" />
      </CardHeader>
      <CardContent className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
        <Skeleton className="h-12 w-full mt-4" />
      </CardContent>
    </Card>
  );
}
