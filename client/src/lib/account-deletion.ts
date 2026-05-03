/**
 * Account Deletion Service
 * 
 * Required by Apple App Store and Google Play Store policies.
 * Handles complete deletion of user data from CRM/backend.
 * Local vault data can be optionally preserved or deleted.
 */

export interface DeletionRequest {
  userId: string;
  email: string;
  deleteLocalData: boolean;
  reason?: string;
}

export interface DeletionResult {
  success: boolean;
  requestId: string;
  estimatedCompletionDays: number;
  error?: string;
}

export interface DeletionStatus {
  requestId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestedAt: string;
  completedAt?: string;
  deletedData: {
    crmRecord: boolean;
    subscriptions: boolean;
    supportTickets: boolean;
    activityLog: boolean;
    localVault: boolean;
  };
}

class AccountDeletionService {
  private apiBaseUrl: string;

  constructor() {
    this.apiBaseUrl = import.meta.env.VITE_API_URL || '/api';
  }

  /**
   * Request account and data deletion
   * This submits a deletion request to the backend.
   */
  async requestDeletion(request: DeletionRequest): Promise<DeletionResult> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/account/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: request.userId,
          email: request.email,
          deleteLocalData: request.deleteLocalData,
          reason: request.reason,
          requestedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          requestId: '',
          estimatedCompletionDays: 0,
          error: error.message || 'Failed to submit deletion request',
        };
      }

      const data = await response.json();
      return {
        success: true,
        requestId: data.requestId,
        estimatedCompletionDays: data.estimatedCompletionDays || 30,
      };
    } catch (error: any) {
      console.error('[AccountDeletion] Request failed:', error);
      return {
        success: false,
        requestId: '',
        estimatedCompletionDays: 0,
        error: error.message || 'Network error',
      };
    }
  }

  /**
   * Check status of a deletion request
   */
  async getDeletionStatus(requestId: string): Promise<DeletionStatus | null> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/account/delete/status/${requestId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return null;
      }

      return response.json();
    } catch (error) {
      console.error('[AccountDeletion] Status check failed:', error);
      return null;
    }
  }

  /**
   * Delete local vault data
   * This removes all IndexedDB databases associated with vaults.
   */
  async deleteLocalData(): Promise<boolean> {
    try {
      // Get list of all IndexedDB databases
      const databases = await indexedDB.databases();
      
      // Delete IronVault databases
      for (const db of databases) {
        if (db.name?.startsWith('IronVault')) {
          await this.deleteDatabase(db.name);
        }
      }

      // Clear localStorage items
      const keysToDelete: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('ironvault') || key?.startsWith('vault')) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => localStorage.removeItem(key));

      // Clear license/entitlements cache
      localStorage.removeItem('ironvault_entitlements_cache');
      localStorage.removeItem('ironvault_trial_used');
      localStorage.removeItem('license');
      localStorage.removeItem('billing_anonymous_user_id');

      return true;
    } catch (error) {
      console.error('[AccountDeletion] Failed to delete local data:', error);
      return false;
    }
  }

  /**
   * Delete a specific IndexedDB database
   */
  private deleteDatabase(dbName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(dbName);
      
      request.onsuccess = () => {
        resolve();
      };
      
      request.onerror = () => {
        console.error(`[AccountDeletion] Failed to delete database: ${dbName}`);
        reject(request.error);
      };
      
      request.onblocked = () => {
        // Still resolve - the database might be deleted when connections close
        resolve();
      };
    });
  }

  /**
   * Get data that will be deleted (for user confirmation)
   */
  getDataToBeDeleted(): string[] {
    return [
      'Your account profile and contact information',
      'Subscription and billing history',
      'Support tickets and communications',
      'Activity and usage logs',
      'Any CRM records associated with your account',
    ];
  }

  /**
   * Get data that will NOT be deleted (local-only data)
   */
  getLocalOnlyData(): string[] {
    return [
      'Vault data stored on this device (encrypted)',
      'Passwords, notes, and documents in your vault',
      'This data never leaves your device unless you choose to delete it',
    ];
  }
}

export const accountDeletionService = new AccountDeletionService();
