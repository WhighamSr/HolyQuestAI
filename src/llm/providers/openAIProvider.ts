/**
 * OpenAI Provider for Holy Quest AI
 * Implements the ILLMProvider interface for OpenAI's API
 */

import { LLMProvider, LLMRequest, LLMResponse } from '../types';
import { BaseLLMProvider, ProviderError } from './providerInterface';
import { streamOpenAICompletion } from './openAIStream';

/**
 * OpenAI API provider implementation
 */
export class OpenAIProvider extends BaseLLMProvider {
  readonly providerName = LLMProvider.OPENAI;
  readonly requiresApiKey = true;
  
  private readonly baseUrl = 'https://api.openai.com/v1';
  private readonly model: string;
  
  constructor(model: string = 'gpt-4o-mini') {
    super();
    this.model = model;
  }
  
  /**
   * Make a non-streaming completion request to OpenAI
   */
  async complete(request: LLMRequest): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new ProviderError(this.providerName, 'AUTH', 'API key not configured');
    }
    
    const startTime = performance.now();
    
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(this.buildRequestBody(request))
      });
      
      if (!response.ok) {
        const errorBody = await response.text();
        this.handleApiError(response.status, errorBody);
      }
      
      const data: any = await response.json();
      const endTime = performance.now();
      
      return {
        content: data.choices[0]?.message?.content || '',
        provider: this.providerName,
        tokensUsed: data.usage?.total_tokens || 0,
        costUsd: this.calculateCost(data.usage),
        latencyMs: Math.round(endTime - startTime),
        cached: false
      };
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }
      throw new ProviderError(this.providerName, 'NETWORK', `Network error: ${error}`);
    }
  }
  
  /**
   * Make a streaming completion request to OpenAI
   */
  async completeStream(
    request: LLMRequest,
    onChunk: (chunk: string) => void
  ): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new ProviderError(this.providerName, 'AUTH', 'API key not configured');
    }
    
    return streamOpenAICompletion(
      this.apiKey,
      this.model,
      this.baseUrl,
      request,
      onChunk
    );
  }
  
  /**
   * Validate the API key by making a minimal test request
   */
  async validateApiKey(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: this.buildHeaders()
      });
      
      return response.ok;
    } catch {
      return false;
    }
  }
  
  /**
   * Build the request body for OpenAI API
   */
  private buildRequestBody(request: LLMRequest): object {
    return {
      model: this.model,
      messages: [
        {
          role: 'user',
          content: request.prompt
        }
      ],
      temperature: request.temperature || 0.7,
      max_tokens: request.maxTokens || 2000
    };
  }
  
  /**
   * Build headers for OpenAI API requests
   */
  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`
    };
  }
  
  /**
   * Calculate the cost based on token usage
   * Using approximate pricing for gpt-4o-mini: $0.15/1M input, $0.60/1M output
   */
  private calculateCost(usage: any): number {
    if (!usage) return 0;
    
    const inputCost = (usage.prompt_tokens || 0) * 0.15 / 1_000_000;
    const outputCost = (usage.completion_tokens || 0) * 0.60 / 1_000_000;
    
    return inputCost + outputCost;
  }
  
  /**
   * Handle API errors and throw appropriate ProviderError
   */
  private handleApiError(status: number, body: string): never {
    let code: ProviderError['code'] = 'UNKNOWN';
    let message = `OpenAI API error (${status})`;
    
    if (status === 401) {
      code = 'AUTH';
      message = 'Invalid API key';
    } else if (status === 429) {
      code = 'RATE_LIMIT';
      message = 'Rate limit exceeded';
    } else if (status === 400) {
      code = 'INVALID_REQUEST';
      message = 'Invalid request format';
    } else if (status >= 500) {
      code = 'NETWORK';
      message = 'OpenAI server error';
    }
    
    throw new ProviderError(this.providerName, code, message);
  }
}
