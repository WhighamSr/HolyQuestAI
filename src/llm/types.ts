/**
 * Core TypeScript types for LLM routing system
 * Part of Patent #1: Smart Routing Engine
 */

export enum TaskComplexity {
  TRIVIAL = 'TRIVIAL',
  SIMPLE = 'SIMPLE',
  MODERATE = 'MODERATE',
  COMPLEX = 'COMPLEX',
  CRITICAL = 'CRITICAL'
}

export enum ProviderTier {
  FREE = 'FREE',
  BUDGET = 'BUDGET',
  STANDARD = 'STANDARD',
  PREMIUM = 'PREMIUM'
}

export enum LLMProvider {
  OLLAMA = 'OLLAMA',
  GROQ = 'GROQ',
  GEMINI = 'GEMINI',
  OPENAI = 'OPENAI',
  ANTHROPIC = 'ANTHROPIC',
  DEEPSEEK = 'DEEPSEEK',
  CUSTOM = 'CUSTOM'
}

export interface LLMRequest {
  prompt: string;
  taskType: string;
  complexity: TaskComplexity;
  maxTokens?: number;
  temperature?: number;
  requiresStreaming?: boolean;
}

export interface LLMResponse {
  content: string;
  provider: LLMProvider;
  tokensUsed: number;
  costUsd: number;
  latencyMs: number;
  cached: boolean;
}

export interface ProviderCapability {
  provider: LLMProvider;
  tier: ProviderTier;
  costPer1kInputTokens: number;
  costPer1kOutputTokens: number;
  maxContextTokens: number;
  supportsStreaming: boolean;
  supportsVision: boolean;
  averageLatencyMs: number;
  qualityScore: number; // 0-100
}

export interface RoutingDecision {
  selectedProvider: LLMProvider;
  reason: string;
  estimatedCostUsd: number;
  estimatedLatencyMs: number;
  fallbackProviders: LLMProvider[];
}

export interface CostBreakdown {
  totalRequests: number;
  totalTokens: number;
  totalCostUsd: number;
  byProvider: Map<LLMProvider, { requests: number; cost: number }>;
  savingsVsAnthropicOnly: number;
}
