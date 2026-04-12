import * as vscode from 'vscode';
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    console.log('🎮 Holy Quest AI Assistant activated!');

    const provider = new ChatViewProvider(context.extensionUri, context);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('holy-quest-ai.chatView', provider)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('holy-quest-ai.openChat', () => {
            vscode.commands.executeCommand('workbench.view.extension.holy-quest-ai-sidebar');
        })
    );

    vscode.window.showInformationMessage('🎮 Holy Quest AI Assistant ready!');
}

class ChatViewProvider implements vscode.WebviewViewProvider {
    private currentAbortController?: AbortController;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext
    ) {}

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this.getHtmlContent(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'sendMessage':
                    await this.handleMessage(webviewView.webview, data.message, data.image);
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

    private async saveApiKey(apiKey: string, webview: vscode.Webview) {
        try {
            await vscode.workspace.getConfiguration('holyQuestAI').update(
                'anthropicApiKey',
                apiKey,
                vscode.ConfigurationTarget.Global
            );
            webview.postMessage({ type: 'apiKeySaved' });
            vscode.window.showInformationMessage('✅ API key saved!');
        } catch (error: any) {
            webview.postMessage({ type: 'error', message: `Failed to save API key: ${error.message}` });
        }
    }

    private cancelRequest(webview: vscode.Webview) {
        if (this.currentAbortController) {
            this.currentAbortController.abort();
            this.currentAbortController = undefined;
            webview.postMessage({ type: 'cancelled' });
        }
    }

    private async handleMessage(webview: vscode.Webview, message: string, imageData?: string) {
        this.currentAbortController = new AbortController();
        const signal = this.currentAbortController.signal;

        try {
            const config = vscode.workspace.getConfiguration('holyQuestAI');
            const apiKey = config.get<string>('anthropicApiKey');

            if (!apiKey) {
                webview.postMessage({
                    type: 'needApiKey',
                    message: 'Please enter your Anthropic API key above first.'
                });
                return;
            }

            webview.postMessage({ type: 'progress', message: '🔍 Analyzing...' });

            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            const projectContext = workspaceFolder
                ? `Working in: ${workspaceFolder.name}`
                : 'No workspace open';

            if (signal.aborted) return;

            webview.postMessage({ type: 'progress', message: '🤖 Calling Claude...' });

            const Anthropic = require('@anthropic-ai/sdk').default;
            const client = new Anthropic({ apiKey });

            let fullResponse = '';

            // Build content array
            const content: any[] = [{
                type: 'text',
                text: `${message}\n\nProject: ${projectContext}`
            }];

            // Add image if provided
            if (imageData) {
                const base64Data = imageData.split(',')[1];
                const mediaType = imageData.substring(
                    imageData.indexOf(':') + 1,
                    imageData.indexOf(';')
                ) as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

                content.push({
                    type: 'image',
                    source: {
                        type: 'base64',
                        media_type: mediaType,
                        data: base64Data
                    }
                });

                console.log('📷 Image included in request');
            }

            const stream = await client.messages.stream({
                model: 'claude-sonnet-4-5-20250929',
                max_tokens: 8000,
                messages: [{
                    role: 'user',
                    content: content
                }],
                system: `You are a Holy Quest game development assistant.

When providing code, use this format:
[FILENAME: path/to/file.js]
\`\`\`javascript
// Complete working code here
\`\`\`

Use beautiful markdown formatting:
- Use headers (# ## ###) for sections
- Use **bold** for emphasis
- Use \`code\` for inline code
- Use numbered lists for steps
- Use bullet points for features
- Use code blocks with language tags
- Use tables for comparisons

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

            if (signal.aborted) return;

            webview.postMessage({ type: 'progress', message: '💾 Writing files...' });

            const filesWritten = await this.extractAndWriteFiles(fullResponse, webview);

            webview.postMessage({
                type: 'complete',
                message: fullResponse,
                filesWritten: filesWritten
            });

        } catch (error: any) {
            console.error('Error:', error);
            webview.postMessage({
                type: 'error',
                message: error.message || 'An error occurred'
            });
        } finally {
            this.currentAbortController = undefined;
        }
    }

    private async extractAndWriteFiles(text: string, webview: vscode.Webview): Promise<number> {
        const pattern = /\[FILENAME:\s*([^\]]+)\]\s*```(?:\w+)?\n([\s\S]*?)```/g;
        let count = 0;
        let match;

        while ((match = pattern.exec(text)) !== null) {
            try {
                await this.writeFile(match[1].trim(), match[2].trim(), webview);
                count++;
            } catch (error) {
                console.error('Write error:', error);
            }
        }

        return count;
    }

    private async writeFile(relativePath: string, content: string, webview: vscode.Webview): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) throw new Error('No workspace folder');

        const fullPath = vscode.Uri.joinPath(workspaceFolder.uri, relativePath);
        const dirPath = vscode.Uri.joinPath(fullPath, '..');

        try {
            await vscode.workspace.fs.createDirectory(dirPath);
        } catch (e) {}

        await vscode.workspace.fs.writeFile(fullPath, Buffer.from(content, 'utf8'));

        const document = await vscode.workspace.openTextDocument(fullPath);
        await vscode.window.showTextDocument(document, {
            preview: false,
            viewColumn: vscode.ViewColumn.Beside
        });

        webview.postMessage({ type: 'fileWritten', file: relativePath });
        vscode.window.showInformationMessage(`✅ ${relativePath}`);
    }

    private getHtmlContent(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
    <!-- Markdown & Syntax Highlighting -->
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/vs2015.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            height: 100vh;
            display: flex;
            flex-direction: column;
            line-height: 1.6;
        }
        
        /* API Key Section */
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
        
        /* Header */
        .header {
            padding: 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .header h3 {
            margin: 0;
            font-size: 16px;
        }
        
        /* Messages */
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
        
        /* Markdown Styling */
        .message-content h1 {
            font-size: 24px;
            margin: 16px 0 12px 0;
            padding-bottom: 8px;
            border-bottom: 2px solid var(--vscode-textLink-foreground);
            color: var(--vscode-textLink-foreground);
        }
        .message-content h2 {
            font-size: 20px;
            margin: 14px 0 10px 0;
            color: var(--vscode-textLink-activeForeground);
        }
        .message-content h3 {
            font-size: 16px;
            margin: 12px 0 8px 0;
        }
        .message-content p {
            margin-bottom: 12px;
        }
        .message-content ul, .message-content ol {
            margin-left: 24px;
            margin-bottom: 12px;
        }
        .message-content li {
            margin-bottom: 6px;
        }
        .message-content code {
            background: var(--vscode-textCodeBlock-background);
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 13px;
        }
        .message-content pre {
            position: relative;
            background: var(--vscode-textCodeBlock-background);
            padding: 16px;
            border-radius: 6px;
            overflow-x: auto;
            margin: 12px 0;
        }
        .message-content pre code {
            background: none;
            padding: 0;
        }
        
        /* Copy Button */
        .copy-btn {
            position: absolute;
            top: 8px;
            right: 8px;
            padding: 4px 10px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
            opacity: 0;
            transition: opacity 0.2s;
        }
        .message-content pre:hover .copy-btn {
            opacity: 1;
        }
        .copy-btn.copied {
            background: var(--vscode-charts-green);
        }
        
        /* Image Preview */
        .image-preview {
            margin: 12px 0;
            border-radius: 8px;
            overflow: hidden;
            border: 1px solid var(--vscode-panel-border);
        }
        .image-preview img {
            max-width: 100%;
            display: block;
        }
        .image-info {
            padding: 8px;
            background: var(--vscode-input-background);
            font-size: 11px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .remove-image-btn {
            padding: 4px 8px;
            background: var(--vscode-button-secondaryBackground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 10px;
        }
        
        /* Progress */
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
        
        /* Input Area */
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
        .button-row {
            display: flex;
            gap: 8px;
            margin-top: 8px;
        }
        button {
            flex: 1;
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
        .attach-btn {
            background: var(--vscode-button-secondaryBackground);
            flex: 0 0 auto;
            padding: 10px 20px;
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
                <strong>New Features:</strong><br>
                • 📎 Attach images and screenshots<br>
                • 🎨 Beautiful markdown formatting<br>
                • 📋 Copy code with one click<br><br>
                <strong>Step 1:</strong> Paste your API key above<br>
                <strong>Step 2:</strong> Ask me anything or upload a screenshot!
            </div>
        </div>
    </div>
    <div class="progress" id="progress">⏳ Working...</div>
    <div class="input-area">
        <div id="imagePreview"></div>
        <textarea id="input" placeholder="What would you like me to help with?"></textarea>
        <div class="button-row">
            <button class="attach-btn" id="attachBtn">📎 Attach Image</button>
            <button id="send">Send (Ctrl+Enter)</button>
        </div>
        <input type="file" id="fileInput" accept="image/*" style="display:none">
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        const messages = document.getElementById('messages');
        const input = document.getElementById('input');
        const send = document.getElementById('send');
        const progress = document.getElementById('progress');
        const apiKeyInput = document.getElementById('apiKeyInput');
        const saveKeyBtn = document.getElementById('saveKeyBtn');
        const attachBtn = document.getElementById('attachBtn');
        const fileInput = document.getElementById('fileInput');
        const imagePreview = document.getElementById('imagePreview');

        let currentMsg = null;
        let filesWritten = [];
        let currentImage = null;
        let currentRawContent = '';

        // Configure marked.js
        if (typeof marked !== 'undefined') {
            marked.setOptions({
                highlight: function(code, lang) {
                    if (lang && hljs.getLanguage(lang)) {
                        return hljs.highlight(code, { language: lang }).value;
                    }
                    return hljs.highlightAuto(code).value;
                },
                breaks: true,
                gfm: true
            });
        }

        // Handle API key save
        saveKeyBtn.addEventListener('click', () => {
            const key = apiKeyInput.value.trim();
            if (key) {
                if (!key.startsWith('sk-ant-')) {
                    addMessage('assistant', '⚠️ Invalid key format. Should start with "sk-ant-"', true);
                    return;
                }
                vscode.postMessage({ type: 'saveApiKey', apiKey: key });
                apiKeyInput.value = '••••••••••••';
                apiKeyInput.disabled = true;
                saveKeyBtn.textContent = '✅ Key Saved';
                saveKeyBtn.disabled = true;
            }
        });

        // Handle image attachment
        attachBtn.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Validate file type
            if (!file.type.startsWith('image/')) {
                alert('Please select an image file');
                return;
            }

            // Validate file size (5MB max)
            if (file.size > 5 * 1024 * 1024) {
                alert('Image must be less than 5MB');
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                currentImage = event.target.result;
                showImagePreview(file.name, file.size, currentImage);
            };
            reader.readAsDataURL(file);
        });

        function showImagePreview(name, size, dataUrl) {
            const sizeKB = Math.round(size / 1024);
            imagePreview.innerHTML = \`
                <div class="image-preview">
                    <img src="\${dataUrl}" alt="Preview">
                    <div class="image-info">
                        <span>📷 \${name} (\${sizeKB} KB)</span>
                        <button class="remove-image-btn" onclick="removeImage()">✕ Remove</button>
                    </div>
                </div>
            \`;
        }

        window.removeImage = function() {
            currentImage = null;
            imagePreview.innerHTML = '';
            fileInput.value = '';
        };

        function addMessage(role, content, isRaw = false) {
            const div = document.createElement('div');
            div.className = \`message \${role}\`;
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            
            if (role === 'assistant' && !isRaw && typeof marked !== 'undefined') {
                contentDiv.innerHTML = marked.parse(content);
                addCopyButtons(contentDiv);
            } else {
                contentDiv.innerHTML = content.replace(/\\n/g, '<br>');
            }
            
            div.appendChild(contentDiv);
            messages.appendChild(div);
            messages.scrollTop = messages.scrollHeight;
            return div;
        }

        function addCopyButtons(container) {
            container.querySelectorAll('pre code').forEach((block) => {
                const pre = block.parentElement;
                const button = document.createElement('button');
                button.className = 'copy-btn';
                button.textContent = '📋 Copy';
                button.onclick = () => {
                    navigator.clipboard.writeText(block.textContent).then(() => {
                        button.textContent = '✅ Copied!';
                        button.classList.add('copied');
                        setTimeout(() => {
                            button.textContent = '📋 Copy';
                            button.classList.remove('copied');
                        }, 2000);
                    });
                };
                pre.appendChild(button);
            });
        }

        function updateProgress(msg) {
            progress.textContent = msg;
            progress.classList.add('show');
        }

        function hideProgress() {
            progress.classList.remove('show');
        }

        send.addEventListener('click', () => {
            const msg = input.value.trim();
            if (!msg && !currentImage) return;

            if (currentImage) {
                addMessage('user', \`\${msg}<br><em>📷 Image attached</em>\`, true);
            } else {
                addMessage('user', msg, true);
            }
            
            input.value = '';
            send.disabled = true;
            input.disabled = true;
            filesWritten = [];
            currentRawContent = '';

            currentMsg = addMessage('assistant', '');
            vscode.postMessage({ 
                type: 'sendMessage', 
                message: msg,
                image: currentImage 
            });

            // Clear image after sending
            if (currentImage) {
                removeImage();
            }
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
                    addMessage('assistant', '<strong>✅ API key saved!</strong><br>You can now send messages.', true);
                    break;

                case 'needApiKey':
                    addMessage('assistant', '<strong>⚠️ API key required</strong><br>Please enter your API key above first.', true);
                    send.disabled = false;
                    input.disabled = false;
                    break;

                case 'progress':
                    updateProgress(msg.message);
                    break;

                case 'stream':
                    if (currentMsg) {
                        currentRawContent += msg.text;
                        const content = currentMsg.querySelector('.message-content');
                        
                        if (typeof marked !== 'undefined') {
                            content.innerHTML = marked.parse(currentRawContent);
                            addCopyButtons(content);
                        } else {
                            content.textContent = currentRawContent;
                        }
                        
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
                        
                        if (typeof marked !== 'undefined') {
                            content.innerHTML = marked.parse(msg.message);
                            addCopyButtons(content);
                        } else {
                            content.innerHTML = msg.message.replace(/\\n/g, '<br>');
                        }

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
                    currentRawContent = '';
                    break;

                case 'cancelled':
                    hideProgress();
                    addMessage('assistant', '⚠️ Request cancelled', true);
                    send.disabled = false;
                    input.disabled = false;
                    input.focus();
                    currentMsg = null;
                    currentRawContent = '';
                    break;

                case 'error':
                    hideProgress();
                    addMessage('assistant', \`<strong>❌ Error:</strong><br>\${msg.message}\`, true);
                    send.disabled = false;
                    input.disabled = false;
                    input.focus();
                    currentMsg = null;
                    currentRawContent = '';
                    break;
            }
        });

        input.focus();
    </script>
</body>
</html>`;
    }
}

export function deactivate() {}