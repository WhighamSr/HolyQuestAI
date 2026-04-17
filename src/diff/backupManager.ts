/**
 * BackupManager - In-memory file backup management with FIFO eviction
 * Holy Quest AI - Phase 1
 */

/**
 * Represents a single backup entry
 */
interface BackupEntry {
  backupId: string;
  filePath: string;
  content: string;
  timestamp: number;
}

/**
 * Manages in-memory backups of file content with FIFO eviction
 */
export class BackupManager {
  private backups: Map<string, BackupEntry>;
  private backupOrder: string[]; // Track insertion order for FIFO
  private readonly maxBackups = 50;

  constructor() {
    this.backups = new Map<string, BackupEntry>();
    this.backupOrder = [];
  }

  /**
   * Creates a backup of file content and returns a unique backup ID
   * @param filePath - Path to the file being backed up
   * @param content - Content to backup
   * @returns Unique backup ID
   */
  public backup(filePath: string, content: string): string {
    // Generate unique backup ID using timestamp and random component
    const backupId = this.generateBackupId();

    // Create backup entry
    const entry: BackupEntry = {
      backupId,
      filePath,
      content,
      timestamp: Date.now()
    };

    // Check if we need to evict oldest backup (FIFO)
    if (this.backups.size >= this.maxBackups) {
      this.evictOldestBackup();
    }

    // Store the backup
    this.backups.set(backupId, entry);
    this.backupOrder.push(backupId);

    return backupId;
  }

  /**
   * Restores a backup by its ID
   * @param backupId - The backup ID to restore
   * @returns The backup entry or null if not found
   */
  public restore(backupId: string): { filePath: string; content: string } | null {
    const entry = this.backups.get(backupId);
    
    if (!entry) {
      return null;
    }

    return {
      filePath: entry.filePath,
      content: entry.content
    };
  }

  /**
   * Gets the most recent backup
   * @returns The last backup entry or null if no backups exist
   */
  public getLastBackup(): { backupId: string; filePath: string; content: string } | null {
    if (this.backupOrder.length === 0) {
      return null;
    }

    // Get the last backup ID from the order array
    const lastBackupId = this.backupOrder[this.backupOrder.length - 1];
    const entry = this.backups.get(lastBackupId);

    if (!entry) {
      return null;
    }

    return {
      backupId: entry.backupId,
      filePath: entry.filePath,
      content: entry.content
    };
  }

  /**
   * Clears all backups from memory
   */
  public clearAll(): void {
    this.backups.clear();
    this.backupOrder = [];
  }

  /**
   * Gets the current number of backups in memory
   * @returns Count of backups
   */
  public getBackupCount(): number {
    return this.backups.size;
  }

  /**
   * Generates a unique backup ID
   * @returns Unique backup ID string
   */
  private generateBackupId(): string {
    // Use timestamp + random component for uniqueness
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `backup_${timestamp}_${random}`;
  }

  /**
   * Evicts the oldest backup (FIFO)
   */
  private evictOldestBackup(): void {
    if (this.backupOrder.length === 0) {
      return;
    }

    // Remove the first (oldest) backup
    const oldestId = this.backupOrder.shift();
    if (oldestId) {
      this.backups.delete(oldestId);
    }
  }
}
