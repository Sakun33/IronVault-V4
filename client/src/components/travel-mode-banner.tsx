// Travel Mode banner — shown app-wide while travel mode is active so the
// user always knows that some vaults are hidden.

import React, { useEffect, useState } from 'react';
import { Plane } from 'lucide-react';
import { isTravelModeActive, subscribeTravelMode } from '@/lib/travel-mode';
import { Link } from 'wouter';

export function TravelModeBanner() {
  const [active, setActive] = useState<boolean>(() => isTravelModeActive());

  useEffect(() => subscribeTravelMode(() => setActive(isTravelModeActive())), []);

  if (!active) return null;

  return (
    <div
      role="status"
      className="w-full bg-destructive/10 border-b border-destructive/30 text-destructive text-xs px-3 py-1.5 flex items-center justify-center gap-2"
      data-testid="travel-mode-banner"
    >
      <Plane className="w-3.5 h-3.5" />
      <span className="font-medium">Travel Mode Active</span>
      <span className="text-destructive/80 hidden sm:inline">— some vaults are hidden.</span>
      <Link href="/settings" className="underline underline-offset-2 hover:text-destructive">
        Manage
      </Link>
    </div>
  );
}
