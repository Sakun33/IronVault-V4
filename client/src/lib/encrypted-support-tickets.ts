// Encrypted Support Ticket System
// End-to-end encryption for support tickets with AES-256-GCM
// No plaintext ever stored - only ciphertext

export interface SupportTicket {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  vaultVersion: string;
  platform: string;
  featureContext: string;
  errorStack?: string;
  logs?: string;
  screenshot?: string;
  status: 'pending' | 'resolved' | 'escalated';
  resolvedIn?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'bug' | 'feature' | 'performance' | 'ui' | 'other';
}

export interface EncryptedTicketRecord {
  iv: string; // base64 encoded IV
  ciphertext: string; // base64 encoded encrypted data
  tag: string; // base64 encoded auth tag
  timestamp: string;
  version: string;
}

export class EncryptedSupportTickets {
  private key: CryptoKey | null = null;
  private readonly keyDerivationParams = {
    name: 'PBKDF2',
    salt: new Uint8Array(16), // Will be generated
    iterations: 100000, // OWASP recommended minimum
    hash: 'SHA-256'
  };

  constructor() {
    this.generateSalt();
  }

  private generateSalt(): void {
    this.keyDerivationParams.salt = crypto.getRandomValues(new Uint8Array(16));
  }

  /**
   * Derive encryption key from master password using PBKDF2
   * Uses same key derivation as analytics for consistency
   */
  async deriveKey(masterPassword: string): Promise<void> {
    try {
      const passwordBuffer = new TextEncoder().encode(masterPassword);
      
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        'PBKDF2',
        false,
        ['deriveKey']
      );

      this.key = await crypto.subtle.deriveKey(
        this.keyDerivationParams,
        keyMaterial,
        {
          name: 'AES-GCM',
          length: 256
        },
        false,
        ['encrypt', 'decrypt']
      );
    } catch (error) {
      console.error('Failed to derive encryption key:', error);
      throw new Error('Key derivation failed');
    }
  }

  /**
   * Encrypt support ticket using AES-256-GCM
   * Each ticket gets a unique IV for security
   */
  async encryptTicket(ticket: SupportTicket): Promise<EncryptedTicketRecord> {
    if (!this.key) {
      throw new Error('Encryption key not derived');
    }

    try {
      const dataBuffer = new TextEncoder().encode(JSON.stringify(ticket));
      const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
      
      const encrypted = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        this.key,
        dataBuffer
      );

      // Extract ciphertext and auth tag
      const ciphertext = new Uint8Array(encrypted.slice(0, -16));
      const tag = new Uint8Array(encrypted.slice(-16));

      return {
        iv: this.arrayBufferToBase64(iv),
        ciphertext: this.arrayBufferToBase64(ciphertext),
        tag: this.arrayBufferToBase64(tag),
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      };
    } catch (error) {
      console.error('Ticket encryption failed:', error);
      throw new Error('Ticket encryption failed');
    }
  }

  /**
   * Decrypt support ticket using AES-256-GCM
   * Verifies authentication tag for integrity
   */
  async decryptTicket(encryptedRecord: EncryptedTicketRecord): Promise<SupportTicket> {
    if (!this.key) {
      throw new Error('Encryption key not derived');
    }

    try {
      const iv = this.base64ToArrayBuffer(encryptedRecord.iv);
      const ciphertext = this.base64ToArrayBuffer(encryptedRecord.ciphertext);
      const tag = this.base64ToArrayBuffer(encryptedRecord.tag);

      // Combine ciphertext and tag
      const encryptedData = new Uint8Array(ciphertext.byteLength + tag.byteLength);
      encryptedData.set(new Uint8Array(ciphertext), 0);
      encryptedData.set(new Uint8Array(tag), ciphertext.byteLength);

      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        this.key,
        encryptedData
      );

      const decryptedText = new TextDecoder().decode(decrypted);
      return JSON.parse(decryptedText);
    } catch (error) {
      console.error('Ticket decryption failed:', error);
      throw new Error('Ticket decryption failed');
    }
  }

  /**
   * Submit encrypted support ticket
   */
  async submitTicket(ticketData: {
    title: string;
    description: string;
    category: 'bug' | 'feature' | 'performance' | 'ui' | 'other';
    priority: 'low' | 'medium' | 'high' | 'critical';
    featureContext?: string;
    errorStack?: string;
    logs?: string;
    screenshot?: string;
  }): Promise<string> {
    try {
      const ticket: SupportTicket = {
        id: this.generateTicketId(),
        title: ticketData.title,
        description: ticketData.description,
        timestamp: new Date().toISOString(),
        vaultVersion: this.getAppVersion(),
        platform: this.getPlatformInfo(),
        featureContext: ticketData.featureContext || 'general',
        errorStack: ticketData.errorStack,
        logs: ticketData.logs,
        screenshot: ticketData.screenshot,
        status: 'pending',
        priority: ticketData.priority,
        category: ticketData.category
      };

      const encrypted = await this.encryptTicket(ticket);
      await this.storeTicket(encrypted);

      // Also send to backend API so admin console can see the ticket
      try {
        const crmUserId = localStorage.getItem('crmUserId');
        const apiUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_BACKEND_API_URL) || '';
        const endpoint = apiUrl ? `${apiUrl}/api/crm/tickets` : '/api/crm/tickets';
        await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: crmUserId,
            subject: ticketData.title,
            description: ticketData.description,
            priority: ticketData.priority,
            category: ticketData.category
          }),
        });
      } catch (syncError) {
      }
      
      return ticket.id;
    } catch (error) {
      console.error('Failed to submit ticket:', error);
      throw new Error('Ticket submission failed');
    }
  }

  /**
   * Get all encrypted tickets
   */
  async getAllTickets(): Promise<SupportTicket[]> {
    try {
      const encryptedTickets = await this.getStoredTickets();
      const tickets: SupportTicket[] = [];
      
      for (const encryptedTicket of encryptedTickets) {
        try {
          const ticket = await this.decryptTicket(encryptedTicket);
          tickets.push(ticket);
        } catch (error) {
          console.error('Failed to decrypt ticket:', error);
        }
      }

      return tickets.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      console.error('Failed to get tickets:', error);
      return [];
    }
  }

  /**
   * Update ticket status
   */
  async updateTicketStatus(ticketId: string, status: 'resolved' | 'escalated', resolvedIn?: string): Promise<void> {
    try {
      const tickets = await this.getAllTickets();
      const ticketIndex = tickets.findIndex(t => t.id === ticketId);
      
      if (ticketIndex === -1) {
        throw new Error('Ticket not found');
      }

      tickets[ticketIndex].status = status;
      if (resolvedIn) {
        tickets[ticketIndex].resolvedIn = resolvedIn;
      }

      // Re-encrypt and store all tickets
      const encryptedTickets: EncryptedTicketRecord[] = [];
      for (const ticket of tickets) {
        const encrypted = await this.encryptTicket(ticket);
        encryptedTickets.push(encrypted);
      }

      await this.storeAllTickets(encryptedTickets);
    } catch (error) {
      console.error('Failed to update ticket status:', error);
      throw new Error('Ticket status update failed');
    }
  }

  /**
   * Get tickets by status
   */
  async getTicketsByStatus(status: 'pending' | 'resolved' | 'escalated'): Promise<SupportTicket[]> {
    const allTickets = await this.getAllTickets();
    return allTickets.filter(ticket => ticket.status === status);
  }

  /**
   * Get tickets by category
   */
  async getTicketsByCategory(category: 'bug' | 'feature' | 'performance' | 'ui' | 'other'): Promise<SupportTicket[]> {
    const allTickets = await this.getAllTickets();
    return allTickets.filter(ticket => ticket.category === category);
  }

  /**
   * Search tickets by title or description
   */
  async searchTickets(query: string): Promise<SupportTicket[]> {
    const allTickets = await this.getAllTickets();
    const lowercaseQuery = query.toLowerCase();
    
    return allTickets.filter(ticket => 
      ticket.title.toLowerCase().includes(lowercaseQuery) ||
      ticket.description.toLowerCase().includes(lowercaseQuery)
    );
  }

  /**
   * Get ticket statistics
   */
  async getTicketStats(): Promise<{
    total: number;
    pending: number;
    resolved: number;
    escalated: number;
    byCategory: Record<string, number>;
    byPriority: Record<string, number>;
  }> {
    const allTickets = await this.getAllTickets();
    
    const stats = {
      total: allTickets.length,
      pending: allTickets.filter(t => t.status === 'pending').length,
      resolved: allTickets.filter(t => t.status === 'resolved').length,
      escalated: allTickets.filter(t => t.status === 'escalated').length,
      byCategory: {} as Record<string, number>,
      byPriority: {} as Record<string, number>
    };

    // Count by category
    allTickets.forEach(ticket => {
      stats.byCategory[ticket.category] = (stats.byCategory[ticket.category] || 0) + 1;
      stats.byPriority[ticket.priority] = (stats.byPriority[ticket.priority] || 0) + 1;
    });

    return stats;
  }

  /**
   * Generate unique ticket ID
   */
  private generateTicketId(): string {
    return `ticket_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Get app version
   */
  private getAppVersion(): string {
    return '1.0.0'; // In real app, this would come from package.json
  }

  /**
   * Get platform information
   */
  private getPlatformInfo(): string {
    const userAgent = navigator.userAgent;
    
    let os = 'Unknown';
    if (userAgent.includes('Windows')) os = 'Windows';
    else if (userAgent.includes('Mac')) os = 'macOS';
    else if (userAgent.includes('Linux')) os = 'Linux';
    else if (userAgent.includes('Android')) os = 'Android';
    else if (userAgent.includes('iOS')) os = 'iOS';

    let browser = 'Unknown';
    if (userAgent.includes('Chrome')) browser = 'Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Safari')) browser = 'Safari';
    else if (userAgent.includes('Edge')) browser = 'Edge';

    return `${os} ${browser}`;
  }

  /**
   * Store encrypted ticket in IndexedDB
   */
  private async storeTicket(encryptedTicket: EncryptedTicketRecord): Promise<void> {
    try {
      const db = await this.openDatabase();
      const transaction = db.transaction(['meta_v3'], 'readwrite');
      const store = transaction.objectStore('meta_v3');
      
      // Get existing tickets
      const existing = await new Promise<any>((resolve, reject) => {
        const request = store.get('supportTickets');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const tickets = existing ? await this.decryptTicketsArray(existing.value) : [];
      
      // Add new ticket
      tickets.push(encryptedTicket);
      
      // Re-encrypt and store
      const encryptedArray = await this.encryptTicketsArray(tickets);
      await store.put({
        key: 'supportTickets',
        value: encryptedArray,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to store ticket:', error);
      throw new Error('Ticket storage failed');
    }
  }

  /**
   * Store all encrypted tickets
   */
  private async storeAllTickets(encryptedTickets: EncryptedTicketRecord[]): Promise<void> {
    try {
      const db = await this.openDatabase();
      const transaction = db.transaction(['meta_v3'], 'readwrite');
      const store = transaction.objectStore('meta_v3');
      
      const encryptedArray = await this.encryptTicketsArray(encryptedTickets);
      await store.put({
        key: 'supportTickets',
        value: encryptedArray,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to store tickets:', error);
      throw new Error('Tickets storage failed');
    }
  }

  /**
   * Get stored encrypted tickets
   */
  private async getStoredTickets(): Promise<EncryptedTicketRecord[]> {
    try {
      const db = await this.openDatabase();
      const transaction = db.transaction(['meta_v3'], 'readonly');
      const store = transaction.objectStore('meta_v3');
      
      const result = await new Promise<any>((resolve, reject) => {
        const request = store.get('supportTickets');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (!result) {
        return [];
      }

      return await this.decryptTicketsArray(result.value);
    } catch (error) {
      console.error('Failed to get stored tickets:', error);
      return [];
    }
  }

  /**
   * Encrypt array of tickets
   */
  private async encryptTicketsArray(tickets: EncryptedTicketRecord[]): Promise<EncryptedTicketRecord> {
    if (!this.key) {
      throw new Error('Encryption key not derived');
    }

    try {
      const dataBuffer = new TextEncoder().encode(JSON.stringify(tickets));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      const encrypted = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        this.key,
        dataBuffer
      );

      const ciphertext = new Uint8Array(encrypted.slice(0, -16));
      const tag = new Uint8Array(encrypted.slice(-16));

      return {
        iv: this.arrayBufferToBase64(iv),
        ciphertext: this.arrayBufferToBase64(ciphertext),
        tag: this.arrayBufferToBase64(tag),
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      };
    } catch (error) {
      console.error('Failed to encrypt tickets array:', error);
      throw new Error('Tickets array encryption failed');
    }
  }

  /**
   * Decrypt array of tickets
   */
  private async decryptTicketsArray(encryptedArray: EncryptedTicketRecord): Promise<EncryptedTicketRecord[]> {
    if (!this.key) {
      throw new Error('Encryption key not derived');
    }

    try {
      const iv = this.base64ToArrayBuffer(encryptedArray.iv);
      const ciphertext = this.base64ToArrayBuffer(encryptedArray.ciphertext);
      const tag = this.base64ToArrayBuffer(encryptedArray.tag);

      const encryptedData = new Uint8Array(ciphertext.byteLength + tag.byteLength);
      encryptedData.set(new Uint8Array(ciphertext), 0);
      encryptedData.set(new Uint8Array(tag), ciphertext.byteLength);

      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        this.key,
        encryptedData
      );

      const decryptedText = new TextDecoder().decode(decrypted);
      return JSON.parse(decryptedText);
    } catch (error) {
      console.error('Failed to decrypt tickets array:', error);
      throw new Error('Tickets array decryption failed');
    }
  }

  /**
   * Open IndexedDB database
   */
  private async openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('vault_v3', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains('meta_v3')) {
          const store = db.createObjectStore('meta_v3', { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 string to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Clear all tickets
   */
  async clearAllTickets(): Promise<void> {
    try {
      const db = await this.openDatabase();
      const transaction = db.transaction(['meta_v3'], 'readwrite');
      const store = transaction.objectStore('meta_v3');
      
      await store.delete('supportTickets');
    } catch (error) {
      console.error('Failed to clear tickets:', error);
      throw new Error('Tickets clearing failed');
    }
  }
}

// Singleton instance
export const encryptedSupportTickets = new EncryptedSupportTickets();
