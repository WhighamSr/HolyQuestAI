const { AgentCoordinator } = require('./out/agents/AgentCoordinator');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const apiKey = process.env.ANTHROPIC_API_KEY || 'your-key-here';
const workspace = 'C:\\dev\\holy-fact-quest';

console.log('🤖 Holy Quest AI Agent System');
console.log('Type your request and press Enter\n');

rl.on('line', async (input) => {
    if (input.toLowerCase() === 'exit') {
        rl.close();
        return;
    }

    try {
        const coordinator = new AgentCoordinator(apiKey, workspace, null);
        const result = await coordinator.runWorkflow(input, []);
        console.log('\n✅ RESULT:\n', result.text || JSON.stringify(result, null, 2));
        console.log('\n---\nNext request:');
    } catch (error) {
        console.error('❌ ERROR:', error.message);
    }
});