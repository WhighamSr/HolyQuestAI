import * as vscode from 'vscode';
import Anthropic from '@anthropic-ai/sdk';

export function activate(context: vscode.ExtensionContext) {
    const provider = new HolyQuestAIViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('holyQuestAI.chatView', provider)
    );
}

export function deactivate() {}

class HolyQuestAIViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'holyQuestAI.chatView';
    private _view?: vscode.WebviewView;
    private anthropic: Anthropic;
    private apiKey: string = '';
    private conversationHistory: Array<{role: 'user' | 'assistant', content: any}> = [];

    constructor(private readonly _extensionUri: vscode.Uri) {
        const config = vscode.workspace.getConfiguration('holyQuestAI');
        this.apiKey = config.get('apiKey') || '';
        this.anthropic = new Anthropic({ apiKey: this.apiKey || 'placeholder-key' });
    }

    public resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this.getHtml();
        
        webviewView.webview.onDidReceiveMessage(async (data) => {
            if (data.type === 'saveApiKey') {
                this.apiKey = data.apiKey;
                this.anthropic = new Anthropic({ apiKey: this.apiKey });
                const config = vscode.workspace.getConfiguration('holyQuestAI');
                await config.update('apiKey', data.apiKey, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage('API Key Saved');
                webviewView.webview.postMessage({ type: 'apiKeySaved' });
                return;
            }
            
            if (data.type === 'clearHistory') {
                this.conversationHistory = [];
                vscode.window.showInformationMessage('Conversation history cleared');
                return;
            }
            
            if (data.type === 'chat') {
                const message = data.message || '';
                const imageData = data.imageData;
                
                if (!this.apiKey || this.apiKey === 'placeholder-key') {
                    webviewView.webview.postMessage({ type: 'error', message: 'Set API key first' });
                    return;
                }
                
                // Build message content
                const messageContent: any[] = [{ type: 'text', text: message }];
                
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
                
                // Add user message to history
                this.conversationHistory.push({
                    role: 'user',
                    content: messageContent
                });
                
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
                        
                        // Pass conversation history to agent
                        const result = await coordinator.runWorkflow(message, this.conversationHistory);
                        
                        // Add agent response to history
                        this.conversationHistory.push({
                            role: 'assistant',
                            content: result.text || JSON.stringify(result)
                        });
                        
                        webviewView.webview.postMessage({ type: 'agentComplete', result: result });
                    } catch (error: any) {
                        webviewView.webview.postMessage({ type: 'error', message: error.message });
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
                        for await (const chunk of stream) {
                            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                                response += chunk.delta.text;
                            }
                        }
                        
                        // Add assistant response to history
                        this.conversationHistory.push({
                            role: 'assistant',
                            content: response
                        });
                        
                        webviewView.webview.postMessage({ type: 'agentComplete', result: { text: response } });
                    } catch (error: any) {
                        webviewView.webview.postMessage({ type: 'error', message: error.message });
                    }
                }
            }
        });
    }

    private getHtml(): string {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <style>
        body { margin:0; padding:0; background:#1e1e1e; color:#ccc; font-family:system-ui; }
        .header { background:#2d2d30; padding:10px 20px; border-bottom:1px solid #3e3e42; display:flex; justify-content:space-between; align-items:center; }
        .header h1 { margin:0; font-size:14px; font-weight:600; }
        .clear-btn { background:#5a1d1d; color:#f48771; border:none; padding:6px 12px; border-radius:4px; font-size:11px; cursor:pointer; }
        .clear-btn:hover { background:#6e2525; }
        .content { height:calc(100vh - 130px); overflow-y:auto; padding:20px; }
        .welcome { background:#2d2d30; border-radius:6px; padding:20px; }
        .welcome h2 { margin:0 0 15px; font-size:18px; color:#4ec9b0; }
        .welcome h3 { margin:15px 0 10px; font-size:14px; color:#9cdcfe; }
        .welcome ul { margin:0; padding-left:20px; }
        .welcome li { margin:5px 0; font-size:13px; }
        .message { background:#2d2d30; border-radius:6px; padding:15px; margin-bottom:15px; }
        .message-user { background:#0e639c; }
        .message-agent { border-left:3px solid #4ec9b0; }
        .message-error { background:#5a1d1d; border-left:3px solid #f48771; }
        .markdown-body { background:transparent!important; color:#ccc!important; font-size:13px; }
        .markdown-body code { background:#1e1e1e!important; padding:2px 6px; border-radius:3px; }
        .markdown-body pre { background:#1e1e1e!important; border:1px solid #3e3e42; position:relative; padding-top:35px; }
        .copy-btn { position:absolute; top:8px; right:8px; background:#0e639c; color:white; border:none; padding:4px 12px; border-radius:3px; font-size:11px; cursor:pointer; }
        .copy-btn:hover { background:#1177bb; }
        .typing { display:flex; gap:4px; padding:10px 0; }
        .typing div { width:8px; height:8px; background:#4ec9b0; border-radius:50%; animation:pulse 1.4s infinite; }
        .typing div:nth-child(2) { animation-delay:0.2s; }
        .typing div:nth-child(3) { animation-delay:0.4s; }
        @keyframes pulse { 0%,60%,100% { opacity:0.3; } 30% { opacity:1; } }
        .input-area { position:fixed; bottom:0; left:0; right:0; background:#2d2d30; border-top:1px solid #3e3e42; padding:15px; }
        .input-wrapper { position:relative; display:flex; align-items:center; background:#1e1e1e; border:1px solid #3e3e42; border-radius:24px; }
        .input-wrapper:focus-within { border-color:#0e639c; }
        textarea { flex:1; background:transparent; color:#ccc; border:none; padding:12px 80px 12px 50px; font-size:13px; resize:none; min-height:24px; max-height:120px; outline:none; font-family:system-ui; }
        .icon-btn { background:transparent; border:none; padding:8px 12px; cursor:pointer; font-size:20px; color:#858585; transition:color 0.2s; margin:0; }
        .icon-btn:hover { color:#4ec9b0; }
        .attach-btn { position:absolute; left:8px; }
        .send-btn { position:absolute; right:8px; color:#0e639c; font-size:24px; }
        .send-btn:hover { color:#1177bb; }
        .image-preview-inline { position:absolute; bottom:100%; left:0; right:0; background:#2d2d30; border:1px solid #3e3e42; border-radius:8px 8px 0 0; padding:8px 12px; font-size:12px; color:#9cdcfe; display:none; }
        .image-preview-inline.show { display:flex; align-items:center; justify-content:space-between; }
        .close-preview { background:transparent; border:none; color:#858585; cursor:pointer; font-size:16px; padding:0 8px; margin:0; }
        .close-preview:hover { color:#f48771; }
    </style>
</head>
<body>
    <div class="header">
        <h1>HOLY QUEST AI: AI ASSISTANT</h1>
        <button class="clear-btn" onclick="clearHistory()" title="Clear conversation history">🗑️ Clear Chat</button>
    </div>
    <div class="content" id="content">
        <div class="welcome">
            <h2>Welcome!</h2>
            <h3>New Features:</h3>
            <ul>
                <li>💬 Conversation memory - I remember our chat!</li>
                <li>📎 Attach images and screenshots</li>
                <li>✨ Beautiful markdown formatting</li>
                <li>📋 Copy code with one click</li>
            </ul>
            <h3>Step 1:</h3>
            <p>Make sure your API key is set</p>
            <h3>Step 2:</h3>
            <p>Ask me anything - I'll remember the context!</p>
        </div>
    </div>
    <div class="input-area">
        <input type="file" id="imageInput" accept="image/*" style="display:none" />
        <div class="image-preview-inline" id="imagePreviewInline">
            <span id="imageFileName"></span>
            <button class="close-preview" onclick="clearImage()">✕</button>
        </div>
        <div class="input-wrapper">
            <button class="icon-btn attach-btn" onclick="document.getElementById('imageInput').click()" title="Attach image">📎</button>
            <textarea id="input" placeholder="What would you like me to help with?" rows="1"></textarea>
            <button class="icon-btn send-btn" onclick="send()" title="Send (Ctrl+Enter)">➤</button>
        </div>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        const content = document.getElementById('content');
        const input = document.getElementById('input');
        const imageInput = document.getElementById('imageInput');
        const imagePreviewInline = document.getElementById('imagePreviewInline');
        const imageFileName = document.getElementById('imageFileName');
        let currentImage = null;
        
        input.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });
        
        imageInput.addEventListener('change', function() {
            const file = imageInput.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    currentImage = e.target.result;
                    imageFileName.textContent = '📷 ' + file.name;
                    imagePreviewInline.classList.add('show');
                };
                reader.readAsDataURL(file);
            }
        });
        
        function clearImage() {
            currentImage = null;
            imageInput.value = '';
            imagePreviewInline.classList.remove('show');
            imageFileName.textContent = '';
        }
        
        function clearHistory() {
            if (confirm('Clear entire conversation history?')) {
                vscode.postMessage({ type: 'clearHistory' });
                content.innerHTML = '<div class="welcome"><h2>Chat Cleared!</h2><p>Starting fresh conversation</p></div>';
            }
        }
        
        function send() {
            const msg = input.value.trim();
            if (!msg && !currentImage) return;
            
            add('user', msg || '[Image attached]');
            
            vscode.postMessage({ 
                type: 'chat', 
                message: msg,
                imageData: currentImage 
            });
            
            input.value = '';
            input.style.height = 'auto';
            clearImage();
        }
        
        function add(type, text) {
            const div = document.createElement('div');
            div.className = 'message message-' + type;
            if (type === 'agent') {
                div.innerHTML = '<div class="markdown-body">' + marked.parse(text) + '</div>';
                setTimeout(() => {
                    div.querySelectorAll('pre').forEach(pre => {
                        const btn = document.createElement('button');
                        btn.className = 'copy-btn';
                        btn.textContent = 'Copy';
                        btn.onclick = () => { 
                            navigator.clipboard.writeText(pre.textContent); 
                            btn.textContent='Copied!'; 
                            setTimeout(()=>btn.textContent='Copy',2000); 
                        };
                        pre.appendChild(btn);
                    });
                }, 0);
            } else {
                div.textContent = text;
            }
            content.appendChild(div);
            content.scrollTop = content.scrollHeight;
        }
        
        function typing(show) {
            const t = document.getElementById('typing');
            if (t) t.remove();
            if (show) {
                const div = document.createElement('div');
                div.id = 'typing';
                div.className = 'typing';
                div.innerHTML = '<div></div><div></div><div></div>';
                content.appendChild(div);
                content.scrollTop = content.scrollHeight;
            }
        }
        
        input.addEventListener('keydown', e => { if (e.ctrlKey && e.key==='Enter') send(); });
        
        window.addEventListener('message', e => {
            const m = e.data;
            if (m.type==='agentStart') typing(true);
            if (m.type==='stream') { typing(false); add('agent', m.text); }
            if (m.type==='agentComplete') { typing(false); add('agent', m.result?.text || JSON.stringify(m.result,null,2)); }
            if (m.type==='error') { typing(false); add('error', m.message); }
            if (m.type==='info') add('info', m.message);
        });
    </script>
</body>
</html>`;
    }
}