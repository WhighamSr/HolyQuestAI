/**
 * secretScanner.ts
 * Detects API keys, tokens, passwords, and credentials in code.
 * Warns before potential secret exposure.
 * Holy Quest AI — Security Layer
 */

// ─── SECRET PATTERN DEFINITIONS ────────────────────────────────────────────
export interface SecretPattern {
  name: string;
  pattern: RegExp;
  severity: 'critical' | 'high' | 'medium';
  description: string;
}

export interface SecretMatch {
  patternName: string;
  severity: 'critical' | 'high' | 'medium';
  description: string;
  lineNumber: number;
  redactedValue: string;
}

export interface SecretScanResult {
  hasSecrets: boolean;
  matches: SecretMatch[];
  scannedLines: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
}

// ─── KNOWN SECRET PATTERNS ─────────────────────────────────────────────────
const SECRET_PATTERNS: SecretPattern[] = [
  {
    name: 'Anthropic API Key',
    pattern: /sk-ant-[a-zA-Z0-9\-_]{20,}/g,
    severity: 'critical',
    description: 'Anthropic API key detected',
  },
  {
    name: 'OpenAI API Key',
    pattern: /sk-[a-zA-Z0-9]{20,}/g,
    severity: 'critical',
    description: 'OpenAI API key detected',
  },
  {
    name: 'AWS Access Key',
    pattern: /AKIA[0-9A-Z]{16}/g,
    severity: 'critical',
    description: 'AWS Access Key ID detected',
  },
  {
    name: 'Generic Secret Assignment',
    pattern: /(?:secret|password|passwd|pwd|token|api_key|apikey|api-key)\s*[:=]\s*["'][^"']{8,}["']/gi,
    severity: 'high',
    description: 'Hardcoded credential assignment detected',
  },
  {
    name: 'Bearer Token',
    pattern: /Bearer\s+[a-zA-Z0-9\-._~+/]{20,}/g,
    severity: 'high',
    description: 'Bearer token detected',
  },
  {
    name: 'Private Key Header',
    pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g,
    severity: 'critical',
    description: 'Private key material detected',
  },
  {
    name: 'GitHub Token',
    pattern: /ghp_[a-zA-Z0-9]{36}/g,
    severity: 'critical',
    description: 'GitHub personal access token detected',
  },
  {
    name: 'Stripe Key',
    pattern: /(?:sk|pk)_(?:live|test)_[a-zA-Z0-9]{24,}/g,
    severity: 'critical',
    description: 'Stripe API key detected',
  },
  {
    name: 'Connection String',
    pattern: /(?:mongodb|mysql|postgres|postgresql|redis):\/\/[^:]+:[^@]+@/gi,
    severity: 'high',
    description: 'Database connection string with credentials detected',
  },
];

// ─── MAIN SCANNER ──────────────────────────────────────────────────────────
export class SecretScanner {

  /**
   * Scans a block of text/code for exposed secrets.
   */
  static scan(content: string): SecretScanResult {
    const lines = content.split('\n');
    const matches: SecretMatch[] = [];

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];

      for (const secretPattern of SECRET_PATTERNS) {
        const regex = new RegExp(secretPattern.pattern.source, secretPattern.pattern.flags);
        let match: RegExpExecArray | null;

        while ((match = regex.exec(line)) !== null) {
          const raw = match[0];
          const redacted = raw.substring(0, 4) + '****' + raw.substring(raw.length - 2);
          matches.push({
            patternName: secretPattern.name,
            severity: secretPattern.severity,
            description: secretPattern.description,
            lineNumber: lineIndex + 1,
            redactedValue: redacted,
          });
        }
      }
    }

    return {
      hasSecrets: matches.length > 0,
      matches,
      scannedLines: lines.length,
      criticalCount: matches.filter(m => m.severity === 'critical').length,
      highCount: matches.filter(m => m.severity === 'high').length,
      mediumCount: matches.filter(m => m.severity === 'medium').length,
    };
  }

  /**
   * Returns a human-readable summary of scan results.
   */
  static summarize(result: SecretScanResult): string {
    if (!result.hasSecrets) {
      return 'No secrets detected.';
    }
    const lines = [`Secrets detected: ${result.matches.length} total`];
    if (result.criticalCount > 0) { lines.push(`  CRITICAL: ${result.criticalCount}`); }
    if (result.highCount > 0) { lines.push(`  HIGH: ${result.highCount}`); }
    if (result.mediumCount > 0) { lines.push(`  MEDIUM: ${result.mediumCount}`); }
    return lines.join('\n');
  }
}
