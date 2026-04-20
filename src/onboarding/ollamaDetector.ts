/**
 * Ollama Detection for Holy Quest AI
 * Detects Ollama installation and running status
 */

/**
 * Possible states of Ollama installation
 */
export enum OllamaStatus {
  NOT_INSTALLED = 'not_installed',
  INSTALLED_NOT_RUNNING = 'installed_not_running',
  RUNNING = 'running',
  UNKNOWN = 'unknown'
}

/**
 * Result of Ollama status detection
 */
export interface OllamaStatusResult {
  status: OllamaStatus;
  version?: string;
  modelCount?: number;
  suggestedAction: string;
  installUrl?: string;
}

/**
 * Detects Ollama installation and status
 */
export class OllamaDetector {
  private readonly baseUrl: string;
  private readonly timeoutMs: number = 2000;

  constructor(baseUrl: string = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
  }

  /**
   * Detect the current status of Ollama
   */
  async detectStatus(): Promise<OllamaStatusResult> {
    try {
      // Try to get version with timeout
      const version = await this.getVersionWithTimeout();
      
      if (version) {
        // Ollama is running, get model count
        const modelCount = await this.getModelCount();
        
        return {
          status: OllamaStatus.RUNNING,
          version,
          modelCount,
          suggestedAction: modelCount > 0
            ? 'Ollama is ready to use!'
            : 'Download a model to get started.',
        };
      }

      // Connection refused or timeout - could be not installed or not running
      return {
        status: OllamaStatus.UNKNOWN,
        suggestedAction: 'Install Ollama or start the Ollama service.',
        installUrl: this.getInstallUrl(process.platform as NodeJS.Platform),
      };
    } catch (error) {
      return {
        status: OllamaStatus.UNKNOWN,
        suggestedAction: 'Unable to detect Ollama. Please check your installation.',
        installUrl: this.getInstallUrl(process.platform as NodeJS.Platform),
      };
    }
  }

  /**
   * Check if Ollama is currently running
   */
  async isRunning(): Promise<boolean> {
    const result = await this.detectStatus();
    return result.status === OllamaStatus.RUNNING;
  }

  /**
   * Get Ollama version if available
   */
  async getVersion(): Promise<string | undefined> {
    try {
      const response = await fetch(`${this.baseUrl}/api/version`, {
        method: 'GET',
      });

      if (response.ok) {
        const data: any = await response.json();
        return data.version;
      }
      return undefined;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Get install URL for the current platform
   */
  getInstallUrl(platform: NodeJS.Platform): string {
    switch (platform) {
      case 'win32':
        return 'https://ollama.com/download/windows';
      case 'darwin':
        return 'https://ollama.com/download/mac';
      case 'linux':
        return 'https://ollama.com/download/linux';
      default:
        return 'https://ollama.com';
    }
  }

  /**
   * Get version with timeout to avoid hanging
   */
  private async getVersionWithTimeout(): Promise<string | undefined> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(`${this.baseUrl}/api/version`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data: any = await response.json();
        return data.version;
      }
      return undefined;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Get count of installed models
   */
  private async getModelCount(): Promise<number> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
      });

      if (response.ok) {
        const data: any = await response.json();
        return data.models?.length || 0;
      }
      return 0;
    } catch (error) {
      return 0;
    }
  }
}
