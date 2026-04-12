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
    private readonly MAX_TOKENS = 200000;
    private readonly SUMMARY_THRESHOLD = 160000;
    private currentTokenCount = 0;

    constructor(private readonly _extensionUri: vscode.Uri) {
        const config = vscode.workspace.getConfiguration('holyQuestAI');
        this.apiKey = config.get('apiKey') || '';
        this.anthropic = new Anthropic({ apiKey: this.apiKey || 'placeholder-key' });
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
            
            if (data.type === 'chat') {
                const message = data.message || '';
                const imageData = data.imageData;
                
                if (!this.apiKey || this.apiKey === 'placeholder-key') {
                    webviewView.webview.postMessage({ type: 'error', message: 'Set API key first' });
                    return;
                }
                
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
                        webviewView.webview.postMessage({ type: 'error', message: error.message });
                    }
                }
            }
        });

        this.updateTokenDisplay(webviewView.webview);
    }

    private getHtml(): string {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <style>
        * { box-sizing: border-box; }
        body { margin:0; padding:0; background:#1e1e1e; color:#ccc; font-family:system-ui; }
        .header { background:#2d2d30; padding:10px 20px; border-bottom:1px solid #3e3e42; }
        .header h1 { margin:0 0 8px 0; font-size:14px; font-weight:600; }
        .header-controls { display:flex; gap:8px; align-items:center; margin-top:8px; }
        .token-bar-container { flex:1; background:#1e1e1e; border-radius:10px; height:20px; position:relative; overflow:hidden; }
        .token-bar { height:100%; transition:all 0.3s ease; border-radius:10px; }
        .token-bar.low { background:linear-gradient(90deg, #4ec9b0, #5dcebc); }
        .token-bar.medium { background:linear-gradient(90deg, #dcdcaa, #e8e89d); }
        .token-bar.high { background:linear-gradient(90deg, #f48771, #ff9580); }
        .token-text { position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); font-size:10px; font-weight:600; color:#1e1e1e; white-space:nowrap; }
        .summary-btn { background:#0e639c; color:white; border:none; padding:6px 12px; border-radius:4px; font-size:11px; cursor:pointer; }
        .summary-btn:hover { background:#1177bb; }
        .summary-btn.warning { background:#dcdcaa; color:#1e1e1e; animation:pulse-warning 2s infinite; }
        @keyframes pulse-warning { 0%, 100% { opacity:1; } 50% { opacity:0.7; } }
        .clear-btn { background:#5a1d1d; color:#f48771; border:none; padding:6px 12px; border-radius:4px; font-size:11px; cursor:pointer; }
        .clear-btn:hover { background:#6e2525; }
        .content { height:calc(100vh - 180px); overflow-y:auto; padding:20px; }
        .welcome { background:#2d2d30; border-radius:6px; padding:20px; }
        .welcome h2 { margin:0 0 15px; font-size:18px; color:#4ec9b0; }
        .welcome h3 { margin:15px 0 10px; font-size:14px; color:#9cdcfe; }
        .welcome ul { margin:0; padding-left:20px; }
        .welcome li { margin:5px 0; font-size:13px; }
        .message { background:#2d2d30; border-radius:6px; padding:15px; margin-bottom:15px; }
        .message-user { background:#0e639c; }
        .message-agent { border-left:3px solid #4ec9b0; }
        .message-error { background:#5a1d1d; border-left:3px solid #f48771; }
        .message-info { background:#2d2d30; border-left:3px solid #dcdcaa; }
        .message-summary { background:#1e1e1e; border:2px solid #4ec9b0; padding:20px; }
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
        textarea { flex:1; background:transparent; color:#ccc; border:none; padding:12px 50px 12px 50px; font-size:13px; resize:none; min-height:24px; max-height:120px; outline:none; font-family:system-ui; }
        .icon-btn { background:transparent; border:none; padding:8px 12px; cursor:pointer; font-size:20px; color:#858585; transition:color 0.2s; margin:0; flex-shrink:0; }
        .icon-btn:hover { color:#4ec9b0; }
        .attach-btn { position:absolute; left:8px; }
        .send-btn { position:absolute; right:8px; color:#0e639c; font-size:24px; line-height:1; }
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
        <div class="header-controls">
            <div class="token-bar-container">
                <div class="token-bar low" id="tokenBar" style="width:0%"></div>
                <div class="token-text" id="tokenText">0 / 200k tokens (0%)</div>
            </div>
            <button class="summary-btn" id="summaryBtn" onclick="generateSummary()" title="Generate context transfer summary">📝 Summary</button>
            <button class="clear-btn" onclick="clearHistory()" title="Clear conversation history">🗑️</button>
        </div>
    </div>
    <div class="content" id="content">
        <div class="welcome">
            <h2>Welcome!</h2>
            <h3>New Features:</h3>
            <ul>
                <li>📊 Real-time token usage tracker</li>
                <li>📝 Auto-summary for context transfer</li>
                <li>💬 Conversation memory</li>
                <li>📎 Image attachments</li>
                <li>✨ Beautiful markdown formatting</li>
            </ul>
            <h3>Token Management:</h3>
            <p>Watch the token bar above. When it turns yellow (80%+), generate a summary to continue in a new chat without losing context.</p>
        </div>
    </div>
    <div class="input-area">
        <input type="file" id="imageInput" accept="image/*" style="display:none" />
        <div class="image-preview-inline" id="imagePreviewInline">
            <span id="imageFileName"></span>
            <button class="close-preview" onclick="clearImage()">✕</button>
        </div>
        <div class="input-wrapper">
            <button class="icon-btn attach-btn" onclick="attachImage(event)" title="Attach image">📎</button>
            <textarea id="input" placeholder="What would you like me to help with?" rows="1"></textarea>
            <button class="icon-btn send-btn" onclick="sendMessage(event)" title="Send (Ctrl+Enter)">➤</button>
        </div>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        const content = document.getElementById('content');
        const input = document.getElementById('input');
        const imageInput = document.getElementById('imageInput');
        const imagePreviewInline = document.getElementById('imagePreviewInline');
        const imageFileName = document.getElementById('imageFileName');
        const tokenBar = document.getElementById('tokenBar');
        const tokenText = document.getElementById('tokenText');
        const summaryBtn = document.getElementById('summaryBtn');
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
        
        function attachImage(e) {
            e.preventDefault();
            e.stopPropagation();
            imageInput.click();
            return false;
        }
        
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

        function generateSummary() {
            vscode.postMessage({ type: 'generateSummary' });
        }
        
        function sendMessage(e) {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            
            const msg = input.value.trim();
            if (!msg && !currentImage) return false;
            
            add('user', msg || '[Image attached]');
            
            vscode.postMessage({ 
                type: 'chat', 
                message: msg,
                imageData: currentImage 
            });
            
            input.value = '';
            input.style.height = 'auto';
            clearImage();
            
            return false;
        }
        
        function add(type, text) {
            const div = document.createElement('div');
            div.className = 'message message-' + type;
            if (type === 'agent' || type === 'summary') {
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
        
        input.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.key === 'Enter') {
                sendMessage(e);
            }
        });
        
        window.addEventListener('message', e => {
            const m = e.data;
            if (m.type==='agentStart') typing(true);
            if (m.type==='summaryStart') typing(true);
            if (m.type==='stream') { typing(false); add('agent', m.text); }
            if (m.type==='agentComplete') { typing(false); add('agent', m.result?.text || JSON.stringify(m.result,null,2)); }
            if (m.type==='summaryComplete') { typing(false); add('summary', m.summary); }
            if (m.type==='error') { typing(false); add('error', m.message); }
            if (m.type==='info') add('info', m.message);
            
            if (m.type==='updateTokens') {
                const pct = parseFloat(m.percentage);
                tokenBar.style.width = pct + '%';
                tokenText.textContent = m.current.toLocaleString() + ' / ' + (m.max/1000).toFixed(0) + 'k tokens (' + m.percentage + '%)';
                
                if (pct < 60) {
                    tokenBar.className = 'token-bar low';
                    summaryBtn.className = 'summary-btn';
                } else if (pct < 80) {
                    tokenBar.className = 'token-bar medium';
                    summaryBtn.className = 'summary-btn';
                } else {
                    tokenBar.className = 'token-bar high';
                    summaryBtn.className = 'summary-btn warning';
                }
            }
        });
    </script>
</body>
</html>`;
    }
}