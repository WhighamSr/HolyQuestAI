import { formatCsv, escapeCsv, parseCsv, formatCsvWithHeaders, AuditEntry } from '../privacy/auditFormatters/csvFormatter';

describe('csvFormatter', () => {
  let testEntries: AuditEntry[];

  beforeEach(() => {
    testEntries = [
      {
        timestamp: 1640000000000,
        actor: 'user@test.com',
        action: 'create',
        resource: 'document.txt',
        outcome: 'success'
      },
      {
        timestamp: 1640000060000,
        actor: 'admin@test.com',
        action: 'delete',
        resource: 'old,file.txt',
        outcome: 'failure',
        metadata: { reason: 'not_found' }
      }
    ];
  });

  describe('escapeCsv', () => {
    it('should escape commas', () => {
      expect(escapeCsv('hello, world')).toBe('"hello, world"');
    });

    it('should escape quotes', () => {
      expect(escapeCsv('say "hello"')).toBe('"say ""hello"""');
    });

    it('should escape newlines', () => {
      expect(escapeCsv('line1\nline2')).toBe('"line1\nline2"');
    });

    it('should escape carriage returns', () => {
      expect(escapeCsv('line1\rline2')).toBe('"line1\rline2"');
    });

    it('should not escape simple strings', () => {
      expect(escapeCsv('simple')).toBe('simple');
    });

    it('should handle mixed special characters', () => {
      expect(escapeCsv('field,"with",\nmixed')).toBe('"field,""with"",\nmixed"');
    });
  });

  describe('formatCsv', () => {
    it('should format entries with header row', () => {
      const csv = formatCsv(testEntries);
      expect(csv).toContain('Timestamp,Actor,Action,Resource,Outcome,Metadata');
    });

    it('should format entry fields correctly', () => {
      const csv = formatCsv(testEntries);
      expect(csv).toContain('user@test.com');
      expect(csv).toContain('create');
      expect(csv).toContain('document.txt');
    });

    it('should escape special characters in fields', () => {
      const csv = formatCsv(testEntries);
      expect(csv).toContain('"old,file.txt"');
    });

    it('should handle empty metadata', () => {
      const csv = formatCsv([testEntries[0]]);
      const lines = csv.split('\n');
      expect(lines[1]).not.toContain('undefined');
    });

    it('should handle entries with metadata', () => {
      const csv = formatCsv([testEntries[1]]);
      expect(csv).toContain('not_found');
    });

    it('should return headers only for empty array', () => {
      const csv = formatCsv([]);
      expect(csv).toBe('Timestamp,Actor,Action,Resource,Outcome,Metadata\n');
    });
  });

  describe('formatCsvWithHeaders', () => {
    it('should use custom headers', () => {
      const headers = ['Time', 'User', 'Event', 'Target', 'Result', 'Extra'];
      const csv = formatCsvWithHeaders(testEntries, headers);
      expect(csv).toContain('Time,User,Event,Target,Result,Extra');
    });

    it('should escape custom headers', () => {
      const headers = ['Time,Date', 'User'];
      const csv = formatCsvWithHeaders([], headers);
      expect(csv).toContain('"Time,Date",User');
    });
  });

  describe('parseCsv', () => {
    it('should parse valid CSV', () => {
      const csv = formatCsv(testEntries);
      const parsed = parseCsv(csv);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].actor).toBe('user@test.com');
      expect(parsed[0].action).toBe('create');
    });

    it('should handle escaped fields', () => {
      const csv = formatCsv(testEntries);
      const parsed = parseCsv(csv);
      expect(parsed[1].resource).toBe('old,file.txt');
    });

    it('should return empty array for headers only', () => {
      const csv = 'Timestamp,Actor,Action,Resource,Outcome,Metadata\n';
      const parsed = parseCsv(csv);
      expect(parsed).toHaveLength(0);
    });

    it('should return empty array for empty string', () => {
      const parsed = parseCsv('');
      expect(parsed).toHaveLength(0);
    });
  });
});
