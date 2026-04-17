/**
 * DiffEngine - Line-by-line diff computation for file comparison
 * Holy Quest AI - Phase 1
 */

import { PrivacyOrchestrator } from '../privacy/privacyOrchestrator';

/**
 * Represents a single line in a diff result
 */
export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineNumber: number;
}

/**
 * Represents the complete result of a diff operation
 */
export interface DiffResult {
  lines: DiffLine[];
  addedCount: number;
  removedCount: number;
  unchangedCount: number;
  totalChanges: number;
}

/**
 * Engine for computing line-by-line diffs between text content
 */
export class DiffEngine {
  private privacyOrchestrator: PrivacyOrchestrator;

  constructor() {
    // Initialize privacy orchestrator for potential future use
    this.privacyOrchestrator = new PrivacyOrchestrator();
  }

  /**
   * Computes a line-by-line diff between original and proposed content
   * @param original - The original file content
   * @param proposed - The proposed new content
   * @returns DiffResult containing all diff lines and statistics
   */
  public computeDiff(original: string, proposed: string): DiffResult {
    // Validate inputs
    if (original === null || original === undefined) {
      throw new Error('Original content cannot be null or undefined');
    }
    if (proposed === null || proposed === undefined) {
      throw new Error('Proposed content cannot be null or undefined');
    }

    // Split content into lines
    const originalLines = this.splitIntoLines(original);
    const proposedLines = this.splitIntoLines(proposed);

    // Compute diff using simple line comparison
    const diffLines = this.computeLineDiff(originalLines, proposedLines);

    // Calculate statistics
    const addedCount = diffLines.filter(line => line.type === 'added').length;
    const removedCount = diffLines.filter(line => line.type === 'removed').length;
    const unchangedCount = diffLines.filter(line => line.type === 'unchanged').length;
    const totalChanges = addedCount + removedCount;

    return {
      lines: diffLines,
      addedCount,
      removedCount,
      unchangedCount,
      totalChanges
    };
  }

  /**
   * Formats a diff result for human-readable display
   * @param diff - The diff result to format
   * @returns Formatted string representation
   */
  public formatForDisplay(diff: DiffResult): string {
    const lines: string[] = [];
    
    lines.push('=== DIFF SUMMARY ===');
    lines.push(`Added: ${diff.addedCount} lines`);
    lines.push(`Removed: ${diff.removedCount} lines`);
    lines.push(`Unchanged: ${diff.unchangedCount} lines`);
    lines.push(`Total changes: ${diff.totalChanges} lines`);
    lines.push('');
    lines.push('=== DIFF CONTENT ===');

    for (const line of diff.lines) {
      const prefix = this.getLinePrefix(line.type);
      const number = line.lineNumber.toString().padStart(4, ' ');
      lines.push(`${number} ${prefix} ${line.content}`);
    }

    return lines.join('\n');
  }

  /**
   * Splits content into lines, handling various newline formats
   * @param content - Content to split
   * @returns Array of lines
   */
  private splitIntoLines(content: string): string[] {
    if (content === '') {
      return [];
    }
    
    // Split by newlines and handle trailing newline
    const lines = content.split('\n');
    
    // If content ends with newline, remove the last empty element
    if (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }
    
    return lines;
  }

  /**
   * Computes line-by-line diff using simple comparison algorithm
   * @param originalLines - Original content lines
   * @param proposedLines - Proposed content lines
   * @returns Array of DiffLine objects
   */
  private computeLineDiff(originalLines: string[], proposedLines: string[]): DiffLine[] {
    const result: DiffLine[] = [];
    let lineNumber = 1;

    // Build a set of proposed lines for quick lookup
    const proposedSet = new Set(proposedLines);
    const originalSet = new Set(originalLines);

    // First pass: Process lines that exist in both (unchanged) and originals (removed)
    const processedProposed = new Set<number>();
    
    for (let i = 0; i < originalLines.length; i++) {
      const originalLine = originalLines[i];
      
      // Check if this line exists in proposed
      const proposedIndex = proposedLines.indexOf(originalLine);
      
      if (proposedIndex !== -1 && !processedProposed.has(proposedIndex)) {
        // Line is unchanged
        result.push({
          type: 'unchanged',
          content: originalLine,
          lineNumber: lineNumber++
        });
        processedProposed.add(proposedIndex);
      } else {
        // Line was removed
        result.push({
          type: 'removed',
          content: originalLine,
          lineNumber: lineNumber++
        });
      }
    }

    // Second pass: Add lines that are in proposed but not yet processed (added)
    for (let i = 0; i < proposedLines.length; i++) {
      if (!processedProposed.has(i)) {
        result.push({
          type: 'added',
          content: proposedLines[i],
          lineNumber: lineNumber++
        });
      }
    }

    return result;
  }

  /**
   * Gets the display prefix for a diff line type
   * @param type - The line type
   * @returns Prefix string
   */
  private getLinePrefix(type: 'added' | 'removed' | 'unchanged'): string {
    switch (type) {
      case 'added':
        return '+';
      case 'removed':
        return '-';
      case 'unchanged':
        return ' ';
    }
  }
}
