import React from 'react';
import { cn } from '@/lib/utils';
import { getBrandColor } from '@/lib/brand-colors';
import { getFaviconUrl } from '@/components/favicon';

interface BrandCardProps extends React.ComponentPropsWithoutRef<'div'> {
  name: string;
  url?: string;
  brandColor?: string;
  watermarkEmoji?: string;
}

export function BrandCard({
  name,
  url,
  brandColor,
  watermarkEmoji,
  className,
  style,
  children,
  ...rest
}: BrandCardProps) {
  const color = brandColor ?? getBrandColor(name);
  const faviconSrc = !watermarkEmoji ? getFaviconUrl(url, name) : null;

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-border/40 shadow-sm',
        'hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.005]',
        'will-change-transform',
        className
      )}
      style={{
        borderLeftWidth: '3px',
        borderLeftStyle: 'solid',
        borderLeftColor: color,
        background: `linear-gradient(135deg, hsl(var(--card)), ${color}0A)`,
        ...style,
      }}
      {...rest}
    >
      {faviconSrc && (
        <img
          src={faviconSrc}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="absolute -bottom-3 -right-3 w-20 md:w-28 pointer-events-none select-none grayscale opacity-[0.06] dark:opacity-[0.08] transition-opacity duration-300 group-hover:opacity-[0.12] group-hover:dark:opacity-[0.15]"
        />
      )}
      {watermarkEmoji && (
        <div
          aria-hidden="true"
          className="absolute -bottom-4 -right-2 pointer-events-none select-none opacity-[0.07] dark:opacity-[0.09] transition-opacity duration-300 group-hover:opacity-[0.14] group-hover:dark:opacity-[0.17]"
          style={{ fontSize: '6rem', lineHeight: 1 }}
        >
          {watermarkEmoji}
        </div>
      )}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
