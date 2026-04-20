/**
 * Google Gemini Provider for Holy Quest AI
 * Implements the ILLMProvider interface for Google's Gemini API
 */

import { LLMProvider, LLMRequest, LLMResponse } from '../types';
import { BaseLLMProvider, ProviderError } from './providerInterface';
import { streamGeminiCompletion } from './geminiStream';

/**
 * Google Gemini API provider implementation
 */
export class GeminiProvider extends BaseLLMProvider {
  readonly providerName = LLMProvider.GEMINI;
  readonly requiresApiKey = true;
  
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  private readonly model: string;
  
  constructor(model: string = 'gemini-1.5-flash') {
    super();
    this.model = model;
  }
  
  /**
   * Make a non-streaming completion request to Gemini
   */
  async complete(request: LLMRequest): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new ProviderError(this.providerName, 'AUTH', 'API key not configured');
    }
    
    const startTime = performance.now();
    
    try {
      const response = await fetch(
        this.buildUrl(`models/${this.model}:generateContent`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(this.buildRequestBody(request))
        }
      );
      
      if (!response.ok) {
        const errorBody = await response.text();
        this.handleApiError(response.status, errorBody);
      }
      
      const data: any = await response.json();
      const endTime = performance.now();
      
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const usageMetadata = data.usageMetadata || {};
      
      return {
        content,
        provider: this.providerName,
        tokensUsed: usageMetadata.totalTokenCount || 0,
        costUsd: this.calculateCost(usageMetadata),
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
   * Make a streaming completion request to Gemini
   */
  async completeStream(
    request: LLMRequest,
    onChunk: (chunk: string) => void
  ): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new ProviderError(this.providerName, 'AUTH', 'API key not configured');
    }
    
    return streamGeminiCompletion(
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
      const response = await fetch(
        this.buildUrl(`models/${this.model}`),
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.ok;
    } catch {
      return false;
    }
  }
  
  /**
   * Build the request body for Gemini API
   */
  private buildRequestBody(request: LLMRequest): object {
    return {
      contents: [
        {
          parts: [
            {
              text: request.prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: request.temperature || 0.7,
        maxOutputTokens: request.maxTokens || 2000
      }
    };
  }
  
  /**
   * Build URL with API key as query parameter
   */
  private buildUrl(endpoint: string): string {
    return `${this.baseUrl}/${endpoint}?key=${this.apiKey}`;
  }
  
  /**
   * Calculate the cost based on token usage
   * Using approximate pricing for gemini-1.5-flash: $0.075/1M input, $0.30/1M output
   */
  private calculateCost(usageMetadata: any): number {
    if (!usageMetadata) return 0;
    
    const inputCost = (usageMetadata.promptTokenCount || 0) * 0.075 / 1_000_000;
    const outputCost = (usageMetadata.candidatesTokenCount || 0) * 0.30 / 1_000_000;
    
    return inputCost + outputCost;
  }
  
  /**
   * Handle API errors and throw appropriate ProviderError
   */
  private handleApiError(status: number, body: string): never {
    let code: ProviderError['code'] = 'UNKNOWN';
    let message = `Gemini API error (${status})`;
    
    if (status === 403) {
      code = 'AUTH';
      message = 'Invalid API key or permission denied';
    } else if (status === 429) {
      code = 'RATE_LIMIT';
      message = 'Rate limit exceeded';
    } else if (status === 400) {
      code = 'INVALID_REQUEST';
      message = 'Invalid request format';
    } else if (status >= 500) {
      code = 'NETWORK';
      message = 'Gemini server error';
    }
    
    throw new ProviderError(this.providerName, code, message);
  }
}
