/**
 * Unit tests for CostCalculator
 * Tests Patent #1 cost arbitrage and savings calculations
 */

import { CostCalculator } from '../llm/costCalculator';
import { ProviderRegistry } from '../llm/providerRegistry';
import { LLMProvider } from '../llm/types';

describe('CostCalculator - recording', () => {
  let calculator: CostCalculator;
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
    calculator = new CostCalculator(registry);
  });

  test('should record a request and return cost', () => {
    const cost = calculator.recordRequest(LLMProvider.GEMINI, 1000, 500);
    
    // GEMINI: $0.00015/1k input, $0.0006/1k output
    // Expected: (1000/1000 * 0.00015) + (500/1000 * 0.0006) = 0.00015 + 0.0003 = 0.00045
    expect(cost).toBeCloseTo(0.00045, 6);
  });

  test('should accumulate multiple requests', () => {
    calculator.recordRequest(LLMProvider.OLLAMA, 1000, 1000);
    calculator.recordRequest(LLMProvider.GROQ, 1000, 1000);
    calculator.recordRequest(LLMProvider.GEMINI, 1000, 1000);

    const breakdown = calculator.getBreakdown();
    expect(breakdown.totalRequests).toBe(3);
  });

  test('should track costs per provider separately', () => {
    calculator.recordRequest(LLMProvider.OLLAMA, 1000, 1000);
    calculator.recordRequest(LLMProvider.OLLAMA, 1000, 1000);
    calculator.recordRequest(LLMProvider.GEMINI, 1000, 1000);

    const ollamaStats = calculator.getProviderStats(LLMProvider.OLLAMA);
    const geminiStats = calculator.getProviderStats(LLMProvider.GEMINI);

    expect(ollamaStats.requests).toBe(2);
    expect(geminiStats.requests).toBe(1);
  });
});

describe('CostCalculator - breakdown', () => {
  let calculator: CostCalculator;
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
    calculator = new CostCalculator(registry);
  });

  test('should return total request count', () => {
    calculator.recordRequest(LLMProvider.OLLAMA, 1000, 1000);
    calculator.recordRequest(LLMProvider.GROQ, 1000, 1000);

    const breakdown = calculator.getBreakdown();
    expect(breakdown.totalRequests).toBe(2);
  });

  test('should return total token count', () => {
    calculator.recordRequest(LLMProvider.OLLAMA, 1000, 500);
    calculator.recordRequest(LLMProvider.GROQ, 2000, 1000);

    const breakdown = calculator.getBreakdown();
    // Total: 1000 + 500 + 2000 + 1000 = 4500
    expect(breakdown.totalTokens).toBe(4500);
  });

  test('should return per-provider breakdown', () => {
    calculator.recordRequest(LLMProvider.OLLAMA, 1000, 1000);
    calculator.recordRequest(LLMProvider.GEMINI, 1000, 1000);

    const breakdown = calculator.getBreakdown();
    
    expect(breakdown.byProvider.size).toBeGreaterThan(0);
    expect(breakdown.byProvider.has(LLMProvider.OLLAMA)).toBe(true);
    expect(breakdown.byProvider.has(LLMProvider.GEMINI)).toBe(true);
    
    const ollamaData = breakdown.byProvider.get(LLMProvider.OLLAMA);
    expect(ollamaData?.requests).toBe(1);
  });
});

describe('CostCalculator - savings calculation', () => {
  let calculator: CostCalculator;
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
    calculator = new CostCalculator(registry);
  });

  test('should calculate Anthropic-only cost correctly', () => {
    // Record using free providers
    calculator.recordRequest(LLMProvider.OLLAMA, 1000, 1000);
    calculator.recordRequest(LLMProvider.GROQ, 1000, 1000);

    const anthropicCost = calculator.calculateAnthropicOnlyCost();
    
    // ANTHROPIC: $0.003/1k input, $0.015/1k output
    // For 2 requests of 1000 input + 1000 output each:
    // (1000/1000 * 0.003 + 1000/1000 * 0.015) * 2 = (0.003 + 0.015) * 2 = 0.036
    expect(anthropicCost).toBeCloseTo(0.036, 6);
  });

  test('should calculate savings percentage vs Anthropic-only', () => {
    // Use all free providers
    calculator.recordRequest(LLMProvider.OLLAMA, 1000, 1000);
    calculator.recordRequest(LLMProvider.GROQ, 1000, 1000);

    const savingsPercent = calculator.calculateSavingsPercent();
    
    // Free providers cost $0, Anthropic would cost $0.036
    // Savings: 100%
    expect(savingsPercent).toBe(100);
  });

  test('should show high savings when using free tier providers', () => {
    calculator.recordRequest(LLMProvider.OLLAMA, 10000, 5000);
    calculator.recordRequest(LLMProvider.GROQ, 10000, 5000);

    const breakdown = calculator.getBreakdown();
    
    // Free providers, so actual cost = $0
    expect(breakdown.totalCostUsd).toBe(0);
    
    // Anthropic would have cost significantly more
    expect(breakdown.savingsVsAnthropicOnly).toBeGreaterThan(0);
  });
});

describe('CostCalculator - reset', () => {
  let calculator: CostCalculator;
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
    calculator = new CostCalculator(registry);
  });

  test('should clear all logs after reset', () => {
    calculator.recordRequest(LLMProvider.OLLAMA, 1000, 1000);
    calculator.recordRequest(LLMProvider.GEMINI, 1000, 1000);

    let breakdown = calculator.getBreakdown();
    expect(breakdown.totalRequests).toBe(2);

    calculator.reset();

    breakdown = calculator.getBreakdown();
    expect(breakdown.totalRequests).toBe(0);
  });

  test('should reset all counters to zero', () => {
    calculator.recordRequest(LLMProvider.OPENAI, 5000, 2000);
    
    calculator.reset();

    const breakdown = calculator.getBreakdown();
    expect(breakdown.totalRequests).toBe(0);
    expect(breakdown.totalTokens).toBe(0);
    expect(breakdown.totalCostUsd).toBe(0);
    expect(breakdown.savingsVsAnthropicOnly).toBe(0);
  });
});
