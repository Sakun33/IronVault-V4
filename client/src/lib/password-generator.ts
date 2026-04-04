export interface PasswordOptions {
  length: number;
  includeUppercase: boolean;
  includeLowercase: boolean;
  includeNumbers: boolean;
  includeSymbols: boolean;
  excludeSimilar: boolean;
}

export class PasswordGenerator {
  private static readonly UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  private static readonly LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
  private static readonly NUMBERS = '0123456789';
  private static readonly SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  private static readonly SIMILAR = '0O1lI';

  /**
   * Generates a cryptographically secure random integer between 0 and max-1
   * Uses rejection sampling to avoid modulo bias
   */
  private static secureRandomInt(max: number): number {
    if (max <= 0) throw new Error('Max must be greater than 0');
    
    const range = Math.floor(0x100000000 / max) * max; // Largest multiple of max <= 2^32
    let randomValue;
    
    do {
      randomValue = crypto.getRandomValues(new Uint32Array(1))[0];
    } while (randomValue >= range);
    
    return randomValue % max;
  }

  static generate(options: PasswordOptions): string {
    let charset = '';
    let password = '';
    
    // Build character set based on options
    if (options.includeUppercase) {
      charset += this.UPPERCASE;
    }
    if (options.includeLowercase) {
      charset += this.LOWERCASE;
    }
    if (options.includeNumbers) {
      charset += this.NUMBERS;
    }
    if (options.includeSymbols) {
      charset += this.SYMBOLS;
    }

    // Remove similar characters if requested
    if (options.excludeSimilar) {
      charset = charset.split('').filter(char => !this.SIMILAR.includes(char)).join('');
    }

    if (charset.length === 0) {
      throw new Error('At least one character type must be selected');
    }

    // Generate password using cryptographically secure random selection
    for (let i = 0; i < options.length; i++) {
      password += charset[this.secureRandomInt(charset.length)];
    }

    // Ensure at least one character from each selected type
    password = this.ensureCharacterTypes(password, options);

    return password;
  }

  private static ensureCharacterTypes(password: string, options: PasswordOptions): string {
    const chars = password.split('');
    
    // Create filtered character sets based on excludeSimilar option
    const filteredUppercase = options.excludeSimilar ? 
      this.UPPERCASE.split('').filter(char => !this.SIMILAR.includes(char)).join('') : this.UPPERCASE;
    const filteredLowercase = options.excludeSimilar ? 
      this.LOWERCASE.split('').filter(char => !this.SIMILAR.includes(char)).join('') : this.LOWERCASE;
    const filteredNumbers = options.excludeSimilar ? 
      this.NUMBERS.split('').filter(char => !this.SIMILAR.includes(char)).join('') : this.NUMBERS;
    const filteredSymbols = options.excludeSimilar ? 
      this.SYMBOLS.split('').filter(char => !this.SIMILAR.includes(char)).join('') : this.SYMBOLS;

    // Check what types are present
    let hasUppercase = false;
    let hasLowercase = false;
    let hasNumbers = false;
    let hasSymbols = false;

    for (const char of chars) {
      if (filteredUppercase.includes(char)) hasUppercase = true;
      if (filteredLowercase.includes(char)) hasLowercase = true;
      if (filteredNumbers.includes(char)) hasNumbers = true;
      if (filteredSymbols.includes(char)) hasSymbols = true;
    }

    // Collect missing types and their corresponding character sets
    const missingTypes: { charset: string; type: string }[] = [];
    
    if (options.includeUppercase && !hasUppercase && filteredUppercase.length > 0) {
      missingTypes.push({ charset: filteredUppercase, type: 'uppercase' });
    }
    if (options.includeLowercase && !hasLowercase && filteredLowercase.length > 0) {
      missingTypes.push({ charset: filteredLowercase, type: 'lowercase' });
    }
    if (options.includeNumbers && !hasNumbers && filteredNumbers.length > 0) {
      missingTypes.push({ charset: filteredNumbers, type: 'numbers' });
    }
    if (options.includeSymbols && !hasSymbols && filteredSymbols.length > 0) {
      missingTypes.push({ charset: filteredSymbols, type: 'symbols' });
    }

    // If we have more missing types than password length, we need to prioritize
    // Place one character of each type deterministically to avoid infinite loops
    if (missingTypes.length > 0) {
      const availableIndices = Array.from({ length: chars.length }, (_, i) => i);
      
      // Shuffle indices for random placement
      for (let i = availableIndices.length - 1; i > 0; i--) {
        const j = this.secureRandomInt(i + 1);
        [availableIndices[i], availableIndices[j]] = [availableIndices[j], availableIndices[i]];
      }

      // Place characters for missing types, reusing indices if necessary
      for (let i = 0; i < missingTypes.length; i++) {
        const indexToReplace = availableIndices[i % availableIndices.length];
        const randomChar = missingTypes[i].charset[this.secureRandomInt(missingTypes[i].charset.length)];
        chars[indexToReplace] = randomChar;
      }
    }

    return chars.join('');
  }

  static calculateStrength(password: string): {
    score: number;
    level: 'weak' | 'medium' | 'strong' | 'very-strong';
    feedback: string[];
  } {
    let score = 0;
    const feedback: string[] = [];

    // Length scoring
    if (password.length >= 8) score += 20;
    else feedback.push('Use at least 8 characters');

    if (password.length >= 12) score += 20;
    else if (password.length >= 8) feedback.push('Consider using 12+ characters');

    if (password.length >= 16) score += 10;

    // Character type scoring
    if (/[a-z]/.test(password)) score += 15;
    else feedback.push('Include lowercase letters');

    if (/[A-Z]/.test(password)) score += 15;
    else feedback.push('Include uppercase letters');

    if (/[0-9]/.test(password)) score += 10;
    else feedback.push('Include numbers');

    if (/[^A-Za-z0-9]/.test(password)) score += 10;
    else feedback.push('Include symbols');

    // Complexity bonus
    const uniqueChars = new Set(password).size;
    if (uniqueChars > password.length * 0.7) score += 10;

    // Penalty for common patterns
    if (/(.)\1{2,}/.test(password)) {
      score -= 10;
      feedback.push('Avoid repeating characters');
    }

    if (/123|abc|qwerty/i.test(password)) {
      score -= 15;
      feedback.push('Avoid common patterns');
    }

    score = Math.max(0, Math.min(100, score));

    let level: 'weak' | 'medium' | 'strong' | 'very-strong';
    if (score < 30) level = 'weak';
    else if (score < 60) level = 'medium';
    else if (score < 80) level = 'strong';
    else level = 'very-strong';

    return { score, level, feedback };
  }
}
