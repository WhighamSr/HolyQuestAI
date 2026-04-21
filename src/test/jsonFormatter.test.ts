import { formatJson, formatNdjson, parseJson, parseNdjson, formatJsonReadable } from '../privacy/auditFormatters/jsonFormatter';
import { AuditEntry } from '../privacy/auditFormatters/csvFormatter';

describe('jsonFormatter', () => {
  let testEntries: AuditEntry[];

  beforeEach(() => {
    testEntries = [
      {
        timestamp: 1640000000000,
        actor: 'user@test.com',
        action: 'create',
        resource: 'file.txt',
        outcome: 'success'
      },
      {
        timestamp: 1640000060000,
        actor: 'admin@test.com',
        action: 'delete',
        resource: 'old.txt',
        outcome: 'failure',
        metadata: { reason: 'not_found' }
      }
    ];
  });

  describe('formatJson', () => {
    it('should format as pretty JSON by default', () => {
      const json = formatJson(testEntries);
      expect(json).toContain('[\n');
      expect(json).toContain('  ');
    });

    it('should format as compact JSON when pretty=false', () => {
      const json = formatJson(testEntries, false);
      expect(json).not.toContain('\n  ');
    });

    it('should produce valid parseable JSON', () => {
      const json = formatJson(testEntries);
      const parsed = JSON.parse(json);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
    });

    it('should maintain stable key ordering', () => {
      const json1 = formatJson(testEntries);
      const json2 = formatJson(testEntries);
      expect(json1).toBe(json2);
    });
  });

  describe('formatNdjson', () => {
    it('should format as newline-delimited JSON', () => {
      const ndjson = formatNdjson(testEntries);
      const lines = ndjson.split('\n');
      expect(lines).toHaveLength(2);
    });

    it('should have parseable JSON on each line', () => {
      const ndjson = formatNdjson(testEntries);
      const lines = ndjson.split('\n');
      lines.forEach(line => {
        expect(() => JSON.parse(line)).not.toThrow();
      });
    });

    it('should handle empty array', () => {
      const ndjson = formatNdjson([]);
      expect(ndjson).toBe('');
    });
  });

  describe('parseJson', () => {
    it('should parse valid JSON array', () => {
      const json = formatJson(testEntries);
      const parsed = parseJson(json);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].actor).toBe('user@test.com');
    });

    it('should return array for single object', () => {
      const json = JSON.stringify(testEntries[0]);
      const parsed = parseJson(json);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
    });

    it('should return empty array for invalid JSON', () => {
      const parsed = parseJson('invalid json');
      expect(parsed).toEqual([]);
    });
  });

  describe('parseNdjson', () => {
    it('should parse valid NDJSON', () => {
      const ndjson = formatNdjson(testEntries);
      const parsed = parseNdjson(ndjson);
      expect(parsed).toHaveLength(2);
      expect(parsed[1].action).toBe('delete');
    });

    it('should skip invalid lines', () => {
      const ndjson = `${JSON.stringify(testEntries[0])}\ninvalid\n${JSON.stringify(testEntries[1])}`;
      const parsed = parseNdjson(ndjson);
      expect(parsed).toHaveLength(2);
    });

    it('should handle empty string', () => {
      const parsed = parseNdjson('');
      expect(parsed).toEqual([]);
    });
  });

  describe('formatJsonReadable', () => {
    it('should convert timestamps to ISO strings', () => {
      const json = formatJsonReadable(testEntries);
      expect(json).toContain('"time"');
      expect(json).toContain('2021-12-');
    });

    it('should include metadata as details', () => {
      const json = formatJsonReadable([testEntries[1]]);
      expect(json).toContain('"details"');
      expect(json).toContain('not_found');
    });
  });
});
