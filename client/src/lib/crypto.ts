// Comprehensive crypto utilities for IronVault
// Implements proper key derivation, encryption, and security features

export interface KDFConfig {
  iterations: number;
  salt: Uint8Array;
  algorithm: string;
  hash: string;
}

export interface CryptoKDFConfig {
  algorithm: string;
  iterations: number;
  hash: string;
}

export class CryptoService {
  private static instance: CryptoService;
  
  // KDF presets for different security levels
  public static readonly KDF_PRESETS = {
    fast: {
      algorithm: 'PBKDF2',
      iterations: 100000,
      hash: 'SHA-256'
    },
    standard: {
      algorithm: 'PBKDF2',
      iterations: 600000,
      hash: 'SHA-256'
    },
    paranoid: {
      algorithm: 'PBKDF2',
      iterations: 2000000,
      hash: 'SHA-256'
    }
  };
  
  private constructor() {}
  
  public static getInstance(): CryptoService {
    if (!CryptoService.instance) {
      CryptoService.instance = new CryptoService();
    }
    return CryptoService.instance;
  }

  // Generate a random salt
  public static generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(16));
  }

  // Derive key from password using PBKDF2 (overloaded for default config)
  public static async deriveKey(
    password: string, 
    salt: Uint8Array, 
    config?: CryptoKDFConfig
  ): Promise<CryptoKey> {
    const actualConfig = config || this.KDF_PRESETS.standard;
    return this.deriveKeyWithConfig(password, salt, actualConfig);
  }

  // Derive key from password using PBKDF2 (with explicit config)
  public static async deriveKeyWithConfig(
    password: string, 
    salt: Uint8Array, 
    config: CryptoKDFConfig,
    extractable: boolean = false
  ): Promise<CryptoKey> {
    const passwordBuffer = new TextEncoder().encode(password);
    
    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveKey']
    );

    // Derive AES-GCM key
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: config.iterations,
        hash: config.hash
      },
      keyMaterial,
      {
        name: 'AES-GCM',
        length: 256
      },
      extractable,
      ['encrypt', 'decrypt']
    );

    return key;
  }

  // Derive key with progress callback
  public static async deriveKeyWithProgress(
    password: string,
    salt: Uint8Array,
    config: CryptoKDFConfig,
    progressCallback?: (progress: number) => void
  ): Promise<{ key: CryptoKey; timeMs: number }> {
    const startTime = performance.now();
    
    const passwordBuffer = new TextEncoder().encode(password);
    
    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveKey']
    );

    // Derive AES-GCM key
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: config.iterations,
        hash: config.hash
      },
      keyMaterial,
      {
        name: 'AES-GCM',
        length: 256
      },
      false,
      ['encrypt', 'decrypt']
    );

    const endTime = performance.now();
    const timeMs = endTime - startTime;

    if (progressCallback) {
      progressCallback(100);
    }

    return { key, timeMs };
  }

  // Convert Uint8Array to base64 string
  public static uint8ArrayToBase64(uint8Array: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
  }

  // Convert base64 string to Uint8Array
  public static base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  // Generate a random IV
  public static generateIV(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(12));
  }

  // Encrypt data with AES-GCM (overloaded for string input)
  public static async encrypt(
    data: string | Uint8Array,
    key: CryptoKey,
    iv?: Uint8Array
  ): Promise<{ encrypted: Uint8Array; iv: Uint8Array }> {
    try {
      const actualIV = iv || this.generateIV();
      const dataBuffer = typeof data === 'string' 
        ? new TextEncoder().encode(data)
        : data;

      const encrypted = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: actualIV,
        },
        key,
        dataBuffer
      );

      return { 
        encrypted: new Uint8Array(encrypted), 
        iv: actualIV 
      };
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  // Convert ArrayBuffer to base64 string
  public static arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // Decrypt data with AES-GCM
  public static async decrypt(
    encryptedData: Uint8Array,
    key: CryptoKey,
    iv: Uint8Array
  ): Promise<Uint8Array> {
    try {
      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv,
        },
        key,
        encryptedData
      );

      return new Uint8Array(decrypted);
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  // Generate a random key for AES-GCM
  public static async generateKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  // Utility function to generate random bytes
  public static generateRandomBytes(length: number): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(length));
  }

  // Convert base64 string to ArrayBuffer
  public static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Hash data (alias for hashData for compatibility)
  public static async hash(data: string): Promise<string> {
    return this.hashData(data);
  }

  // Utility function to hash data
  public static async hashData(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  // Benchmark KDF performance (mock implementation)
  public static async benchmarkKDF(password: string, iterations: number): Promise<number> {
    const start = performance.now();
    const salt = this.generateSalt();
    await this.deriveKey(password, salt, { algorithm: 'PBKDF2', iterations, hash: 'SHA-256' });
    return performance.now() - start;
  }
  
  // Recommend KDF preset based on device performance
  public static async recommendKDFPreset(): Promise<keyof typeof CryptoService.KDF_PRESETS> {
    // Simple performance test
    const testTime = await this.benchmarkKDF('test', 100000);
    
    if (testTime < 100) {
      return 'paranoid';
    } else if (testTime < 500) {
      return 'standard';
    } else {
      return 'fast';
    }
  }
}