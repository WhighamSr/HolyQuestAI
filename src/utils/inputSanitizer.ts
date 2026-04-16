/**
 * inputSanitizer.ts
 * Prevents XSS attacks and prompt injection on all user input.
 * Holy Quest AI — Security Layer
 */

// ─── XSS DANGEROUS PATTERNS ────────────────────────────────────────────────
const XSS_PATTERNS: RegExp[] = [
  /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
  /<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi,
  /javascript\s*:/gi,
  /on\w+\s*=\s*["'][^"']*["']/gi,
  /data\s*:\s*text\/html/gi,
  /<object[\s\S]*?>/gi,
  /<embed[\s\S]*?>/gi,
  /vbscript\s*:/gi,
];

// ─── PROMPT INJECTION PATTERNS ──────────────────────────────────────────────
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
  /disregard\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
  /forget\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
  /you\s+are\s+now\s+(a\s+)?(?!an?\s+AI|Holy Quest)/gi,
  /new\s+instructions?\s*:/gi,
  /system\s*prompt\s*:/gi,
  /\[INST\]/gi,
  /<<SYS>>/gi,
  /<\|im_start\|>/gi,
];

// ─── SANITIZATION RESULT ───────────────────────────────────────────────────
export interface SanitizationResult {
  sanitized: string;
  wasModified: boolean;
  xssDetected: boolean;
  injectionDetected: boolean;
  originalLength: number;
  sanitizedLength: number;
}

// ─── MAIN SANITIZER ────────────────────────────────────────────────────────
export class InputSanitizer {

  /**
   * Sanitizes user input before sending to Claude API.
   * Removes XSS vectors and prompt injection attempts.
   */
  static sanitize(input: string): SanitizationResult {
    if (!input || typeof input !== 'string') {
      return {
        sanitized: '',
        wasModified: true,
        xssDetected: false,
        injectionDetected: false,
        originalLength: 0,
        sanitizedLength: 0,
      };
    }

    let result = input;
    let xssDetected = false;
    let injectionDetected = false;

    // Strip XSS patterns
    for (const pattern of XSS_PATTERNS) {
      if (pattern.test(result)) {
        xssDetected = true;
        result = result.replace(pattern, '[REMOVED]');
      }
    }

    // Strip prompt injection attempts
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(result)) {
        injectionDetected = true;
        result = result.replace(pattern, '[REMOVED]');
      }
    }

    // Enforce maximum input length (32KB)
    const MAX_LENGTH = 32768;
    if (result.length > MAX_LENGTH) {
      result = result.substring(0, MAX_LENGTH) + '\n[INPUT TRUNCATED FOR SECURITY]';
    }

    return {
      sanitized: result,
      wasModified: result !== input,
      xssDetected,
      injectionDetected,
      originalLength: input.length,
      sanitizedLength: result.length,
    };
  }

  /**
   * Quick check — returns true if input is safe without modifying it.
   */
  static isSafe(input: string): boolean {
    const result = this.sanitize(input);
    return !result.xssDetected && !result.injectionDetected;
  }
}
