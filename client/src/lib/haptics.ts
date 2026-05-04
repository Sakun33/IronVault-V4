// Lightweight wrapper around @capacitor/haptics. On web (or when Capacitor
// is unavailable) every helper is a cheap no-op so the call sites can fire
// haptics unconditionally without branching at the call site.
//
// We import @capacitor/haptics dynamically so it doesn't get pulled into the
// web bundle when only the native iOS/Android shells need it.

import { Capacitor } from '@capacitor/core';

let _hapticsModule: typeof import('@capacitor/haptics') | null = null;
let _moduleLoadFailed = false;

async function loadHapticsModule() {
  if (_hapticsModule || _moduleLoadFailed) return _hapticsModule;
  try {
    _hapticsModule = await import('@capacitor/haptics');
  } catch {
    _moduleLoadFailed = true;
    _hapticsModule = null;
  }
  return _hapticsModule;
}

function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export async function hapticLight(): Promise<void> {
  if (!isNative()) return;
  const m = await loadHapticsModule();
  if (!m) return;
  try { await m.Haptics.impact({ style: m.ImpactStyle.Light }); } catch { /* swallow — haptics is best-effort UX */ }
}

export async function hapticMedium(): Promise<void> {
  if (!isNative()) return;
  const m = await loadHapticsModule();
  if (!m) return;
  try { await m.Haptics.impact({ style: m.ImpactStyle.Medium }); } catch { /* noop */ }
}

export async function hapticHeavy(): Promise<void> {
  if (!isNative()) return;
  const m = await loadHapticsModule();
  if (!m) return;
  try { await m.Haptics.impact({ style: m.ImpactStyle.Heavy }); } catch { /* noop */ }
}

export async function hapticSuccess(): Promise<void> {
  if (!isNative()) return;
  const m = await loadHapticsModule();
  if (!m) return;
  try { await m.Haptics.notification({ type: m.NotificationType.Success }); } catch { /* noop */ }
}

export async function hapticWarning(): Promise<void> {
  if (!isNative()) return;
  const m = await loadHapticsModule();
  if (!m) return;
  try { await m.Haptics.notification({ type: m.NotificationType.Warning }); } catch { /* noop */ }
}

export async function hapticError(): Promise<void> {
  if (!isNative()) return;
  const m = await loadHapticsModule();
  if (!m) return;
  try { await m.Haptics.notification({ type: m.NotificationType.Error }); } catch { /* noop */ }
}

// Selection feedback — used for picker/swipe-handle changes on iOS.
export async function hapticSelection(): Promise<void> {
  if (!isNative()) return;
  const m = await loadHapticsModule();
  if (!m) return;
  try { await m.Haptics.selectionStart(); await m.Haptics.selectionEnd(); } catch { /* noop */ }
}
