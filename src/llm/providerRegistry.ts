/**
 * Registry of all supported LLM providers with their capabilities
 * Part of Patent #1: Smart Routing Engine
 */

import { LLMProvider, ProviderCapability, ProviderTier } from './types';

export class ProviderRegistry {
  private capabilities: Map<LLMProvider, ProviderCapability>;

  constructor() {
    this.capabilities = new Map<LLMProvider, ProviderCapability>();
    this.initializeDefaultCapabilities();
  }

  private initializeDefaultCapabilities(): void {
    // OLLAMA - Free tier, local, fast
    this.capabilities.set(LLMProvider.OLLAMA, {
      provider: LLMProvider.OLLAMA,
      tier: ProviderTier.FREE,
      costPer1kInputTokens: 0,
      costPer1kOutputTokens: 0,
      maxContextTokens: 8000,
      supportsStreaming: true,
      supportsVision: false,
      averageLatencyMs: 500,
      qualityScore: 60
    });

    // GROQ - Free tier, cloud, very fast
    this.capabilities.set(LLMProvider.GROQ, {
      provider: LLMProvider.GROQ,
      tier: ProviderTier.FREE,
      costPer1kInputTokens: 0,
      costPer1kOutputTokens: 0,
      maxContextTokens: 8000,
      supportsStreaming: true,
      supportsVision: false,
      averageLatencyMs: 200,
      qualityScore: 65
    });

    // GEMINI - Budget tier, good quality, vision support
    this.capabilities.set(LLMProvider.GEMINI, {
      provider: LLMProvider.GEMINI,
      tier: ProviderTier.BUDGET,
      costPer1kInputTokens: 0.00015,
      costPer1kOutputTokens: 0.0006,
      maxContextTokens: 32000,
      supportsStreaming: true,
      supportsVision: true,
      averageLatencyMs: 400,
      qualityScore: 80
    });

    // DEEPSEEK - Budget tier, cost-effective
    this.capabilities.set(LLMProvider.DEEPSEEK, {
      provider: LLMProvider.DEEPSEEK,
      tier: ProviderTier.BUDGET,
      costPer1kInputTokens: 0.00014,
      costPer1kOutputTokens: 0.00028,
      maxContextTokens: 32000,
      supportsStreaming: true,
      supportsVision: false,
      averageLatencyMs: 600,
      qualityScore: 78
    });

    // OPENAI - Standard tier, high quality
    this.capabilities.set(LLMProvider.OPENAI, {
      provider: LLMProvider.OPENAI,
      tier: ProviderTier.STANDARD,
      costPer1kInputTokens: 0.0025,
      costPer1kOutputTokens: 0.01,
      maxContextTokens: 128000,
      supportsStreaming: true,
      supportsVision: true,
      averageLatencyMs: 800,
      qualityScore: 90
    });

    // ANTHROPIC - Premium tier, highest quality
    this.capabilities.set(LLMProvider.ANTHROPIC, {
      provider: LLMProvider.ANTHROPIC,
      tier: ProviderTier.PREMIUM,
      costPer1kInputTokens: 0.003,
      costPer1kOutputTokens: 0.015,
      maxContextTokens: 200000,
      supportsStreaming: true,
      supportsVision: true,
      averageLatencyMs: 1200,
      qualityScore: 95
    });

    // CUSTOM - Standard tier, configurable
    this.capabilities.set(LLMProvider.CUSTOM, {
      provider: LLMProvider.CUSTOM,
      tier: ProviderTier.STANDARD,
      costPer1kInputTokens: 0.001,
      costPer1kOutputTokens: 0.003,
      maxContextTokens: 32000,
      supportsStreaming: true,
      supportsVision: false,
      averageLatencyMs: 1000,
      qualityScore: 75
    });
  }

  getCapability(provider: LLMProvider): ProviderCapability | undefined {
    return this.capabilities.get(provider);
  }

  getAllProviders(): LLMProvider[] {
    return Array.from(this.capabilities.keys());
  }

  getProvidersByTier(tier: ProviderTier): LLMProvider[] {
    return Array.from(this.capabilities.values())
      .filter(cap => cap.tier === tier)
      .map(cap => cap.provider);
  }

  getProvidersInCostRange(minUsd: number, maxUsd: number): LLMProvider[] {
    return Array.from(this.capabilities.values())
      .filter(cap => {
        const avgCost = (cap.costPer1kInputTokens + cap.costPer1kOutputTokens) / 2;
        return avgCost >= minUsd && avgCost <= maxUsd;
      })
      .map(cap => cap.provider);
  }

  getCheapestProvider(minQuality: number): LLMProvider | undefined {
    const eligible = Array.from(this.capabilities.values())
      .filter(cap => cap.qualityScore >= minQuality)
      .sort((a, b) => {
        const costA = (a.costPer1kInputTokens + a.costPer1kOutputTokens) / 2;
        const costB = (b.costPer1kInputTokens + b.costPer1kOutputTokens) / 2;
        return costA - costB;
      });
    
    return eligible.length > 0 ? eligible[0].provider : undefined;
  }

  getFastestProvider(minQuality: number): LLMProvider | undefined {
    const eligible = Array.from(this.capabilities.values())
      .filter(cap => cap.qualityScore >= minQuality)
      .sort((a, b) => a.averageLatencyMs - b.averageLatencyMs);
    
    return eligible.length > 0 ? eligible[0].provider : undefined;
  }

  getHighestQualityProvider(): LLMProvider {
    const sorted = Array.from(this.capabilities.values())
      .sort((a, b) => b.qualityScore - a.qualityScore);
    
    return sorted[0].provider;
  }
}
