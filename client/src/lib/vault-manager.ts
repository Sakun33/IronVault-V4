import { VaultStorage } from './storage';
import { vaultIndex, VaultIndexEntry, MAX_FAILED_ATTEMPTS, LOCKOUT_DURATION_MS } from './vault-index';
import { CryptoService } from './crypto';

export interface VaultInfo {
  id: string;
  name: string;
  createdAt: Date;
  lastAccessedAt: Date;
  isDefault: boolean;
  biometricEnabled: boolean;
  itemCount: number;
  iconColor: string;
  isLocked?: boolean; // Locked by plan
}

export interface VaultListEntry {
  id: string;
  name: string;
  createdAt: string;
  lastAccessedAt: string;
  isDefault: boolean;
  biometricEnabled: boolean;
  iconColor: string;
}

export interface LockoutState {
  isLocked: boolean;
  remainingMs: number;
  failedAttempts: number;
}

const VAULT_REGISTRY_KEY = 'ironvault_registry';           // unscoped (legacy / fallback)
const ACTIVE_VAULT_KEY = 'ironvault_active_vault';         // unscoped (legacy / fallback)
const VAULT_PASSWORDS_GLOBAL_KEY = 'ironvault_passwords'; // unscoped (legacy / fallback)
const BIOMETRIC_KEY_PREFIX = 'ironvault_biometric_';
const MAX_VAULTS_FREE = 1;
const MAX_VAULTS_PAID = 5;

// Re-export for convenience
export { MAX_FAILED_ATTEMPTS, LOCKOUT_DURATION_MS };

const ICON_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
];

// Store password verification data per vault
interface VaultPasswordData {
  vaultId: string;
  salt: string;
  verificationHash: string;
}

export class VaultManager {
  private static instance: VaultManager;
  private vaultStorages: Map<string, VaultStorage> = new Map();
  private activeVaultId: string | null = null;
  private _accountEmail: string | null = null;

  private constructor() {}

  // ── Email-scoped localStorage key helpers ─────────────────────────────────

  /** Safe suffix derived from an email: lower-cased, only alphanumeric/._- */
  private static emailSuffix(email: string): string {
    return email.toLowerCase().replace(/[^a-z0-9._@-]/g, '_');
  }

  private get registryKey(): string {
    return this._accountEmail
      ? `ironvault_registry_${VaultManager.emailSuffix(this._accountEmail)}`
      : VAULT_REGISTRY_KEY;
  }

  private get activeVaultKey(): string {
    return this._accountEmail
      ? `ironvault_active_vault_${VaultManager.emailSuffix(this._accountEmail)}`
      : ACTIVE_VAULT_KEY;
  }

  private get vaultPasswordsKey(): string {
    return this._accountEmail
      ? `ironvault_passwords_${VaultManager.emailSuffix(this._accountEmail)}`
      : VAULT_PASSWORDS_GLOBAL_KEY;
  }

  /**
   * Scope all vault data to a specific account email.
   * On first call for a given email, migrates any existing unscoped registry data
   * so existing users don't lose their vaults on upgrade.
   */
  setAccountEmail(email: string): void {
    const normalized = email.toLowerCase().trim();
    const suffix = VaultManager.emailSuffix(normalized);
    const scopedRegistryKey = `ironvault_registry_${suffix}`;

    // One-time migration: if no scoped registry exists yet but an unscoped one does, copy it over.
    if (!localStorage.getItem(scopedRegistryKey)) {
      const legacy = localStorage.getItem(VAULT_REGISTRY_KEY);
      if (legacy && legacy !== '[]') {
        localStorage.setItem(scopedRegistryKey, legacy);
        // Remove the unscoped registry so the next account login starts clean.
        localStorage.removeItem(VAULT_REGISTRY_KEY);
        localStorage.removeItem(ACTIVE_VAULT_KEY);
        localStorage.removeItem(VAULT_PASSWORDS_GLOBAL_KEY);
      }
    }

    this._accountEmail = normalized;
    // Reset in-memory active vault so it's re-read from the scoped key
    this.activeVaultId = null;
  }

  /** Called on account logout — vault data stays in scoped keys for next login. */
  clearAccountEmail(): void {
    this._accountEmail = null;
    this.activeVaultId = null;
  }

  static getInstance(): VaultManager {
    if (!VaultManager.instance) {
      VaultManager.instance = new VaultManager();
    }
    return VaultManager.instance;
  }

  private getRegistry(): VaultListEntry[] {
    try {
      const data = localStorage.getItem(this.registryKey);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private saveRegistry(vaults: VaultListEntry[]): void {
    localStorage.setItem(this.registryKey, JSON.stringify(vaults));
  }

  getActiveVaultId(): string | null {
    if (this.activeVaultId) return this.activeVaultId;

    try {
      const stored = localStorage.getItem(this.activeVaultKey);
      if (stored) {
        // Validate that this vault ID actually exists in the current (scoped) registry
        const registry = this.getRegistry();
        if (registry.find(v => v.id === stored)) {
          this.activeVaultId = stored;
          return stored;
        }
        // Stale pointer from a different account — discard it
        localStorage.removeItem(this.activeVaultKey);
      }
    } catch {}
    
    const registry = this.getRegistry();
    const defaultVault = registry.find(v => v.isDefault);
    if (defaultVault) {
      this.activeVaultId = defaultVault.id;
      return defaultVault.id;
    }
    
    if (registry.length > 0) {
      this.activeVaultId = registry[0].id;
      return registry[0].id;
    }
    
    return null;
  }

  setActiveVaultId(vaultId: string): void {
    this.activeVaultId = vaultId;
    localStorage.setItem(this.activeVaultKey, vaultId);
    
    const registry = this.getRegistry();
    const vault = registry.find(v => v.id === vaultId);
    if (vault) {
      vault.lastAccessedAt = new Date().toISOString();
      this.saveRegistry(registry);
    }
  }

  getVaultStorage(vaultId?: string): VaultStorage {
    const id = vaultId || this.getActiveVaultId() || 'default';
    
    if (!this.vaultStorages.has(id)) {
      const storage = new VaultStorage();
      (storage as any).dbName = `IronVault_${id}`;
      this.vaultStorages.set(id, storage);
    }
    
    return this.vaultStorages.get(id)!;
  }

  async listVaults(): Promise<VaultInfo[]> {
    const registry = this.getRegistry();
    
    // Don't auto-create vault - let the UI handle vault creation
    if (registry.length === 0) {
      return [];
    }
    
    return registry.map(v => ({
      id: v.id,
      name: v.name,
      createdAt: new Date(v.createdAt),
      lastAccessedAt: new Date(v.lastAccessedAt),
      isDefault: v.isDefault,
      biometricEnabled: v.biometricEnabled,
      itemCount: 0,
      iconColor: v.iconColor,
    }));
  }

  /**
   * Get existing vaults without auto-creating (for reset dialog)
   */
  getExistingVaults(): VaultInfo[] {
    const registry = this.getRegistry();
    return registry.map(v => ({
      id: v.id,
      name: v.name,
      createdAt: new Date(v.createdAt),
      lastAccessedAt: new Date(v.lastAccessedAt),
      isDefault: v.isDefault,
      biometricEnabled: v.biometricEnabled,
      itemCount: 0,
      iconColor: v.iconColor,
    }));
  }

  /**
   * Add an externally-created vault entry to the local registry without generating a new ID.
   * Used when registering cloud vaults that already have a server-assigned ID.
   */
  addToRegistry(entry: VaultListEntry): void {
    const registry = this.getRegistry();
    // Skip if already present
    if (registry.find(v => v.id === entry.id)) return;
    if (entry.isDefault) {
      registry.forEach(v => { v.isDefault = false; });
    }
    registry.push(entry);
    this.saveRegistry(registry);
  }

  /**
   * Check how many local vaults exist for the current account.
   * Used by UI to show upgrade prompts before hitting createVault().
   */
  getLocalVaultCount(): number {
    return this.getRegistry().length;
  }

  /**
   * Create a new local vault entry.
   *
   * Plan limits are enforced on the COMBINED total of local + cloud vaults
   * (a vault that is both local and cloud-synced counts as one). Callers
   * must pass `cloudVaultCount` — the number of cloud vaults that are NOT
   * already in the local registry — so we never count the same vault twice.
   *
   * @param planVaultLimit  total vaults allowed by the user's plan (-1 = unlimited)
   * @param cloudVaultCount number of cloud vaults outside the local registry
   */
  async createVault(
    name: string,
    isDefault = false,
    planVaultLimit?: number,
    cloudVaultCount = 0,
  ): Promise<VaultInfo> {
    const registry = this.getRegistry();

    // Enforce per-plan TOTAL vault limit when a limit is provided.
    const limit = planVaultLimit ?? MAX_VAULTS_FREE;
    const currentTotal = registry.length + Math.max(0, cloudVaultCount);
    if (limit !== -1 && currentTotal >= limit) {
      const limitLabel = limit === 1 ? '1 vault' : `${limit} vaults total`;
      throw new Error(`PLAN_LIMIT: Your current plan allows ${limitLabel} (local + cloud combined). Upgrade to create more.`);
    }

    const id = `vault_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const iconColor = ICON_COLORS[registry.length % ICON_COLORS.length];

    if (isDefault) {
      registry.forEach(v => { v.isDefault = false; });
    }

    const uniqueName = this.dedupeVaultName(name, registry);

    const newVault: VaultListEntry = {
      id,
      name: uniqueName,
      createdAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString(),
      isDefault,
      biometricEnabled: false,
      iconColor,
    };

    registry.push(newVault);
    this.saveRegistry(registry);

    return {
      id,
      name: uniqueName,
      createdAt: new Date(newVault.createdAt),
      lastAccessedAt: new Date(newVault.lastAccessedAt),
      isDefault,
      biometricEnabled: false,
      itemCount: 0,
      iconColor,
    };
  }

  /**
   * Resolve a vault name against the existing registry, appending a suffix
   * ("My Vault 2", "My Vault 3", …) if the requested name is already taken.
   * Comparison is case-insensitive on trimmed names.
   */
  private dedupeVaultName(requested: string, registry: VaultListEntry[]): string {
    const base = (requested || '').trim() || 'My Vault';
    const taken = new Set(registry.map(v => (v.name || '').trim().toLowerCase()));
    if (!taken.has(base.toLowerCase())) return base;
    let i = 2;
    while (taken.has(`${base} ${i}`.toLowerCase())) i++;
    return `${base} ${i}`;
  }

  async updateVault(vaultId: string, updates: Partial<Pick<VaultInfo, 'name' | 'isDefault' | 'biometricEnabled'>>): Promise<void> {
    const registry = this.getRegistry();
    const vaultIndex = registry.findIndex(v => v.id === vaultId);
    
    if (vaultIndex === -1) {
      throw new Error('Vault not found');
    }
    
    if (updates.isDefault) {
      registry.forEach(v => { v.isDefault = false; });
    }
    
    registry[vaultIndex] = {
      ...registry[vaultIndex],
      ...updates,
    };
    
    this.saveRegistry(registry);
  }

  async deleteVault(vaultId: string): Promise<void> {
    const registry = this.getRegistry();
    
    if (registry.length <= 1) {
      throw new Error('Cannot delete the last vault');
    }
    
    const vault = registry.find(v => v.id === vaultId);
    if (vault?.isDefault) {
      throw new Error('Cannot delete the default vault. Set another vault as default first.');
    }
    
    const updatedRegistry = registry.filter(v => v.id !== vaultId);
    this.saveRegistry(updatedRegistry);
    
    this.vaultStorages.delete(vaultId);
    
    try {
      const deleteRequest = indexedDB.deleteDatabase(`IronVault_${vaultId}`);
      deleteRequest.onerror = () => console.error('Failed to delete vault database');
    } catch (error) {
      console.error('Error deleting vault database:', error);
    }
    
    if (this.activeVaultId === vaultId) {
      const defaultVault = updatedRegistry.find(v => v.isDefault) || updatedRegistry[0];
      this.setActiveVaultId(defaultVault.id);
    }
  }

  getVaultInfo(vaultId: string): VaultInfo | null {
    const registry = this.getRegistry();
    const vault = registry.find(v => v.id === vaultId);
    
    if (!vault) return null;
    
    return {
      id: vault.id,
      name: vault.name,
      createdAt: new Date(vault.createdAt),
      lastAccessedAt: new Date(vault.lastAccessedAt),
      isDefault: vault.isDefault,
      biometricEnabled: vault.biometricEnabled,
      itemCount: 0,
      iconColor: vault.iconColor,
    };
  }

  canCreateVault(isPaidUser: boolean): boolean {
    const registry = this.getRegistry();
    const maxVaults = isPaidUser ? MAX_VAULTS_PAID : MAX_VAULTS_FREE;
    return registry.length < maxVaults;
  }

  getMaxVaults(isPaidUser: boolean): number {
    return isPaidUser ? MAX_VAULTS_PAID : MAX_VAULTS_FREE;
  }

  migrateExistingVault(): void {
    const registry = this.getRegistry();
    
    if (registry.length === 0) {
      // Only migrate if there's explicit evidence of existing vault data
      // Don't auto-create - this was causing issues after vault reset
      const hasExistingVaultFlag = localStorage.getItem('ironvault_has_vault') === 'true';
      
      if (hasExistingVaultFlag) {
        const defaultVault: VaultListEntry = {
          id: 'default',
          name: 'My Vault',
          createdAt: new Date().toISOString(),
          lastAccessedAt: new Date().toISOString(),
          isDefault: true,
          biometricEnabled: false,
          iconColor: ICON_COLORS[0],
        };
        
        this.saveRegistry([defaultVault]);
        this.setActiveVaultId('default');
      }
    }
  }

  // ============================================
  // Security / Lockout Methods
  // ============================================

  async getLockoutState(): Promise<LockoutState> {
    try {
      await vaultIndex.init();
      const isLocked = await vaultIndex.isLockedOut();
      const remainingMs = await vaultIndex.getLockoutTimeRemaining();
      const failedAttempts = await vaultIndex.getFailedAttemptCount();
      return { isLocked, remainingMs, failedAttempts };
    } catch (error) {
      console.error('Error getting lockout state:', error);
      return { isLocked: false, remainingMs: 0, failedAttempts: 0 };
    }
  }

  async recordFailedAttempt(): Promise<boolean> {
    try {
      await vaultIndex.init();
      return await vaultIndex.recordFailedAttempt();
    } catch (error) {
      console.error('Error recording failed attempt:', error);
      return false;
    }
  }

  async resetFailedAttempts(): Promise<void> {
    try {
      await vaultIndex.init();
      await vaultIndex.resetFailedAttempts();
    } catch (error) {
      console.error('Error resetting failed attempts:', error);
    }
  }

  clearInternalState(): void {
    // Clear all internal state for full reset
    this.vaultStorages.clear();
    this.activeVaultId = null;
    console.log('🗑️ Cleared vaultManager internal state');
  }

  async isLockedOut(): Promise<boolean> {
    try {
      await vaultIndex.init();
      return await vaultIndex.isLockedOut();
    } catch (error) {
      console.error('Error checking lockout:', error);
      return false;
    }
  }

  // ============================================
  // Plan-based Vault Access
  // ============================================

  canAccessVault(vault: VaultInfo, isPaidUser: boolean): boolean {
    if (isPaidUser) {
      return true; // Premium users can access all vaults
    }
    // Free users can only access the default vault
    return vault.isDefault;
  }

  getDefaultVault(): VaultInfo | null {
    const registry = this.getRegistry();
    const defaultVault = registry.find(v => v.isDefault);
    if (!defaultVault) return null;
    
    return {
      id: defaultVault.id,
      name: defaultVault.name,
      createdAt: new Date(defaultVault.createdAt),
      lastAccessedAt: new Date(defaultVault.lastAccessedAt),
      isDefault: defaultVault.isDefault,
      biometricEnabled: defaultVault.biometricEnabled,
      itemCount: 0,
      iconColor: defaultVault.iconColor,
    };
  }

  // ============================================
  // Biometric Key Storage
  // ============================================

  saveBiometricKey(vaultId: string, masterPassword: string): void {
    try {
      // Store encrypted biometric key (in production, use Keychain/Keystore)
      const key = btoa(masterPassword);
      localStorage.setItem(`${BIOMETRIC_KEY_PREFIX}${vaultId}`, key);
    } catch (error) {
      console.error('Error saving biometric key:', error);
    }
  }

  getBiometricKey(vaultId: string): string | null {
    try {
      const key = localStorage.getItem(`${BIOMETRIC_KEY_PREFIX}${vaultId}`);
      if (key) {
        return atob(key);
      }
    } catch (error) {
      console.error('Error getting biometric key:', error);
    }
    return null;
  }

  removeBiometricKey(vaultId: string): void {
    try {
      localStorage.removeItem(`${BIOMETRIC_KEY_PREFIX}${vaultId}`);
    } catch (error) {
      console.error('Error removing biometric key:', error);
    }
  }

  // ============================================
  // Multi-Vault Password Management
  // ============================================

  private getVaultPasswords(): VaultPasswordData[] {
    try {
      const data = localStorage.getItem(this.vaultPasswordsKey);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private saveVaultPasswords(passwords: VaultPasswordData[]): void {
    localStorage.setItem(this.vaultPasswordsKey, JSON.stringify(passwords));
  }

  /**
   * Create a password verification hash for a vault
   */
  async createVaultPassword(vaultId: string, masterPassword: string): Promise<void> {
    const salt = CryptoService.generateSalt();
    const saltBase64 = CryptoService.uint8ArrayToBase64(salt);
    
    // Create a verification hash using PBKDF2 with extractable key
    const key = await CryptoService.deriveKeyWithConfig(masterPassword, salt, {
      algorithm: 'PBKDF2',
      iterations: 100000,
      hash: 'SHA-256'
    }, true); // extractable = true for password verification
    
    // Export key and create verification hash
    const exportedKey = await crypto.subtle.exportKey('raw', key);
    const hashArray = Array.from(new Uint8Array(exportedKey));
    const verificationHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    const passwords = this.getVaultPasswords();
    // Remove existing entry for this vault if any
    const filtered = passwords.filter(p => p.vaultId !== vaultId);
    filtered.push({ vaultId, salt: saltBase64, verificationHash });
    this.saveVaultPasswords(filtered);
    
    console.log(`✅ Password created for vault: ${vaultId}`);
  }

  /**
   * Try to unlock a specific vault with a password
   */
  async tryUnlockVault(vaultId: string, masterPassword: string): Promise<boolean> {
    const passwords = this.getVaultPasswords();
    const vaultPassword = passwords.find(p => p.vaultId === vaultId);
    
    if (!vaultPassword) {
      console.log(`No password data for vault: ${vaultId}`);
      return false;
    }
    
    try {
      const salt = CryptoService.base64ToUint8Array(vaultPassword.salt);
      const key = await CryptoService.deriveKeyWithConfig(masterPassword, salt, {
        algorithm: 'PBKDF2',
        iterations: 100000,
        hash: 'SHA-256'
      }, true); // extractable = true for password verification
      
      const exportedKey = await crypto.subtle.exportKey('raw', key);
      const hashArray = Array.from(new Uint8Array(exportedKey));
      const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      return computedHash === vaultPassword.verificationHash;
    } catch (error) {
      console.error(`Error verifying password for vault ${vaultId}:`, error);
      return false;
    }
  }

  /**
   * Try password against ALL vaults and return the matching vault ID
   */
  async tryUnlockAnyVault(masterPassword: string): Promise<{ success: boolean; vaultId: string | null; vaultName: string | null }> {
    const registry = this.getRegistry();
    
    for (const vault of registry) {
      const success = await this.tryUnlockVault(vault.id, masterPassword);
      if (success) {
        console.log(`✅ Password matched vault: ${vault.name}`);
        return { success: true, vaultId: vault.id, vaultName: vault.name };
      }
    }
    
    console.log('❌ Password did not match any vault');
    return { success: false, vaultId: null, vaultName: null };
  }

  /**
   * Check if a password already exists for any vault (for duplicate detection during creation)
   */
  async checkPasswordExists(masterPassword: string): Promise<{ exists: boolean; vaultId: string | null; vaultName: string | null }> {
    const result = await this.tryUnlockAnyVault(masterPassword);
    return {
      exists: result.success,
      vaultId: result.vaultId,
      vaultName: result.vaultName
    };
  }

  /**
   * Remove password data for a vault (when deleting)
   */
  removeVaultPassword(vaultId: string): void {
    const passwords = this.getVaultPasswords();
    const filtered = passwords.filter(p => p.vaultId !== vaultId);
    this.saveVaultPasswords(filtered);
  }

  /**
   * Get vault count info
   */
  getVaultCount(): { current: number; max: number } {
    const registry = this.getRegistry();
    const isPaidUser = this.isPaidUser();
    return {
      current: registry.length,
      max: isPaidUser ? MAX_VAULTS_PAID : MAX_VAULTS_FREE
    };
  }

  /**
   * Check if user has a paid subscription
   */
  isPaidUser(): boolean {
    try {
      const profile = localStorage.getItem('customerProfile');
      if (profile) {
        const { subscription } = JSON.parse(profile);
        return subscription === 'lifetime' || 
               subscription === 'pro_monthly' || 
               subscription === 'pro_yearly' ||
               subscription === 'premium';
      }
    } catch (error) {
      console.error('Error checking paid status:', error);
    }
    return false;
  }

  /**
   * Check if this is the first vault (no customer info yet)
   * Returns true only if no customer profile AND no existing vaults
   */
  isFirstVault(): boolean {
    const profile = localStorage.getItem('customerProfile');
    const registry = this.getRegistry();
    
    // If there's a customer profile, it's not the first vault
    if (profile) {
      return false;
    }
    
    // If there are existing vaults but no profile, user may have cleared data
    // In this case, don't ask for customer info again (use simple dialog)
    if (registry.length > 0) {
      return false;
    }
    
    // No profile and no vaults - this is truly the first vault
    return true;
  }

  /**
   * Delete vault completely and decrease counter
   */
  async resetVault(vaultId: string): Promise<void> {
    const registry = this.getRegistry();
    const vault = registry.find(v => v.id === vaultId);
    
    if (!vault) {
      throw new Error('Vault not found');
    }
    
    // Remove password data
    this.removeVaultPassword(vaultId);
    
    // Remove biometric key
    this.removeBiometricKey(vaultId);
    
    // Remove from registry
    const updatedRegistry = registry.filter(v => v.id !== vaultId);
    
    // If deleted vault was default, set new default
    if (vault.isDefault && updatedRegistry.length > 0) {
      updatedRegistry[0].isDefault = true;
    }
    
    this.saveRegistry(updatedRegistry);
    
    // Delete IndexedDB for this vault
    try {
      const deleteRequest = indexedDB.deleteDatabase(`IronVault_${vaultId}`);
      deleteRequest.onerror = () => console.error('Failed to delete vault database');
    } catch (error) {
      console.error('Error deleting vault database:', error);
    }
    
    // Clean up storage map
    this.vaultStorages.delete(vaultId);
    
    // Update active vault if needed
    if (this.activeVaultId === vaultId) {
      const newDefault = updatedRegistry.find(v => v.isDefault) || updatedRegistry[0];
      if (newDefault) {
        this.setActiveVaultId(newDefault.id);
      } else {
        this.activeVaultId = null;
        localStorage.removeItem(this.activeVaultKey);
      }
    }

    console.log(`✅ Vault reset: ${vaultId}`);
  }
}

export const vaultManager = VaultManager.getInstance();
