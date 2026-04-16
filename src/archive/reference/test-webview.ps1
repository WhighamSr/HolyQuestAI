#Requires -Version 5.1

param()

$ErrorActionPreference = "Stop"

Write-Host "Holy Quest AI - Webview Diagnostic Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Verify we're in the right directory
if (!(Test-Path "src\extension.ts")) {
    Write-Host "Error: Must run from extension root folder" -ForegroundColor Red
    Write-Host "Please cd to C:\dev\holy-quest-ai first" -ForegroundColor Yellow
    exit 1
}

# Backup current extension.ts
Write-Host "`nCreating backup..." -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
Copy-Item "src\extension.ts" "src\extension.ts.backup-$timestamp" -Force
Write-Host "Backup created: extension.ts.backup-$timestamp" -ForegroundColor Green

# Create test version
Write-Host "`nCreating minimal test version..." -ForegroundColor Yellow

$testExtension = @'
import * as vscode from 'vscode';
import Anthropic from '@anthropic-ai/sdk';

export function activate(context: vscode.ExtensionContext) {
    console.log('Holy Quest AI Test Version activated!');
    
    try {
        const provider = new HolyQuestAIViewProvider(context.extensionUri);
        
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(
                'holyQuestAI.chatView',
                provider
            )
        );
        
        vscode.window.showInformationMessage('Test Version Loaded!');
        console.log('Test extension activated successfully');
        
    } catch (error: any) {
        console.error('Activation error:', error);
        vscode.window.showErrorMessage(`Failed: ${error.message}`);
    }
}

export function deactivate() {
    console.log('Extension deactivated');
}

class HolyQuestAIViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'holyQuestAI.chatView';
    private _view?: vscode.WebviewView;
    private anthropic: Anthropic;
    private apiKey: string = '';

    constructor(private readonly _extensionUri: vscode.Uri) {
        console.log('Constructor called');
        
        const config = vscode.workspace.getConfiguration('holyQuestAI');
        this.apiKey = config.get('apiKey') || '';
        
        this.anthropic = new Anthropic({
            apiKey: this.apiKey || 'test-key'
        });
        
        console.log('Constructor complete');
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        console.log('resolveWebviewView called');
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        
        console.log('Webview options set');

        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
        
        console.log('HTML assigned to webview');

        webviewView.webview.onDidReceiveMessage(async (data) => {
            console.log('Received message from webview:', data);
            
            if (data.type === 'test') {
                vscode.window.showInformationMessage('Webview communication works!');
            }
        });
        
        console.log('resolveWebviewView complete');
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        console.log('Creating minimal test HTML');
        
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Holy Quest AI Test</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background: #1e1e1e;
            color: #cccccc;
            padding: 20px;
        }
        h1 { color: #4ec9b0; }
        .status {
            background: #264f78;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }
        button {
            background: #0e639c;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 3px;
            cursor: pointer;
            margin: 5px;
        }
        button:hover { background: #1177bb; }
        .log {
            background: #252526;
            padding: 15px;
            border-radius: 5px;
            margin-top: 20px;
            font-family: monospace;
            font-size: 12px;
            max-height: 300px;
            overflow-y: auto;
        }
    </style>
</head>
<body>
    <h1>Holy Quest AI - Webview Test</h1>
    
    <div class="status">
        <div>✅ HTML Loaded Successfully</div>
        <div id="js-status">⏳ JavaScript: Checking...</div>
        <div id="vscode-status">⏳ VS Code API: Checking...</div>
    </div>
    
    <div>
        <button onclick="testCommunication()">Test Communication</button>
        <button onclick="testConsole()">Test Console</button>
    </div>
    
    <div class="log" id="log">Log initialized...</div>

    <script>
        const vscode = acquireVsCodeApi();
        
        // Update status
        document.getElementById('js-status').textContent = '✅ JavaScript: Working';
        document.getElementById('vscode-status').textContent = '✅ VS Code API: Connected';
        
        function log(msg) {
            const logDiv = document.getElementById('log');
            const time = new Date().toLocaleTimeString();
            logDiv.innerHTML += '<br>' + time + ' - ' + msg;
            console.log(msg);
        }
        
        function testCommunication() {
            log('Sending test message...');
            vscode.postMessage({
                type: 'test',
                message: 'Hello from webview!'
            });
            log('Message sent!');
        }
        
        function testConsole() {
            console.log('Test log');
            console.warn('Test warning');
            console.error('Test error');
            log('Check browser console (F12)');
        }
        
        log('Webview initialized successfully');
        console.log('Webview script loaded');
    </script>
</body>
</html>`;
    }
}
'@

Set-Content -Path "src\extension.ts" -Value $testExtension -Encoding UTF8
Write-Host "Test version created" -ForegroundColor Green

# Compile
Write-Host "`nCompiling..." -ForegroundColor Yellow
npm run compile | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "Compilation successful" -ForegroundColor Green
} else {
    Write-Host "Compilation failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "TEST VERSION READY" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "1. Close Extension Development Host window"
Write-Host "2. Press F5 in VS Code"
Write-Host "3. Open Holy Quest AI sidebar"
Write-Host "4. Click 'Test Communication' button"
Write-Host "5. Watch Debug Console (Ctrl+Shift+Y)"

Write-Host "`nBackup: src\extension.ts.backup-$timestamp" -ForegroundColor Gray
Write-Host ""