// Travel Mode — hides sensitive vaults at borders.
//
// When enabled, the user picks which vaults remain visible (the "safe" set).
// Everything else is hidden from the vault picker, sidebar switcher, and any
// vault list UI. To disable, the user must re-enter their master password
// (so a border agent who toggles a switch in Settings can't reveal everything).
//
// State persists in localStorage so it survives reloads. Disabling requires
// passing a verified=true flag — UI must verify the master password first.

const STORAGE_KEY = 'iv_travel_mode';

interface TravelModeState {
  active: boolean;
  // IDs of vaults that REMAIN VISIBLE while travel mode is active.
  safeVaultIds: string[];
  // Section IDs to HIDE while travel mode is active (e.g. 'passwords',
  // 'cards', 'investments'). When empty, no sections are hidden — vault-only
  // travel mode (original behavior).
  hiddenSections: string[];
  enabledAt: number;
}

function readState(): TravelModeState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TravelModeState;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.safeVaultIds)) return null;
    // Older state didn't carry hiddenSections — normalize to empty array
    // so isSectionHidden() doesn't crash on legacy travel-mode payloads.
    if (!Array.isArray((parsed as any).hiddenSections)) {
      (parsed as any).hiddenSections = [];
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeState(state: TravelModeState | null): void {
  try {
    if (state === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
    // Notify listeners (custom event so any view can refresh)
    window.dispatchEvent(new CustomEvent('iv-travel-mode-change'));
  } catch {
    /* ignore */
  }
}

export function enableTravelMode(
  safeVaultIds: string[],
  hiddenSections: string[] = [],
): void {
  const ids = Array.from(new Set((safeVaultIds || []).filter(Boolean)));
  const sections = Array.from(new Set((hiddenSections || []).filter(Boolean)));
  writeState({
    active: true,
    safeVaultIds: ids,
    hiddenSections: sections,
    enabledAt: Date.now(),
  });
}

/** Section IDs (sidebar nav item ids) hidden by travel mode. */
export function getHiddenSections(): string[] {
  const state = readState();
  return state && state.active ? [...state.hiddenSections] : [];
}

/** Is a given sidebar section currently hidden by travel mode? */
export function isSectionHidden(sectionId: string): boolean {
  const state = readState();
  if (!state || !state.active) return false;
  if (!sectionId) return false;
  return state.hiddenSections.includes(sectionId);
}

export interface DisableOpts {
  /** Caller must verify the master password before passing true. */
  verified: boolean;
}

export function disableTravelMode(opts: DisableOpts): boolean {
  if (!opts || !opts.verified) {
    // Refuse to disable without explicit verification — keeps a casual UI
    // toggle from undoing travel mode without a master-password check.
    return false;
  }
  writeState(null);
  return true;
}

export function isTravelModeActive(): boolean {
  const state = readState();
  return !!(state && state.active);
}

export function isVaultHidden(vaultId: string): boolean {
  const state = readState();
  if (!state || !state.active) return false;
  if (!vaultId) return false;
  return !state.safeVaultIds.includes(vaultId);
}

export function getSafeVaultIds(): string[] {
  const state = readState();
  return state && state.active ? [...state.safeVaultIds] : [];
}

export function getTravelModeState(): TravelModeState | null {
  return readState();
}

/** Filter helper — returns only vaults visible in current mode. */
export function filterVisibleVaults<T extends { id: string }>(vaults: T[]): T[] {
  if (!isTravelModeActive()) return vaults;
  const safe = new Set(getSafeVaultIds());
  return vaults.filter(v => safe.has(v.id));
}

/** Subscribe to enable/disable events. Returns an unsubscribe fn. */
export function subscribeTravelMode(fn: () => void): () => void {
  const handler = () => fn();
  window.addEventListener('iv-travel-mode-change', handler);
  // Also listen to storage events so changes from another tab propagate.
  const storageHandler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) fn();
  };
  window.addEventListener('storage', storageHandler);
  return () => {
    window.removeEventListener('iv-travel-mode-change', handler);
    window.removeEventListener('storage', storageHandler);
  };
}
