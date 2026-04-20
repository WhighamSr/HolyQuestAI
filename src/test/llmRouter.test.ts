/**
 * Unit tests for LLMRouter and ProviderRegistry
 * Tests Patent #1 Smart Routing Engine implementation
 */

import { LLMRouter } from '../llm/llmRouter';
import { ProviderRegistry } from '../llm/providerRegistry';
import { LLMProvider, TaskComplexity, ProviderTier } from '../llm/types';

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  test('should register all 7 default providers', () => {
    const allProviders = registry.getAllProviders();
    expect(allProviders).toHaveLength(7);
    expect(allProviders).toContain(LLMProvider.OLLAMA);
    expect(allProviders).toContain(LLMProvider.GROQ);
    expect(allProviders).toContain(LLMProvider.GEMINI);
    expect(allProviders).toContain(LLMProvider.OPENAI);
    expect(allProviders).toContain(LLMProvider.ANTHROPIC);
    expect(allProviders).toContain(LLMProvider.DEEPSEEK);
    expect(allProviders).toContain(LLMProvider.CUSTOM);
  });

  test('should return correct capability for OLLAMA', () => {
    const capability = registry.getCapability(LLMProvider.OLLAMA);
    expect(capability).toBeDefined();
    expect(capability?.provider).toBe(LLMProvider.OLLAMA);
    expect(capability?.tier).toBe(ProviderTier.FREE);
    expect(capability?.costPer1kInputTokens).toBe(0);
    expect(capability?.costPer1kOutputTokens).toBe(0);
    expect(capability?.qualityScore).toBe(60);
  });

  test('should return correct capability for ANTHROPIC', () => {
    const capability = registry.getCapability(LLMProvider.ANTHROPIC);
    expect(capability).toBeDefined();
    expect(capability?.provider).toBe(LLMProvider.ANTHROPIC);
    expect(capability?.tier).toBe(ProviderTier.PREMIUM);
    expect(capability?.costPer1kInputTokens).toBe(0.003);
    expect(capability?.costPer1kOutputTokens).toBe(0.015);
    expect(capability?.qualityScore).toBe(95);
  });

  test('should return providers by tier FREE', () => {
    const freeProviders = registry.getProvidersByTier(ProviderTier.FREE);
    expect(freeProviders).toHaveLength(2);
    expect(freeProviders).toContain(LLMProvider.OLLAMA);
    expect(freeProviders).toContain(LLMProvider.GROQ);
  });

  test('should return providers by tier PREMIUM', () => {
    const premiumProviders = registry.getProvidersByTier(ProviderTier.PREMIUM);
    expect(premiumProviders).toHaveLength(1);
    expect(premiumProviders).toContain(LLMProvider.ANTHROPIC);
  });

  test('should find cheapest provider meeting quality threshold', () => {
    const cheapest = registry.getCheapestProvider(60);
    // Should be OLLAMA or GROQ (both free, quality 60/65)
    expect([LLMProvider.OLLAMA, LLMProvider.GROQ]).toContain(cheapest);
  });

  test('should find fastest provider meeting quality threshold', () => {
    const fastest = registry.getFastestProvider(60);
    // GROQ has 200ms latency, fastest among quality >= 60
    expect(fastest).toBe(LLMProvider.GROQ);
  });

  test('should return highest quality provider', () => {
    const highest = registry.getHighestQualityProvider();
    // ANTHROPIC has quality score of 95
    expect(highest).toBe(LLMProvider.ANTHROPIC);
  });
});

describe('LLMRouter - provider availability', () => {
  let router: LLMRouter;
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
    router = new LLMRouter(registry);
  });

  test('should enable a provider', () => {
    router.disableProvider(LLMProvider.OLLAMA);
    expect(router.isProviderAvailable(LLMProvider.OLLAMA)).toBe(false);
    
    router.enableProvider(LLMProvider.OLLAMA);
    expect(router.isProviderAvailable(LLMProvider.OLLAMA)).toBe(true);
  });

  test('should disable a provider', () => {
    expect(router.isProviderAvailable(LLMProvider.GROQ)).toBe(true);
    
    router.disableProvider(LLMProvider.GROQ);
    expect(router.isProviderAvailable(LLMProvider.GROQ)).toBe(false);
  });

  test('should report availability correctly', () => {
    // All providers should be available by default
    expect(router.isProviderAvailable(LLMProvider.GEMINI)).toBe(true);
    expect(router.isProviderAvailable(LLMProvider.OPENAI)).toBe(true);
  });
});

describe('LLMRouter - complexity classification', () => {
  let router: LLMRouter;
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
    router = new LLMRouter(registry);
  });

  test('should classify short simple prompts as TRIVIAL', () => {
    const complexity = router.classifyComplexity('Hello', 'simple');
    expect(complexity).toBe(TaskComplexity.TRIVIAL);
  });

  test('should classify medium prompts as MODERATE', () => {
    const mediumPrompt = 'a'.repeat(800);
    const complexity = router.classifyComplexity(mediumPrompt, 'general');
    expect(complexity).toBe(TaskComplexity.MODERATE);
  });

  test('should classify security-related prompts as CRITICAL', () => {
    const securityPrompt = 'Implement authentication for the API';
    const complexity = router.classifyComplexity(securityPrompt, 'code');
    expect(complexity).toBe(TaskComplexity.CRITICAL);
  });

  test('should classify long complex prompts as COMPLEX', () => {
    const longPrompt = 'a'.repeat(2500);
    const complexity = router.classifyComplexity(longPrompt, 'general');
    expect(complexity).toBe(TaskComplexity.COMPLEX);
  });
});

describe('LLMRouter - routing decisions', () => {
  let router: LLMRouter;
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
    router = new LLMRouter(registry);
  });

  test('should route TRIVIAL to OLLAMA when available', () => {
    const decision = router.route({
      prompt: 'Hi',
      taskType: 'simple',
      complexity: TaskComplexity.TRIVIAL
    });

    expect(decision.selectedProvider).toBe(LLMProvider.OLLAMA);
    expect(decision.reason).toContain('Trivial');
    expect(decision.reason).toContain('cost optimization');
  });

  test('should route CRITICAL to ANTHROPIC when available', () => {
    const decision = router.route({
      prompt: 'Implement secure password hashing',
      taskType: 'security',
      complexity: TaskComplexity.CRITICAL
    });

    expect(decision.selectedProvider).toBe(LLMProvider.ANTHROPIC);
    expect(decision.reason).toContain('Critical');
    expect(decision.reason).toContain('maximum quality');
  });

  test('should fallback when primary provider is disabled', () => {
    router.disableProvider(LLMProvider.OLLAMA);
    
    const decision = router.route({
      prompt: 'Hi',
      taskType: 'simple',
      complexity: TaskComplexity.TRIVIAL
    });

    // Should fallback to GROQ (next in TRIVIAL chain)
    expect(decision.selectedProvider).toBe(LLMProvider.GROQ);
  });

  test('should provide cost estimate in routing decision', () => {
    const decision = router.route({
      prompt: 'Test prompt',
      taskType: 'simple',
      complexity: TaskComplexity.SIMPLE,
      maxTokens: 100
    });

    expect(decision.estimatedCostUsd).toBeGreaterThanOrEqual(0);
    expect(decision.estimatedLatencyMs).toBeGreaterThan(0);
  });

  test('should provide fallback providers', () => {
    const decision = router.route({
      prompt: 'Test',
      taskType: 'general',
      complexity: TaskComplexity.MODERATE
    });

    expect(decision.fallbackProviders).toBeDefined();
    expect(Array.isArray(decision.fallbackProviders)).toBe(true);
    expect(decision.fallbackProviders.length).toBeGreaterThan(0);
    expect(decision.fallbackProviders).not.toContain(decision.selectedProvider);
  });
});
