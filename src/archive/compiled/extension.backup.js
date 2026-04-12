"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
function activate(context) {
    console.log('🎮 Holy Quest AI Assistant activated!');
    const provider = new ChatViewProvider(context.extensionUri, context);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('holy-quest-ai.chatView', provider));
    context.subscriptions.push(vscode.commands.registerCommand('holy-quest-ai.openChat', () => {
        vscode.commands.executeCommand('workbench.view.extension.holy-quest-ai-sidebar');
    }));
    vscode.window.showInformationMessage('🎮 Holy Quest AI Assistant ready!');
}
class ChatViewProvider {
    _extensionUri;
    _context;
    currentAbortController;
    constructor(_extensionUri, _context) {
        this._extensionUri = _extensionUri;
        this._context = _context;
    }
    resolveWebviewView(webviewView, context, _token) {
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this.getHtmlContent(webviewView.webview);
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'sendMessage':
                    await this.handleMessage(webviewView.webview, data.message);
                    break;
                case 'cancel':
                    this.cancelRequest(webviewView.webview);
                    break;
                case 'saveApiKey':
                    await this.saveApiKey(data.apiKey, webviewView.webview);
                    break;
            }
        });
    }
    async saveApiKey(apiKey, webview) {
        try {
            await vscode.workspace.getConfiguration('holyQuestAI').update('anthropicApiKey', apiKey, vscode.ConfigurationTarget.Global);
            webview.postMessage({ type: 'apiKeySaved' });
            vscode.window.showInformationMessage('✅ API key saved!');
        }
        catch (error) {
            webview.postMessage({ type: 'error', message: `Failed to save API key: ${error.message}` });
        }
    }
    cancelRequest(webview) {
        if (this.currentAbortController) {
            this.currentAbortController.abort();
            this.currentAbortController = undefined;
            webview.postMessage({ type: 'cancelled' });
        }
    }
    async handleMessage(webview, message) {
        this.currentAbortController = new AbortController();
        const signal = this.currentAbortController.signal;
        try {
            const config = vscode.workspace.getConfiguration('holyQuestAI');
            const apiKey = config.get('anthropicApiKey');
            if (!apiKey) {
                webview.postMessage({
                    type: 'needApiKey',
                    message: 'Please enter your Anthropic API key above first.'
                });
                return;
            }
            webview.postMessage({ type: 'progress', message: '📁 Analyzing project...' });
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            const projectContext = workspaceFolder
                ? `Working in: ${workspaceFolder.name}`
                : 'No workspace open';
            if (signal.aborted)
                return;
            webview.postMessage({ type: 'progress', message: '🤖 Calling Claude Sonnet 4...' });
            const Anthropic = require('@anthropic-ai/sdk').default;
            const client = new Anthropic({ apiKey });
            let fullResponse = '';
            // Use YOUR model name
            const stream = await client.messages.stream({
                model: 'claude-sonnet-4-5-20250929',
                max_tokens: 4096,
                messages: [{
                        role: 'user',
                        content: `${message}\n\nProject: ${projectContext}`
                    }],
                system: `You are a Holy Quest game development assistant.

When providing code, use this format:
[FILENAME: path/to/file.js]
\`\`\`javascript
// Complete working code here
\`\`\`

Provide clear explanations and complete solutions.`
            });
            for await (const chunk of stream) {
                if (signal.aborted) {
                    await stream.abort();
                    break;
                }
                if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                    fullResponse += chunk.delta.text;
                    webview.postMessage({ type: 'stream', text: chunk.delta.text });
                }
            }
            if (signal.aborted)
                return;
            webview.postMessage({ type: 'progress', message: '💾 Writing files...' });
            const filesWritten = await this.extractAndWriteFiles(fullResponse, webview);
            webview.postMessage({
                type: 'complete',
                message: fullResponse,
                filesWritten: filesWritten
            });
        }
        catch (error) {
            if (signal.aborted) {
                webview.postMessage({ type: 'cancelled' });
            }
            else {
                console.error('Error:', error);
                webview.postMessage({
                    type: 'error',
                    message: `Error: ${error.message}\nStatus: ${error.status || 'Unknown'}\nModel: claude-sonnet-4-5-20250929`
                });
            }
        }
        finally {
            this.currentAbortController = undefined;
        }
    }
    async extractAndWriteFiles(text, webview) {
        const pattern = /\[FILENAME:\s*([^\]]+)\]\s*```(?:\w+)?\n([\s\S]*?)```/g;
        let count = 0;
        let match;
        while ((match = pattern.exec(text)) !== null) {
            try {
                await this.writeFile(match[1].trim(), match[2].trim(), webview);
                count++;
            }
            catch (error) {
                console.error('Write error:', error);
            }
        }
        return count;
    }
    async writeFile(relativePath, content, webview) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder)
            throw new Error('No workspace folder');
        const fullPath = vscode.Uri.joinPath(workspaceFolder.uri, relativePath);
        const dirPath = vscode.Uri.joinPath(fullPath, '..');
        try {
            await vscode.workspace.fs.createDirectory(dirPath);
        }
        catch (e) { }
        await vscode.workspace.fs.writeFile(fullPath, Buffer.from(content, 'utf8'));
        const document = await vscode.workspace.openTextDocument(fullPath);
        await vscode.window.showTextDocument(document, {
            preview: false,
            viewColumn: vscode.ViewColumn.Beside
        });
        webview.postMessage({ type: 'fileWritten', file: relativePath });
        vscode.window.showInformationMessage(`✅ ${relativePath}`);
    }
    getHtmlContent(webview) {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        .api-key-section {
            padding: 12px;
            background: var(--vscode-input-background);
            border-bottom: 2px solid var(--vscode-panel-border);
        }
        .api-key-label {
            font-size: 11px;
            margin-bottom: 6px;
            color: var(--vscode-descriptionForeground);
            font-weight: 600;
        }
        .api-key-input {
            width: 100%;
            padding: 8px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            font-family: monospace;
            font-size: 11px;
        }
        .save-key-btn {
            margin-top: 8px;
            width: 100%;
            padding: 8px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
        }
        .save-key-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .header {
            padding: 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .header h3 {
            margin: 0;
            font-size: 16px;
        }
        .messages {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
        }
        .message {
            margin-bottom: 16px;
            animation: fadeIn 0.3s;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .message.user { text-align: right; }
        .message-content {
            display: inline-block;
            padding: 12px 16px;
            border-radius: 12px;
            max-width: 85%;
            text-align: left;
            word-wrap: break-word;
        }
        .user .message-content {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .assistant .message-content {
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-panel-border);
        }
        .message-content pre {
            background: var(--vscode-textCodeBlock-background);
            padding: 8px;
            border-radius: 4px;
            overflow-x: auto;
            margin: 8px 0;
            font-size: 12px;
        }
        .progress {
            padding: 12px 16px;
            font-style: italic;
            opacity: 0.7;
            display: none;
            animation: pulse 1.5s infinite;
        }
        .progress.show { display: block; }
        @keyframes pulse {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
        }
        .cancel-btn {
            margin-left: 8px;
            padding: 4px 12px;
            background: var(--vscode-button-secondaryBackground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
        }
        .input-area {
            padding: 16px;
            border-top: 1px solid var(--vscode-panel-border);
        }
        textarea {
            width: 100%;
            padding: 10px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 6px;
            font-family: var(--vscode-font-family);
            font-size: 13px;
            resize: vertical;
            min-height: 70px;
        }
        textarea:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        button {
            margin-top: 8px;
            width: 100%;
            padding: 10px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
        }
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .file-badge {
            display: inline-block;
            padding: 4px 8px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            border-radius: 12px;
            font-size: 11px;
            margin: 4px 4px 4px 0;
        }
    </style>
</head>
<body>
    <div class="api-key-section">
        <div class="api-key-label">🔑 ANTHROPIC API KEY</div>
        <input type="password" class="api-key-input" id="apiKeyInput" placeholder="sk-ant-api03-...">
        <button class="save-key-btn" id="saveKeyBtn">💾 Save API Key</button>
    </div>
    <div class="header">
        <h3>🎮 Holy Quest AI</h3>
    </div>
    <div class="messages" id="messages">
        <div class="message assistant">
            <div class="message-content">
                <strong>👋 Welcome!</strong><br><br>
                <strong>Step 1:</strong> Paste your Anthropic API key above<br>
                <strong>Step 2:</strong> Click "Save API Key"<br>
                <strong>Step 3:</strong> Ask me anything!<br><br>
                <small>Try: "Fix the bible questions corruption"</small>
            </div>
        </div>
    </div>
    <div class="progress" id="progress">
        ⏳ Working...
        <button class="cancel-btn" id="cancelBtn">Cancel</button>
    </div>
    <div class="input-area">
        <textarea id="input" placeholder="What would you like me to help with?"></textarea>
        <button id="send">Send (Ctrl+Enter)</button>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        const messages = document.getElementById('messages');
        const input = document.getElementById('input');
        const send = document.getElementById('send');
        const progress = document.getElementById('progress');
        const apiKeyInput = document.getElementById('apiKeyInput');
        const saveKeyBtn = document.getElementById('saveKeyBtn');
        const cancelBtn = document.getElementById('cancelBtn');
        
        let currentMsg = null;
        let filesWritten = [];

        saveKeyBtn.addEventListener('click', () => {
            const key = apiKeyInput.value.trim();
            if (key) {
                if (!key.startsWith('sk-ant-')) {
                    addMessage('assistant', '⚠️ Invalid key format. Should start with "sk-ant-"');
                    return;
                }
                vscode.postMessage({ type: 'saveApiKey', apiKey: key });
                apiKeyInput.value = '•••••••••••••';
                apiKeyInput.disabled = true;
                saveKeyBtn.textContent = '✅ Key Saved';
                saveKeyBtn.disabled = true;
            }
        });

        cancelBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'cancel' });
        });

        function addMessage(role, content) {
            const div = document.createElement('div');
            div.className = \`message \${role}\`;
            div.innerHTML = \`<div class="message-content">\${content.replace(/\\n/g, '<br>')}</div>\`;
            messages.appendChild(div);
            messages.scrollTop = messages.scrollHeight;
            return div;
        }

        function updateProgress(msg) {
            progress.innerHTML = msg + ' ';
            progress.appendChild(cancelBtn);
            progress.classList.add('show');
        }

        function hideProgress() {
            progress.classList.remove('show');
        }

        send.addEventListener('click', () => {
            const msg = input.value.trim();
            if (!msg) return;
            
            addMessage('user', msg);
            input.value = '';
            send.disabled = true;
            input.disabled = true;
            filesWritten = [];
            
            currentMsg = addMessage('assistant', '');
            vscode.postMessage({ type: 'sendMessage', message: msg });
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                send.click();
            }
        });

        window.addEventListener('message', (e) => {
            const msg = e.data;
            
            switch (msg.type) {
                case 'apiKeySaved':
                    addMessage('assistant', '<strong>✅ API key saved!</strong><br>You can now send messages.');
                    break;
                    
                case 'needApiKey':
                    addMessage('assistant', '<strong>⚠️ API key required</strong><br>Please enter your API key above first.');
                    send.disabled = false;
                    input.disabled = false;
                    break;
                    
                case 'progress':
                    updateProgress(msg.message);
                    break;
                    
                case 'stream':
                    if (currentMsg) {
                        currentMsg.querySelector('.message-content').textContent += msg.text;
                        messages.scrollTop = messages.scrollHeight;
                    }
                    break;
                    
                case 'fileWritten':
                    filesWritten.push(msg.file);
                    break;
                    
                case 'complete':
                    hideProgress();
                    if (currentMsg) {
                        const content = currentMsg.querySelector('.message-content');
                        content.innerHTML = msg.message
                            .replace(/\`\`\`(\\w+)?\\n([\\s\\S]*?)\`\`\`/g, '<pre>$2</pre>')
                            .replace(/\\n/g, '<br>');
                        
                        if (filesWritten.length > 0) {
                            content.innerHTML += '<br><br><strong>✅ Files Updated:</strong><br>';
                            filesWritten.forEach(f => {
                                content.innerHTML += \`<span class="file-badge">📝 \${f}</span>\`;
                            });
                        }
                    }
                    send.disabled = false;
                    input.disabled = false;
                    input.focus();
                    currentMsg = null;
                    break;
                    
                case 'cancelled':
                    hideProgress();
                    addMessage('assistant', '⚠️ Request cancelled');
                    send.disabled = false;
                    input.disabled = false;
                    input.focus();
                    currentMsg = null;
                    break;
                    
                case 'error':
                    hideProgress();
                    addMessage('assistant', \`<strong>❌ Error:</strong><br>\${msg.message}\`);
                    send.disabled = false;
                    input.disabled = false;
                    input.focus();
                    currentMsg = null;
                    break;
            }
        });
        
        input.focus();
    </script>
</body>
</html>`;
    }
}
function deactivate() { }
//# sourceMappingURL=extension.backup.js.map