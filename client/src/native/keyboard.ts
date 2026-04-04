import { Keyboard, KeyboardInfo } from '@capacitor/keyboard';
import { isNativeApp } from './platform';

let keyboardListeners: Array<() => void> = [];

export async function setupKeyboardHandling() {
  if (!isNativeApp()) return;

  try {
    const showListener = await Keyboard.addListener('keyboardWillShow', (info: KeyboardInfo) => {
      handleKeyboardShow(info);
    });

    const hideListener = await Keyboard.addListener('keyboardWillHide', () => {
      handleKeyboardHide();
    });

    keyboardListeners.push(
      () => showListener.remove(),
      () => hideListener.remove()
    );

    await Keyboard.setAccessoryBarVisible({ isVisible: true });
  } catch (error) {
    console.debug('Keyboard plugin not available:', error);
  }
}

export function cleanupKeyboardHandling() {
  keyboardListeners.forEach(remove => remove());
  keyboardListeners = [];
}

function handleKeyboardShow(info: KeyboardInfo) {
  const keyboardHeight = info.keyboardHeight;
  document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
  
  const activeElement = document.activeElement;
  if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
    setTimeout(() => {
      activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }
}

function handleKeyboardHide() {
  document.documentElement.style.setProperty('--keyboard-height', '0px');
}

export async function hideKeyboard() {
  if (!isNativeApp()) return;
  try {
    await Keyboard.hide();
  } catch (error) {
    console.debug('Could not hide keyboard:', error);
  }
}

export async function showKeyboard() {
  if (!isNativeApp()) return;
  try {
    await Keyboard.show();
  } catch (error) {
    console.debug('Could not show keyboard:', error);
  }
}
