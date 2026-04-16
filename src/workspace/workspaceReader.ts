/**
 * workspaceReader.ts
 * Reads files from the developer's open workspace safely.
 * Enforces size limits and binary file detection.
 * Holy Quest AI — Workspace Operations
 */

import * as vscode from 'vscode';
import * as path from 'path';

// ─── READ RESULT ───────────────────────────────────────────────────────────
export interface FileReadResult {
  success: boolean;
  content: string;
  filePath: string;
  lineCount: number;
  sizeBytes: number;
  language: string;
  errorMessage?: string;
}

// ─── BINARY EXTENSIONS — NEVER READ THESE ─────────────────────────────────
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg',
  '.mp3', '.mp4', '.wav', '.avi', '.mov',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.exe', '.dll', '.so', '.dylib',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.woff', '.woff2', '.ttf', '.eot',
  '.map', '.lock',
]);

// ─── SIZE LIMITS ───────────────────────────────────────────────────────────
const MAX_FILE_SIZE_BYTES = 512 * 1024;   // 512KB hard limit
const MAX_LINES_WARNING   = 1000;          // Warn if over 1000 lines

// ─── LANGUAGE DETECTION ────────────────────────────────────────────────────
function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.ts': 'typescript', '.tsx': 'typescript',
    '.js': 'javascript', '.jsx': 'javascript',
    '.py': 'python', '.rb': 'ruby',
    '.java': 'java', '.cs': 'csharp',
    '.go': 'go', '.rs': 'rust',
    '.cpp': 'cpp', '.c': 'c', '.h': 'c',
    '.html': 'html', '.css': 'css',
    '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml',
    '.md': 'markdown', '.sql': 'sql',
    '.sh': 'bash', '.ps1': 'powershell',
    '.env': 'plaintext', '.txt': 'plaintext',
  };
  return map[ext] ?? 'plaintext';
}

// ─── WORKSPACE READER ──────────────────────────────────────────────────────
export class WorkspaceReader {

  /**
   * Reads a file from the workspace by URI.
   */
  static async readFile(uri: vscode.Uri): Promise<FileReadResult> {
    const filePath = uri.fsPath;
    const ext = path.extname(filePath).toLowerCase();

    // Block binary files
    if (BINARY_EXTENSIONS.has(ext)) {
      return {
        success: false,
        content: '',
        filePath,
        lineCount: 0,
        sizeBytes: 0,
        language: 'binary',
        errorMessage: `Binary file type '${ext}' cannot be read as text.`,
      };
    }

    try {
      const raw = await vscode.workspace.fs.readFile(uri);
      const sizeBytes = raw.byteLength;

      // Block oversized files
      if (sizeBytes > MAX_FILE_SIZE_BYTES) {
        return {
          success: false,
          content: '',
          filePath,
          lineCount: 0,
          sizeBytes,
          language: detectLanguage(filePath),
          errorMessage: `File exceeds 512KB limit (${Math.round(sizeBytes / 1024)}KB). Too large to include in context.`,
        };
      }

      const content = Buffer.from(raw).toString('utf-8');
      const lineCount = content.split('\n').length;
      const language = detectLanguage(filePath);

      return {
        success: true,
        content,
        filePath,
        lineCount,
        sizeBytes,
        language,
      };

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        content: '',
        filePath,
        lineCount: 0,
        sizeBytes: 0,
        language: 'unknown',
        errorMessage: `Failed to read file: ${message}`,
      };
    }
  }

  /**
   * Reads a file and formats it for inclusion in an AI prompt.
   */
  static async readForContext(uri: vscode.Uri): Promise<string> {
    const result = await this.readFile(uri);
    if (!result.success) {
      return `[File could not be read: ${result.errorMessage}]`;
    }
    const warning = result.lineCount > MAX_LINES_WARNING
      ? `\n[WARNING: Large file — ${result.lineCount} lines]\n`
      : '';
    return `\`\`\`${result.language}\n// File: ${result.filePath}\n${warning}${result.content}\n\`\`\``;
  }
}
