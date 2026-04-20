import { LLMRequest, LLMResponse, LLMProvider } from '../types';
import { BaseLLMProvider, ProviderError } from './providerInterface';
import { streamOllamaCompletion } from './ollamaStream';

/**
 * Ollama local LLM provider for free, privacy-first AI inference.
 * Runs models locally without API keys or costs.
 */
export class OllamaProvider extends BaseLLMProvider {
  readonly providerName = LLMProvider.OLLAMA;
  readonly requiresApiKey = false;

  private readonly baseUrl: string;
  private readonly model: string;

  constructor(model: string = 'llama3.1', baseUrl: string = 'http://localhost:11434') {
    super();
    this.model = model;
    this.baseUrl = baseUrl;
  }

  /**
   * Complete a prompt using Ollama (non-streaming).
   */
  async complete(request: LLMRequest): Promise<LLMResponse> {
    const startTime = performance.now();

    try {
      const requestBody = this.buildRequestBody(request);
      
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.handleApiError(response.status, errorText);
      }

      const data: any = await response.json();
      const latencyMs = performance.now() - startTime;

      // Ollama returns content in 'response' field
      const content = data.response || '';
      
      // Token counting: use eval_count if available, otherwise estimate
      const tokensUsed = data.eval_count || this.estimateTokens(content);

      return {
        content,
        tokensUsed,
        costUsd: 0, // Local inference is free
        latencyMs: Math.round(latencyMs),
        provider: this.providerName,
        cached: false,
      };
    } catch (error: any) {
      const latencyMs = performance.now() - startTime;

      // Handle connection errors (Ollama not running)
      if (error.cause?.code === 'ECONNREFUSED' || error.message?.includes('fetch failed')) {
        throw new ProviderError(
          this.providerName,
          'NETWORK',
          'Ollama is not running. Please start Ollama and try again.'
        );
      }

      throw new ProviderError(
        this.providerName,
        'UNKNOWN',
        `Ollama error: ${error.message}`
      );
    }
  }

  /**
   * Complete a prompt with streaming support.
   */
  async completeStream(
    request: LLMRequest,
    onChunk: (chunk: string) => void
  ): Promise<LLMResponse> {
    return streamOllamaCompletion(this.baseUrl, this.model, request, onChunk);
  }

  /**
   * Validate that Ollama is running and accessible.
   * Returns true if Ollama server responds successfully.
   */
  async validateApiKey(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Build the request body for Ollama API.
   */
  private buildRequestBody(request: LLMRequest): object {
    const body: any = {
      model: this.model,
      prompt: request.prompt,
      stream: false,
      options: {},
    };

    // Map temperature if provided
    if (request.temperature !== undefined) {
      body.options.temperature = request.temperature;
    }

    // Map maxTokens to num_predict
    if (request.maxTokens !== undefined) {
      body.options.num_predict = request.maxTokens;
    }

    return body;
  }

  /**
   * Handle Ollama-specific API errors.
   */
  private handleApiError(status: number, body: string): never {
    if (status === 404) {
      throw new ProviderError(
        this.providerName,
        'INVALID_REQUEST',
        `Model '${this.model}' not found. Please pull the model using 'ollama pull ${this.model}'.`
      );
    }

    if (status === 400) {
      throw new ProviderError(
        this.providerName,
        'INVALID_REQUEST',
        `Invalid request: ${body}`
      );
    }

    throw new ProviderError(
      this.providerName,
      'UNKNOWN',
      `Ollama API error (${status}): ${body}`
    );
  }
}
