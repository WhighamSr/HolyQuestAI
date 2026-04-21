import { AuditLogExporter } from '../privacy/auditLogExporter';
import { AuditEntry } from '../privacy/auditFormatters/csvFormatter';
import * as vscode from 'vscode';

jest.mock('vscode');

describe('AuditLogExporter', () => {
  let testEntries: AuditEntry[];

  beforeEach(() => {
    testEntries = [
      {
        timestamp: 1640000000000,
        actor: 'user@test.com',
        action: 'vault_secret',
        resource: 'api_key',
        outcome: 'success',
        metadata: { category: 'secrets' }
      },
      {
        timestamp: 1640000060000,
        actor: 'user@test.com',
        action: 'retrieve_data',
        resource: 'code_snippet',
        outcome: 'success'
      },
      {
        timestamp: 1640000120000,
        actor: 'admin@test.com',
        action: 'delete_entry',
        resource: 'audit_log',
        outcome: 'failure',
        metadata: { reason: 'permission_denied' }
      }
    ];
  });

  describe('exportLogs', () => {
    it('should export as CSV format', async () => {
      const result = await AuditLogExporter.exportLogs(testEntries, 'csv');
      expect(result).toContain('Timestamp,Actor,Action,Resource,Outcome,Metadata');
      expect(result).toContain('user@test.com');
      expect(result).toContain('vault_secret');
    });

    it('should export as JSON format', async () => {
      const result = await AuditLogExporter.exportLogs(testEntries, 'json');
      const parsed = JSON.parse(result);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(3);
      expect(parsed[0].actor).toBe('user@test.com');
    });

    it('should export as NDJSON format', async () => {
      const result = await AuditLogExporter.exportLogs(testEntries, 'ndjson');
      const lines = result.trim().split('\n');
      expect(lines).toHaveLength(3);
      const firstEntry = JSON.parse(lines[0]);
      expect(firstEntry.action).toBe('vault_secret');
    });

    it('should apply compliance schema when specified', async () => {
      const result = await AuditLogExporter.exportLogs(testEntries, 'csv', 'hipaa');
      expect(result).toContain('EventId');
      expect(result).toContain('DataClassification');
    });

    it('should throw error for unsupported format', async () => {
      await expect(
        AuditLogExporter.exportLogs(testEntries, 'xml' as any)
      ).rejects.toThrow('Unsupported format');
    });
  });

  describe('summarize', () => {
    it('should return correct summary statistics', () => {
      const summary = AuditLogExporter.summarize(testEntries);
      expect(summary.totalEvents).toBe(3);
      expect(summary.byAction['vault_secret']).toBe(1);
      expect(summary.byAction['retrieve_data']).toBe(1);
      expect(summary.byAction['delete_entry']).toBe(1);
      expect(summary.byOutcome['success']).toBe(2);
      expect(summary.byOutcome['failure']).toBe(1);
    });

    it('should count unique actors', () => {
      const summary = AuditLogExporter.summarize(testEntries);
      expect(summary.byActor['user@test.com']).toBe(2);
      expect(summary.byActor['admin@test.com']).toBe(1);
    });

    it('should calculate time range', () => {
      const summary = AuditLogExporter.summarize(testEntries);
      expect(summary.timeRange.start).toBe(1640000000000);
      expect(summary.timeRange.end).toBe(1640000120000);
    });

    it('should handle empty entries', () => {
      const summary = AuditLogExporter.summarize([]);
      expect(summary.totalEvents).toBe(0);
      expect(summary.timeRange.start).toBe(0);
      expect(summary.timeRange.end).toBe(0);
    });
  });
});
