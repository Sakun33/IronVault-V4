/**
 * Vault Autofill Hook
 * 
 * Provides autofill functionality for password fields and other sensitive inputs.
 * Detects fields, binds listeners, and manages inline prompts.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { VaultEntry, extractDomain } from '@/lib/vault-autofill-crypto';
import { localVaultStore } from '@/lib/vault-autofill-store';

export interface VaultAutofillOptions {
  enabled?: boolean;
  selector?: string; // CSS selector for fields to target
  includePasswordFields?: boolean;
  includeDataVaultIdent?: boolean;
}

export interface VaultAutofillState {
  isPromptVisible: boolean;
  targetElement: HTMLElement | null;
  domain: string;
  type: VaultEntry['type'];
}

const DEFAULT_OPTIONS: VaultAutofillOptions = {
  enabled: true,
  selector: 'input[type="password"], input[data-vault-ident]',
  includePasswordFields: true,
  includeDataVaultIdent: true,
};

/**
 * Hook to enable vault autofill on password and sensitive input fields
 * @param options - Configuration options
 * @returns Autofill state and control functions
 */
export function useVaultAutofill(options: VaultAutofillOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const [promptState, setPromptState] = useState<VaultAutofillState>({
    isPromptVisible: false,
    targetElement: null,
    domain: extractDomain(window.location.hostname || 'localhost'),
    type: 'password',
  });

  const [isEnabled, setIsEnabled] = useState(opts.enabled ?? true);
  const observerRef = useRef<MutationObserver | null>(null);
  const boundFieldsRef = useRef<Set<HTMLElement>>(new Set());

  /**
   * Show autofill prompt for a specific element
   */
  const showPrompt = useCallback((element: HTMLElement) => {
    // Check if domain is in never list
    const domain = extractDomain(window.location.hostname || 'localhost');
    localVaultStore.isNeverForDomain(domain).then(isNever => {
      if (isNever) return;

      // Determine type from element
      const type = element.getAttribute('data-vault-type') as VaultEntry['type'] || 'password';

      setPromptState({
        isPromptVisible: true,
        targetElement: element,
        domain,
        type,
      });
    });
  }, []);

  /**
   * Hide autofill prompt
   */
  const hidePrompt = useCallback(() => {
    setPromptState(prev => ({
      ...prev,
      isPromptVisible: false,
      targetElement: null,
    }));
  }, []);

  /**
   * Handle autofill selection
   */
  const handleAutofill = useCallback((value: string, element: HTMLElement) => {
    // Set the value
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      element.value = value;
      
      // Trigger change event for React
      const event = new Event('input', { bubbles: true });
      element.dispatchEvent(event);
    }

    hidePrompt();
  }, [hidePrompt]);

  /**
   * Bind autofill listeners to an element
   */
  const bindElement = useCallback((element: HTMLElement) => {
    if (boundFieldsRef.current.has(element)) return;

    const handleFocus = () => {
      if (!isEnabled) return;
      showPrompt(element);
    };

    const handleBlur = () => {
      // Delay to allow click on prompt
      setTimeout(hidePrompt, 200);
    };

    element.addEventListener('focus', handleFocus);
    element.addEventListener('blur', handleBlur);

    boundFieldsRef.current.add(element);

    // Cleanup on unmount
    return () => {
      element.removeEventListener('focus', handleFocus);
      element.removeEventListener('blur', handleBlur);
      boundFieldsRef.current.delete(element);
    };
  }, [isEnabled, showPrompt, hidePrompt]);

  /**
   * Scan DOM for autofill fields
   */
  const scanForFields = useCallback(() => {
    if (!opts.selector) return;

    const fields = document.querySelectorAll<HTMLElement>(opts.selector);
    fields.forEach(field => bindElement(field));
  }, [opts.selector, bindElement]);

  /**
   * Initialize autofill on mount
   */
  useEffect(() => {
    if (!isEnabled) return;

    // Initial scan
    scanForFields();

    // Watch for dynamically added fields
    observerRef.current = new MutationObserver(() => {
      scanForFields();
    });

    observerRef.current.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observerRef.current?.disconnect();
      
      // Clean up all bound fields
      boundFieldsRef.current.forEach(field => {
        // Listeners will be cleaned up by individual cleanup functions
      });
      boundFieldsRef.current.clear();
    };
  }, [isEnabled, scanForFields]);

  /**
   * Enable/disable autofill based on user preference
   */
  useEffect(() => {
    const checkUserPref = async () => {
      const pref = localStorage.getItem('enableVaultPrompts');
      if (pref !== null) {
        setIsEnabled(pref === 'true');
      }
    };

    checkUserPref();
  }, []);

  return {
    promptState,
    isEnabled,
    setIsEnabled: (enabled: boolean) => {
      setIsEnabled(enabled);
      localStorage.setItem('enableVaultPrompts', enabled.toString());
    },
    showPrompt,
    hidePrompt,
    handleAutofill,
    bindElement,
    scanForFields,
  };
}

/**
 * Hook to show save modal after creating/updating a secret
 */
export function useVaultSavePrompt() {
  const [saveModalState, setSaveModalState] = useState<{
    isOpen: boolean;
    secret: string;
    title: string;
    username?: string;
    type: VaultEntry['type'];
    domain?: string;
    tags?: string[];
  }>({
    isOpen: false,
    secret: '',
    title: '',
    type: 'password',
  });

  /**
   * Show save prompt for a secret
   */
  const promptSave = useCallback(async (data: {
    secret: string;
    title: string;
    username?: string;
    type: VaultEntry['type'];
    domain?: string;
    tags?: string[];
  }) => {
    // Check if domain is in never list
    const domain = data.domain || extractDomain(window.location.hostname || 'localhost');
    const isNever = await localVaultStore.isNeverForDomain(domain);
    
    if (isNever) return;

    // Check user preference
    const enablePrompts = localStorage.getItem('enableVaultPrompts');
    if (enablePrompts === 'false') return;

    setSaveModalState({
      isOpen: true,
      ...data,
      domain,
    });
  }, []);

  /**
   * Close save modal
   */
  const closeSaveModal = useCallback(() => {
    setSaveModalState(prev => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  return {
    saveModalState,
    promptSave,
    closeSaveModal,
  };
}

/**
 * Hook to manage vault autofill settings
 */
export function useVaultAutofillSettings() {
  const [settings, setSettings] = useState({
    enableVaultPrompts: true,
    autoFillOnSelect: true,
    showInlinePrompts: true,
  });

  useEffect(() => {
    const loadSettings = () => {
      setSettings({
        enableVaultPrompts: localStorage.getItem('enableVaultPrompts') !== 'false',
        autoFillOnSelect: localStorage.getItem('autoFillOnSelect') !== 'false',
        showInlinePrompts: localStorage.getItem('showInlinePrompts') !== 'false',
      });
    };

    loadSettings();
  }, []);

  const updateSetting = useCallback((key: keyof typeof settings, value: boolean) => {
    localStorage.setItem(key, value.toString());
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  return {
    settings,
    updateSetting,
  };
}

