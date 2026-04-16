import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';

export interface EnvironmentProfile {
    platform: 'windows' | 'mac' | 'linux';
    shell: 'powershell' | 'bash' | 'zsh' | 'cmd' | 'unknown';
    shellVersion: string;
    nodeVersion: string;
    pathSeparator: string;
    homeDir: string;
    tempDir: string;
    detectedAt: number;
    vscodePlatform: string;
}

export class EnvironmentDetector {
    private static readonly STORAGE_KEY = 'holyQuestAI.environment';

    constructor(private readonly globalState: vscode.Memento) {}

    async detect(): Promise<EnvironmentProfile> {
        const platform = this.detectPlatform();
        const shell = this.detectShell();
        const profile: EnvironmentProfile = {
            platform,
            shell,
            shellVersion: process.version,
            nodeVersion: process.version,
            pathSeparator: path.sep,
            homeDir: os.homedir(),
            tempDir: os.tmpdir(),
            detectedAt: Date.now(),
            vscodePlatform: process.platform
        };
        await this.globalState.update(
            EnvironmentDetector.STORAGE_KEY, profile
        );
        return profile;
    }

    getStoredProfile(): EnvironmentProfile | undefined {
        return this.globalState.get<EnvironmentProfile>(
            EnvironmentDetector.STORAGE_KEY
        );
    }

    private detectPlatform(): 'windows' | 'mac' | 'linux' {
        switch (process.platform) {
            case 'win32': return 'windows';
            case 'darwin': return 'mac';
            default: return 'linux';
        }
    }

    private detectShell(): 'powershell' | 'bash' | 'zsh' | 'cmd' | 'unknown' {
        const shell = process.env.SHELL || 
                      process.env.ComSpec || 
                      vscode.env.shell || '';
        const shellLower = shell.toLowerCase();
        if (shellLower.includes('powershell') || 
            shellLower.includes('pwsh')) return 'powershell';
        if (shellLower.includes('zsh')) return 'zsh';
        if (shellLower.includes('bash')) return 'bash';
        if (shellLower.includes('cmd')) return 'cmd';
        return 'unknown';
    }

    joinPath(...parts: string[]): string {
        return path.join(...parts);
    }

    isWindows(): boolean {
        return this.detectPlatform() === 'windows';
    }

    isMac(): boolean {
        return this.detectPlatform() === 'mac';
    }

    isLinux(): boolean {
        return this.detectPlatform() === 'linux';
    }
}
