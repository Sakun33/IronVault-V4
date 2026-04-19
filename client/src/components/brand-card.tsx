import React from 'react';
import { cn } from '@/lib/utils';
import { getBrandColor } from '@/lib/brand-colors';

interface BrandCardProps extends React.ComponentPropsWithoutRef<'div'> {
  name: string;
  url?: string;
  brandColor?: string;
  // watermarkEmoji kept for API compat but ignored — top-line design now
  watermarkEmoji?: string;
}

export function BrandCard({
  name,
  url,
  brandColor,
  watermarkEmoji: _watermarkEmoji,
  className,
  style,
  children,
  ...rest
}: BrandCardProps) {
  const color = brandColor ?? getBrandColor(name);

  return (
    <div
      className={cn(
        'group relative rounded-2xl bg-card border border-border/50 shadow-sm',
        'hover:shadow-md transition-all duration-200 hover:-translate-y-0.5',
        'overflow-hidden will-change-transform',
        className
      )}
      style={style}
      {...rest}
    >
      {/* Thin brand accent top line */}
      <div
        className="h-[3px] w-full flex-shrink-0"
        style={{ background: `linear-gradient(90deg, ${color}, ${color}55)` }}
      />
      <div className="relative">
        {children}
      </div>
    </div>
  );
}
