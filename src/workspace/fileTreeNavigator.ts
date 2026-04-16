/**
 * fileTreeNavigator.ts
 * Builds a structural map of the developer's workspace.
 * Used to give AI agents awareness of the full project.
 * Holy Quest AI — Workspace Operations
 */

import * as vscode from 'vscode';
import * as path from 'path';

// ─── TREE NODE ─────────────────────────────────────────────────────────────
export interface FileTreeNode {
  name: string;
  relativePath: string;
  type: 'file' | 'directory';
  extension?: string;
  children?: FileTreeNode[];
  sizeBytes?: number;
}

// ─── NAVIGATOR CONFIG ──────────────────────────────────────────────────────
export interface NavigatorConfig {
  maxDepth: number;
  excludePatterns: string[];
  maxFiles: number;
}

const DEFAULT_CONFIG: NavigatorConfig = {
  maxDepth: 6,
  excludePatterns: [
    'node_modules', '.git', 'dist', 'out', 'build',
    '.next', '.nuxt', 'coverage', '.nyc_output',
    'archive', '__pycache__', '.pytest_cache',
  ],
  maxFiles: 500,
};

// ─── FILE TREE NAVIGATOR ───────────────────────────────────────────────────
export class FileTreeNavigator {
  private fileCount = 0;

  /**
   * Builds a complete file tree for the first workspace folder.
   */
  async buildTree(config: NavigatorConfig = DEFAULT_CONFIG): Promise<FileTreeNode | null> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return null;
    }
    this.fileCount = 0;
    return this.scanDirectory(folders[0].uri, folders[0].uri, 0, config);
  }

  private async scanDirectory(
    uri: vscode.Uri,
    rootUri: vscode.Uri,
    depth: number,
    config: NavigatorConfig
  ): Promise<FileTreeNode> {
    const name = path.basename(uri.fsPath);
    const relativePath = path.relative(rootUri.fsPath, uri.fsPath);

    if (depth >= config.maxDepth || this.fileCount >= config.maxFiles) {
      return { name, relativePath, type: 'directory', children: [] };
    }

    let entries: [string, vscode.FileType][] = [];
    try {
      entries = await vscode.workspace.fs.readDirectory(uri);
    } catch {
      return { name, relativePath, type: 'directory', children: [] };
    }

    const children: FileTreeNode[] = [];

    for (const [entryName, fileType] of entries) {
      // Skip excluded patterns
      if (config.excludePatterns.some(p => entryName === p)) {
        continue;
      }
      // Skip hidden files/folders
      if (entryName.startsWith('.') && entryName !== '.env.example') {
        continue;
      }

      const childUri = vscode.Uri.joinPath(uri, entryName);
      const childRelative = path.join(relativePath, entryName);

      if (fileType === vscode.FileType.Directory) {
        const subtree = await this.scanDirectory(childUri, rootUri, depth + 1, config);
        children.push(subtree);
      } else if (fileType === vscode.FileType.File) {
        this.fileCount++;
        children.push({
          name: entryName,
          relativePath: childRelative,
          type: 'file',
          extension: path.extname(entryName).toLowerCase(),
        });
        if (this.fileCount >= config.maxFiles) { break; }
      }
    }

    // Sort: directories first, then files, both alphabetical
    children.sort((a, b) => {
      if (a.type !== b.type) { return a.type === 'directory' ? -1 : 1; }
      return a.name.localeCompare(b.name);
    });

    return { name, relativePath, type: 'directory', children };
  }

  /**
   * Returns a compact text representation of the file tree.
   * Used for including project structure in AI prompts.
   */
  static formatTree(node: FileTreeNode, indent: string = ''): string {
    const lines: string[] = [];
    const prefix = node.type === 'directory' ? '📁 ' : '📄 ';
    lines.push(`${indent}${prefix}${node.name}`);
    if (node.children) {
      for (const child of node.children) {
        lines.push(FileTreeNavigator.formatTree(child, indent + '  '));
      }
    }
    return lines.join('\n');
  }
}
