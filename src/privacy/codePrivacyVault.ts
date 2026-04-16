/**
 * codePrivacyVault.ts
 * Privacy Layer 1 — Identifies and vaults proprietary identifiers.
 * Raw code stays local. Proprietary names flagged before transmission.
 * WHIGGEO LLC — Patent #15 Foundation
 * Holy Quest AI — Privacy Architecture
 */

// ─── VAULT ENTRY ───────────────────────────────────────────────────────────
export interface VaultEntry {
  token: string;          // Replacement token e.g. [CLASS_1]
  originalValue: string;  // The real name stored locally only
  category: VaultCategory;
  firstSeen: number;      // timestamp
}

export type VaultCategory =
  | 'class'
  | 'function'
  | 'variable'
  | 'credential'
  | 'schema'
  | 'comment'
  | 'string_literal';

// ─── VAULT STATE ───────────────────────────────────────────────────────────
export interface VaultState {
  entries: Map<string, VaultEntry>;   // token → VaultEntry
  reverseMap: Map<string, string>;    // originalValue → token
  sessionId: string;
  createdAt: number;
}

// ─── CODE PRIVACY VAULT ────────────────────────────────────────────────────
export class CodePrivacyVault {
  private state: VaultState;
  private counters: Map<VaultCategory, number>;

  constructor(sessionId: string) {
    this.state = {
      entries: new Map(),
      reverseMap: new Map(),
      sessionId,
      createdAt: Date.now(),
    };
    this.counters = new Map([
      ['class', 0],
      ['function', 0],
      ['variable', 0],
      ['credential', 0],
      ['schema', 0],
      ['comment', 0],
      ['string_literal', 0],
    ]);
  }

  /**
   * Vaults a proprietary identifier and returns its replacement token.
   * If already vaulted, returns the existing token.
   */
  vault(originalValue: string, category: VaultCategory): string {
    // Already vaulted — return existing token
    if (this.state.reverseMap.has(originalValue)) {
      return this.state.reverseMap.get(originalValue)!;
    }

    // Generate new token
    const count = (this.counters.get(category) ?? 0) + 1;
    this.counters.set(category, count);
    const token = `[${category.toUpperCase()}_${count}]`;

    // Store in vault
    const entry: VaultEntry = {
      token,
      originalValue,
      category,
      firstSeen: Date.now(),
    };
    this.state.entries.set(token, entry);
    this.state.reverseMap.set(originalValue, token);

    return token;
  }

  /**
   * Retrieves the original value for a token.
   * Returns undefined if token not found in vault.
   */
  retrieve(token: string): string | undefined {
    return this.state.entries.get(token)?.originalValue;
  }

  /**
   * Returns all current vault entries (for reassembly engine).
   */
  getAllEntries(): Map<string, VaultEntry> {
    return new Map(this.state.entries);
  }

  /**
   * Securely destroys vault contents after session.
   */
  destroy(): void {
    this.state.entries.clear();
    this.state.reverseMap.clear();
    this.counters.clear();
  }

  /**
   * Returns vault statistics (no original values exposed).
   */
  getStats(): { totalVaulted: number; byCategory: Record<string, number>; sessionId: string } {
    const byCategory: Record<string, number> = {};
    for (const [cat, count] of this.counters.entries()) {
      byCategory[cat] = count;
    }
    return {
      totalVaulted: this.state.entries.size,
      byCategory,
      sessionId: this.state.sessionId,
    };
  }
}
