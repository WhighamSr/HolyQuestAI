"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentCoordinator = void 0;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
class AgentCoordinator {
    anthropic;
    agents;
    webview;
    constructor(apiKey, projectRoot, webview) {
        this.anthropic = new sdk_1.default({ apiKey });
        this.agents = new Map();
        this.webview = webview;
        this.initializeAgents();
    }
    initializeAgents() {
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
    registerAgent(agent) {
        this.agents.set(agent.name, agent);
    }
    async runWorkflow(task) {
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
    async runAgent(agentName, task) {
        const agent = this.agents.get(agentName);
        if (!agent)
            throw new Error(`Agent ${agentName} not found`);
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
    sendProgress(msg) {
        console.log(msg);
        this.webview?.postMessage({ type: 'progress', message: msg });
    }
}
exports.AgentCoordinator = AgentCoordinator;
//# sourceMappingURL=AgentCoordinator.js.map