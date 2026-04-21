import * as vscode from 'vscode';
import { AuditEntry } from './auditFormatters/csvFormatter';
import { formatCsv, formatCsvWithHeaders } from './auditFormatters/csvFormatter';
import { formatJson, formatNdjson } from './auditFormatters/jsonFormatter';
import { applySchema, ComplianceSchema, getSchemaHeaders } from './auditFormatters/complianceSchemas';

export type ExportFormat = 'csv' | 'json' | 'ndjson';

export class AuditLogExporter {
  /**
   * Export audit logs to file
   */
  static async exportLogs(
    entries: AuditEntry[],
    format: ExportFormat,
    complianceSchema?: ComplianceSchema,
    outputPath?: string
  ): Promise<string> {
    // Apply compliance transformation if specified
    const processedEntries = complianceSchema 
      ? applySchema(entries, complianceSchema)
      : entries;

    // Format data
    const content = this.formatEntries(processedEntries, format, complianceSchema);

    // Write to file
    if (outputPath) {
      await this.writeToFile(outputPath, content);
    }

    return content;
  }

  /**
   * Format entries based on format type
   */
  private static formatEntries(
    entries: AuditEntry[],
    format: ExportFormat,
    complianceSchema?: ComplianceSchema
  ): string {
    switch (format) {
      case 'csv':
        if (complianceSchema) {
          const headers = getSchemaHeaders(complianceSchema);
          return formatCsvWithHeaders(entries, headers);
        }
        return formatCsv(entries);
      
      case 'json':
        return formatJson(entries, true);
      
      case 'ndjson':
        return formatNdjson(entries);
      
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Write content to file
   */
  private static async writeToFile(path: string, content: string): Promise<void> {
    const uri = vscode.Uri.file(path);
    const encoder = new TextEncoder();
    await vscode.workspace.fs.writeFile(uri, encoder.encode(content));
  }

  /**
   * Generate summary statistics
   */
  static summarize(entries: AuditEntry[]): {
    totalEvents: number;
    byAction: Record<string, number>;
    byOutcome: Record<string, number>;
    byActor: Record<string, number>;
    timeRange: { start: number; end: number };
  } {
    if (entries.length === 0) {
      return {
        totalEvents: 0,
        byAction: {},
        byOutcome: {},
        byActor: {},
        timeRange: { start: 0, end: 0 }
      };
    }

    const byAction: Record<string, number> = {};
    const byOutcome: Record<string, number> = {};
    const byActor: Record<string, number> = {};

    entries.forEach(entry => {
      byAction[entry.action] = (byAction[entry.action] || 0) + 1;
      byOutcome[entry.outcome] = (byOutcome[entry.outcome] || 0) + 1;
      byActor[entry.actor] = (byActor[entry.actor] || 0) + 1;
    });

    const timestamps = entries.map(e => e.timestamp).sort((a, b) => a - b);

    return {
      totalEvents: entries.length,
      byAction,
      byOutcome,
      byActor,
      timeRange: {
        start: timestamps[0],
        end: timestamps[timestamps.length - 1]
      }
    };
  }
}
