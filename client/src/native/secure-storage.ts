import { Preferences } from '@capacitor/preferences';
import { isNativeApp } from './platform';

const SECURE_STORAGE_PREFIX = 'ss_secure_';

export interface SecureStorageOptions {
  encrypt?: boolean;
}

export async function setSecureItem(key: string, value: string, options?: SecureStorageOptions): Promise<void> {
  try {
    const storageKey = `${SECURE_STORAGE_PREFIX}${key}`;
    
    if (isNativeApp()) {
      await Preferences.set({ key: storageKey, value });
    } else {
      localStorage.setItem(storageKey, value);
    }
  } catch (error) {
    console.error('Failed to set secure item:', error);
    throw new Error('Failed to store secure data');
  }
}

export async function getSecureItem(key: string): Promise<string | null> {
  try {
    const storageKey = `${SECURE_STORAGE_PREFIX}${key}`;
    
    if (isNativeApp()) {
      const result = await Preferences.get({ key: storageKey });
      return result.value;
    } else {
      return localStorage.getItem(storageKey);
    }
  } catch (error) {
    console.error('Failed to get secure item:', error);
    return null;
  }
}

export async function removeSecureItem(key: string): Promise<void> {
  try {
    const storageKey = `${SECURE_STORAGE_PREFIX}${key}`;
    
    if (isNativeApp()) {
      await Preferences.remove({ key: storageKey });
    } else {
      localStorage.removeItem(storageKey);
    }
  } catch (error) {
    console.error('Failed to remove secure item:', error);
    throw new Error('Failed to remove secure data');
  }
}

export async function clearSecureStorage(): Promise<void> {
  try {
    if (isNativeApp()) {
      const { keys } = await Preferences.keys();
      for (const key of keys) {
        if (key.startsWith(SECURE_STORAGE_PREFIX)) {
          await Preferences.remove({ key });
        }
      }
    } else {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(SECURE_STORAGE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    }
  } catch (error) {
    console.error('Failed to clear secure storage:', error);
    throw new Error('Failed to clear secure data');
  }
}

export async function secureStorageAvailable(): Promise<boolean> {
  try {
    const testKey = `${SECURE_STORAGE_PREFIX}test`;
    const testValue = 'test';
    
    await setSecureItem('test', testValue);
    const retrieved = await getSecureItem('test');
    await removeSecureItem('test');
    
    return retrieved === testValue;
  } catch {
    return false;
  }
}
