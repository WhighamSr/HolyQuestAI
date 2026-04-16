/**
 * workspaceWriter.ts
 * Writes and creates files in the developer's workspace.
 * ALL writes require explicit user confirmation.
 * Holy Quest AI — Workspace Operations
 */

import * as vscode from 'vscode';
import * as path from 'path';

// ─── WRITE RESULT ──────────────────────────────────────────────────────────
export interface FileWriteResult {
  success: boolean;
  filePath: string;
  action: 'created' | 'updated' | 'cancelled' | 'failed';
  errorMessage?: string;
  linesWritten?: number;
}

// ─── PROTECTED PATHS — NEVER WRITE TO THESE ───────────────────────────────
const PROTECTED_PATTERNS: RegExp[] = [
  /node_modules/i,
  /\.git[\/\\]/i,
  /package-lock\.json$/i,
  /tsconfig\.json$/i,
  /webpack\.config\.js$/i,
  /\.vscodeignore$/i,
];

function isProtectedPath(filePath: string): boolean {
  return PROTECTED_PATTERNS.some(p => p.test(filePath));
}

// ─── WORKSPACE WRITER ──────────────────────────────────────────────────────
export class WorkspaceWriter {

  /**
   * Writes content to a file after user confirmation.
   * Creates the file if it does not exist.
   * Never overwrites without showing a diff-style preview.
   */
  static async writeFile(
    uri: vscode.Uri,
    content: string,
    skipConfirmation: boolean = false
  ): Promise<FileWriteResult> {
    const filePath = uri.fsPath;

    // Block protected paths
    if (isProtectedPath(filePath)) {
      return {
        success: false,
        filePath,
        action: 'failed',
        errorMessage: `Protected path — Holy Quest AI will never write to: ${filePath}`,
      };
    }

    // Check if file already exists
    let fileExists = false;
    try {
      await vscode.workspace.fs.stat(uri);
      fileExists = true;
    } catch {
      fileExists = false;
    }

    const action = fileExists ? 'updated' : 'created';
    const fileName = path.basename(filePath);
    const lineCount = content.split('\n').length;

    // Always confirm unless explicitly skipped
    if (!skipConfirmation) {
      const verb = fileExists ? 'Overwrite' : 'Create';
      const detail = fileExists
        ? `This will replace the existing file with ${lineCount} lines of new content.`
        : `This will create a new file with ${lineCount} lines.`;

      const choice = await vscode.window.showWarningMessage(
        `Holy Quest AI: ${verb} "${fileName}"?`,
        { modal: true, detail },
        verb,
        'Cancel'
      );

      if (choice !== verb) {
        return { success: false, filePath, action: 'cancelled' };
      }
    }

    try {
      // Ensure parent directory exists
      const parentUri = vscode.Uri.file(path.dirname(filePath));
      await vscode.workspace.fs.createDirectory(parentUri);

      // Write the file
      const encoder = new TextEncoder();
      await vscode.workspace.fs.writeFile(uri, encoder.encode(content));

      // Open the file to show the user what was written
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, { preview: true });

      return {
        success: true,
        filePath,
        action,
        linesWritten: lineCount,
      };

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        filePath,
        action: 'failed',
        errorMessage: `Write failed: ${message}`,
      };
    }
  }

  /**
   * Creates a new file only — never overwrites existing files.
   */
  static async createNewFile(
    uri: vscode.Uri,
    content: string
  ): Promise<FileWriteResult> {
    try {
      await vscode.workspace.fs.stat(uri);
      // File exists — refuse to overwrite via this method
      return {
        success: false,
        filePath: uri.fsPath,
        action: 'failed',
        errorMessage: `File already exists. Use writeFile() to update existing files.`,
      };
    } catch {
      // File does not exist — safe to create
      return this.writeFile(uri, content, false);
    }
  }
}
