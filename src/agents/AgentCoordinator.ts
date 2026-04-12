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
