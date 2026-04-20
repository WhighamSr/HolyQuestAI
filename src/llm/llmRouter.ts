/**
 * Core Smart Routing Engine — Patent #1 Implementation
 * Routes requests to optimal LLM providers based on task complexity,
 * cost optimization, and quality requirements.
 */

import { LLMProvider, LLMRequest, RoutingDecision, TaskComplexity } from './types';
import { ProviderRegistry } from './providerRegistry';

export class LLMRouter {
  private registry: ProviderRegistry;
  private availableProviders: Set<LLMProvider>;

  constructor(registry: ProviderRegistry) {
    this.registry = registry;
    this.availableProviders = new Set<LLMProvider>();
    
    // Initialize with all providers enabled by default
    this.registry.getAllProviders().forEach(provider => {
      this.availableProviders.add(provider);
    });
  }

  enableProvider(provider: LLMProvider): void {
    this.availableProviders.add(provider);
  }

  disableProvider(provider: LLMProvider): void {
    this.availableProviders.delete(provider);
  }

  isProviderAvailable(provider: LLMProvider): boolean {
    return this.availableProviders.has(provider);
  }

  /**
   * Core routing logic - Patent #1 main claim
   * Analyzes request and selects optimal provider
   */
  route(request: LLMRequest): RoutingDecision {
    const complexity = request.complexity;
    const requiresStreaming = request.requiresStreaming || false;
    const requiresVision = false; // Can be extended from request if needed

    // Select primary provider based on complexity
    const selectedProvider = this.selectForComplexity(
      complexity,
      requiresStreaming,
      requiresVision
    );

    // Get capability for cost estimation
    const capability = this.registry.getCapability(selectedProvider);
    if (!capability) {
      throw new Error(`No capability found for provider: ${selectedProvider}`);
    }

    // Estimate tokens (rough heuristic based on prompt length)
    const estimatedInputTokens = Math.ceil(request.prompt.length / 4);
    const estimatedOutputTokens = request.maxTokens || 500;

    // Calculate estimated cost
    const estimatedCostUsd = this.estimateCost(
      selectedProvider,
      estimatedInputTokens,
      estimatedOutputTokens
    );

    // Get fallback chain
    const fallbackProviders = this.getFallbackChain(selectedProvider);

    return {
      selectedProvider,
      reason: this.getRoutingReason(complexity, selectedProvider),
      estimatedCostUsd,
      estimatedLatencyMs: capability.averageLatencyMs,
      fallbackProviders
    };
  }

  /**
   * Classify task complexity based on prompt and task type
   */
  classifyComplexity(prompt: string, taskType: string): TaskComplexity {
    const promptLength = prompt.length;
    const lowerPrompt = prompt.toLowerCase();
    const lowerTaskType = taskType.toLowerCase();

    // Check for critical/security-related keywords
    const criticalKeywords = ['security', 'auth', 'crypto', 'production', 'password', 'secret'];
    const isCritical = criticalKeywords.some(keyword => 
      lowerPrompt.includes(keyword) || lowerTaskType.includes(keyword)
    );

    if (isCritical) {
      return TaskComplexity.CRITICAL;
    }

    // Length-based classification
    if (promptLength < 100 && lowerTaskType === 'simple') {
      return TaskComplexity.TRIVIAL;
    }

    if (promptLength < 500) {
      return TaskComplexity.SIMPLE;
    }

    if (promptLength < 2000) {
      return TaskComplexity.MODERATE;
    }

    return TaskComplexity.COMPLEX;
  }

  /**
   * Estimate cost for a given provider and token count
   */
  estimateCost(
    provider: LLMProvider,
    inputTokens: number,
    expectedOutputTokens: number
  ): number {
    const capability = this.registry.getCapability(provider);
    if (!capability) {
      return 0;
    }

    const inputCost = (inputTokens / 1000) * capability.costPer1kInputTokens;
    const outputCost = (expectedOutputTokens / 1000) * capability.costPer1kOutputTokens;

    return inputCost + outputCost;
  }

  /**
   * Select provider based on task complexity (Patent #1 core algorithm)
   */
  private selectForComplexity(
    complexity: TaskComplexity,
    requiresStreaming: boolean,
    requiresVision: boolean
  ): LLMProvider {
    let preferredProviders: LLMProvider[] = [];

    switch (complexity) {
      case TaskComplexity.TRIVIAL:
        // Try free/local providers first
        preferredProviders = [LLMProvider.OLLAMA, LLMProvider.GROQ, LLMProvider.GEMINI];
        break;

      case TaskComplexity.SIMPLE:
        // Fast and free preferred
        preferredProviders = [LLMProvider.GROQ, LLMProvider.GEMINI, LLMProvider.OPENAI];
        break;

      case TaskComplexity.MODERATE:
        // Balance cost and quality
        preferredProviders = [LLMProvider.GEMINI, LLMProvider.DEEPSEEK, LLMProvider.OPENAI];
        break;

      case TaskComplexity.COMPLEX:
        // Quality matters more
        preferredProviders = [LLMProvider.OPENAI, LLMProvider.GEMINI, LLMProvider.ANTHROPIC];
        break;

      case TaskComplexity.CRITICAL:
        // Highest quality only
        preferredProviders = [LLMProvider.ANTHROPIC, LLMProvider.OPENAI, LLMProvider.GEMINI];
        break;
    }

    // Filter by requirements and availability
    const eligible = preferredProviders.filter(provider => {
      if (!this.availableProviders.has(provider)) {
        return false;
      }

      const capability = this.registry.getCapability(provider);
      if (!capability) {
        return false;
      }

      if (requiresStreaming && !capability.supportsStreaming) {
        return false;
      }

      if (requiresVision && !capability.supportsVision) {
        return false;
      }

      return true;
    });

    // Return first eligible, or fallback to highest quality available
    if (eligible.length > 0) {
      return eligible[0];
    }

    // Fallback: return highest quality provider that's available
    return this.registry.getHighestQualityProvider();
  }

  /**
   * Get fallback provider chain for resilience
   */
  private getFallbackChain(primary: LLMProvider): LLMProvider[] {
    const allProviders = this.registry.getAllProviders()
      .filter(p => p !== primary && this.availableProviders.has(p));

    // Sort by quality score (descending)
    return allProviders
      .map(p => ({ provider: p, capability: this.registry.getCapability(p)! }))
      .sort((a, b) => b.capability.qualityScore - a.capability.qualityScore)
      .map(item => item.provider)
      .slice(0, 2); // Top 2 fallbacks
  }

  /**
   * Generate human-readable routing reason
   */
  private getRoutingReason(complexity: TaskComplexity, provider: LLMProvider): string {
    const capability = this.registry.getCapability(provider);
    const tierName = capability?.tier || 'unknown';

    switch (complexity) {
      case TaskComplexity.TRIVIAL:
        return `Trivial task routed to ${provider} (${tierName} tier) for cost optimization`;
      case TaskComplexity.SIMPLE:
        return `Simple task routed to ${provider} (${tierName} tier) for speed and efficiency`;
      case TaskComplexity.MODERATE:
        return `Moderate task routed to ${provider} (${tierName} tier) balancing cost and quality`;
      case TaskComplexity.COMPLEX:
        return `Complex task routed to ${provider} (${tierName} tier) for high quality output`;
      case TaskComplexity.CRITICAL:
        return `Critical task routed to ${provider} (${tierName} tier) for maximum quality and reliability`;
    }
  }
}
