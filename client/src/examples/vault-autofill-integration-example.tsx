/**
 * Vault Autofill Integration Example
 * 
 * This file demonstrates how to integrate the vault autofill feature into IronVault.
 * Copy and adapt the patterns shown here to add autofill to your forms.
 */

import React, { useState } from 'react';
import { useVaultAutofill, useVaultSavePrompt } from '@/hooks/use-vault-autofill';
import { VaultInlinePrompt } from '@/components/vault-inline-prompt';
import { VaultSaveModal } from '@/components/vault-save-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createPortal } from 'react-dom';

/**
 * Example 1: Password Form with Autofill
 * 
 * Shows how to add autofill to a password creation/update form.
 */
export function PasswordFormWithAutofill() {
  const [website, setWebsite] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const { saveModalState, promptSave, closeSaveModal } = useVaultSavePrompt();

  const handleSavePassword = async () => {
    // 1. Save to your main vault (existing logic)
    await saveToMainVault({ website, username, password });

    // 2. Prompt to save to autofill vault
    await promptSave({
      secret: password,
      title: `${website} Login`,
      username: username,
      type: 'password',
      domain: website,
      tags: ['password']
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Add New Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="example.com"
            />
          </div>
          
          <div>
            <Label htmlFor="username">Username/Email</Label>
            <Input
              id="username"
              type="email"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="user@example.com"
            />
          </div>
          
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
            />
          </div>
          
          <Button onClick={handleSavePassword}>
            Save Password
          </Button>
        </CardContent>
      </Card>

      {/* Vault Save Modal */}
      <VaultSaveModal
        open={saveModalState.isOpen}
        onOpenChange={closeSaveModal}
        {...saveModalState}
      />
    </>
  );
}

/**
 * Example 2: App-Wide Autofill Provider
 * 
 * Add this to your main App.tsx to enable autofill on all password fields.
 */
export function AppWithAutofill({ children }: { children: React.ReactNode }) {
  const { promptState, hidePrompt, handleAutofill } = useVaultAutofill({
    enabled: true,
    includePasswordFields: true,
    includeDataVaultIdent: true,
  });

  return (
    <>
      {children}
      
      {/* Render autofill prompt as portal */}
      {promptState.isPromptVisible && promptState.targetElement && 
        createPortal(
          <VaultInlinePrompt
            targetElement={promptState.targetElement}
            domain={promptState.domain}
            type={promptState.type}
            onSelect={(value) => 
              handleAutofill(value, promptState.targetElement!)
            }
            onDismiss={hidePrompt}
          />,
          document.body
        )
      }
    </>
  );
}

/**
 * Example 3: API Key Form
 * 
 * Shows how to save other secret types (not just passwords).
 */
export function ApiKeyFormWithAutofill() {
  const [serviceName, setServiceName] = useState('');
  const [apiKey, setApiKey] = useState('');
  
  const { saveModalState, promptSave, closeSaveModal } = useVaultSavePrompt();

  const handleSaveApiKey = async () => {
    // Save to main vault
    await saveToMainVault({ serviceName, apiKey });

    // Prompt to save to autofill vault
    await promptSave({
      secret: apiKey,
      title: `${serviceName} API Key`,
      type: 'api_key',
      domain: serviceName.toLowerCase().replace(/\s+/g, '-'),
      tags: ['api', 'key']
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Add API Key</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="service">Service Name</Label>
            <Input
              id="service"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              placeholder="OpenAI, Stripe, etc."
            />
          </div>
          
          <div>
            <Label htmlFor="apikey">API Key</Label>
            <Input
              id="apikey"
              type="password"
              data-vault-ident="api-key"
              data-vault-type="api_key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk_..."
            />
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Focus field to fetch saved API keys from vault
            </p>
          </div>
          
          <Button onClick={handleSaveApiKey}>
            Save API Key
          </Button>
        </CardContent>
      </Card>

      <VaultSaveModal
        open={saveModalState.isOpen}
        onOpenChange={closeSaveModal}
        {...saveModalState}
      />
    </>
  );
}

/**
 * Example 4: Custom Field Marking
 * 
 * Shows how to mark custom fields for autofill detection.
 */
export function CustomFieldExample() {
  return (
    <div className="space-y-4">
      {/* Standard password field - auto-detected */}
      <Input
        type="password"
        placeholder="Password (auto-detected)"
      />

      {/* Custom secure input - marked with data attributes */}
      <Input
        type="text"
        data-vault-ident="secret-token"
        data-vault-type="password"
        placeholder="Secret Token (custom marked)"
      />

      {/* API key input */}
      <Input
        type="password"
        data-vault-ident="api-key"
        data-vault-type="api_key"
        placeholder="API Key"
      />

      {/* Secure note textarea */}
      <textarea
        data-vault-ident="secure-note"
        data-vault-type="note"
        placeholder="Secure Note"
        className="w-full p-2 border rounded"
      />
    </div>
  );
}

/**
 * Example 5: Settings Panel
 * 
 * Shows how to let users control autofill settings.
 */
export function AutofillSettingsPanel() {
  const { settings, updateSetting } = useVaultAutofillSettings();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Autofill Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Enable Vault Prompts</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Show save prompts after creating secrets
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.enableVaultPrompts}
            onChange={(e) => updateSetting('enableVaultPrompts', e.target.checked)}
            className="w-4 h-4"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Auto-fill on Select</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Automatically fill fields when selecting from vault
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.autoFillOnSelect}
            onChange={(e) => updateSetting('autoFillOnSelect', e.target.checked)}
            className="w-4 h-4"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Show Inline Prompts</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Show autofill pills when focusing password fields
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.showInlinePrompts}
            onChange={(e) => updateSetting('showInlinePrompts', e.target.checked)}
            className="w-4 h-4"
          />
        </div>
      </CardContent>
    </Card>
  );
}

// Placeholder functions for example purposes
async function saveToMainVault(data: any) {
  console.log('Saving to main vault:', data);
  // Your existing vault save logic here
}

function useVaultAutofillSettings() {
  // This is imported from the hooks file
  return {
    settings: {
      enableVaultPrompts: true,
      autoFillOnSelect: true,
      showInlinePrompts: true,
    },
    updateSetting: (key: string, value: boolean) => {
      localStorage.setItem(key, value.toString());
    }
  };
}

