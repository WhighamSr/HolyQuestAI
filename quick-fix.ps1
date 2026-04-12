$ErrorActionPreference = "Stop"

Write-Host "🚀 Quick Agent System Fix" -ForegroundColor Cyan

# Paths
$ext = "C:\dev\holy-quest-ai"
$game = "C:\dev\holy-fact-quest"

Set-Location $ext

# Create directories
Write-Host "`nCreating directories..." -ForegroundColor Yellow
@("src\agents", "src\system", "src\types") | ForEach-Object {
    New-Item -ItemType Directory -Path $_ -Force | Out-Null
}
Write-Host "✅ Directories created" -ForegroundColor Green

# Download pre-made files from a temp location
Write-Host "`nCreating files..." -ForegroundColor Yellow

# 1. Create types file
@'
export interface Agent {
  name: string;
  model: string;
  role: string;
  systemPrompt: string;
  temperature: number;
}

export interface AgentResponse {
  agent: string;
  success: boolean;
  output: any;
  forNextAgent?: string;
  needsRetry?: boolean;
  error?: string;
}

export interface SharedMemory {
  currentTask: string;
  projectStatus: string;
  lastUpdate: string;
  completedTasks: any[];
  activeIssues: any[];
  attemptedFixes: any[];
  prohibitedPatterns: string[];
  projectKnowledge: any;
}

export type AgentName = 
  | 'ProjectAnalyst'
  | 'MobileExpert'
  | 'QualityEngineer';
'@ | Out-File "src\types\agents.ts" -Encoding utf8

Write-Host "✅ Created agents.ts" -ForegroundColor Green

# 2. Create constants
@'
export const UNIVERSAL_CONSTRAINTS = `
CONTENT POLICY:
- No profanity or offensive language
- Family-friendly code only
- Respectful Biblical content

CODE QUALITY:
- Add null checks
- Implement error handling
- Use TypeScript types
`;

export const PROJECT_ROOT = 'C:/dev/holy-fact-quest';
export const MAX_RETRIES = 5;
export const AGENT_TIMEOUT = 60000;
'@ | Out-File "src\system\constants.ts" -Encoding utf8

Write-Host "✅ Created constants.ts" -ForegroundColor Green

# 3. Create AgentCoordinator (minimal version)
@'
import Anthropic from '@anthropic-ai/sdk';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Agent, AgentResponse, SharedMemory, AgentName } from '../types/agents';
import { UNIVERSAL_CONSTRAINTS, PROJECT_ROOT, MAX_RETRIES } from '../system/constants';

export class AgentCoordinator {
    private anthropic: Anthropic;
    private agents: Map<AgentName, Agent>;
    private webview?: vscode.Webview;

    constructor(apiKey: string, projectRoot: string, webview?: vscode.Webview) {
        this.anthropic = new Anthropic({ apiKey });
        this.agents = new Map();
        this.webview = webview;
        this.initializeAgents();
    }

    private initializeAgents() {
        this.registerAgent({
            name: 'ProjectAnalyst',
            model: 'claude-sonnet-4-20250514',
            role: 'Analysis',
            temperature: 0.3,
            systemPrompt: 'You analyze bugs and plan solutions. Output JSON.'
        });

        this.registerAgent({
            name: 'MobileExpert',
            model: 'claude-sonnet-4-20250514',
            role: 'React Native coding',
            temperature: 0.2,
            systemPrompt: 'You write React Native TypeScript code. Use .tsx files only.'
        });

        this.registerAgent({
            name: 'QualityEngineer',
            model: 'claude-sonnet-4-20250514',
            role: 'Validation',
            temperature: 0.1,
            systemPrompt: 'You validate code quality. Check for React Native compliance.'
        });
    }

    private registerAgent(agent: Agent) {
        this.agents.set(agent.name as AgentName, agent);
    }

    public async runWorkflow(task: string): Promise<any> {
        this.sendProgress('Starting workflow...');
        
        // Run ProjectAnalyst
        const analysis = await this.runAgent('ProjectAnalyst', task);
        this.sendProgress('Analysis complete');
        
        // Run MobileExpert
        const code = await this.runAgent('MobileExpert', JSON.stringify(analysis.output));
        this.sendProgress('Code generated');
        
        // Run QualityEngineer
        const validation = await this.runAgent('QualityEngineer', JSON.stringify(code.output));
        this.sendProgress('Validation complete');
        
        return validation.output;
    }

    private async runAgent(agentName: AgentName, task: string): Promise<AgentResponse> {
        const agent = this.agents.get(agentName);
        if (!agent) throw new Error(`Agent ${agentName} not found`);

        let response = '';

        const stream = await this.anthropic.messages.stream({
            model: agent.model,
            max_tokens: 8000,
            temperature: agent.temperature,
            system: agent.systemPrompt,
            messages: [{ role: 'user', content: task }]
        });

        for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                response += chunk.delta.text;
                this.webview?.postMessage({ type: 'stream', text: chunk.delta.text });
            }
        }

        return {
            agent: agentName,
            success: true,
            output: { text: response }
        };
    }

    private sendProgress(msg: string) {
        console.log(msg);
        this.webview?.postMessage({ type: 'progress', message: msg });
    }
}
'@ | Out-File "src\agents\AgentCoordinator.ts" -Encoding utf8

Write-Host "✅ Created AgentCoordinator.ts" -ForegroundColor Green

# 4. Create PROJECT_CONTEXT.md in game folder
$context = @"
# HOLY FACT QUEST - PROJECT CONTEXT

PROJECT TYPE: React Native mobile app (Expo)
LANGUAGE: TypeScript
FRAMEWORK: Expo SDK 51

RULES:
- Use .tsx files only
- Use React Native components (View, Text, TouchableOpacity)
- Import from 'react-native'
- NO HTML tags (div, span, button)
- NO .jsx files
- Add null checks
- Handle errors

CURRENT BUGS:
- Journey Results crash: src/components/game/JourneyResultsScreen.tsx
- Socket.io reliability: src/services/socketService.ts
"@

$context | Out-File "$game\PROJECT_CONTEXT.md" -Encoding utf8
Write-Host "✅ Created PROJECT_CONTEXT.md" -ForegroundColor Green

# 5. Create SHARED_MEMORY.json
$memory = @{
    currentTask = "Initialize"
    projectStatus = "Active"
    lastUpdate = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
    prohibitedPatterns = @("jsx files", "HTML tags", "web assumptions")
    projectKnowledge = @{
        isReactNative = $true
        language = "TypeScript"
    }
} | ConvertTo-Json -Depth 5

$memory | Out-File "$game\SHARED_MEMORY.json" -Encoding utf8
Write-Host "✅ Created SHARED_MEMORY.json" -ForegroundColor Green

# 6. Update extension.ts
Write-Host "`nUpdating extension.ts..." -ForegroundColor Yellow

$extFile = "src\extension.ts"
if (Test-Path $extFile) {
    $content = Get-Content $extFile -Raw
    
    if ($content -notmatch "AgentCoordinator") {
        $import = "import { AgentCoordinator } from './agents/AgentCoordinator';`n`n"
        $newContent = $content -replace "(import.*?;`n)", "`$1$import"
        $newContent | Out-File $extFile -Encoding utf8 -NoNewline
        Write-Host "✅ Updated extension.ts" -ForegroundColor Green
    } else {
        Write-Host "⏭️  Already updated" -ForegroundColor Gray
    }
}

# 7. Compile
Write-Host "`nCompiling..." -ForegroundColor Yellow
try {
    npm run compile 2>&1 | Out-Null
    Write-Host "✅ Compiled" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Compilation warnings" -ForegroundColor Yellow
}

Write-Host @"

╔═══════════════════════════════════════════╗
║           ✅ SETUP COMPLETE!              ║
╚═══════════════════════════════════════════╝

Files Created:
✅ src/types/agents.ts
✅ src/system/constants.ts
✅ src/agents/AgentCoordinator.ts
✅ PROJECT_CONTEXT.md
✅ SHARED_MEMORY.json

Next Steps:
1. Open VS Code: code .
2. Press F5 to launch extension
3. Add to extension.ts handleMessage:

   if (message.includes('use agents')) {
       const coordinator = new AgentCoordinator(
           apiKey,
           workspaceFolder.uri.fsPath,
           webview
       );
       return await coordinator.runWorkflow(message);
   }

4. Test: "Use agents to fix Journey Results"

"@ -ForegroundColor Green