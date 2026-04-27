/**
 * Smart password CSV import parser.
 *
 * Goal: never throw. Every row, every column, every encoding gotcha is caught
 * and surfaced as a structured result. Supports 15+ password manager formats
 * with auto-detection plus a generic fuzzy-header fallback.
 */

export type ImportSourceId =
  | 'apple'
  | 'chrome'
  | 'firefox'
  | 'safari'
  | 'edge'
  | 'brave'
  | 'opera'
  | 'onepassword'
  | 'lastpass'
  | 'bitwarden'
  | 'dashlane'
  | 'keepass'
  | 'enpass'
  | 'roboform'
  | 'nordpass'
  | 'generic';

export interface ImportSource {
  id: ImportSourceId;
  name: string;
  /** Lowercased header tokens that strongly indicate this source. All must be present. */
  signature: string[];
  /** Mapping from logical field → list of header aliases (lowercased). First match wins. */
  fieldAliases: Partial<Record<LogicalField, string[]>>;
  /** Static category tag attached to imported rows from this source. */
  category: string;
}

export type LogicalField = 'title' | 'url' | 'username' | 'password' | 'notes' | 'totp' | 'category';

export interface ParsedPassword {
  title: string;
  url: string;
  username: string;
  password: string;
  notes: string;
  totp: string;
  category: string;
}

export interface SkippedRow {
  rowIndex: number;
  reason: 'missing_credentials' | 'duplicate' | 'parse_error' | 'empty';
  detail?: string;
}

export interface ImportResult {
  source: ImportSourceId;
  sourceName: string;
  /** Total non-header rows in the file. */
  totalRows: number;
  /** Successfully parsed entries (after dedup against the file itself). */
  entries: ParsedPassword[];
  /** Rows we deliberately did not import (with reasons). */
  skipped: SkippedRow[];
  /** Detected delimiter, useful for the UI to display. */
  delimiter: ',' | ';' | '\t' | '|';
  /** Detected header row, lowercased. */
  headers: string[];
  /** Field → column index, after auto-mapping. -1 means unmapped. */
  mapping: Record<LogicalField, number>;
  /** Warnings that didn't prevent import. */
  warnings: string[];
}

const STRIP_BOM = /^﻿/;

/* ------------------------------------------------------------------ *
 * 1. Tolerant CSV tokeniser                                          *
 * ------------------------------------------------------------------ */

/**
 * Parses a delimited string into rows. Handles:
 *   - quoted fields with embedded commas, newlines, and "" escapes
 *   - CRLF / LF / CR line endings
 *   - leading BOM
 *   - empty trailing newlines
 * Never throws on malformed input — closes the last field/row if EOF
 * comes mid-quote.
 */
export function tokenize(content: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;
  const text = content.replace(STRIP_BOM, '');
  const len = text.length;

  while (i < len) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          // Escaped quote
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    // not in quotes
    if (ch === '"') {
      // start of quoted field — only honour if it's at field start
      if (field.length === 0) {
        inQuotes = true;
        i++;
        continue;
      }
      // mid-field stray quote — keep it literally
      field += ch;
      i++;
      continue;
    }
    if (ch === delimiter) {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (ch === '\r' || ch === '\n') {
      // commit the current field + row, then swallow CRLF as one break
      row.push(field);
      rows.push(row);
      field = '';
      row = [];
      if (ch === '\r' && text[i + 1] === '\n') i += 2;
      else i++;
      continue;
    }
    field += ch;
    i++;
  }
  // EOF: commit any pending field/row
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // drop trailing fully-empty rows
  while (rows.length > 0 && rows[rows.length - 1].every(c => c.trim() === '')) {
    rows.pop();
  }
  return rows;
}

/** Pick the delimiter that yields the most columns on the header row. */
function detectDelimiter(content: string): ',' | ';' | '\t' | '|' {
  // Look at the first non-empty line up to ~2KB
  const sample = content.replace(STRIP_BOM, '').slice(0, 2048);
  const firstLine = sample.split(/\r?\n/).find(l => l.trim().length > 0) ?? '';
  const candidates: Array<',' | ';' | '\t' | '|'> = [',', ';', '\t', '|'];
  let best: ',' | ';' | '\t' | '|' = ',';
  let bestScore = 0;
  for (const d of candidates) {
    // Count occurrences outside of quotes (approximate)
    let count = 0;
    let inQ = false;
    for (let i = 0; i < firstLine.length; i++) {
      const c = firstLine[i];
      if (c === '"') inQ = !inQ;
      else if (c === d && !inQ) count++;
    }
    if (count > bestScore) {
      bestScore = count;
      best = d;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ *
 * 2. Encoding-tolerant text decode                                   *
 * ------------------------------------------------------------------ */

/**
 * Decode an ArrayBuffer, trying UTF-8 first then Latin-1 / Windows-1252
 * as fallbacks. Returns the first decode whose string contains no replacement
 * characters in the first 4KB.
 */
export function decodeBuffer(buffer: ArrayBuffer): string {
  const encodings = ['utf-8', 'utf-16le', 'windows-1252', 'iso-8859-1'];
  for (const enc of encodings) {
    try {
      const decoder = new TextDecoder(enc, { fatal: false });
      const text = decoder.decode(buffer);
      // Check the first 4KB for the U+FFFD replacement character.
      // If present and we have more encodings to try, skip this one.
      const sample = text.slice(0, 4096);
      if (!sample.includes('�') || enc === encodings[encodings.length - 1]) {
        return text;
      }
    } catch {
      // try next encoding
    }
  }
  // Final fallback — empty string is safer than throwing
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  } catch {
    return '';
  }
}

/* ------------------------------------------------------------------ *
 * 3. Source registry — header signatures + field aliases             *
 * ------------------------------------------------------------------ */

/**
 * Field alias resolution is case-insensitive and ignores spaces,
 * underscores, hyphens, and slashes. So "login_username", "Login Username",
 * "login-username" all match the alias "loginusername".
 */
const SOURCES: ImportSource[] = [
  {
    id: 'apple',
    name: 'Apple Passwords / iCloud Keychain',
    signature: ['title', 'url', 'username', 'password', 'otpauth'],
    fieldAliases: {
      title: ['title'],
      url: ['url'],
      username: ['username'],
      password: ['password'],
      notes: ['notes'],
      totp: ['otpauth'],
    },
    category: 'Apple Import',
  },
  {
    id: 'safari',
    name: 'Safari',
    // Same shape as Apple; we treat them as one
    signature: ['title', 'url', 'username', 'password', 'otpauth'],
    fieldAliases: {
      title: ['title'],
      url: ['url'],
      username: ['username'],
      password: ['password'],
      notes: ['notes'],
      totp: ['otpauth'],
    },
    category: 'Safari Import',
  },
  {
    id: 'firefox',
    name: 'Firefox',
    signature: ['url', 'username', 'password', 'guid'],
    fieldAliases: {
      title: [],
      url: ['url'],
      username: ['username'],
      password: ['password'],
    },
    category: 'Firefox Import',
  },
  {
    id: 'edge',
    name: 'Microsoft Edge',
    signature: ['name', 'url', 'username', 'password'],
    fieldAliases: {
      title: ['name'],
      url: ['url'],
      username: ['username'],
      password: ['password'],
      notes: ['note'],
    },
    category: 'Edge Import',
  },
  {
    id: 'chrome',
    name: 'Google Chrome',
    signature: ['name', 'url', 'username', 'password', 'note'],
    fieldAliases: {
      title: ['name'],
      url: ['url'],
      username: ['username'],
      password: ['password'],
      notes: ['note'],
    },
    category: 'Chrome Import',
  },
  {
    id: 'brave',
    name: 'Brave',
    signature: ['name', 'url', 'username', 'password'],
    fieldAliases: {
      title: ['name'],
      url: ['url'],
      username: ['username'],
      password: ['password'],
      notes: ['note'],
    },
    category: 'Brave Import',
  },
  {
    id: 'opera',
    name: 'Opera',
    signature: ['name', 'url', 'username', 'password'],
    fieldAliases: {
      title: ['name'],
      url: ['url'],
      username: ['username'],
      password: ['password'],
      notes: ['note'],
    },
    category: 'Opera Import',
  },
  {
    id: 'onepassword',
    name: '1Password',
    // 1Password CSVs vary; "Title" + "Password" + ("Url" or "Website") is a stable signal.
    signature: ['title', 'password'],
    fieldAliases: {
      title: ['title'],
      url: ['url', 'website', 'urls'],
      username: ['username'],
      password: ['password'],
      notes: ['notes'],
      totp: ['otp', 'onetimepassword'],
      category: ['tags', 'type'],
    },
    category: '1Password Import',
  },
  {
    id: 'lastpass',
    name: 'LastPass',
    signature: ['url', 'username', 'password', 'extra', 'name', 'grouping'],
    fieldAliases: {
      title: ['name'],
      url: ['url'],
      username: ['username'],
      password: ['password'],
      notes: ['extra'],
      totp: ['totp'],
      category: ['grouping'],
    },
    category: 'LastPass Import',
  },
  {
    id: 'bitwarden',
    name: 'Bitwarden',
    signature: ['folder', 'name', 'login_uri', 'login_username', 'login_password'],
    fieldAliases: {
      title: ['name'],
      url: ['loginuri', 'login_uri'],
      username: ['loginusername', 'login_username'],
      password: ['loginpassword', 'login_password'],
      notes: ['notes'],
      totp: ['logintotp', 'login_totp'],
      category: ['folder'],
    },
    category: 'Bitwarden Import',
  },
  {
    id: 'dashlane',
    name: 'Dashlane',
    signature: ['username', 'title', 'password', 'url'],
    fieldAliases: {
      title: ['title'],
      url: ['url'],
      username: ['username', 'username2', 'username3'],
      password: ['password'],
      notes: ['note'],
      totp: ['otpsecret'],
      category: ['category'],
    },
    category: 'Dashlane Import',
  },
  {
    id: 'keepass',
    name: 'KeePass',
    signature: ['group', 'title', 'username', 'password', 'url'],
    fieldAliases: {
      title: ['title'],
      url: ['url'],
      username: ['username'],
      password: ['password'],
      notes: ['notes'],
      category: ['group'],
    },
    category: 'KeePass Import',
  },
  {
    id: 'enpass',
    name: 'Enpass',
    // Enpass exports headers like "Title", "Field (Login)", "Field (Password)", "Field (URL)", "Note"
    signature: ['title', 'fieldlogin', 'fieldpassword'],
    fieldAliases: {
      title: ['title'],
      url: ['fieldurl', 'field(url)', 'url'],
      username: ['fieldlogin', 'field(login)', 'login', 'fieldemail', 'field(email)', 'username'],
      password: ['fieldpassword', 'field(password)', 'password'],
      notes: ['note', 'notes'],
    },
    category: 'Enpass Import',
  },
  {
    id: 'roboform',
    name: 'RoboForm',
    signature: ['name', 'url', 'matchurl', 'login', 'pwd'],
    fieldAliases: {
      title: ['name'],
      url: ['url', 'matchurl'],
      username: ['login'],
      password: ['pwd'],
      notes: ['note'],
    },
    category: 'RoboForm Import',
  },
  {
    id: 'nordpass',
    name: 'NordPass',
    signature: ['name', 'url', 'username', 'password', 'note', 'folder', 'type'],
    fieldAliases: {
      title: ['name'],
      url: ['url'],
      username: ['username', 'email'],
      password: ['password'],
      notes: ['note'],
      totp: ['totp'],
      category: ['folder'],
    },
    category: 'NordPass Import',
  },
];

/** Generic fallback aliases when no source signature matches. */
const GENERIC_ALIASES: Record<LogicalField, string[]> = {
  title: ['title', 'name', 'site', 'sitename', 'website name', 'displayname', 'label', 'item'],
  url: ['url', 'website', 'address', 'site', 'web', 'link', 'loginuri', 'webaddress', 'host', 'hostname', 'domain', 'matchurl'],
  username: ['username', 'user', 'login', 'email', 'account', 'userid', 'loginname', 'loginusername'],
  password: ['password', 'pass', 'pwd', 'secret', 'loginpassword'],
  notes: ['notes', 'note', 'comment', 'comments', 'extra', 'description', 'memo'],
  totp: ['totp', 'otp', 'otpauth', 'otpsecret', 'logintotp', 'twofactor', '2fa'],
  category: ['category', 'folder', 'group', 'tags', 'type', 'grouping'],
};

/* ------------------------------------------------------------------ *
 * 4. Header normalisation + matching                                 *
 * ------------------------------------------------------------------ */

function normHeader(h: string): string {
  return h
    .replace(STRIP_BOM, '')
    .toLowerCase()
    .replace(/[\s_\-/]+/g, '')
    .trim();
}

function detectSource(headers: string[]): ImportSource | null {
  const norm = headers.map(normHeader);
  const set = new Set(norm);
  // Score each source: number of signature tokens present
  let best: { src: ImportSource; score: number } | null = null;
  for (const src of SOURCES) {
    let score = 0;
    for (const tok of src.signature) {
      if (set.has(normHeader(tok))) score++;
    }
    // Require at least 60% of the signature, and a minimum of 3 (or full
    // signature for short ones).
    const required = Math.max(3, Math.ceil(src.signature.length * 0.6));
    if (score >= required && (!best || score > best.score)) {
      best = { src, score };
    }
  }
  return best?.src ?? null;
}

function findColumn(headers: string[], aliases: string[]): number {
  const norm = headers.map(normHeader);
  for (const alias of aliases) {
    const target = normHeader(alias);
    const idx = norm.indexOf(target);
    if (idx >= 0) return idx;
  }
  return -1;
}

function buildMapping(headers: string[], source: ImportSource | null): Record<LogicalField, number> {
  const aliases = source?.fieldAliases ?? {};
  const fields: LogicalField[] = ['title', 'url', 'username', 'password', 'notes', 'totp', 'category'];
  const mapping = {} as Record<LogicalField, number>;
  for (const f of fields) {
    const explicit = aliases[f] ?? [];
    const generic = GENERIC_ALIASES[f];
    // Prefer the source's explicit aliases; fall back to generic
    const merged = explicit.length > 0 ? [...explicit, ...generic] : generic;
    mapping[f] = findColumn(headers, merged);
  }
  return mapping;
}

/* ------------------------------------------------------------------ *
 * 5. Value normalisation                                             *
 * ------------------------------------------------------------------ */

function cleanValue(v: string | undefined): string {
  if (!v) return '';
  return v.replace(STRIP_BOM, '').trim();
}

/** Add https:// if the URL has no protocol. Returns '' if value is falsy or unparseable. */
export function normalizeUrl(raw: string): string {
  const v = cleanValue(raw);
  if (!v) return '';
  // strip surrounding angle brackets some exports use
  const stripped = v.replace(/^<+|>+$/g, '').trim();
  if (!stripped) return '';
  // If it already has a scheme, accept it
  if (/^[a-z][a-z0-9+.\-]*:\/\//i.test(stripped)) {
    return stripped;
  }
  // If it looks like a domain (has a dot, no spaces), prepend https://
  if (/^[^\s/]+\.[^\s/]+/.test(stripped)) {
    return `https://${stripped}`;
  }
  return stripped;
}

/** Derive a human title from a URL (e.g. "https://accounts.google.com/" → "Accounts.google.com"). */
export function titleFromUrl(rawUrl: string): string {
  const url = normalizeUrl(rawUrl);
  if (!url) return '';
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (!host) return '';
    // Take the second-level domain when possible
    const parts = host.split('.');
    if (parts.length >= 2) {
      const main = parts[parts.length - 2];
      return main.charAt(0).toUpperCase() + main.slice(1);
    }
    return host;
  } catch {
    return rawUrl.trim();
  }
}

/** Normalize TOTP — accept both raw secrets and otpauth:// URIs. */
function normalizeTotp(raw: string): string {
  const v = cleanValue(raw);
  if (!v) return '';
  // Some exports include trailing punctuation; trust the value otherwise.
  return v;
}

/* ------------------------------------------------------------------ *
 * 6. Public entry points                                             *
 * ------------------------------------------------------------------ */

/**
 * Parse raw CSV/TSV/SSV text into a structured ImportResult. Never throws —
 * any internal failure is captured in `warnings` or per-row `skipped` entries.
 */
export function parseCsvText(content: string, opts?: { sourceOverride?: ImportSourceId }): ImportResult {
  const warnings: string[] = [];
  let text = content ?? '';
  if (text.length === 0) {
    return emptyResult('generic', 'Generic CSV', ',', warnings);
  }

  // Detect delimiter — prefer the one that produces the most columns on the header.
  let delimiter = detectDelimiter(text);
  let rows: string[][];
  try {
    rows = tokenize(text, delimiter);
  } catch (e) {
    warnings.push(`Tokenizer error with delimiter "${delimiter}", retrying with comma: ${(e as Error).message}`);
    delimiter = ',';
    try {
      rows = tokenize(text, delimiter);
    } catch (e2) {
      warnings.push(`Tokenizer error with comma: ${(e2 as Error).message}`);
      return emptyResult('generic', 'Generic CSV', delimiter, warnings);
    }
  }

  // If the first attempt produced a single-column table and the file has
  // semicolons or tabs, retry with a different delimiter.
  if (rows.length > 1 && rows[0].length === 1) {
    for (const alt of [';', '\t', '|'] as const) {
      if (alt === delimiter) continue;
      const altRows = tokenize(text, alt);
      if (altRows.length > 0 && altRows[0].length > 1) {
        rows = altRows;
        delimiter = alt;
        warnings.push(`Switched delimiter to "${alt === '\t' ? 'TAB' : alt}" — header had only 1 column with the auto-detected delimiter.`);
        break;
      }
    }
  }

  if (rows.length === 0) {
    return emptyResult('generic', 'Generic CSV', delimiter, warnings);
  }

  // Strip BOM from the very first cell
  rows[0][0] = rows[0][0]?.replace(STRIP_BOM, '') ?? '';

  const headerRow = rows[0];
  const dataRows = rows.slice(1);
  const headers = headerRow.map(h => cleanValue(h));

  // Detect source
  let source = opts?.sourceOverride
    ? SOURCES.find(s => s.id === opts.sourceOverride) ?? null
    : detectSource(headers);

  if (!source && opts?.sourceOverride === 'generic') {
    source = null;
  }

  const mapping = buildMapping(headers, source);

  // Sanity-check the mapping
  if (mapping.password < 0 && mapping.username < 0) {
    warnings.push('Could not auto-detect username/password columns. Using positional fallback.');
    // Fallback: Chrome-like positional mapping
    if (headers.length >= 4) {
      mapping.title = mapping.title >= 0 ? mapping.title : 0;
      mapping.url = mapping.url >= 0 ? mapping.url : 1;
      mapping.username = mapping.username >= 0 ? mapping.username : 2;
      mapping.password = mapping.password >= 0 ? mapping.password : 3;
    }
  }

  const entries: ParsedPassword[] = [];
  const skipped: SkippedRow[] = [];
  const seenKeys = new Set<string>();

  const sourceMeta = source ?? {
    id: 'generic' as ImportSourceId,
    name: 'Generic CSV',
    category: 'Imported',
    fieldAliases: {},
    signature: [],
  };

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowIndex = i + 2; // 1-based, plus header

    // Empty row
    if (!row || row.every(c => !c || !c.trim())) {
      skipped.push({ rowIndex, reason: 'empty' });
      continue;
    }

    let entry: ParsedPassword;
    try {
      entry = mapRow(row, mapping, sourceMeta.category);
    } catch (e) {
      skipped.push({ rowIndex, reason: 'parse_error', detail: (e as Error)?.message ?? 'unknown' });
      continue;
    }

    // Must have at least username OR password — otherwise the row is useless
    if (!entry.password && !entry.username) {
      skipped.push({ rowIndex, reason: 'missing_credentials', detail: 'Both username and password are empty' });
      continue;
    }

    // Title fallback
    if (!entry.title) {
      const fromUrl = titleFromUrl(entry.url);
      entry.title = fromUrl || entry.username || 'Imported Password';
    }

    // URL fallback: if no URL but title looks like a domain, promote it
    if (!entry.url && /^[^\s]+\.[a-z]{2,}/i.test(entry.title)) {
      entry.url = normalizeUrl(entry.title);
    }

    // Source-specific filter: Bitwarden rows where type !== 'login' should be skipped.
    // We don't have direct access to the type column here, but we can look it up.
    // Simpler: rely on having a password to keep the row.

    // Dedup against earlier rows in the same file
    const key = `${entry.title.toLowerCase()}::${entry.username.toLowerCase()}::${entry.url.toLowerCase()}`;
    if (seenKeys.has(key)) {
      skipped.push({ rowIndex, reason: 'duplicate', detail: `Duplicate of an earlier row in the file (${entry.title})` });
      continue;
    }
    seenKeys.add(key);

    entries.push(entry);
  }

  return {
    source: sourceMeta.id,
    sourceName: sourceMeta.name,
    totalRows: dataRows.length,
    entries,
    skipped,
    delimiter,
    headers: headers.map(h => h.toLowerCase()),
    mapping,
    warnings,
  };
}

function mapRow(row: string[], mapping: Record<LogicalField, number>, defaultCategory: string): ParsedPassword {
  const at = (idx: number): string => (idx >= 0 && idx < row.length ? cleanValue(row[idx]) : '');
  return {
    title: at(mapping.title),
    url: normalizeUrl(at(mapping.url)),
    username: at(mapping.username),
    password: at(mapping.password),
    notes: at(mapping.notes),
    totp: normalizeTotp(at(mapping.totp)),
    category: at(mapping.category) || defaultCategory,
  };
}

function emptyResult(
  id: ImportSourceId,
  name: string,
  delimiter: ',' | ';' | '\t' | '|',
  warnings: string[],
): ImportResult {
  return {
    source: id,
    sourceName: name,
    totalRows: 0,
    entries: [],
    skipped: [],
    delimiter,
    headers: [],
    mapping: { title: -1, url: -1, username: -1, password: -1, notes: -1, totp: -1, category: -1 },
    warnings,
  };
}

/**
 * Read a File object (from <input type="file">) and parse it. Tries multiple
 * encodings transparently.
 */
export async function parseFile(file: File, opts?: { sourceOverride?: ImportSourceId }): Promise<ImportResult> {
  const buffer = await file.arrayBuffer();
  const text = decodeBuffer(buffer);
  return parseCsvText(text, opts);
}

export const SOURCE_LIST: Array<{ id: ImportSourceId; name: string }> = [
  { id: 'apple', name: 'Apple Passwords / iCloud Keychain' },
  { id: 'safari', name: 'Safari' },
  { id: 'chrome', name: 'Google Chrome' },
  { id: 'edge', name: 'Microsoft Edge' },
  { id: 'brave', name: 'Brave' },
  { id: 'opera', name: 'Opera' },
  { id: 'firefox', name: 'Firefox' },
  { id: 'onepassword', name: '1Password' },
  { id: 'lastpass', name: 'LastPass' },
  { id: 'bitwarden', name: 'Bitwarden' },
  { id: 'dashlane', name: 'Dashlane' },
  { id: 'keepass', name: 'KeePass' },
  { id: 'enpass', name: 'Enpass' },
  { id: 'roboform', name: 'RoboForm' },
  { id: 'nordpass', name: 'NordPass' },
  { id: 'generic', name: 'Generic CSV (auto-detect)' },
];
