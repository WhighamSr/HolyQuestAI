/**
 * privacyOrchestrator.test.ts
 * Tests for the full three-layer privacy pipeline.
 * WHIGGEO LLC Patent #15 — Test Coverage
 * Holy Quest AI — Privacy Test Suite
 */

import { PrivacyOrchestrator } from '../privacy/privacyOrchestrator';

describe('PrivacyOrchestrator', () => {

  let orchestrator: PrivacyOrchestrator;

  beforeEach(() => {
    orchestrator = new PrivacyOrchestrator();
  });

  afterEach(() => {
    orchestrator.endSession();
  });

  // ─── PRIVACY TOGGLE ───────────────────────────────────────────────────────
  describe('privacy toggle', () => {
    it('should start with privacy disabled', () => {
      expect(orchestrator.isPrivacyEnabled()).toBe(false);
    });

    it('should enable privacy', () => {
      orchestrator.setPrivacyEnabled(true);
      expect(orchestrator.isPrivacyEnabled()).toBe(true);
    });

    it('should disable privacy and end active session', () => {
      orchestrator.setPrivacyEnabled(true);
      orchestrator.beginSession();
      orchestrator.setPrivacyEnabled(false);
      expect(orchestrator.isPrivacyEnabled()).toBe(false);
    });
  });

  // ─── SESSION MANAGEMENT ───────────────────────────────────────────────────
  describe('session management', () => {
    it('should generate a unique session ID', () => {
      orchestrator.setPrivacyEnabled(true);
      const id = orchestrator.beginSession();
      expect(id).toMatch(/^pv_\d+_[a-z0-9]+$/);
    });

    it('should generate different IDs for different sessions', () => {
      orchestrator.setPrivacyEnabled(true);
      const id1 = orchestrator.beginSession();
      orchestrator.endSession();
      const id2 = orchestrator.beginSession();
      expect(id1).not.toBe(id2);
    });
  });

  // ─── PRIVACY DISABLED PASSTHROUGH ─────────────────────────────────────────
  describe('privacy disabled passthrough', () => {
    it('should return prompt unchanged when privacy is off', () => {
      const prompt = 'class MySecretEngine { secret_algo() {} }';
      const result = orchestrator.sanitizePrompt(prompt);
      expect(result.sanitizedPrompt).toBe(prompt);
      expect(result.substitutionCount).toBe(0);
      expect(result.sessionId).toBe('privacy-disabled');
    });

    it('should return response unchanged when privacy is off', () => {
      const response = 'Here is your code with [CLASS_1]';
      const result = orchestrator.reassembleResponse(response);
      expect(result.restoredContent).toBe(response);
      expect(result.tokensRestored).toBe(0);
    });
  });

  // ─── FULL PIPELINE ────────────────────────────────────────────────────────
  describe('full three-layer pipeline', () => {
    it('should sanitize class names in outgoing prompt', () => {
      orchestrator.setPrivacyEnabled(true);
      orchestrator.beginSession();
      const prompt = 'class MyProprietaryEngine { }';
      const result = orchestrator.sanitizePrompt(prompt);
      expect(result.sanitizedPrompt).not.toContain('MyProprietaryEngine');
      expect(result.sanitizedPrompt).toContain('[CLASS_');
      expect(result.substitutionCount).toBeGreaterThan(0);
    });

    it('should restore class names in incoming response', () => {
      orchestrator.setPrivacyEnabled(true);
      orchestrator.beginSession();
      const prompt = 'class MyProprietaryEngine { }';
      orchestrator.sanitizePrompt(prompt);
      const fakeResponse = 'Here is your updated [CLASS_1] implementation.';
      const result = orchestrator.reassembleResponse(fakeResponse);
      expect(result.restoredContent).toContain('MyProprietaryEngine');
      expect(result.tokensRestored).toBe(1);
    });

    it('should remove inline credentials from prompt', () => {
      orchestrator.setPrivacyEnabled(true);
      orchestrator.beginSession();
      const prompt = 'My key is "sk-ant-api03-abcdefghijklmnopqrstuvwxyz"';
      const result = orchestrator.sanitizePrompt(prompt);
      expect(result.sanitizedPrompt).not.toContain('sk-ant-api03');
      expect(result.credentialsRemoved).toBeGreaterThan(0);
    });

    it('should report unmatched tokens without crashing', () => {
      orchestrator.setPrivacyEnabled(true);
      orchestrator.beginSession();
      const fakeResponse = 'Use [CLASS_999] here';
      const result = orchestrator.reassembleResponse(fakeResponse);
      expect(result.success).toBe(false);
      expect(result.tokensNotFound).toContain('[CLASS_999]');
    });
  });

  // ─── AUDIT LOG ────────────────────────────────────────────────────────────
  describe('audit log', () => {
    it('should start with empty audit log', () => {
      expect(orchestrator.getAuditLog()).toHaveLength(0);
    });

    it('should append to audit log after reassembly', () => {
      orchestrator.setPrivacyEnabled(true);
      orchestrator.beginSession();
      orchestrator.sanitizePrompt('class MyClass {}');
      orchestrator.reassembleResponse('Updated [CLASS_1]');
      expect(orchestrator.getAuditLog()).toHaveLength(1);
    });

    it('should never expose original values in audit log', () => {
      orchestrator.setPrivacyEnabled(true);
      orchestrator.beginSession();
      orchestrator.sanitizePrompt('class SuperSecretClassName {}');
      orchestrator.reassembleResponse('[CLASS_1]');
      const log = JSON.stringify(orchestrator.getAuditLog());
      expect(log).not.toContain('SuperSecretClassName');
    });
  });

});
