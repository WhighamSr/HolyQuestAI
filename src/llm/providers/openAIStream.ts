/**
 * OpenAI Streaming Handler for Holy Quest AI
 * Handles Server-Sent Events (SSE) streaming from OpenAI API
 */

import { LLMProvider, LLMRequest, LLMResponse } from '../types';
import { ProviderError } from './providerInterface';

/**
 * Stream a completion from OpenAI using Server-Sent Events
 */
export async function streamOpenAICompletion(
  apiKey: string,
  model: string,
  baseUrl: string,
  request: LLMRequest,
  onChunk: (chunk: string) => void
): Promise<LLMResponse> {
  const startTime = performance.now();
  
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: request.prompt
          }
        ],
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 2000,
        stream: true
      })
    });
    
    if (!response.ok) {
      const errorBody = await response.text();
      throw new ProviderError(
        LLMProvider.OPENAI,
        response.status === 401 ? 'AUTH' :
        response.status === 429 ? 'RATE_LIMIT' :
        response.status === 400 ? 'INVALID_REQUEST' :
        response.status >= 500 ? 'NETWORK' : 'UNKNOWN',
        `OpenAI streaming error (${response.status}): ${errorBody}`
      );
    }
    
    const reader = response.body?.getReader();
    if (!reader) {
      throw new ProviderError(LLMProvider.OPENAI, 'NETWORK', 'No response body');
    }
    
    const decoder = new TextDecoder();
    let fullContent = '';
    let totalTokens = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim() !== '');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          if (data === '[DONE]') {
            continue;
          }
          
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            
            if (delta) {
              fullContent += delta;
              onChunk(delta);
            }
            
            // Capture token usage if provided in final chunk
            if (parsed.usage) {
              promptTokens = parsed.usage.prompt_tokens || 0;
              completionTokens = parsed.usage.completion_tokens || 0;
              totalTokens = parsed.usage.total_tokens || 0;
            }
          } catch (parseError) {
            // Skip invalid JSON lines
            continue;
          }
        }
      }
    }
    
    const endTime = performance.now();
    
    // If no usage data from stream, estimate tokens
    if (totalTokens === 0) {
      promptTokens = Math.ceil(request.prompt.length / 4);
      completionTokens = Math.ceil(fullContent.length / 4);
      totalTokens = promptTokens + completionTokens;
    }
    
    return {
      content: fullContent,
      provider: LLMProvider.OPENAI,
      tokensUsed: totalTokens,
      costUsd: calculateStreamCost(promptTokens, completionTokens),
      latencyMs: Math.round(endTime - startTime),
      cached: false
    };
  } catch (error) {
    if (error instanceof ProviderError) {
      throw error;
    }
    throw new ProviderError(LLMProvider.OPENAI, 'NETWORK', `Streaming error: ${error}`);
  }
}

/**
 * Calculate cost for streaming response
 */
function calculateStreamCost(promptTokens: number, completionTokens: number): number {
  const inputCost = promptTokens * 0.15 / 1_000_000;
  const outputCost = completionTokens * 0.60 / 1_000_000;
  return inputCost + outputCost;
}
