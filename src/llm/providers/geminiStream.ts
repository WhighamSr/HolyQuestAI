/**
 * Gemini Streaming Handler for Holy Quest AI
 * Handles Server-Sent Events (SSE) streaming from Gemini API
 */

import { LLMProvider, LLMRequest, LLMResponse } from '../types';
import { ProviderError } from './providerInterface';

/**
 * Stream a completion from Gemini using Server-Sent Events
 */
export async function streamGeminiCompletion(
  apiKey: string,
  model: string,
  baseUrl: string,
  request: LLMRequest,
  onChunk: (chunk: string) => void
): Promise<LLMResponse> {
  const startTime = performance.now();
  
  try {
    const url = `${baseUrl}/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
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
      })
    });
    
    if (!response.ok) {
      const errorBody = await response.text();
      throw new ProviderError(
        LLMProvider.GEMINI,
        response.status === 403 ? 'AUTH' :
        response.status === 429 ? 'RATE_LIMIT' :
        response.status === 400 ? 'INVALID_REQUEST' :
        response.status >= 500 ? 'NETWORK' : 'UNKNOWN',
        `Gemini streaming error (${response.status}): ${errorBody}`
      );
    }
    
    const reader = response.body?.getReader();
    if (!reader) {
      throw new ProviderError(LLMProvider.GEMINI, 'NETWORK', 'No response body');
    }
    
    const decoder = new TextDecoder();
    let fullContent = '';
    let totalTokens = 0;
    let promptTokens = 0;
    let candidatesTokens = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim() !== '');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          try {
            const parsed = JSON.parse(data);
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (text) {
              fullContent += text;
              onChunk(text);
            }
            
            // Capture token usage if provided
            if (parsed.usageMetadata) {
              promptTokens = parsed.usageMetadata.promptTokenCount || 0;
              candidatesTokens = parsed.usageMetadata.candidatesTokenCount || 0;
              totalTokens = parsed.usageMetadata.totalTokenCount || 0;
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
      candidatesTokens = Math.ceil(fullContent.length / 4);
      totalTokens = promptTokens + candidatesTokens;
    }
    
    return {
      content: fullContent,
      provider: LLMProvider.GEMINI,
      tokensUsed: totalTokens,
      costUsd: calculateStreamCost(promptTokens, candidatesTokens),
      latencyMs: Math.round(endTime - startTime),
      cached: false
    };
  } catch (error) {
    if (error instanceof ProviderError) {
      throw error;
    }
    throw new ProviderError(LLMProvider.GEMINI, 'NETWORK', `Streaming error: ${error}`);
  }
}

/**
 * Calculate cost for streaming response
 */
function calculateStreamCost(promptTokens: number, candidatesTokens: number): number {
  const inputCost = promptTokens * 0.075 / 1_000_000;
  const outputCost = candidatesTokens * 0.30 / 1_000_000;
  return inputCost + outputCost;
}
