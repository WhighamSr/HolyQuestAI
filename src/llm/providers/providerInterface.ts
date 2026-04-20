/**
 * Provider Interface for Holy Quest AI
 * Defines the contract that all LLM providers must implement
 */

import { LLMProvider, LLMRequest, LLMResponse } from '../types';

/**
 * Interface that all LLM providers must implement
 */
export interface ILLMProvider {
  /** The unique identifier for this provider */
  readonly providerName: LLMProvider;
  
  /** Whether this provider requires an API key */
  readonly requiresApiKey: boolean;
  
  /** Check if the provider is properly configured */
  isConfigured(): boolean;
  
  /** Set the API key for this provider */
  setApiKey(key: string): void;
  
  /** Clear the stored API key */
  clearApiKey(): void;
  
  /** Make a completion request (non-streaming) */
  complete(request: LLMRequest): Promise<LLMResponse>;
  
  /** Make a streaming completion request */
  completeStream(
    request: LLMRequest,
    onChunk: (chunk: string) => void
  ): Promise<LLMResponse>;
  
  /** Estimate token count for given text */
  estimateTokens(text: string): number;
  
  /** Validate the configured API key */
  validateApiKey(): Promise<boolean>;
}

/**
 * Base implementation of ILLMProvider with common functionality
 */
export abstract class BaseLLMProvider implements ILLMProvider {
  abstract readonly providerName: LLMProvider;
  abstract readonly requiresApiKey: boolean;
  
  protected apiKey: string | undefined;
  
  /**
   * Check if provider is configured
   * Returns true if no API key required, or if API key is set
   */
  isConfigured(): boolean {
    return !this.requiresApiKey || !!this.apiKey;
  }
  
  /**
   * Set the API key for this provider
   */
  setApiKey(key: string): void {
    this.apiKey = key;
  }
  
  /**
   * Clear the stored API key
   */
  clearApiKey(): void {
    this.apiKey = undefined;
  }
  
  /**
   * Abstract method for completion - must be implemented by concrete providers
   */
  abstract complete(request: LLMRequest): Promise<LLMResponse>;
  
  /**
   * Abstract method for streaming completion - must be implemented by concrete providers
   */
  abstract completeStream(
    request: LLMRequest,
    onChunk: (chunk: string) => void
  ): Promise<LLMResponse>;
  
  /**
   * Abstract method for API key validation - must be implemented by concrete providers
   */
  abstract validateApiKey(): Promise<boolean>;
  
  /**
   * Default token estimation using ~4 characters per token heuristic
   * Providers can override this with more accurate methods
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}

/**
 * Custom error class for provider-specific errors
 */
export class ProviderError extends Error {
  constructor(
    public provider: LLMProvider,
    public code: 'AUTH' | 'RATE_LIMIT' | 'NETWORK' | 'INVALID_REQUEST' | 'UNKNOWN',
    message: string
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
