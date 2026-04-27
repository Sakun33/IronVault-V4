// RFC4180-compliant CSV tokenizer.
//
// Handles:
//   - Quoted fields with embedded commas, newlines, and "" escapes
//   - CR, LF, and CRLF line endings (mixed in the same file)
//   - UTF-8 BOM at the file start
//   - Trailing newline at EOF
//
// Returns: { headers: string[], rows: Record<string, string>[] }
//
// Designed to be tolerant of the slight format drift between Chrome,
// Edge, Firefox, and password-manager exports — they all claim RFC4180
// but cut corners differently.
export function parseCsv(text) {
  if (typeof text !== 'string') return { headers: [], rows: [] };

  // Strip UTF-8 BOM if present.
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  const records = [];
  let field = '';
  let row = [];
  let inQuotes = false;
  const len = text.length;

  for (let i = 0; i < len; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        // Escaped quote ("") → emit one quote, stay in quotes.
        if (i + 1 < len && text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      // A quote at the start of a field opens a quoted field. A quote
      // mid-field is rare but RFC4180 says it's invalid — we keep it as
      // a literal so we don't drop bytes.
      if (field.length === 0) inQuotes = true;
      else field += c;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\r' || c === '\n') {
      // Treat CR, LF, CRLF as a single record separator. Empty trailing
      // newline shouldn't produce a phantom row.
      if (c === '\r' && i + 1 < len && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      // Skip purely-empty lines (e.g. trailing newline at EOF).
      if (!(row.length === 1 && row[0] === '')) records.push(row);
      row = [];
    } else {
      field += c;
    }
  }

  // Flush the final field/row if the file didn't end with a newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (!(row.length === 1 && row[0] === '')) records.push(row);
  }

  if (records.length === 0) return { headers: [], rows: [] };

  // First record is the header. Lowercase + trim for forgiving lookup —
  // Chrome / Edge / Firefox spell columns slightly differently (e.g.
  // "Login URL" vs "url"), so callers normalize via aliases.
  const headers = records[0].map((h) => String(h || '').trim());
  const rows = records.slice(1).map((rec) => {
    const obj = {};
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]] = rec[i] !== undefined ? rec[i] : '';
    }
    return obj;
  });
  return { headers, rows };
}

// Maps the loose header names different browsers emit to a canonical
// shape: { name, url, username, password, note }. Returns null if the
// row has neither url nor username — unparseable.
export function mapBrowserCsvRow(row) {
  const get = (...keys) => {
    for (const k of keys) {
      // Case-insensitive lookup over original headers.
      for (const rk of Object.keys(row)) {
        if (rk.toLowerCase() === k) {
          const v = row[rk];
          if (v != null && String(v).length > 0) return String(v);
        }
      }
    }
    return '';
  };
  const name = get('name', 'title', 'display name');
  const url = get('url', 'login url', 'website', 'web site');
  const username = get('username', 'login', 'user', 'email');
  const password = get('password');
  const note = get('note', 'notes', 'comments');
  if (!url && !username) return null;
  return { name, url, username, password, note };
}

// hostname-only normalization shared with the merge logic. Mirrors the
// rule documented in the feature spec: same host (sans www.) + same
// username = same identity.
export function normalizeDomain(url) {
  if (!url) return '';
  try {
    const u = new URL(url.startsWith('http') ? url : 'https://' + url);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return String(url).trim().toLowerCase();
  }
}
