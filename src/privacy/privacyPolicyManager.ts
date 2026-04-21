import * as vscode from 'vscode';

export type PolicyLevel = 'strict' | 'balanced' | 'permissive';
export type PolicyScope = 'global' | 'workspace';

export interface PolicyRule {
  category: string;
  enabled: boolean;
  threshold?: number;
}

export interface PrivacyPolicy {
  id: string;
  level: PolicyLevel;
  rules: PolicyRule[];
  updatedAt: number;
  scope: PolicyScope;
}

export class PrivacyPolicyManager {
  private context: vscode.ExtensionContext;
  private readonly CONFIG_SECTION = 'holyquest.privacy';
  private readonly GLOBAL_POLICY_KEY = 'globalPolicy';

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Get active policy (workspace overrides global)
   */
  getActivePolicy(): PrivacyPolicy {
    const workspacePolicy = this.getWorkspacePolicy();
    if (workspacePolicy) {
      return workspacePolicy;
    }
    return this.getGlobalPolicy();
  }

  /**
   * Get global policy from extension global state
   */
  getGlobalPolicy(): PrivacyPolicy {
    const stored = this.context.globalState.get<PrivacyPolicy>(this.GLOBAL_POLICY_KEY);
    if (stored) {
      return stored;
    }
    return this.getDefaultPolicy('global');
  }

  /**
   * Get workspace policy from VS Code settings
   */
  getWorkspacePolicy(): PrivacyPolicy | undefined {
    const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
    const policy = config.get<PrivacyPolicy>('workspacePolicy');
    return policy;
  }

  /**
   * Set policy at specified scope
   */
  async setPolicy(policy: PrivacyPolicy, scope: PolicyScope): Promise<void> {
    policy.updatedAt = Date.now();
    policy.scope = scope;

    if (scope === 'global') {
      await this.context.globalState.update(this.GLOBAL_POLICY_KEY, policy);
    } else {
      const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
      await config.update('workspacePolicy', policy, vscode.ConfigurationTarget.Workspace);
    }
  }

  /**
   * List all policies (global + workspace if exists)
   */
  listPolicies(): PrivacyPolicy[] {
    const policies: PrivacyPolicy[] = [this.getGlobalPolicy()];
    const workspacePolicy = this.getWorkspacePolicy();
    if (workspacePolicy) {
      policies.push(workspacePolicy);
    }
    return policies;
  }

  /**
   * Delete policy at specified scope
   */
  async deletePolicy(id: string, scope: PolicyScope): Promise<void> {
    if (scope === 'global') {
      const defaultPolicy = this.getDefaultPolicy('global');
      if (id === defaultPolicy.id) {
        await this.context.globalState.update(this.GLOBAL_POLICY_KEY, undefined);
      }
    } else {
      const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
      await config.update('workspacePolicy', undefined, vscode.ConfigurationTarget.Workspace);
    }
  }

  /**
   * Get default policy
   */
  private getDefaultPolicy(scope: PolicyScope): PrivacyPolicy {
    return {
      id: `default-${scope}`,
      level: 'balanced',
      rules: [
        { category: 'secrets', enabled: true },
        { category: 'classNames', enabled: true },
        { category: 'functionNames', enabled: false },
        { category: 'variableNames', enabled: false },
        { category: 'filePaths', enabled: false },
        { category: 'domainNames', enabled: true },
        { category: 'emails', enabled: true },
        { category: 'ipAddresses', enabled: true }
      ],
      updatedAt: Date.now(),
      scope
    };
  }

  /**
   * Create policy from level preset
   */
  createPolicyFromLevel(level: PolicyLevel, scope: PolicyScope): PrivacyPolicy {
    const basePolicy = this.getDefaultPolicy(scope);
    basePolicy.level = level;
    basePolicy.id = `${level}-${scope}-${Date.now()}`;

    if (level === 'strict') {
      basePolicy.rules.forEach(rule => rule.enabled = true);
    } else if (level === 'permissive') {
      basePolicy.rules.forEach(rule => {
        rule.enabled = rule.category === 'secrets';
      });
    }

    return basePolicy;
  }

  /**
   * Check if workspace policy is active
   */
  hasWorkspaceOverride(): boolean {
    return this.getWorkspacePolicy() !== undefined;
  }

  /**
   * Clear workspace policy (fallback to global)
   */
  async clearWorkspacePolicy(): Promise<void> {
    const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
    await config.update('workspacePolicy', undefined, vscode.ConfigurationTarget.Workspace);
  }
}
