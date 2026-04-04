import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse bg-muted/50 rounded-xl',
        className
      )}
    />
  );
}

interface LoadingListRowProps {
  count?: number;
  className?: string;
}

export function LoadingListRow({ count = 1, className }: LoadingListRowProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn('flex items-center gap-3 p-3 rounded-xl', className)}
        >
          <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="w-5 h-5 rounded shrink-0" />
        </div>
      ))}
    </>
  );
}

interface LoadingCardProps {
  count?: number;
  className?: string;
}

export function LoadingCard({ count = 1, className }: LoadingCardProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'p-4 rounded-2xl border border-border bg-card space-y-3',
            className
          )}
        >
          <div className="flex items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          <Skeleton className="h-20 w-full" />
        </div>
      ))}
    </>
  );
}

interface LoadingStatsGridProps {
  className?: string;
}

export function LoadingStatsGrid({ className }: LoadingStatsGridProps) {
  return (
    <div className={cn('grid grid-cols-2 gap-3', className)}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="p-4 rounded-2xl border border-border bg-card space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-12" />
        </div>
      ))}
    </div>
  );
}

interface LoadingPageProps {
  className?: string;
}

export function LoadingPage({ className }: LoadingPageProps) {
  return (
    <div className={cn('space-y-6 p-4', className)}>
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <LoadingStatsGrid />
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <LoadingListRow count={5} />
      </div>
    </div>
  );
}
