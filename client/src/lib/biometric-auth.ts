// Biometric Authentication Service
// Handles biometric authentication for document access

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
  method?: 'fingerprint' | 'face' | 'password';
}

export interface AuthChallenge {
  id: string;
  documentId: string;
  timestamp: Date;
  expiresAt: Date;
  method: 'biometric' | 'password';
}

export class BiometricAuthService {
  private static instance: BiometricAuthService;
  private isSupported: boolean = false;
  private publicKeyCredential: PublicKeyCredential | null = null;

  private constructor() {
    this.checkSupport();
  }

  public static getInstance(): BiometricAuthService {
    if (!BiometricAuthService.instance) {
      BiometricAuthService.instance = new BiometricAuthService();
    }
    return BiometricAuthService.instance;
  }

  // Check if biometric authentication is supported
  private async checkSupport(): Promise<void> {
    try {
      // Check if WebAuthn is supported
      if (typeof window !== 'undefined' && 
          window.PublicKeyCredential && 
          typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
        
        const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        this.isSupported = available;
      }
    } catch (error) {
      this.isSupported = false;
    }
  }

  // Check if biometric authentication is available
  public async isBiometricAvailable(): Promise<boolean> {
    await this.checkSupport();
    return this.isSupported;
  }

  // Register biometric credential
  public async registerBiometric(userId: string, userName: string): Promise<BiometricAuthResult> {
    try {
      if (!this.isSupported) {
        return { success: false, error: 'Biometric authentication not supported' };
      }

      // Generate challenge
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      // Create credential
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: challenge,
          rp: {
            name: "IronVault",
            id: window.location.hostname,
          },
          user: {
            id: new TextEncoder().encode(userId),
            name: userName,
            displayName: userName,
          },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 }, // ES256
            { type: "public-key", alg: -257 }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
          },
          timeout: 60000,
          attestation: "direct"
        }
      }) as PublicKeyCredential;

      if (credential) {
        this.publicKeyCredential = credential;
        return { success: true, method: 'fingerprint' };
      }

      return { success: false, error: 'Failed to create biometric credential' };
    } catch (error) {
      console.error('Biometric registration error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Authenticate with biometric
  public async authenticateBiometric(): Promise<BiometricAuthResult> {
    try {
      if (!this.isSupported) {
        return { success: false, error: 'Biometric authentication not supported' };
      }

      // Generate challenge
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      // Authenticate
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: challenge,
          timeout: 60000,
          userVerification: "required",
          rpId: window.location.hostname,
        }
      }) as PublicKeyCredential;

      if (assertion) {
        return { success: true, method: 'fingerprint' };
      }

      return { success: false, error: 'Authentication failed' };
    } catch (error) {
      console.error('Biometric authentication error:', error);
      
      // Handle specific error cases
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          return { success: false, error: 'Authentication was cancelled or not allowed' };
        } else if (error.name === 'NotSupportedError') {
          return { success: false, error: 'Biometric authentication not supported on this device' };
        } else if (error.name === 'SecurityError') {
          return { success: false, error: 'Security error during authentication' };
        }
      }
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Authenticate with password (fallback)
  public async authenticatePassword(password: string, masterPassword: string): Promise<BiometricAuthResult> {
    try {
      // In a real implementation, you would hash and compare passwords
      // For now, we'll do a simple comparison
      if (password === masterPassword) {
        return { success: true, method: 'password' };
      }
      
      return { success: false, error: 'Invalid password' };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Password authentication failed' 
      };
    }
  }

  // Create authentication challenge
  public createAuthChallenge(documentId: string, method: 'biometric' | 'password' = 'biometric'): AuthChallenge {
    const now = new Date();
    return {
      id: `challenge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      documentId,
      timestamp: now,
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000), // 5 minutes
      method
    };
  }

  // Validate authentication challenge
  public validateAuthChallenge(challenge: AuthChallenge): boolean {
    const now = new Date();
    return now <= challenge.expiresAt;
  }

  // Clear stored credentials
  public clearCredentials(): void {
    this.publicKeyCredential = null;
  }

  // Get authentication methods available
  public async getAvailableMethods(): Promise<Array<'biometric' | 'password'>> {
    const methods: Array<'biometric' | 'password'> = ['password']; // Password is always available
    
    if (await this.isBiometricAvailable()) {
      methods.unshift('biometric');
    }
    
    return methods;
  }

  // Check if device has biometric capabilities
  public async hasBiometricCapability(): Promise<boolean> {
    try {
      if (typeof window !== 'undefined' && 
          window.PublicKeyCredential && 
          typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
        
        return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  // Get device biometric type
  public async getBiometricType(): Promise<'fingerprint' | 'face' | 'unknown'> {
    try {
      if (await this.hasBiometricCapability()) {
        // In a real implementation, you would check the device capabilities
        // For now, we'll return 'fingerprint' as a default
        return 'fingerprint';
      }
      return 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }
}

// Export singleton instance
export const biometricAuthService = BiometricAuthService.getInstance();

// Utility function to check if we're in a secure context
export function isSecureContext(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext;
}

// Utility function to check if HTTPS is being used
export function isHTTPS(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'https:';
}

// Utility function to check if we're on localhost (for development)
export function isLocalhost(): boolean {
  return typeof window !== 'undefined' && 
         (window.location.hostname === 'localhost' || 
          window.location.hostname === '127.0.0.1' ||
          window.location.hostname === '::1');
}

// Check if biometric authentication is available in current context
export async function canUseBiometric(): Promise<boolean> {
  return isSecureContext() && (isHTTPS() || isLocalhost()) && 
         await biometricAuthService.isBiometricAvailable();
}
