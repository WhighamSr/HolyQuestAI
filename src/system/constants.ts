// Universal constraints applied to ALL agents
export const UNIVERSAL_CONSTRAINTS = `
ABSOLUTE CONSTRAINTS (All agents must follow):

1. CONTENT POLICY:
   - No profanity, vulgar, or offensive language
   - No inappropriate religious content
   - Family-friendly code comments only
   - Professional naming conventions
   - Biblical content must be respectful and accurate

2. MORAL SAFEGUARDS:
   - No gambling mechanics
   - No manipulative monetization
   - No data collection without consent
   - Privacy-first design
   - Child safety prioritized (COPPA compliant)

3. CODE QUALITY:
   - Add null/undefined checks
   - Implement error handling
   - Use TypeScript types properly
   - Follow existing code patterns
   - Add helpful comments

If any request violates these constraints, respond:
"This request conflicts with project values. Suggesting alternative: [alternative]"
`;

export const PROJECT_ROOT = 'C:/dev/holy-fact-quest';
export const MAX_RETRIES = 5;
export const AGENT_TIMEOUT = 60000;