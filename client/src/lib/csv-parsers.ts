import type { PasswordEntry } from '@shared/schema';

// CSV parsing utility functions
export class CSVParser {
  static parseCsvToRows(content: string): string[][] {
    const lines = content.trim().split('\n');
    const rows: string[][] = [];
    
    for (const line of lines) {
      // Simple CSV parsing - handles quoted fields with commas
      const row: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          row.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      
      row.push(current.trim());
      rows.push(row);
    }
    
    return rows;
  }

  static cleanField(field: string): string {
    return field.replace(/^"|"$/g, '').trim();
  }

  static createPasswordEntry(data: {
    name: string;
    url?: string;
    username: string;
    password: string;
    category?: string;
    notes?: string;
  }): PasswordEntry {
    return {
      id: crypto.randomUUID(),
      name: data.name || 'Imported Password',
      url: data.url || '',
      username: data.username || '',
      password: data.password || '',
      category: data.category || 'Imported',
      notes: data.notes || '',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastUsed: undefined,
    };
  }
}

// Password manager specific parsers
export class PasswordManagerParsers {
  // Chrome/Chromium CSV format
  static parseChrome(content: string): PasswordEntry[] {
    const rows = CSVParser.parseCsvToRows(content);
    const [header, ...dataRows] = rows;
    
    // Expected headers: name,url,username,password
    const entries: PasswordEntry[] = [];
    
    for (const row of dataRows) {
      if (row.length < 4) continue;
      
      const [name, url, username, password] = row.map(CSVParser.cleanField);
      
      if (name && username && password) {
        entries.push(CSVParser.createPasswordEntry({
          name,
          url,
          username,
          password,
          category: 'Chrome Import',
        }));
      }
    }
    
    return entries;
  }

  // Safari CSV format
  static parseSafari(content: string): PasswordEntry[] {
    const rows = CSVParser.parseCsvToRows(content);
    const [header, ...dataRows] = rows;
    
    // Expected headers: Title,URL,Username,Password,Notes
    const entries: PasswordEntry[] = [];
    
    for (const row of dataRows) {
      if (row.length < 4) continue;
      
      const [name, url, username, password, notes] = row.map(CSVParser.cleanField);
      
      if (name && username && password) {
        entries.push(CSVParser.createPasswordEntry({
          name,
          url,
          username,
          password,
          notes,
          category: 'Safari Import',
        }));
      }
    }
    
    return entries;
  }

  // Firefox CSV format (from Lockwise export)
  static parseFirefox(content: string): PasswordEntry[] {
    const rows = CSVParser.parseCsvToRows(content);
    const [header, ...dataRows] = rows;
    
    // Expected headers: url,username,password,httpRealm,formActionOrigin,guid,timeCreated,timeLastUsed,timePasswordChanged
    const entries: PasswordEntry[] = [];
    
    for (const row of dataRows) {
      if (row.length < 3) continue;
      
      const [url, username, password] = row.map(CSVParser.cleanField);
      
      if (url && username && password) {
        // Extract site name from URL
        let name = url;
        try {
          const urlObj = new URL(url);
          name = urlObj.hostname.replace('www.', '');
        } catch {
          // Keep original URL if parsing fails
        }
        
        entries.push(CSVParser.createPasswordEntry({
          name,
          url,
          username,
          password,
          category: 'Firefox Import',
        }));
      }
    }
    
    return entries;
  }

  // Bitwarden CSV format
  static parseBitwarden(content: string): PasswordEntry[] {
    const rows = CSVParser.parseCsvToRows(content);
    const [header, ...dataRows] = rows;
    
    // Expected headers: folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp
    const entries: PasswordEntry[] = [];
    
    for (const row of dataRows) {
      if (row.length < 10) continue;
      
      const [folder, favorite, type, name, notes, fields, reprompt, loginUri, loginUsername, loginPassword] = row.map(CSVParser.cleanField);
      
      if (name && loginUsername && loginPassword && type === 'login') {
        entries.push(CSVParser.createPasswordEntry({
          name,
          url: loginUri,
          username: loginUsername,
          password: loginPassword,
          notes,
          category: folder || 'Bitwarden Import',
        }));
      }
    }
    
    return entries;
  }

  // 1Password CSV format
  static parse1Password(content: string): PasswordEntry[] {
    const rows = CSVParser.parseCsvToRows(content);
    const [header, ...dataRows] = rows;
    
    // Expected headers: Title,Website,Username,Password,Notes,Tags
    const entries: PasswordEntry[] = [];
    
    for (const row of dataRows) {
      if (row.length < 4) continue;
      
      const [title, website, username, password, notes, tags] = row.map(CSVParser.cleanField);
      
      if (title && username && password) {
        entries.push(CSVParser.createPasswordEntry({
          name: title,
          url: website,
          username,
          password,
          notes,
          category: tags || '1Password Import',
        }));
      }
    }
    
    return entries;
  }

  // LastPass CSV format
  static parseLastPass(content: string): PasswordEntry[] {
    const rows = CSVParser.parseCsvToRows(content);
    const [header, ...dataRows] = rows;
    
    // Expected headers: url,username,password,extra,name,grouping,fav
    const entries: PasswordEntry[] = [];
    
    for (const row of dataRows) {
      if (row.length < 5) continue;
      
      const [url, username, password, extra, name, grouping] = row.map(CSVParser.cleanField);
      
      if (name && username && password) {
        entries.push(CSVParser.createPasswordEntry({
          name,
          url,
          username,
          password,
          notes: extra,
          category: grouping || 'LastPass Import',
        }));
      }
    }
    
    return entries;
  }

  // Complete vault data parser for CSV exports with multiple data types
  static parseCompleteData(content: string): PasswordEntry[] {
    const rows = CSVParser.parseCsvToRows(content);
    const [header, ...dataRows] = rows;
    
    if (!header || dataRows.length === 0) return [];
    
    // Look for password-related columns
    const passwordEntries: PasswordEntry[] = [];
    
    // Find password-related columns
    const passwordColumns = {
      name: -1,
      username: -1,
      password: -1,
      url: -1,
      notes: -1,
      category: -1
    };
    
    header.forEach((col, index) => {
      const lowerCol = col.toLowerCase().trim();
      
      if (lowerCol.includes('title') || lowerCol.includes('name') || lowerCol.includes('site')) {
        passwordColumns.name = index;
      } else if (lowerCol.includes('username') || lowerCol.includes('user') || lowerCol.includes('email')) {
        passwordColumns.username = index;
      } else if (lowerCol.includes('password') || lowerCol.includes('pass')) {
        passwordColumns.password = index;
      } else if (lowerCol.includes('url') || lowerCol.includes('website') || lowerCol.includes('address')) {
        passwordColumns.url = index;
      } else if (lowerCol.includes('note') || lowerCol.includes('comment') || lowerCol.includes('extra')) {
        passwordColumns.notes = index;
      } else if (lowerCol.includes('category') || lowerCol.includes('folder') || lowerCol.includes('group')) {
        passwordColumns.category = index;
      }
    });
    
    // Only process rows that have password data
    for (const row of dataRows) {
      const name = passwordColumns.name >= 0 ? row[passwordColumns.name] : '';
      const username = passwordColumns.username >= 0 ? row[passwordColumns.username] : '';
      const password = passwordColumns.password >= 0 ? row[passwordColumns.password] : '';
      const url = passwordColumns.url >= 0 ? row[passwordColumns.url] : '';
      const notes = passwordColumns.notes >= 0 ? row[passwordColumns.notes] : '';
      const category = passwordColumns.category >= 0 ? row[passwordColumns.category] : '';
      
      // Only create password entry if we have the essential fields
      if (name && username && password) {
        passwordEntries.push(CSVParser.createPasswordEntry({
          name: CSVParser.cleanField(name),
          url: CSVParser.cleanField(url),
          username: CSVParser.cleanField(username),
          password: CSVParser.cleanField(password),
          notes: CSVParser.cleanField(notes),
          category: CSVParser.cleanField(category) || 'Complete Data Import',
        }));
      }
    }
    
    return passwordEntries;
  }

  // Generic CSV parser that tries to auto-detect common fields
  static parseGeneric(content: string): PasswordEntry[] {
    const rows = CSVParser.parseCsvToRows(content);
    const [header, ...dataRows] = rows;
    
    if (!header || dataRows.length === 0) return [];
    
    // Map common field names to our schema
    const fieldMapping: { [key: string]: string } = {};
    
    header.forEach((col, index) => {
      const lowerCol = col.toLowerCase().trim();
      
      if (lowerCol.includes('name') || lowerCol.includes('title') || lowerCol.includes('site')) {
        fieldMapping['name'] = index.toString();
      } else if (lowerCol.includes('url') || lowerCol.includes('website') || lowerCol.includes('address')) {
        fieldMapping['url'] = index.toString();
      } else if (lowerCol.includes('username') || lowerCol.includes('user') || lowerCol.includes('email')) {
        fieldMapping['username'] = index.toString();
      } else if (lowerCol.includes('password') || lowerCol.includes('pass')) {
        fieldMapping['password'] = index.toString();
      } else if (lowerCol.includes('note') || lowerCol.includes('comment') || lowerCol.includes('extra')) {
        fieldMapping['notes'] = index.toString();
      } else if (lowerCol.includes('category') || lowerCol.includes('folder') || lowerCol.includes('group')) {
        fieldMapping['category'] = index.toString();
      }
    });
    
    const entries: PasswordEntry[] = [];
    
    for (const row of dataRows) {
      const name = row[parseInt(fieldMapping['name'] || '0')] || '';
      const url = fieldMapping['url'] ? row[parseInt(fieldMapping['url'])] || '' : '';
      const username = fieldMapping['username'] ? row[parseInt(fieldMapping['username'])] || '' : '';
      const password = fieldMapping['password'] ? row[parseInt(fieldMapping['password'])] || '' : '';
      const notes = fieldMapping['notes'] ? row[parseInt(fieldMapping['notes'])] || '' : '';
      const category = fieldMapping['category'] ? row[parseInt(fieldMapping['category'])] || '' : '';
      
      if (name && username && password) {
        entries.push(CSVParser.createPasswordEntry({
          name: CSVParser.cleanField(name),
          url: CSVParser.cleanField(url),
          username: CSVParser.cleanField(username),
          password: CSVParser.cleanField(password),
          notes: CSVParser.cleanField(notes),
          category: CSVParser.cleanField(category) || 'Generic Import',
        }));
      }
    }
    
    return entries;
  }
}

// Export type definitions and parser registry
export interface ParserConfig {
  id: string;
  name: string;
  description: string;
  parser: (content: string) => PasswordEntry[];
}

export const PASSWORD_MANAGER_PARSERS: ParserConfig[] = [
  {
    id: 'chrome',
    name: 'Chrome',
    description: 'Chrome/Chromium browser password export',
    parser: PasswordManagerParsers.parseChrome,
  },
  {
    id: 'safari',
    name: 'Safari',
    description: 'Safari browser password export',
    parser: PasswordManagerParsers.parseSafari,
  },
  {
    id: 'firefox',
    name: 'Firefox',
    description: 'Firefox/Lockwise password export',
    parser: PasswordManagerParsers.parseFirefox,
  },
  {
    id: 'bitwarden',
    name: 'Bitwarden',
    description: 'Bitwarden password manager export',
    parser: PasswordManagerParsers.parseBitwarden,
  },
  {
    id: 'onepassword',
    name: '1Password',
    description: '1Password manager export',
    parser: PasswordManagerParsers.parse1Password,
  },
  {
    id: 'lastpass',
    name: 'LastPass',
    description: 'LastPass password manager export',
    parser: PasswordManagerParsers.parseLastPass,
  },
  {
    id: 'generic',
    name: 'Generic CSV',
    description: 'Auto-detect fields from CSV headers',
    parser: PasswordManagerParsers.parseGeneric,
  },
  {
    id: 'complete-data',
    name: 'Complete Data Export',
    description: 'Parse complete vault exports with multiple data types',
    parser: PasswordManagerParsers.parseCompleteData,
  },
];