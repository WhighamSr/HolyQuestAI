import { AuditEntry } from './csvFormatter';

/**
 * Format audit entries as JSON with stable key ordering
 */
export function formatJson(entries: AuditEntry[], pretty: boolean = true): string {
  if (pretty) {
    return JSON.stringify(entries, stableKeyReplacer, 2);
  }
  return JSON.stringify(entries, stableKeyReplacer);
}

/**
 * Format as newline-delimited JSON (NDJSON/streaming format)
 */
export function formatNdjson(entries: AuditEntry[]): string {
  return entries.map(entry => JSON.stringify(entry, stableKeyReplacer)).join('\n');
}

/**
 * Parse JSON back to entries
 */
export function parseJson(json: string): AuditEntry[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

/**
 * Parse NDJSON back to entries
 */
export function parseNdjson(ndjson: string): AuditEntry[] {
  const lines = ndjson.trim().split('\n');
  const entries: AuditEntry[] = [];
  
  for (const line of lines) {
    if (line.trim()) {
      try {
        entries.push(JSON.parse(line));
      } catch {
        // Skip invalid lines
      }
    }
  }
  
  return entries;
}

/**
 * JSON replacer for stable key ordering (reproducible diffs)
 */
function stableKeyReplacer(key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const ordered: Record<string, unknown> = {};
    const keys = Object.keys(value).sort();
    for (const k of keys) {
      ordered[k] = (value as Record<string, unknown>)[k];
    }
    return ordered;
  }
  return value;
}

/**
 * Format with metadata extraction for readability
 */
export function formatJsonReadable(entries: AuditEntry[]): string {
  const formatted = entries.map(entry => ({
    time: new Date(entry.timestamp).toISOString(),
    actor: entry.actor,
    action: entry.action,
    resource: entry.resource,
    outcome: entry.outcome,
    ...(entry.metadata && { details: entry.metadata })
  }));
  
  return JSON.stringify(formatted, null, 2);
}
