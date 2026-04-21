export interface AuditEntry {
  timestamp: number;
  actor: string;
  action: string;
  resource: string;
  outcome: 'success' | 'failure';
  metadata?: Record<string, unknown>;
}

/**
 * Escape value for RFC 4180 compliant CSV
 */
export function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Format audit entries as CSV
 */
export function formatCsv(entries: AuditEntry[]): string {
  if (entries.length === 0) {
    return 'Timestamp,Actor,Action,Resource,Outcome,Metadata\n';
  }

  const headers = 'Timestamp,Actor,Action,Resource,Outcome,Metadata';
  const rows = entries.map(entry => formatCsvRow(entry));
  return [headers, ...rows].join('\n');
}

/**
 * Format single entry as CSV row
 */
function formatCsvRow(entry: AuditEntry): string {
  const timestamp = new Date(entry.timestamp).toISOString();
  const metadata = entry.metadata ? JSON.stringify(entry.metadata) : '';
  
  return [
    escapeCsv(timestamp),
    escapeCsv(entry.actor),
    escapeCsv(entry.action),
    escapeCsv(entry.resource),
    escapeCsv(entry.outcome),
    escapeCsv(metadata)
  ].join(',');
}

/**
 * Format with custom headers
 */
export function formatCsvWithHeaders(
  entries: AuditEntry[],
  headers: string[]
): string {
  if (entries.length === 0) {
    return headers.join(',') + '\n';
  }

  const headerRow = headers.map(h => escapeCsv(h)).join(',');
  const rows = entries.map(entry => formatCsvRow(entry));
  return [headerRow, ...rows].join('\n');
}

/**
 * Parse CSV back to entries (for testing/validation)
 */
export function parseCsv(csv: string): AuditEntry[] {
  const lines = csv.trim().split('\n');
  if (lines.length <= 1) {
    return [];
  }

  const entries: AuditEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const entry = parseCsvRow(lines[i]);
    if (entry) {
      entries.push(entry);
    }
  }
  return entries;
}

/**
 * Parse single CSV row
 */
function parseCsvRow(row: string): AuditEntry | null {
  const parts = splitCsvRow(row);
  if (parts.length < 5) {
    return null;
  }

  const metadata = parts[5] ? JSON.parse(parts[5]) : undefined;
  
  return {
    timestamp: new Date(parts[0]).getTime(),
    actor: parts[1],
    action: parts[2],
    resource: parts[3],
    outcome: parts[4] as 'success' | 'failure',
    metadata
  };
}

/**
 * Split CSV row respecting quoted fields
 */
function splitCsvRow(row: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    
    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}
