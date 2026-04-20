import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import { ConversationStore, Conversation } from '../storage/conversationStore';
import { EnvironmentDetector } from '../utils/environmentDetector';
import { ErrorHandler } from '../utils/errorHandler';
import { RetryHandler } from '../utils/retryHandler';
import { InputSanitizer } from '../utils/inputSanitizer';
import { SecretScanner } from '../utils/secretScanner';
import { PrivacyOrchestrator } from '../privacy/privacyOrchestrator';
import { WorkspaceReader } from '../workspace/workspaceReader';
import { WorkspaceWriter } from '../workspace/workspaceWriter';
import { ContextBuilder } from '../workspace/contextBuilder';
import { DiffEngine } from '../diff/diffEngine';
import { BackupManager } from '../diff/backupManager';

export class HolyQuestAIViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'holyQuestAI.chatView';
    private _view?: vscode.WebviewView;
    private anthropic: Anthropic;
    private apiKey: string = '';
    private conversationHistory: Array<{role: 'user' | 'assistant', content: any}> = [];
    private readonly MAX_TOKENS = 200000;
    private readonly SUMMARY_THRESHOLD = 160000;
    private currentTokenCount = 0;
    private conversationStore?: ConversationStore;
    private currentConversation?: Conversation;
    private environmentDetector?: EnvironmentDetector;
    private stopRequested: boolean = false;
    private diffEngine: DiffEngine;
    private backupManager: BackupManager;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly context?: vscode.ExtensionContext
    ) {
        this.anthropic = new Anthropic({ apiKey: 'placeholder-key' });
        this.diffEngine = new DiffEngine();
        this.backupManager = new BackupManager();
        // API key will be loaded from SecretStorage in initialize()
    }

    async initialize(context: vscode.ExtensionContext): Promise<void> {
        // Load API key from SecretStorage
        const storedKey = await context.secrets.get('holyQuestAI.apiKey');
        if (storedKey) {
            this.apiKey = storedKey;
            this.anthropic = new Anthropic({ apiKey: this.apiKey });
        }

        this.conversationStore = new ConversationStore(context.globalState);
        this.environmentDetector = new EnvironmentDetector(context.globalState);
        await this.environmentDetector.detect();
        const existing = this.conversationStore.getActiveConversation();
        if (existing) {
            this.currentConversation = existing;
            this.conversationHistory = existing.messages;
        } else {
            this.currentConversation = this.conversationStore.createNewConversation();
            await this.conversationStore.saveConversation(this.currentConversation);
            await this.conversationStore.setActiveConversation(
                this.currentConversation.id
            );
        }
    }

    private estimateTokens(text: string): number {
        return Math.ceil(text.length / 4);
    }

    private calculateConversationTokens(): number {
        let total = 0;
        for (const msg of this.conversationHistory) {
            if (typeof msg.content === 'string') {
                total += this.estimateTokens(msg.content);
            } else if (Array.isArray(msg.content)) {
                for (const part of msg.content) {
                    if (part.type === 'text') {
                        total += this.estimateTokens(part.text);
                    } else if (part.type === 'image') {
                        total += 1500;
                    }
                }
            }
        }
        return total;
    }

    private updateTokenDisplay(webview: vscode.Webview) {
        this.currentTokenCount = this.calculateConversationTokens();
        const percentage = (this.currentTokenCount / this.MAX_TOKENS) * 100;
        
        webview.postMessage({
            type: 'updateTokens',
            current: this.currentTokenCount,
            max: this.MAX_TOKENS,
            percentage: percentage.toFixed(1),
            nearLimit: this.currentTokenCount >= this.SUMMARY_THRESHOLD
        });
    }

    private async generateContextSummary(): Promise<string> {
        const summaryPrompt = `Create a concise context transfer summary of this conversation for continuation in a new chat. Include:

1. **Key Topics Discussed:** Brief list of main subjects
2. **Technical Details:** Important code, file paths, configurations mentioned
3. **Decisions Made:** What was decided or implemented
4. **Current State:** Where we are in the workflow
5. **Next Steps:** What needs to be done next

Keep it under 2000 tokens. Be precise and technical.

Conversation history:
${JSON.stringify(this.conversationHistory, null, 2)}`;

        try {
            const response = await this.anthropic.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 3000,
                messages: [{ role: 'user', content: summaryPrompt }]
            });

            const summaryText = response.content[0].type === 'text' ? response.content[0].text : '';
            const estimatedTokens = this.estimateTokens(summaryText);

            return `# 📋 CONTEXT TRANSFER SUMMARY
*Generated automatically - Use this to continue our conversation in a new chat*
*Summary size: ~${estimatedTokens} tokens*

---

${summaryText}

---

*Original conversation: ${this.currentTokenCount} tokens*
*Summary created: ${new Date().toLocaleString()}*`;
        } catch (error: any) {
            return `# ⚠️ Summary Generation Failed\n\nError: ${error.message}\n\nPlease manually copy important context before clearing chat.`;
        }
    }

    public resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this.getHtml(webviewView.webview);
        
        webviewView.webview.onDidReceiveMessage(async (data) => {
            if (data.type === 'saveApiKey') {
                // Check if it's multi-provider key or legacy Anthropic key
                if (data.provider) {
                    await this.handleSaveApiKey(data.provider, data.apiKey);
                } else {
                    // Legacy support for Anthropic
                    this.apiKey = data.apiKey;
                    this.anthropic = new Anthropic({ apiKey: this.apiKey });
                    if (this.context) {
                        await this.context.secrets.store('holyQuestAI.apiKey', data.apiKey);
                    }
                    vscode.window.showInformationMessage('API Key Saved Securely');
                    webviewView.webview.postMessage({ type: 'apiKeySaved' });
                }
                return;
            }

            if (data.type === 'checkApiKey') {
                const hasKey = !!(await this.getApiKey(data.provider));
                webviewView.webview.postMessage({ 
                    type: 'apiKeyStatus', 
                    provider: data.provider, 
                    hasKey 
                });
                return;
            }
            
            if (data.type === 'clearHistory') {
                this.conversationHistory = [];
                this.currentTokenCount = 0;
                this.updateTokenDisplay(webviewView.webview);
                vscode.window.showInformationMessage('Conversation history cleared');
                return;
            }

            if (data.type === 'generateSummary') {
                webviewView.webview.postMessage({ type: 'summaryStart' });
                const summary = await this.generateContextSummary();
                webviewView.webview.postMessage({ 
                    type: 'summaryComplete', 
                    summary: summary 
                });
                return;
            }

            if (data.type === 'stopGeneration') {
                this.stopRequested = true;
                return;
            }

            if (data.type === 'applyToFile') {
                await this.handleApplyToFile(data.filePath, data.proposedContent);
                return;
            }

            if (data.type === 'undoLastApply') {
                await this.handleUndoLastApply();
                return;
            }
            
            if (data.type === 'chat') {
                const message = data.message || '';
                const imageData = data.imageData;
                
                if (!this.apiKey || this.apiKey === 'placeholder-key') {
                    webviewView.webview.postMessage({ type: 'error', message: 'Set API key first' });
                    return;
                }
                
                // Sanitize user input before API transmission
                const sanitizationResult = InputSanitizer.sanitize(message);
                if (sanitizationResult.xssDetected || sanitizationResult.injectionDetected) {
                    console.warn('Holy Quest AI: Suspicious input detected and sanitized.');
                }
                const safeMessage = sanitizationResult.sanitized;
                
                const messageContent: any[] = [{ type: 'text', text: safeMessage }];
                
                if (imageData) {
                    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
                    messageContent.push({
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: 'image/png',
                            data: base64Data
                        }
                    });
                }
                
                this.conversationHistory.push({
                    role: 'user',
                    content: messageContent
                });

                this.updateTokenDisplay(webviewView.webview);
                
                if (message.toLowerCase().includes('agent')) {
                    try {
                        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                        if (!workspaceFolder) {
                            webviewView.webview.postMessage({ type: 'error', message: 'No workspace open' });
                            return;
                        }
                        
                        webviewView.webview.postMessage({ type: 'agentStart' });
                        const { AgentCoordinator } = require('./agents/AgentCoordinator');
                        const coordinator = new AgentCoordinator(this.apiKey, workspaceFolder.uri.fsPath, webviewView.webview);
                        
                        const result = await coordinator.runWorkflow(message, this.conversationHistory);
                        
                        this.conversationHistory.push({
                            role: 'assistant',
                            content: result.text || JSON.stringify(result)
                        });

                        this.updateTokenDisplay(webviewView.webview);
                        
                        webviewView.webview.postMessage({ type: 'agentComplete', result: result });

                        if (this.currentTokenCount >= this.SUMMARY_THRESHOLD) {
                            webviewView.webview.postMessage({ 
                                type: 'info', 
                                message: '⚠️ Approaching token limit. Consider generating a summary for context transfer.' 
                            });
                        }
                    } catch (error: any) {
                        const categorized = ErrorHandler.categorize(error);
                        ErrorHandler.showError(categorized);
                        webviewView.webview.postMessage({ 
                            type: 'error', 
                            message: ErrorHandler.formatForWebview(categorized)
                        });
                    }
                } else {
                    try {
                        webviewView.webview.postMessage({ type: 'agentStart' });
                        
                        const stream = await this.anthropic.messages.stream({
                            model: 'claude-sonnet-4-20250514',
                            max_tokens: 8000,
                            temperature: 0.7,
                            messages: this.conversationHistory
                        });
                        
                        let response = '';
                        this.stopRequested = false;
                        for await (const chunk of stream) {
                            if (this.stopRequested) {
                                break;
                            }
                            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                                response += chunk.delta.text;
                            }
                        }
                        
                        this.conversationHistory.push({
                            role: 'assistant',
                            content: response
                        });

                        this.updateTokenDisplay(webviewView.webview);
                        
                        webviewView.webview.postMessage({ type: 'agentComplete', result: { text: response } });

                        if (this.currentTokenCount >= this.SUMMARY_THRESHOLD) {
                            webviewView.webview.postMessage({ 
                                type: 'info', 
                                message: '⚠️ Approaching token limit. Consider generating a summary for context transfer.' 
                            });
                        }
                    } catch (error: any) {
                        const categorized = ErrorHandler.categorize(error);
                        ErrorHandler.showError(categorized);
                        webviewView.webview.postMessage({ 
                            type: 'error', 
                            message: ErrorHandler.formatForWebview(categorized)
                        });
                    }
                }
            }
        });

        this.updateTokenDisplay(webviewView.webview);
    }

    private getHtml(webview: vscode.Webview): string {
        const nonce = this.getNonce();
        const stylesUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'styles.css')
        );
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'chat.js')
        );
        const htmlPath = path.join(
            this._extensionUri.fsPath, 'src', 'webview', 'chat.html'
        );
        let html = fs.readFileSync(htmlPath, 'utf8');
        html = html.replace(/NONCE_PLACEHOLDER/g, nonce);
        html = html.replace('STYLES_URI_PLACEHOLDER', stylesUri.toString());
        html = html.replace('SCRIPT_URI_PLACEHOLDER', scriptUri.toString());
        return html;
    }

    private getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    private async handleSaveApiKey(provider: string, apiKey: string): Promise<void> {
        const validProviders = ['openai', 'gemini', 'anthropic', 'groq', 'deepseek', 'custom'];
        if (!validProviders.includes(provider.toLowerCase())) {
            this._view?.webview.postMessage({ type: 'apiKeyResult', success: false, error: 'Invalid provider' });
            return;
        }
        if (this.context) {
            await this.context.secrets.store(`holyquest.apikey.${provider.toLowerCase()}`, apiKey);
            this._view?.webview.postMessage({ type: 'apiKeyResult', success: true, provider });
        }
    }

    private async getApiKey(provider: string): Promise<string | undefined> {
        return this.context?.secrets.get(`holyquest.apikey.${provider.toLowerCase()}`);
    }

    public async handleApplyToFile(
        filePath: string,
        proposedContent: string
    ): Promise<void> {
        try {
            // Read current file content
            const uri = vscode.Uri.file(filePath);
            let currentContent = '';
            try {
                const bytes = await vscode.workspace.fs.readFile(uri);
                currentContent = new TextDecoder().decode(bytes);
            } catch {
                // File doesn't exist yet — treat as empty
                currentContent = '';
            }

            // Open diff view
            const proposedUri = vscode.Uri.parse(
                `holyquest-proposed:${filePath}?${Date.now()}`
            );
            
            // Register content provider for proposed content
            const provider = new (class implements vscode.TextDocumentContentProvider {
                provideTextDocumentContent(): string {
                    return proposedContent;
                }
            })();
            
            const registration = vscode.workspace.registerTextDocumentContentProvider(
                'holyquest-proposed',
                provider
            );

            try {
                await vscode.commands.executeCommand(
                    'vscode.diff',
                    uri,
                    proposedUri,
                    `Holy Quest AI: ${filePath.split(/[\\/]/).pop()} (Preview)`
                );

                // Ask user to confirm
                const choice = await vscode.window.showInformationMessage(
                    `Apply changes to ${filePath.split(/[\\/]/).pop()}?`,
                    { modal: true },
                    'Apply',
                    'Cancel'
                );

                if (choice === 'Apply') {
                    // Backup first
                    this.backupManager.backup(filePath, currentContent);
                    
                    // Write new content
                    await vscode.workspace.fs.writeFile(
                        uri,
                        new TextEncoder().encode(proposedContent)
                    );

                    vscode.window.showInformationMessage(
                        `Applied changes to ${filePath.split(/[\\/]/).pop()}. Use "Undo Last Apply" to revert.`
                    );
                }
            } finally {
                registration.dispose();
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Apply to File failed: ${message}`);
        }
    }

    public async handleUndoLastApply(): Promise<void> {
        const lastBackup = this.backupManager.getLastBackup();
        
        if (!lastBackup) {
            vscode.window.showInformationMessage('No recent apply to undo.');
            return;
        }

        const choice = await vscode.window.showWarningMessage(
            `Undo apply to ${lastBackup.filePath.split(/[\\/]/).pop()}?`,
            { modal: true },
            'Undo',
            'Cancel'
        );

        if (choice === 'Undo') {
            try {
                const uri = vscode.Uri.file(lastBackup.filePath);
                await vscode.workspace.fs.writeFile(
                    uri,
                    new TextEncoder().encode(lastBackup.content)
                );
                vscode.window.showInformationMessage('Undo successful. File restored.');
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`Undo failed: ${message}`);
            }
        }
    }
}
