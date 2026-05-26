/**
 * User preferences — persistent across logins and devices.
 *
 * Lives in localStorage under `iv_user_prefs` as a single JSON blob.
 * Auth-context's logout flow MUST NOT clear this key (only the auth
 * tokens / cloud session). Preferences also ride the encrypted vault
 * blob via storage.ts exportVault/importVault so a user signing in on
 * a fresh device sees their settings restored from the cloud.
 *
 * Why a single blob (not one key per pref):
 * - Single source of truth → no key-name drift between writers/readers.
 * - One JSON.parse on read; cheap.
 * - Easy to extend without touching every site.
 */

const PREFS_KEY = 'iv_user_prefs';

export interface UserPreferences {
  /** First-name override for the dashboard greeting. */
  displayName: string | null;
  /** Whether the user has granted system notification permission AND opted into reminders. */
  notificationsEnabled: boolean;
  /** Whether biometric unlock is enrolled for at least one vault. Per-vault state still lives
   *  in vault-manager; this flag is the cross-device "user prefers biometric where available" hint. */
  biometricEnabled: boolean;
  /** Theme preference. `system` follows OS-level dark/light. */
  theme: 'dark' | 'light' | 'system';
  /** Font size scale (matches index.css class tokens: 'small' | 'medium' | 'large' | 'xl'). */
  fontSize: 'small' | 'medium' | 'large' | 'xl';
  /** Idle minutes before the vault auto-locks. 0 disables auto-lock. */
  autoLockMinutes: number;
  /** Whether cloud sync is enabled for the active account. */
  cloudSyncEnabled: boolean;
  /** Seconds before a copied secret is auto-cleared from the clipboard. 0 disables. */
  clipboardClearSeconds: number;
  /** Last-known currency display preference (carried across logins). */
  currency: string | null;
}

const DEFAULTS: UserPreferences = {
  displayName: null,
  notificationsEnabled: false,
  biometricEnabled: false,
  theme: 'system',
  fontSize: 'medium',
  autoLockMinutes: 5,
  cloudSyncEnabled: true,
  clipboardClearSeconds: 30,
  currency: null,
};

/** One-time migration of stand-alone pref keys into the unified blob.
 *  Idempotent — once a key has been migrated and removed, this is a
 *  no-op. Runs lazily on first loadPreferences() call. */
let _migrated = false;
function migrateLegacyKeys(): void {
  if (_migrated) return;
  _migrated = true;
  try {
    const existing = localStorage.getItem(PREFS_KEY);
    const current: Record<string, unknown> = existing ? JSON.parse(existing) : {};
    let dirty = false;
    // iv_preferred_display_name (shipped before this module existed).
    const legacyName = localStorage.getItem('iv_preferred_display_name');
    if (legacyName && current.displayName == null) {
      current.displayName = legacyName.trim() || null;
      dirty = true;
      localStorage.removeItem('iv_preferred_display_name');
    }
    if (dirty) {
      localStorage.setItem(PREFS_KEY, JSON.stringify(current));
    }
  } catch { /* ignore */ }
}

/** Read the full preferences object, merged with defaults so missing keys
 *  resolve to a known value (rather than `undefined`). */
export function loadPreferences(): UserPreferences {
  migrateLegacyKeys();
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return { ...DEFAULTS, ...parsed };
      }
    }
  } catch {
    /* Corrupt JSON — fall through to defaults. We deliberately don't
       wipe the bad blob; if it later parses, fine. */
  }
  return { ...DEFAULTS };
}

/** Merge `partial` into the stored prefs and write back. */
export function savePreferences(partial: Partial<UserPreferences>): UserPreferences {
  const current = loadPreferences();
  const merged: UserPreferences = { ...current, ...partial };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(merged));
  } catch {
    /* localStorage quota exceeded — rare; ignore. */
  }
  // Dispatch a same-window event so consumers can subscribe to changes
  // without ping-ponging through the native `storage` event (which only
  // fires in OTHER tabs).
  try {
    window.dispatchEvent(new CustomEvent('iv:user-prefs:changed', { detail: merged }));
  } catch { /* SSR / no window */ }
  return merged;
}

/** Typed single-key write. */
export function savePref<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]): void {
  savePreferences({ [key]: value } as Partial<UserPreferences>);
}

/** Typed single-key read. */
export function getPref<K extends keyof UserPreferences>(key: K): UserPreferences[K] {
  return loadPreferences()[key];
}

/** Wipe the prefs blob. Reserved for the user explicitly clicking
 *  "Reset all preferences" — auth-context logout MUST NOT call this. */
export function clearAllPreferences(): void {
  try { localStorage.removeItem(PREFS_KEY); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent('iv:user-prefs:changed', { detail: DEFAULTS })); } catch { /* ignore */ }
}

/** Subscribe to in-window pref changes. Returns an unsubscribe fn. */
export function subscribePreferences(cb: (prefs: UserPreferences) => void): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail as UserPreferences | undefined;
    cb(detail ?? loadPreferences());
  };
  window.addEventListener('iv:user-prefs:changed', handler as EventListener);
  return () => window.removeEventListener('iv:user-prefs:changed', handler as EventListener);
}
