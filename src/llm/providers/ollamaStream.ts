/**
 * Ollama Streaming Support for Holy Quest AI
 * Handles newline-delimited JSON streaming from Ollama
 */

import { LLMRequest, LLMResponse, LLMProvider } from '../types';
import { ProviderError } from './providerInterface';

/**
 * Stream a completion from Ollama with real-time chunk callbacks.
 * Ollama uses newline-delimited JSON (not SSE).
 */
export async function streamOllamaCompletion(
  baseUrl: string,
  model: string,
  request: LLMRequest,
  onChunk: (chunk: string) => void
): Promise<LLMResponse> {
  const startTime = performance.now();

  try {
    const requestBody = buildStreamRequestBody(model, request);

    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ProviderError(
        LLMProvider.OLLAMA,
        'UNKNOWN',
        `Ollama streaming error (${response.status}): ${errorText}`
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new ProviderError(
        LLMProvider.OLLAMA,
        'UNKNOWN',
        'Response body is not readable'
      );
    }

    const decoder = new TextDecoder();
    let fullText = '';
    let tokensUsed = 0;
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;

      // Decode chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });

      // Process complete lines (newline-delimited JSON)
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const data = JSON.parse(line);

          // Extract chunk content
          if (data.response) {
            fullText += data.response;
            onChunk(data.response);
          }

          // Check if streaming is complete
          if (data.done) {
            tokensUsed = data.eval_count || 0;
          }
        } catch (parseError) {
          // Skip malformed JSON lines
          console.warn('Failed to parse Ollama stream line:', line);
        }
      }
    }

    const latencyMs = performance.now() - startTime;

    return {
      content: fullText,
      tokensUsed: tokensUsed || Math.ceil(fullText.length / 4),
      costUsd: 0, // Local inference is free
      latencyMs: Math.round(latencyMs),
      provider: LLMProvider.OLLAMA,
      cached: false,
    };
  } catch (error: any) {
    const latencyMs = performance.now() - startTime;

    if (error instanceof ProviderError) {
      throw error;
    }

    if (error.cause?.code === 'ECONNREFUSED' || error.message?.includes('fetch failed')) {
      throw new ProviderError(
        LLMProvider.OLLAMA,
        'NETWORK',
        'Ollama is not running. Please start Ollama and try again.'
      );
    }

    throw new ProviderError(
      LLMProvider.OLLAMA,
      'UNKNOWN',
      `Ollama streaming error: ${error.message}`
    );
  }
}

/**
 * Build request body for streaming
 */
function buildStreamRequestBody(model: string, request: LLMRequest): object {
  const body: any = {
    model,
    prompt: request.prompt,
    stream: true,
    options: {},
  };

  if (request.temperature !== undefined) {
    body.options.temperature = request.temperature;
  }

  if (request.maxTokens !== undefined) {
    body.options.num_predict = request.maxTokens;
  }

  return body;
}
