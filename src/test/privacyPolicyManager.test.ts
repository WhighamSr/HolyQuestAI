import { PrivacyPolicyManager, PrivacyPolicy, PolicyLevel, PolicyScope } from '../privacy/privacyPolicyManager';
import * as vscode from 'vscode';

describe('PrivacyPolicyManager', () => {
  let manager: PrivacyPolicyManager;
  let mockContext: vscode.ExtensionContext;
  let globalState: Map<string, any>;
  let workspaceConfig: Map<string, any>;

  beforeEach(() => {
    globalState = new Map();
    workspaceConfig = new Map();

    mockContext = {
      globalState: {
        get: (key: string) => globalState.get(key),
        update: async (key: string, value: any) => {
          globalState.set(key, value);
        }
      }
    } as any;

    // Mock workspace configuration
    const originalGetConfiguration = vscode.workspace.getConfiguration;
    (vscode.workspace.getConfiguration as any) = jest.fn((section?: string) => ({
      get: (key: string) => workspaceConfig.get(key),
      update: async (key: string, value: any, target: any) => {
        workspaceConfig.set(key, value);
      }
    }));

    manager = new PrivacyPolicyManager(mockContext);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getGlobalPolicy', () => {
    it('should return default global policy when none set', () => {
      const policy = manager.getGlobalPolicy();
      expect(policy.id).toContain('default-global');
      expect(policy.level).toBe('balanced');
      expect(policy.scope).toBe('global');
      expect(policy.rules).toHaveLength(8);
    });

    it('should return stored global policy', async () => {
      const customPolicy: PrivacyPolicy = {
        id: 'custom-1',
        level: 'strict',
        rules: [{ category: 'secrets', enabled: true }],
        updatedAt: Date.now(),
        scope: 'global'
      };

      await manager.setPolicy(customPolicy, 'global');
      const retrieved = manager.getGlobalPolicy();
      expect(retrieved.id).toBe('custom-1');
      expect(retrieved.level).toBe('strict');
    });
  });

  describe('getWorkspacePolicy', () => {
    it('should return undefined when no workspace policy set', () => {
      const policy = manager.getWorkspacePolicy();
      expect(policy).toBeUndefined();
    });

    it('should return workspace policy when set', async () => {
      const workspacePolicy: PrivacyPolicy = {
        id: 'workspace-1',
        level: 'permissive',
        rules: [{ category: 'secrets', enabled: true }],
        updatedAt: Date.now(),
        scope: 'workspace'
      };

      workspaceConfig.set('workspacePolicy', workspacePolicy);
      const retrieved = manager.getWorkspacePolicy();
      expect(retrieved?.id).toBe('workspace-1');
      expect(retrieved?.level).toBe('permissive');
    });
  });

  describe('getActivePolicy', () => {
    it('should return global policy when no workspace override', () => {
      const active = manager.getActivePolicy();
      expect(active.scope).toBe('global');
    });

    it('should return workspace policy when workspace override exists', async () => {
      const workspacePolicy: PrivacyPolicy = {
        id: 'workspace-override',
        level: 'strict',
        rules: [{ category: 'secrets', enabled: true }],
        updatedAt: Date.now(),
        scope: 'workspace'
      };

      workspaceConfig.set('workspacePolicy', workspacePolicy);
      const active = manager.getActivePolicy();
      expect(active.id).toBe('workspace-override');
      expect(active.scope).toBe('workspace');
    });
  });

  describe('setPolicy', () => {
    it('should set global policy and update timestamp', async () => {
      const before = Date.now();
      const policy: PrivacyPolicy = {
        id: 'test-1',
        level: 'balanced',
        rules: [],
        updatedAt: 0,
        scope: 'global'
      };

      await manager.setPolicy(policy, 'global');
      const stored = manager.getGlobalPolicy();
      expect(stored.updatedAt).toBeGreaterThanOrEqual(before);
      expect(stored.scope).toBe('global');
    });

    it('should set workspace policy', async () => {
      const policy: PrivacyPolicy = {
        id: 'workspace-test',
        level: 'strict',
        rules: [],
        updatedAt: 0,
        scope: 'workspace'
      };

      await manager.setPolicy(policy, 'workspace');
      expect(workspaceConfig.has('workspacePolicy')).toBe(true);
      const stored = workspaceConfig.get('workspacePolicy');
      expect(stored.scope).toBe('workspace');
    });
  });

  describe('listPolicies', () => {
    it('should list only global policy when no workspace policy', () => {
      const policies = manager.listPolicies();
      expect(policies).toHaveLength(1);
      expect(policies[0].scope).toBe('global');
    });

    it('should list both global and workspace policies', async () => {
      const workspacePolicy: PrivacyPolicy = {
        id: 'workspace-1',
        level: 'permissive',
        rules: [],
        updatedAt: Date.now(),
        scope: 'workspace'
      };

      workspaceConfig.set('workspacePolicy', workspacePolicy);
      const policies = manager.listPolicies();
      expect(policies).toHaveLength(2);
      expect(policies.some(p => p.scope === 'global')).toBe(true);
      expect(policies.some(p => p.scope === 'workspace')).toBe(true);
    });
  });

  describe('deletePolicy', () => {
    it('should clear global policy', async () => {
      const policy = manager.getGlobalPolicy();
      await manager.deletePolicy(policy.id, 'global');
      expect(globalState.has('globalPolicy')).toBe(false);
    });

    it('should clear workspace policy', async () => {
      workspaceConfig.set('workspacePolicy', { id: 'test', level: 'strict', rules: [], updatedAt: Date.now(), scope: 'workspace' });
      await manager.deletePolicy('test', 'workspace');
      expect(workspaceConfig.get('workspacePolicy')).toBeUndefined();
    });
  });

  describe('createPolicyFromLevel', () => {
    it('should create strict policy with all rules enabled', () => {
      const policy = manager.createPolicyFromLevel('strict', 'global');
      expect(policy.level).toBe('strict');
      expect(policy.rules.every(r => r.enabled)).toBe(true);
    });

    it('should create permissive policy with only secrets enabled', () => {
      const policy = manager.createPolicyFromLevel('permissive', 'global');
      expect(policy.level).toBe('permissive');
      const enabledRules = policy.rules.filter(r => r.enabled);
      expect(enabledRules).toHaveLength(1);
      expect(enabledRules[0].category).toBe('secrets');
    });

    it('should create balanced policy with default settings', () => {
      const policy = manager.createPolicyFromLevel('balanced', 'workspace');
      expect(policy.level).toBe('balanced');
      expect(policy.scope).toBe('workspace');
    });
  });

  describe('hasWorkspaceOverride', () => {
    it('should return false when no workspace policy', () => {
      expect(manager.hasWorkspaceOverride()).toBe(false);
    });

    it('should return true when workspace policy exists', () => {
      workspaceConfig.set('workspacePolicy', { id: 'test', level: 'strict', rules: [], updatedAt: Date.now(), scope: 'workspace' });
      expect(manager.hasWorkspaceOverride()).toBe(true);
    });
  });

  describe('clearWorkspacePolicy', () => {
    it('should clear workspace policy', async () => {
      workspaceConfig.set('workspacePolicy', { id: 'test', level: 'strict', rules: [], updatedAt: Date.now(), scope: 'workspace' });
      await manager.clearWorkspacePolicy();
      expect(workspaceConfig.get('workspacePolicy')).toBeUndefined();
    });
  });
});
