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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
function activate(context) {
    console.log('Holy Quest AI extension is now active!');
    const provider = new HolyQuestAIViewProvider(context.extensionUri, context);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('holyQuestAIView', provider));
    context.subscriptions.push(vscode.commands.registerCommand('holyQuestAI.openChat', () => {
        vscode.commands.executeCommand('workbench.view.extension.holyQuestAI');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('holyQuestAI.clearChat', () => {
        provider.clearConversation();
    }));
}
class HolyQuestAIViewProvider {
    _extensionUri;
    _context;
    _view;
    conversationHistory = [];
    anthropic;
    tokenUsage = { current: 0, max: 200000, percentage: 0 };
    constructor(_extensionUri, _context) {
        this._extensionUri = _extensionUri;
        this._context = _context;
        this.initializeAnthropic();
    }
    initializeAnthropic() {
        const config = vscode.workspace.getConfiguration('holyQuestAI');
        const apiKey = config.get('apiKey') || config.get('anthropicApiKey');
        if (apiKey) {
            this.anthropic = new sdk_1.default({ apiKey });
        }
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'sendMessage':
                    await this.handleUserMessage(data.message, data.images);
                    break;
                case 'clearChat':
                    this.clearConversation();
                    break;
            }
        });
        this.updateTokenDisplay();
    }
    async handleUserMessage(message, images) {
        if (!this.anthropic) {
            this.sendErrorToWebview('API key not configured. Please set your Anthropic API key in settings.');
            return;
        }
        // Add user message to history
        const userContent = [{ type: 'text', text: message }];
        if (images && images.length > 0) {
            for (const imageData of images) {
                const base64Data = imageData.split(',')[1];
                userContent.push({
                    type: 'image',
                    source: {
                        type: 'base64',
                        media_type: 'image/jpeg',
                        data: base64Data
                    }
                });
            }
        }
        this.conversationHistory.push({
            role: 'user',
            content: userContent
        });
        this.sendMessageToWebview('user', message, images);
        try {
            const response = await this.anthropic.messages.create({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 8096,
                system: this.getSystemPrompt(),
                messages: this.conversationHistory
            });
            const assistantMessage = response.content
                .filter((block) => block.type === 'text')
                .map((block) => block.text)
                .join('\n');
            this.conversationHistory.push({
                role: 'assistant',
                content: assistantMessage
            });
            // Update token usage
            this.tokenUsage.current = this.estimateTokens();
            this.tokenUsage.percentage = (this.tokenUsage.current / this.tokenUsage.max) * 100;
            this.updateTokenDisplay();
            // Check for file operations in the response
            await this.processFileOperations(assistantMessage);
            this.sendMessageToWebview('assistant', assistantMessage);
        }
        catch (error) {
            this.sendErrorToWebview(`Error: ${error.message}`);
        }
    }
    async processFileOperations(message) {
        const config = vscode.workspace.getConfiguration('holyQuestAI');
        const allowFileEdits = config.get('allowFileEdits', true);
        if (!allowFileEdits) {
            return;
        }
        // Pattern 1: WRITE_FILE: path | content
        const writeFileMatch = message.match(/WRITE_FILE:\s*([^\|]+)\s*\|\s*([\s\S]+?)(?=\n\n|\n(?:WRITE_FILE|EDIT_FILE|RUN_COMMAND)|$)/g);
        if (writeFileMatch) {
            for (const match of writeFileMatch) {
                const parts = match.split('|');
                if (parts.length >= 2) {
                    const filePath = parts[0].replace('WRITE_FILE:', '').trim();
                    const content = parts.slice(1).join('|').trim();
                    await this.writeFile(filePath, content);
                }
            }
        }
        // Pattern 2: EDIT_FILE: path LINE: number CONTENT: content
        const editFileMatch = message.match(/EDIT_FILE:\s*(.+?)\s*LINE:\s*(\d+)\s*CONTENT:\s*(.+?)(?=\n(?:EDIT_FILE|WRITE_FILE|RUN_COMMAND)|$)/gs);
        if (editFileMatch) {
            for (const match of editFileMatch) {
                const parsed = match.match(/EDIT_FILE:\s*(.+?)\s*LINE:\s*(\d+)\s*CONTENT:\s*(.+)/s);
                if (parsed) {
                    const [, filePath, lineNum, content] = parsed;
                    await this.editFileLine(filePath.trim(), parseInt(lineNum), content.trim());
                }
            }
        }
        // Pattern 3: REPLACE_IN_FILE: path | search | replace
        const replaceMatch = message.match(/REPLACE_IN_FILE:\s*([^\|]+)\s*\|\s*([^\|]+)\s*\|\s*(.+?)(?=\n\n|\n(?:REPLACE_IN_FILE|RUN_COMMAND)|$)/gs);
        if (replaceMatch) {
            for (const match of replaceMatch) {
                const parts = match.split('|');
                if (parts.length >= 3) {
                    const filePath = parts[0].replace('REPLACE_IN_FILE:', '').trim();
                    const searchText = parts[1].trim();
                    const replaceText = parts[2].trim();
                    await this.replaceInFile(filePath, searchText, replaceText);
                }
            }
        }
        // Pattern 4: RUN_COMMAND: command
        const commandMatch = message.match(/RUN_COMMAND:\s*(.+?)(?=\n(?:RUN_COMMAND|EDIT_FILE|WRITE_FILE)|$)/g);
        if (commandMatch) {
            const autoExecute = config.get('autoExecuteCommands', false);
            for (const match of commandMatch) {
                const command = match.replace('RUN_COMMAND:', '').trim();
                if (autoExecute) {
                    await this.executeCommand(command);
                }
                else {
                    await this.promptExecuteCommand(command);
                }
            }
        }
    }
    async writeFile(relativePath, content) {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                throw new Error('No workspace folder open');
            }
            const fullPath = path.join(workspaceFolders[0].uri.fsPath, relativePath);
            const uri = vscode.Uri.file(fullPath);
            // Ensure directory exists
            const dir = path.dirname(fullPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const encoder = new TextEncoder();
            await vscode.workspace.fs.writeFile(uri, encoder.encode(content));
            vscode.window.showInformationMessage(`✅ File written: ${relativePath}`);
            return true;
        }
        catch (error) {
            vscode.window.showErrorMessage(`❌ Failed to write file: ${error.message}`);
            return false;
        }
    }
    async editFileLine(relativePath, lineNumber, newContent) {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                throw new Error('No workspace folder open');
            }
            const fullPath = path.join(workspaceFolders[0].uri.fsPath, relativePath);
            const uri = vscode.Uri.file(fullPath);
            const document = await vscode.workspace.openTextDocument(uri);
            const edit = new vscode.WorkspaceEdit();
            const line = document.lineAt(lineNumber - 1);
            edit.replace(uri, line.range, newContent);
            const success = await vscode.workspace.applyEdit(edit);
            if (success) {
                await document.save();
                vscode.window.showInformationMessage(`✅ Edited line ${lineNumber} in ${relativePath}`);
            }
            return success;
        }
        catch (error) {
            vscode.window.showErrorMessage(`❌ Failed to edit file: ${error.message}`);
            return false;
        }
    }
    async replaceInFile(relativePath, searchText, replaceText) {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                throw new Error('No workspace folder open');
            }
            const fullPath = path.join(workspaceFolders[0].uri.fsPath, relativePath);
            const uri = vscode.Uri.file(fullPath);
            const document = await vscode.workspace.openTextDocument(uri);
            const text = document.getText();
            const newText = text.replace(new RegExp(searchText, 'g'), replaceText);
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(text.length));
            edit.replace(uri, fullRange, newText);
            const success = await vscode.workspace.applyEdit(edit);
            if (success) {
                await document.save();
                vscode.window.showInformationMessage(`✅ Replaced text in ${relativePath}`);
            }
            return success;
        }
        catch (error) {
            vscode.window.showErrorMessage(`❌ Failed to replace in file: ${error.message}`);
            return false;
        }
    }
    async executeCommand(command) {
        const terminal = vscode.window.createTerminal('Holy Quest AI');
        terminal.show();
        terminal.sendText(command);
        vscode.window.showInformationMessage(`▶️ Executing: ${command}`);
    }
    async promptExecuteCommand(command) {
        const choice = await vscode.window.showInformationMessage(`Execute command: ${command}?`, 'Yes', 'No');
        if (choice === 'Yes') {
            await this.executeCommand(command);
        }
    }
    getSystemPrompt() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const workspacePath = workspaceFolders ? workspaceFolders[0].uri.fsPath : 'unknown';
        return `You are Holy Quest AI, an expert coding assistant for the Holy Fact Quest mobile game project.

**PROJECT CONTEXT:**
- Working directory: ${workspacePath}
- Project: React Native mobile game (Bible trivia)
- Tech stack: TypeScript, React Native, Expo, Socket.IO
- Status: 99% complete, ready for deployment

**YOUR CAPABILITIES:**
You can directly edit files using these commands in your responses:

1. **Write entire file:**
   WRITE_FILE: path/to/file.ts | 
   [complete file content here]

2. **Edit specific line:**
   EDIT_FILE: path/to/file.ts LINE: 42 CONTENT: new line content

3. **Replace text in file:**
   REPLACE_IN_FILE: path/to/file.ts | search text | replacement text

4. **Run terminal command:**
   RUN_COMMAND: npm test

**IMPORTANT RULES:**
- Always use relative paths from workspace root
- When editing files, provide COMPLETE content, not snippets
- Test changes by suggesting RUN_COMMAND: npm test after edits
- Be proactive - don't just suggest changes, MAKE them
- Use proper file operation commands in every response that requires code changes

**CURRENT PRIORITIES:**
1. Fix failing test in tests/unit/server/roomManager.test.ts (line 281)
2. Install missing TypeScript types
3. Remove misplaced test files
4. Prepare for deployment to Railway and app stores

When user asks you to fix something, DO IT using the file operation commands above. Don't just explain what to do.`;
    }
    estimateTokens() {
        let total = 0;
        for (const msg of this.conversationHistory) {
            if (typeof msg.content === 'string') {
                total += Math.ceil(msg.content.length / 4);
            }
            else if (Array.isArray(msg.content)) {
                for (const block of msg.content) {
                    if (block.type === 'text') {
                        total += Math.ceil(block.text.length / 4);
                    }
                    else if (block.type === 'image') {
                        total += 1500; // Approximate tokens per image
                    }
                }
            }
        }
        return total;
    }
    updateTokenDisplay() {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'updateTokens',
                usage: this.tokenUsage
            });
        }
    }
    clearConversation() {
        this.conversationHistory = [];
        this.tokenUsage = { current: 0, max: 200000, percentage: 0 };
        if (this._view) {
            this._view.webview.postMessage({ type: 'clearChat' });
            this.updateTokenDisplay();
        }
        vscode.window.showInformationMessage('Conversation cleared');
    }
    sendMessageToWebview(role, content, images) {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'addMessage',
                role,
                content,
                images
            });
        }
    }
    sendErrorToWebview(error) {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'error',
                content: error
            });
        }
    }
    _getHtmlForWebview(webview) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Holy Quest AI</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            height: 100vh;
            display: flex;
            flex-direction: column;
        }

        #header {
            padding: 12px 16px;
            background: var(--vscode-sideBar-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        #header h2 {
            font-size: 14px;
            font-weight: 600;
        }

        #token-bar-container {
            flex: 1;
            margin: 0 16px;
            height: 6px;
            background: var(--vscode-input-background);
            border-radius: 3px;
            overflow: hidden;
        }

        #token-bar {
            height: 100%;
            background: #4CAF50;
            transition: width 0.3s, background-color 0.3s;
        }

        #token-bar.warning {
            background: #FFA726;
        }

        #token-bar.danger {
            background: #EF5350;
        }

        #clear-btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 4px 12px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
        }

        #clear-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }

        #messages {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .message {
            display: flex;
            gap: 12px;
            animation: fadeIn 0.3s;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .message.user {
            justify-content: flex-end;
        }

        .message-content {
            max-width: 80%;
            padding: 12px 16px;
            border-radius: 24px;
            line-height: 1.5;
        }

        .message.user .message-content {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .message.assistant .message-content {
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-panel-border);
        }

        .message.error .message-content {
            background: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
        }

        .message-images {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-top: 8px;
        }

        .message-image {
            max-width: 200px;
            max-height: 200px;
            border-radius: 8px;
            object-fit: contain;
        }

        #input-container {
            border-top: 1px solid var(--vscode-panel-border);
            padding: 12px 16px;
            background: var(--vscode-sideBar-background);
        }

        #image-preview {
            display: none;
            gap: 8px;
            margin-bottom: 8px;
            flex-wrap: wrap;
        }

        #image-preview.visible {
            display: flex;
        }

        .preview-image-container {
            position: relative;
        }

        .preview-image {
            max-width: 100px;
            max-height: 100px;
            border-radius: 8px;
            border: 1px solid var(--vscode-panel-border);
        }

        .remove-image {
            position: absolute;
            top: -8px;
            right: -8px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        #input-row {
            display: flex;
            align-items: flex-end;
            gap: 8px;
        }

        #attach-btn, #send-btn {
            background: none;
            border: none;
            color: var(--vscode-foreground);
            cursor: pointer;
            padding: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0.7;
            transition: opacity 0.2s;
        }

        #attach-btn:hover, #send-btn:hover {
            opacity: 1;
        }

        #message-input {
            flex: 1;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 24px;
            padding: 8px 16px;
            font-family: var(--vscode-font-family);
            font-size: 13px;
            resize: none;
            min-height: 36px;
            max-height: 120px;
            overflow-y: auto;
        }

        #message-input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }

        code {
            background: var(--vscode-textCodeBlock-background);
            padding: 2px 6px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
        }

        pre {
            background: var(--vscode-textCodeBlock-background);
            padding: 12px;
            border-radius: 6px;
            overflow-x: auto;
            margin: 8px 0;
        }

        pre code {
            background: none;
            padding: 0;
        }
    </style>
</head>
<body>
    <div id="header">
        <h2>HOLY QUEST AI: AI ASSISTANT</h2>
        <div id="token-bar-container">
            <div id="token-bar"></div>
        </div>
        <button id="clear-btn">Clear Chat</button>
    </div>

    <div id="messages"></div>

    <div id="input-container">
        <div id="image-preview"></div>
        <div id="input-row">
            <button id="attach-btn" title="Attach image">📎</button>
            <textarea id="message-input" placeholder="Ask me anything about your code..." rows="1"></textarea>
            <button id="send-btn" title="Send message">➤</button>
        </div>
        <input type="file" id="file-input" accept="image/*" multiple style="display: none;">
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const messagesDiv = document.getElementById('messages');
        const messageInput = document.getElementById('message-input');
        const sendBtn = document.getElementById('send-btn');
        const attachBtn = document.getElementById('attach-btn');
        const fileInput = document.getElementById('file-input');
        const imagePreview = document.getElementById('image-preview');
        const clearBtn = document.getElementById('clear-btn');
        const tokenBar = document.getElementById('token-bar');
        
        let selectedImages = [];

        // Auto-resize textarea
        messageInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });

        // Send message
        function sendMessage() {
            const message = messageInput.value.trim();
            if (message || selectedImages.length > 0) {
                vscode.postMessage({
                    type: 'sendMessage',
                    message: message,
                    images: selectedImages
                });
                messageInput.value = '';
                messageInput.style.height = 'auto';
                selectedImages = [];
                updateImagePreview();
            }
        }

        sendBtn.addEventListener('click', sendMessage);
        
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // File attachment
        attachBtn.addEventListener('click', () => fileInput.click());
        
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    selectedImages.push(event.target.result);
                    updateImagePreview();
                };
                reader.readAsDataURL(file);
            });
            fileInput.value = '';
        });

        function updateImagePreview() {
            if (selectedImages.length === 0) {
                imagePreview.classList.remove('visible');
                imagePreview.innerHTML = '';
            } else {
                imagePreview.classList.add('visible');
                imagePreview.innerHTML = selectedImages.map((img, index) => \`
                    <div class="preview-image-container">
                        <img src="\${img}" class="preview-image">
                        <button class="remove-image" onclick="removeImage(\${index})">×</button>
                    </div>
                \`).join('');
            }
        }

        window.removeImage = function(index) {
            selectedImages.splice(index, 1);
            updateImagePreview();
        };

        // Clear chat
        clearBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'clearChat' });
        });

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch(message.type) {
                case 'addMessage':
                    addMessage(message.role, message.content, message.images);
                    break;
                case 'error':
                    addMessage('error', message.content);
                    break;
                case 'clearChat':
                    messagesDiv.innerHTML = '';
                    break;
                case 'updateTokens':
                    updateTokenBar(message.usage);
                    break;
            }
        });

        function addMessage(role, content, images) {
            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${role}\`;
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            
            // Format code blocks
            content = content.replace(/` ``(w + ) ?  : ;
        n([s, S] *  ?  : ) `` `/g, (match, lang, code) => {
                return \`<pre><code>\${escapeHtml(code.trim())}</code></pre>\`;
            });
            
            // Format inline code
            content = content.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
            
            // Format line breaks
            content = content.replace(/\n/g, '<br>');
            
            contentDiv.innerHTML = content;
            
            if (images && images.length > 0) {
                const imagesDiv = document.createElement('div');
                imagesDiv.className = 'message-images';
                images.forEach(img => {
                    const imgEl = document.createElement('img');
                    imgEl.src = img;
                    imgEl.className = 'message-image';
                    imagesDiv.appendChild(imgEl);
                });
                contentDiv.appendChild(imagesDiv);
            }
            
            messageDiv.appendChild(contentDiv);
            messagesDiv.appendChild(messageDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }

        function updateTokenBar(usage) {
            const percentage = usage.percentage;
            tokenBar.style.width = percentage + '%';
            
            if (percentage >= 80) {
                tokenBar.className = 'danger';
            } else if (percentage >= 60) {
                tokenBar.className = 'warning';
            } else {
                tokenBar.className = '';
            }
        }

        function escapeHtml(text) {
            const map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            };
            return text.replace(/[&<>"']/g, m => map[m]);
        }

        // Focus input on load
        messageInput.focus();
    </script>
</body>
</html>`;
    }
}
function deactivate() { }
//# sourceMappingURL=extension.js.map