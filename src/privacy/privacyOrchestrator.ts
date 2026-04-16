/**
 * privacyOrchestrator.ts
 * Coordinates all three privacy layers in sequence.
 * Single entry point for the Three-Layer Privacy Architecture.
 * WHIGGEO LLC — Patent #15 Foundation
 * Holy Quest AI — Privacy Architecture
 */

import { CodePrivacyVault } from './codePrivacyVault';
import { SanitizationGateway, SanitizationConfig, DEFAULT_CONFIG } from './sanitizationGateway';
import { ReassemblyEngine, ReassemblyResult, AuditEntry } from './reassemblyEngine';

// ─── PRIVACY SESSION ───────────────────────────────────────────────────────
export interface PrivacySession {
  sessionId: string;
  vault: CodePrivacyVault;
  createdAt: number;
  isActive: boolean;
}

// ─── ORCHESTRATION RESULT ──────────────────────────────────────────────────
export interface OrchestrationResult {
  sanitizedPrompt: string;
  substitutionCount: number;
  credentialsRemoved: number;
  sessionId: string;
}

// ─── PRIVACY ORCHESTRATOR ──────────────────────────────────────────────────
export class PrivacyOrchestrator {
  private activeSession: PrivacySession | null = null;
  private privacyEnabled: boolean = false;
  private config: SanitizationConfig;
  private auditLog: AuditEntry[] = [];

  constructor(config: SanitizationConfig = DEFAULT_CONFIG) {
    this.config = config;
  }

  /**
   * Enable or disable the privacy layer.
   */
  setPrivacyEnabled(enabled: boolean): void {
    this.privacyEnabled = enabled;
    if (!enabled && this.activeSession) {
      this.endSession();
    }
  }

  isPrivacyEnabled(): boolean {
    return this.privacyEnabled;
  }

  /**
   * Step 1 — Begin a new privacy session.
   * Call before sending a message that contains code.
   */
  beginSession(): string {
    const sessionId = `pv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    this.activeSession = {
      sessionId,
      vault: new CodePrivacyVault(sessionId),
      createdAt: Date.now(),
      isActive: true,
    };
    return sessionId;
  }

  /**
   * Step 2 — Sanitize the outgoing prompt.
   * Replaces proprietary identifiers with vault tokens.
   */
  sanitizePrompt(rawPrompt: string): OrchestrationResult {
    if (!this.privacyEnabled || !this.activeSession) {
      return {
        sanitizedPrompt: rawPrompt,
        substitutionCount: 0,
        credentialsRemoved: 0,
        sessionId: 'privacy-disabled',
      };
    }

    const gatewayResult = SanitizationGateway.sanitize(
      rawPrompt,
      this.activeSession.vault,
      this.config
    );

    return {
      sanitizedPrompt: gatewayResult.sanitizedContent,
      substitutionCount: gatewayResult.substitutionCount,
      credentialsRemoved: gatewayResult.credentialsRemoved,
      sessionId: this.activeSession.sessionId,
    };
  }

  /**
   * Step 3 — Reassemble the API response.
   * Restores original values from tokens in the response.
   */
  reassembleResponse(apiResponse: string): ReassemblyResult {
    if (!this.privacyEnabled || !this.activeSession) {
      return {
        restoredContent: apiResponse,
        tokensRestored: 0,
        tokensNotFound: [],
        success: true,
      };
    }

    const result = ReassemblyEngine.reassemble(apiResponse, this.activeSession.vault);
    const auditEntry = ReassemblyEngine.generateAuditEntry(result, this.activeSession.vault);
    this.auditLog.push(auditEntry);
    return result;
  }

  /**
   * Step 4 — End session and destroy vault.
   */
  endSession(): void {
    if (this.activeSession) {
      this.activeSession.vault.destroy();
      this.activeSession.isActive = false;
      this.activeSession = null;
    }
  }

  /**
   * Returns audit log (contains no original values).
   */
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
