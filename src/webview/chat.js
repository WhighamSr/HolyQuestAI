// ============================================
// Holy Quest AI — Chat Webview JavaScript
// Extracted from extension.ts getHtml()
// Pure JavaScript only — no script tags
// ============================================

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
