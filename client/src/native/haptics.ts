import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNativeApp } from './platform';

export async function hapticLight() {
  if (!isNativeApp()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (error) {
  }
}

export async function hapticMedium() {
  if (!isNativeApp()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch (error) {
  }
}

export async function hapticHeavy() {
  if (!isNativeApp()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Heavy });
  } catch (error) {
  }
}

export async function hapticSuccess() {
  if (!isNativeApp()) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch (error) {
  }
}

export async function hapticWarning() {
  if (!isNativeApp()) return;
  try {
    await Haptics.notification({ type: NotificationType.Warning });
  } catch (error) {
  }
}

export async function hapticError() {
  if (!isNativeApp()) return;
  try {
    await Haptics.notification({ type: NotificationType.Error });
  } catch (error) {
  }
}

export async function hapticSelection() {
  if (!isNativeApp()) return;
  try {
    await Haptics.selectionStart();
    await Haptics.selectionChanged();
    await Haptics.selectionEnd();
  } catch (error) {
  }
}
