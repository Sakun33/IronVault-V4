/**
 * AppLogo Component
 * Reusable app icon/logo component for consistent branding across the app
 * Uses the premium icon pack assets
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface AppLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | number;
  className?: string;
  showText?: boolean;
  textClassName?: string;
  variant?: 'default' | 'hero' | 'minimal';
}

const sizeMap = {
  xs: 16,
  sm: 24,
  md: 32,
  lg: 48,
  xl: 64,
  '2xl': 96,
};

export function AppLogo({ 
  size = 'md', 
  className,
  showText = false,
  textClassName,
  variant = 'default',
}: AppLogoProps) {
  const pixelSize = typeof size === 'number' ? size : sizeMap[size];
  
  // Select the appropriate icon based on size for best quality
  const getIconSrc = () => {
    if (pixelSize <= 16) return '/icon-16.png';
    if (pixelSize <= 32) return '/icon-32.png';
    if (pixelSize <= 48) return '/icon-48.png';
    if (pixelSize <= 64) return '/icon-64.png';
    if (pixelSize <= 192) return '/icon-192.png';
    return '/icon-512.png';
  };

  // Hero variant - large centered logo for login/splash screens
  if (variant === 'hero') {
    // Use a larger size for hero variant to fill the space better
    const heroSize = pixelSize * 1.2;
    return (
      <div className={cn('flex flex-col items-center justify-center', className)}>
        <div className="relative">
          {/* Subtle glow effect behind the icon */}
          <div 
            className="absolute inset-0 bg-primary/15 rounded-2xl blur-2xl scale-110"
          />
          {/* Icon with premium shadow - no extra container padding */}
          <img
            src={getIconSrc()}
            alt="IronVault"
            width={heroSize}
            height={heroSize}
            className="relative object-cover rounded-2xl shadow-2xl"
            style={{ 
              width: heroSize, 
              height: heroSize,
              boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.35), 0 0 20px rgba(99, 102, 241, 0.1)'
            }}
          />
        </div>
        {showText && (
          <span className={cn(
            'font-semibold text-foreground mt-4',
            textClassName
          )}>
            IronVault
          </span>
        )}
      </div>
    );
  }

  // Minimal variant - just the icon, no container
  if (variant === 'minimal') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <img
          src={getIconSrc()}
          alt="IronVault"
          width={pixelSize}
          height={pixelSize}
          className="object-contain"
          style={{ width: pixelSize, height: pixelSize }}
        />
        {showText && (
          <span className={cn(
            'font-semibold text-foreground',
            textClassName
          )}>
            IronVault
          </span>
        )}
      </div>
    );
  }

  // Default variant - with subtle container for headers
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="rounded-xl overflow-hidden shadow-sm">
        <img
          src={getIconSrc()}
          alt="IronVault"
          width={pixelSize}
          height={pixelSize}
          className="object-contain"
          style={{ width: pixelSize, height: pixelSize }}
        />
      </div>
      {showText && (
        <span className={cn(
          'font-semibold text-foreground',
          textClassName
        )}>
          IronVault
        </span>
      )}
    </div>
  );
}

export default AppLogo;
