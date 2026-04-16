/**
 * secretScanner.test.ts
 * Tests for secret/credential detection in code content.
 * Holy Quest AI — Security Test Suite
 */

import { SecretScanner } from '../utils/secretScanner';

describe('SecretScanner', () => {

  // ─── CLEAN CODE ───────────────────────────────────────────────────────────
  describe('clean code passthrough', () => {
    it('should find no secrets in normal code', () => {
      const code = `
        function getUserById(id: string) {
          return db.users.find(u => u.id === id);
        }
      `;
      const result = SecretScanner.scan(code);
      expect(result.hasSecrets).toBe(false);
      expect(result.matches).toHaveLength(0);
    });

    it('should return correct line count', () => {
      const code = 'line1\nline2\nline3';
      const result = SecretScanner.scan(code);
      expect(result.scannedLines).toBe(3);
    });
  });

  // ─── ANTHROPIC KEY DETECTION ──────────────────────────────────────────────
  describe('Anthropic API key detection', () => {
    it('should detect sk-ant- prefixed keys', () => {
      const code = 'const key = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz123456";';
      const result = SecretScanner.scan(code);
      expect(result.hasSecrets).toBe(true);
      expect(result.criticalCount).toBeGreaterThan(0);
      const match = result.matches.find(m => m.patternName === 'Anthropic API Key');
      expect(match).toBeDefined();
      expect(match?.severity).toBe('critical');
    });

    it('should redact the key value in match output', () => {
      const code = 'const key = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz123456";';
      const result = SecretScanner.scan(code);
      const match = result.matches.find(m => m.patternName === 'Anthropic API Key');
      expect(match?.redactedValue).not.toContain('abcdefghijklmnopqrstuvwxyz');
      expect(match?.redactedValue).toContain('****');
    });
  });

  // ─── AWS KEY DETECTION ────────────────────────────────────────────────────
  describe('AWS key detection', () => {
    it('should detect AKIA prefixed AWS access keys', () => {
      const code = 'const awsKey = "AKIAIOSFODNN7EXAMPLE";';
      const result = SecretScanner.scan(code);
      expect(result.hasSecrets).toBe(true);
      const match = result.matches.find(m => m.patternName === 'AWS Access Key');
      expect(match).toBeDefined();
      expect(match?.severity).toBe('critical');
    });
  });

  // ─── GITHUB TOKEN DETECTION ───────────────────────────────────────────────
  describe('GitHub token detection', () => {
    it('should detect ghp_ prefixed GitHub tokens', () => {
      const code = 'const token = "ghp_abcdefghijklmnopqrstuvwxyz1234567890ab";';
      const result = SecretScanner.scan(code);
      expect(result.hasSecrets).toBe(true);
      const match = result.matches.find(m => m.patternName === 'GitHub Token');
      expect(match).toBeDefined();
    });
  });

  // ─── GENERIC CREDENTIAL DETECTION ────────────────────────────────────────
  describe('generic credential detection', () => {
    it('should detect password assignments', () => {
      const code = 'const password = "SuperSecret123!";';
      const result = SecretScanner.scan(code);
      expect(result.hasSecrets).toBe(true);
      expect(result.highCount).toBeGreaterThan(0);
    });

    it('should detect api_key assignments', () => {
      const code = 'const api_key = "some-long-secret-value";';
      const result = SecretScanner.scan(code);
      expect(result.hasSecrets).toBe(true);
    });

    it('should detect database connection strings', () => {
      const code = 'const db = "mongodb://admin:password123@cluster.mongodb.net";';
      const result = SecretScanner.scan(code);
      expect(result.hasSecrets).toBe(true);
    });
  });

  // ─── LINE NUMBER ACCURACY ─────────────────────────────────────────────────
  describe('line number accuracy', () => {
    it('should report correct line number for detected secret', () => {
      const code = `const a = 1;
const b = 2;
const key = "AKIAIOSFODNN7EXAMPLE";
const c = 3;`;
      const result = SecretScanner.scan(code);
      expect(result.hasSecrets).toBe(true);
      expect(result.matches[0].lineNumber).toBe(3);
    });
  });

  // ─── SUMMARIZE HELPER ─────────────────────────────────────────────────────
  describe('summarize helper', () => {
    it('should return clean message for no secrets', () => {
      const result = SecretScanner.scan('const x = 1;');
      expect(SecretScanner.summarize(result)).toBe('No secrets detected.');
    });

    it('should include counts in summary when secrets found', () => {
      const code = 'const key = "AKIAIOSFODNN7EXAMPLE";';
      const result = SecretScanner.scan(code);
      const summary = SecretScanner.summarize(result);
      expect(summary).toContain('detected');
    });
  });

});
