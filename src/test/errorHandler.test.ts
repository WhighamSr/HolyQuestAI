/**
 * errorHandler.test.ts
 * Tests for error categorization across all 7 error types.
 * Holy Quest AI — Infrastructure Test Suite
 */

import { ErrorHandler, ErrorCategory } from '../utils/errorHandler';

describe('ErrorHandler', () => {

  // ─── AUTH ERRORS ──────────────────────────────────────────────────────────
  describe('auth error detection', () => {
    it('should categorize 401 as AUTH error', () => {
      const err = { status: 401, message: 'Unauthorized' };
      const result = ErrorHandler.categorize(err);
      expect(result.category).toBe(ErrorCategory.AUTH);
      expect(result.userMessage).toBeTruthy();
      expect(result.recoverable).toBe(false);
    });

    it('should categorize api key message as AUTH error', () => {
      const err = { message: 'invalid api key: the provided key is not valid' };
      const result = ErrorHandler.categorize(err);
      expect(result.category).toBe(ErrorCategory.AUTH);
    });
  });

  // ─── RATE LIMIT ERRORS ────────────────────────────────────────────────────
  describe('rate limit error detection', () => {
    it('should categorize 429 as RATE_LIMIT error', () => {
      const err = { status: 429, message: 'Too Many Requests' };
      const result = ErrorHandler.categorize(err);
      expect(result.category).toBe(ErrorCategory.RATE_LIMIT);
      expect(result.recoverable).toBe(true);
    });
  });

  // ─── NETWORK ERRORS ───────────────────────────────────────────────────────
  describe('network error detection', () => {
    it('should categorize ECONNREFUSED as NETWORK error', () => {
      const err = { message: 'Connection refused ECONNREFUSED' };
      const result = ErrorHandler.categorize(err);
      expect(result.category).toBe(ErrorCategory.NETWORK);
      expect(result.recoverable).toBe(true);
    });

    it('should categorize ETIMEDOUT as TIMEOUT error', () => {
      const err = { message: 'Request ETIMEDOUT' };
      const result = ErrorHandler.categorize(err);
      expect(result.category).toBe(ErrorCategory.TIMEOUT);
    });
  });

  // ─── SERVER ERRORS ────────────────────────────────────────────────────────
  describe('server error detection', () => {
    it('should categorize 500 as SERVER_ERROR', () => {
      const err = { status: 500, message: 'Internal Server Error' };
      const result = ErrorHandler.categorize(err);
      expect(result.category).toBe(ErrorCategory.SERVER_ERROR);
      expect(result.recoverable).toBe(true);
    });

    it('should categorize 503 as SERVER_ERROR', () => {
      const err = { status: 503, message: 'Service Unavailable' };
      const result = ErrorHandler.categorize(err);
      expect(result.category).toBe(ErrorCategory.SERVER_ERROR);
    });
  });

  // ─── USER MESSAGE QUALITY ─────────────────────────────────────────────────
  describe('user message quality', () => {
    it('should provide a non-empty user message for all categories', () => {
      const errors = [
        { status: 401 },
        { status: 429 },
        { status: 500 },
        { code: 'ECONNREFUSED' },
        { message: 'unknown random error' },
      ];
      for (const err of errors) {
        const result = ErrorHandler.categorize(err);
        expect(result.userMessage).toBeTruthy();
        expect(result.userMessage.length).toBeGreaterThan(5);
      }
    });
  });

  // ─── UNKNOWN ERRORS ───────────────────────────────────────────────────────
  describe('unknown error fallback', () => {
    it('should handle completely unknown errors without throwing', () => {
      const err = { randomProp: 'something unexpected' };
      expect(() => ErrorHandler.categorize(err)).not.toThrow();
      const result = ErrorHandler.categorize(err);
      expect(result.category).toBeTruthy();
      expect(result.userMessage).toBeTruthy();
    });

    it('should handle null without throwing', () => {
      expect(() => ErrorHandler.categorize(null)).not.toThrow();
    });

    it('should handle undefined without throwing', () => {
      expect(() => ErrorHandler.categorize(undefined)).not.toThrow();
    });
  });

});
