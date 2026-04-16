/**
 * contextBuilder.ts
 * Assembles rich context from workspace files for AI prompts.
 * Automatically includes relevant files based on user query.
 * Holy Quest AI — Workspace Operations
 */

import * as vscode from 'vscode';
import { WorkspaceReader } from './workspaceReader';
import { FileTreeNavigator } from './fileTreeNavigator';

// ─── CONTEXT RESULT ────────────────────────────────────────────────────────
export interface BuiltContext {
  projectStructure: string;
  activeFileContent: string;
  selectedTextContent: string;
  additionalFiles: string[];
  totalTokenEstimate: number;
  assembledPrompt: string;
}

// ─── TOKEN ESTIMATION (approximate — 4 chars per token) ───────────────────
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ─── CONTEXT BUILDER ───────────────────────────────────────────────────────
export class ContextBuilder {
  private static readonly MAX_CONTEXT_TOKENS = 80000;

  /**
   * Builds context from the current editor state.
   * Includes: active file, selected text, project tree.
   */
  static async buildFromEditor(userQuery: string): Promise<BuiltContext> {
    const navigator = new FileTreeNavigator();
    let projectStructure = '';
    let activeFileContent = '';
    let selectedTextContent = '';
    const additionalFiles: string[] = [];

    // Build project tree
    try {
      const tree = await navigator.buildTree();
      if (tree) {
        projectStructure = `Project Structure:\n${FileTreeNavigator.formatTree(tree)}`;
      }
    } catch {
      projectStructure = '[Project structure unavailable]';
    }

    // Read active file
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      const uri = activeEditor.document.uri;
      // Skip untitled and output channels
      if (uri.scheme === 'file') {
        const result = await WorkspaceReader.readForContext(uri);
        activeFileContent = `Currently open file:\n${result}`;
      }

      // Get selected text if any
      const selection = activeEditor.selection;
      if (!selection.isEmpty) {
        const selectedText = activeEditor.document.getText(selection);
        selectedTextContent = `Selected code:\n\`\`\`\n${selectedText}\n\`\`\``;
      }
    }

    // Assemble final prompt with token budget awareness
    const assembled = this.assembleWithBudget(
      userQuery,
      projectStructure,
      activeFileContent,
      selectedTextContent,
      additionalFiles
    );

    return {
      projectStructure,
      activeFileContent,
      selectedTextContent,
      additionalFiles,
      totalTokenEstimate: estimateTokens(assembled),
      assembledPrompt: assembled,
    };
  }

  /**
   * Assembles context sections within token budget.
   * Priority: user query > selected text > active file > project tree
   */
  private static assembleWithBudget(
    userQuery: string,
    projectStructure: string,
    activeFileContent: string,
    selectedTextContent: string,
    additionalFiles: string[]
  ): string {
    const sections: string[] = [];
    let tokenBudget = this.MAX_CONTEXT_TOKENS;

    // Always include user query
    sections.push(userQuery);
    tokenBudget -= estimateTokens(userQuery);

    // Include selected text (highest priority)
    if (selectedTextContent && estimateTokens(selectedTextContent) < tokenBudget) {
      sections.push(selectedTextContent);
      tokenBudget -= estimateTokens(selectedTextContent);
    }

    // Include active file content
    if (activeFileContent && estimateTokens(activeFileContent) < tokenBudget) {
      sections.push(activeFileContent);
      tokenBudget -= estimateTokens(activeFileContent);
    }

    // Include additional files if budget allows
    for (const file of additionalFiles) {
      if (estimateTokens(file) < tokenBudget) {
        sections.push(file);
        tokenBudget -= estimateTokens(file);
      }
    }

    // Project structure last (lowest priority)
    if (projectStructure && estimateTokens(projectStructure) < tokenBudget) {
      sections.push(projectStructure);
    }

    return sections.join('\n\n---\n\n');
  }
}
