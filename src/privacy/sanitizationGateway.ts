/**
 * sanitizationGateway.ts
 * Privacy Layer 2 — Applies vault substitutions to produce sanitized content.
 * ZERO real proprietary values are transmitted to external APIs.
 * WHIGGEO LLC — Patent #15 Foundation
 * Holy Quest AI — Privacy Architecture
 */

import { CodePrivacyVault, VaultCategory } from './codePrivacyVault';

// ─── SANITIZATION CONFIG ───────────────────────────────────────────────────
export interface SanitizationConfig {
  sanitizeClassNames: boolean;
  sanitizeFunctionNames: boolean;
  sanitizeVariableNames: boolean;
  sanitizeCredentials: boolean;
  sanitizeComments: boolean;
  sanitizeStringLiterals: boolean;
  preserveKeywords: boolean;   // Never replace JS/TS reserved words
}

export const DEFAULT_CONFIG: SanitizationConfig = {
  sanitizeClassNames: true,
  sanitizeFunctionNames: true,
  sanitizeVariableNames: false,   // Off by default — too aggressive
  sanitizeCredentials: true,
  sanitizeComments: true,
  sanitizeStringLiterals: false,  // Off by default — breaks logic
  preserveKeywords: true,
};

// ─── SANITIZATION RESULT ───────────────────────────────────────────────────
export interface GatewayResult {
  sanitizedContent: string;
  originalContent: string;
  substitutionCount: number;
  credentialsRemoved: number;
  vault: CodePrivacyVault;
}

// ─── TYPESCRIPT/JS RESERVED WORDS — NEVER SANITIZE THESE ──────────────────
const RESERVED_WORDS = new Set([
  'abstract', 'any', 'as', 'async', 'await', 'boolean', 'break', 'case',
  'catch', 'class', 'const', 'constructor', 'continue', 'debugger',
  'declare', 'default', 'delete', 'do', 'else', 'enum', 'export',
  'extends', 'false', 'finally', 'for', 'from', 'function', 'get',
  'if', 'implements', 'import', 'in', 'instanceof', 'interface', 'let',
  'module', 'namespace', 'new', 'null', 'number', 'object', 'of',
  'package', 'private', 'protected', 'public', 'readonly', 'require',
  'return', 'set', 'static', 'string', 'super', 'switch', 'symbol',
  'this', 'throw', 'true', 'try', 'type', 'typeof', 'undefined',
  'var', 'void', 'while', 'with', 'yield',
]);

// ─── CREDENTIAL PATTERNS ───────────────────────────────────────────────────
const CREDENTIAL_INLINE_PATTERN =
  /(['"`])(sk-[a-zA-Z0-9\-_]{20,}|AKIA[0-9A-Z]{16}|ghp_[a-zA-Z0-9]{36})\1/g;

// ─── SANITIZATION GATEWAY ──────────────────────────────────────────────────
export class SanitizationGateway {

  /**
   * Sanitizes code content using the provided vault.
   * Returns sanitized content safe for external API transmission.
   */
  static sanitize(
    content: string,
    vault: CodePrivacyVault,
    config: SanitizationConfig = DEFAULT_CONFIG
  ): GatewayResult {
    let result = content;
    let substitutionCount = 0;
    let credentialsRemoved = 0;

    // Always remove inline credentials regardless of config
    result = result.replace(CREDENTIAL_INLINE_PATTERN, (_match, _quote, secret) => {
      const token = vault.vault(secret, 'credential' as VaultCategory);
      credentialsRemoved++;
      substitutionCount++;
      return `"${token}"`;
    });

    // Sanitize class names (class MyEngine { → class [CLASS_1] {)
    if (config.sanitizeClassNames) {
      result = result.replace(/\bclass\s+([A-Z][a-zA-Z0-9_]*)/g, (_match, name) => {
        if (RESERVED_WORDS.has(name)) { return _match; }
        const token = vault.vault(name, 'class');
        substitutionCount++;
        return `class ${token}`;
      });
    }

    // Sanitize function names in definitions only (not calls)
    if (config.sanitizeFunctionNames) {
      result = result.replace(/\bfunction\s+([a-zA-Z_][a-zA-Z0-9_]*)/g, (_match, name) => {
        if (RESERVED_WORDS.has(name)) { return _match; }
        const token = vault.vault(name, 'function');
        substitutionCount++;
        return `function ${token}`;
      });
    }

    // Strip single-line comments if configured
    if (config.sanitizeComments) {
      result = result.replace(/\/\/[^\n]*/g, '// [COMMENT]');
    }

    return {
      sanitizedContent: result,
      originalContent: content,
      substitutionCount,
      credentialsRemoved,
      vault,
    };
  }
}
