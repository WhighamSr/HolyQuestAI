/**
 * Test suite for DiffEngine
 * Holy Quest AI - Phase 1
 */

import { DiffEngine } from '../diff/diffEngine';

describe('DiffEngine', () => {
  let diffEngine: DiffEngine;

  beforeEach(() => {
    diffEngine = new DiffEngine();
  });

  describe('computeDiff', () => {
    it('should return all unchanged when inputs are identical', () => {
      const original = 'line1\nline2\nline3';
      const proposed = 'line1\nline2\nline3';
      
      const result = diffEngine.computeDiff(original, proposed);
      
      expect(result.unchangedCount).toBe(3);
      expect(result.addedCount).toBe(0);
      expect(result.removedCount).toBe(0);
      expect(result.totalChanges).toBe(0);
      expect(result.lines).toHaveLength(3);
      expect(result.lines.every(line => line.type === 'unchanged')).toBe(true);
    });

    it('should return added lines when proposed has new content', () => {
      const original = 'line1\nline2';
      const proposed = 'line1\nline2\nline3';
      
      const result = diffEngine.computeDiff(original, proposed);
      
      expect(result.addedCount).toBe(1);
      expect(result.unchangedCount).toBe(2);
      expect(result.totalChanges).toBe(1);
    });

    it('should return removed lines when proposed removes content', () => {
      const original = 'line1\nline2\nline3';
      const proposed = 'line1\nline2';
      
      const result = diffEngine.computeDiff(original, proposed);
      
      expect(result.removedCount).toBe(1);
      expect(result.unchangedCount).toBe(2);
      expect(result.totalChanges).toBe(1);
    });

    it('should handle empty original string', () => {
      const original = '';
      const proposed = 'line1\nline2';
      
      const result = diffEngine.computeDiff(original, proposed);
      
      expect(result.addedCount).toBe(2);
      expect(result.removedCount).toBe(0);
      expect(result.unchangedCount).toBe(0);
      expect(result.totalChanges).toBe(2);
    });

    it('should handle empty proposed string', () => {
      const original = 'line1\nline2';
      const proposed = '';
      
      const result = diffEngine.computeDiff(original, proposed);
      
      expect(result.addedCount).toBe(0);
      expect(result.removedCount).toBe(2);
      expect(result.unchangedCount).toBe(0);
      expect(result.totalChanges).toBe(2);
    });

    it('should handle both empty strings', () => {
      const original = '';
      const proposed = '';
      
      const result = diffEngine.computeDiff(original, proposed);
      
      expect(result.addedCount).toBe(0);
      expect(result.removedCount).toBe(0);
      expect(result.unchangedCount).toBe(0);
      expect(result.totalChanges).toBe(0);
      expect(result.lines).toHaveLength(0);
    });

    it('should count changes correctly with mixed operations', () => {
      const original = 'line1\nline2\nline3';
      const proposed = 'line1\nline2-modified\nline4';
      
      const result = diffEngine.computeDiff(original, proposed);
      
      expect(result.unchangedCount).toBe(1); // line1
      expect(result.totalChanges).toBeGreaterThan(0);
    });

    it('should throw error for null original content', () => {
      expect(() => {
        diffEngine.computeDiff(null as any, 'test');
      }).toThrow('Original content cannot be null or undefined');
    });

    it('should throw error for undefined original content', () => {
      expect(() => {
        diffEngine.computeDiff(undefined as any, 'test');
      }).toThrow('Original content cannot be null or undefined');
    });

    it('should throw error for null proposed content', () => {
      expect(() => {
        diffEngine.computeDiff('test', null as any);
      }).toThrow('Proposed content cannot be null or undefined');
    });

    it('should throw error for undefined proposed content', () => {
      expect(() => {
        diffEngine.computeDiff('test', undefined as any);
      }).toThrow('Proposed content cannot be null or undefined');
    });
  });

  describe('formatForDisplay', () => {
    it('should produce human-readable output', () => {
      const original = 'line1\nline2';
      const proposed = 'line1\nline3';
      
      const result = diffEngine.computeDiff(original, proposed);
      const formatted = diffEngine.formatForDisplay(result);
      
      expect(formatted).toContain('DIFF SUMMARY');
      expect(formatted).toContain('Added:');
      expect(formatted).toContain('Removed:');
      expect(formatted).toContain('Unchanged:');
      expect(formatted).toContain('Total changes:');
      expect(formatted).toContain('DIFF CONTENT');
    });

    it('should include line numbers in formatted output', () => {
      const original = 'line1';
      const proposed = 'line2';
      
      const result = diffEngine.computeDiff(original, proposed);
      const formatted = diffEngine.formatForDisplay(result);
      
      expect(formatted).toMatch(/\d+/); // Contains line numbers
    });
  });
});
