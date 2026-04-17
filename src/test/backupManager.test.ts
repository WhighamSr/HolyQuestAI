/**
 * Test suite for BackupManager
 * Holy Quest AI - Phase 1
 */

import { BackupManager } from '../diff/backupManager';

describe('BackupManager', () => {
  let backupManager: BackupManager;

  beforeEach(() => {
    backupManager = new BackupManager();
  });

  describe('backup', () => {
    it('should return a unique backup ID', () => {
      const id1 = backupManager.backup('/path/file1.ts', 'content1');
      const id2 = backupManager.backup('/path/file2.ts', 'content2');
      
      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
    });

    it('should increment backup count', () => {
      expect(backupManager.getBackupCount()).toBe(0);
      
      backupManager.backup('/path/file.ts', 'content');
      expect(backupManager.getBackupCount()).toBe(1);
      
      backupManager.backup('/path/file2.ts', 'content2');
      expect(backupManager.getBackupCount()).toBe(2);
    });
  });

  describe('restore', () => {
    it('should retrieve the backed-up content', () => {
      const filePath = '/path/test.ts';
      const content = 'test content';
      const backupId = backupManager.backup(filePath, content);
      
      const restored = backupManager.restore(backupId);
      
      expect(restored).toBeTruthy();
      expect(restored?.filePath).toBe(filePath);
      expect(restored?.content).toBe(content);
    });

    it('should return null for unknown ID', () => {
      const restored = backupManager.restore('non-existent-id');
      
      expect(restored).toBeNull();
    });
  });

  describe('getLastBackup', () => {
    it('should return most recent backup', () => {
      const id1 = backupManager.backup('/path/file1.ts', 'content1');
      const id2 = backupManager.backup('/path/file2.ts', 'content2');
      const id3 = backupManager.backup('/path/file3.ts', 'content3');
      
      const lastBackup = backupManager.getLastBackup();
      
      expect(lastBackup).toBeTruthy();
      expect(lastBackup?.backupId).toBe(id3);
      expect(lastBackup?.filePath).toBe('/path/file3.ts');
      expect(lastBackup?.content).toBe('content3');
    });

    it('should return null when empty', () => {
      const lastBackup = backupManager.getLastBackup();
      
      expect(lastBackup).toBeNull();
    });
  });

  describe('clearAll', () => {
    it('should empty the backup store', () => {
      backupManager.backup('/path/file1.ts', 'content1');
      backupManager.backup('/path/file2.ts', 'content2');
      expect(backupManager.getBackupCount()).toBe(2);
      
      backupManager.clearAll();
      
      expect(backupManager.getBackupCount()).toBe(0);
      expect(backupManager.getLastBackup()).toBeNull();
    });
  });

  describe('getBackupCount', () => {
    it('should return correct count', () => {
      expect(backupManager.getBackupCount()).toBe(0);
      
      backupManager.backup('/path/file1.ts', 'content1');
      expect(backupManager.getBackupCount()).toBe(1);
      
      backupManager.backup('/path/file2.ts', 'content2');
      expect(backupManager.getBackupCount()).toBe(2);
      
      backupManager.backup('/path/file3.ts', 'content3');
      expect(backupManager.getBackupCount()).toBe(3);
    });
  });

  describe('FIFO eviction', () => {
    it('should evict oldest backup when reaching 50 entries', () => {
      // Add 50 backups
      const backupIds: string[] = [];
      for (let i = 0; i < 50; i++) {
        const id = backupManager.backup(`/path/file${i}.ts`, `content${i}`);
        backupIds.push(id);
      }
      
      expect(backupManager.getBackupCount()).toBe(50);
      
      // Add one more - should evict the first
      const id51 = backupManager.backup('/path/file50.ts', 'content50');
      
      expect(backupManager.getBackupCount()).toBe(50);
      expect(backupManager.restore(backupIds[0])).toBeNull(); // First should be evicted
      expect(backupManager.restore(id51)).toBeTruthy(); // New one should exist
      expect(backupManager.restore(backupIds[1])).toBeTruthy(); // Second should still exist
    });
  });
});
