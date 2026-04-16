/**
 * codePrivacyVault.test.ts
 * Tests for Privacy Layer 1 — vault store, retrieve, destroy.
 * WHIGGEO LLC Patent #15 — Test Coverage
 * Holy Quest AI — Privacy Test Suite
 */

import { CodePrivacyVault } from '../privacy/codePrivacyVault';

describe('CodePrivacyVault', () => {

  let vault: CodePrivacyVault;

  beforeEach(() => {
    vault = new CodePrivacyVault('test-session-001');
  });

  afterEach(() => {
    vault.destroy();
  });

  // ─── VAULT OPERATION ──────────────────────────────────────────────────────
  describe('vault()', () => {
    it('should generate a token for a new value', () => {
      const token = vault.vault('MySecretEngine', 'class');
      expect(token).toBe('[CLASS_1]');
    });

    it('should return the same token for the same value', () => {
      const token1 = vault.vault('MySecretEngine', 'class');
      const token2 = vault.vault('MySecretEngine', 'class');
      expect(token1).toBe(token2);
    });

    it('should generate sequential tokens per category', () => {
      const t1 = vault.vault('ClassOne', 'class');
      const t2 = vault.vault('ClassTwo', 'class');
      expect(t1).toBe('[CLASS_1]');
      expect(t2).toBe('[CLASS_2]');
    });

    it('should use separate counters per category', () => {
      const classToken = vault.vault('MyClass', 'class');
      const funcToken = vault.vault('myFunction', 'function');
      expect(classToken).toBe('[CLASS_1]');
      expect(funcToken).toBe('[FUNCTION_1]');
    });

    it('should use uppercase category in token', () => {
      const token = vault.vault('myFunc', 'function');
      expect(token).toMatch(/^\[FUNCTION_\d+\]$/);
    });

    it('should vault credential values', () => {
      const token = vault.vault('sk-ant-secret-key-value', 'credential');
      expect(token).toBe('[CREDENTIAL_1]');
    });
  });

  // ─── RETRIEVE OPERATION ───────────────────────────────────────────────────
  describe('retrieve()', () => {
    it('should retrieve original value from token', () => {
      vault.vault('MySecretEngine', 'class');
      const retrieved = vault.retrieve('[CLASS_1]');
      expect(retrieved).toBe('MySecretEngine');
    });

    it('should return undefined for unknown token', () => {
      const retrieved = vault.retrieve('[CLASS_999]');
      expect(retrieved).toBeUndefined();
    });

    it('should retrieve values across all categories', () => {
      vault.vault('MyClass', 'class');
      vault.vault('myFunc', 'function');
      expect(vault.retrieve('[CLASS_1]')).toBe('MyClass');
      expect(vault.retrieve('[FUNCTION_1]')).toBe('myFunc');
    });
  });

  // ─── DESTROY OPERATION ────────────────────────────────────────────────────
  describe('destroy()', () => {
    it('should clear all entries after destroy', () => {
      vault.vault('MyClass', 'class');
      vault.destroy();
      const retrieved = vault.retrieve('[CLASS_1]');
      expect(retrieved).toBeUndefined();
    });

    it('should report zero vaulted after destroy', () => {
      vault.vault('MyClass', 'class');
      vault.destroy();
      const stats = vault.getStats();
      expect(stats.totalVaulted).toBe(0);
    });
  });

  // ─── STATS OPERATION ──────────────────────────────────────────────────────
  describe('getStats()', () => {
    it('should return correct total count', () => {
      vault.vault('A', 'class');
      vault.vault('B', 'class');
      vault.vault('C', 'function');
      const stats = vault.getStats();
      expect(stats.totalVaulted).toBe(3);
    });

    it('should include session ID in stats', () => {
      const stats = vault.getStats();
      expect(stats.sessionId).toBe('test-session-001');
    });

    it('should never expose original values in stats', () => {
      vault.vault('SuperSecretClassName', 'class');
      const stats = vault.getStats();
      expect(JSON.stringify(stats)).not.toContain('SuperSecretClassName');
    });
  });

  // ─── getAllEntries ─────────────────────────────────────────────────────────
  describe('getAllEntries()', () => {
    it('should return a copy not a reference', () => {
      vault.vault('MyClass', 'class');
      const entries1 = vault.getAllEntries();
      const entries2 = vault.getAllEntries();
      expect(entries1).not.toBe(entries2);
    });
  });

});
