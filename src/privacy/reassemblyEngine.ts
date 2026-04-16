/**
 * reassemblyEngine.ts
 * Privacy Layer 3 — Restores original values from vault tokens in API responses.
 * Mapping table discarded after reassembly.
 * WHIGGEO LLC — Patent #15 Foundation
 * Holy Quest AI — Privacy Architecture
 */

import { CodePrivacyVault } from './codePrivacyVault';

// ─── REASSEMBLY RESULT ─────────────────────────────────────────────────────
export interface ReassemblyResult {
  restoredContent: string;
  tokensRestored: number;
  tokensNotFound: string[];
  success: boolean;
}

// ─── AUDIT LOG ENTRY (sanitized — no original values) ──────────────────────
export interface AuditEntry {
  sessionId: string;
  timestamp: number;
  tokensRestored: number;
  tokensNotFound: number;
  contentLength: number;
}

// ─── REASSEMBLY ENGINE ─────────────────────────────────────────────────────
export class ReassemblyEngine {

  /**
   * Restores all vault tokens in API response back to original values.
   * This is the final step before displaying response to developer.
   */
  static reassemble(
    apiResponse: string,
    vault: CodePrivacyVault
  ): ReassemblyResult {
    let result = apiResponse;
    let tokensRestored = 0;
    const tokensNotFound: string[] = [];

    // Find all tokens in the response e.g. [CLASS_1], [FUNCTION_2]
    const tokenPattern = /\[(CLASS|FUNCTION|VARIABLE|CREDENTIAL|SCHEMA|COMMENT|STRING_LITERAL)_\d+\]/g;
    const foundTokens = apiResponse.match(tokenPattern) ?? [];
    const uniqueTokens = [...new Set(foundTokens)];

    for (const token of uniqueTokens) {
      const original = vault.retrieve(token);
      if (original !== undefined) {
        // Replace all occurrences of this token
        result = result.split(token).join(original);
        tokensRestored++;
      } else {
        // Token in response but not in vault — log but do not crash
        tokensNotFound.push(token);
      }
    }

    return {
      restoredContent: result,
      tokensRestored,
      tokensNotFound,
      success: tokensNotFound.length === 0,
    };
  }

  /**
   * Generates an audit log entry. Contains NO original values.
   */
  static generateAuditEntry(
    result: ReassemblyResult,
    vault: CodePrivacyVault
  ): AuditEntry {
    const stats = vault.getStats();
    return {
      sessionId: stats.sessionId,
      timestamp: Date.now(),
      tokensRestored: result.tokensRestored,
      tokensNotFound: result.tokensNotFound.length,
      contentLength: result.restoredContent.length,
    };
  }
}
