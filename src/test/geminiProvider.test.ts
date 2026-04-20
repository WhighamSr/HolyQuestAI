/**
 * Unit tests for GeminiProvider
 * All API calls are mocked - no real network requests
 */

import { GeminiProvider } from '../llm/providers/geminiProvider';
import { LLMRequest, TaskComplexity, LLMProvider } from '../llm/types';
import { ProviderError } from '../llm/providers/providerInterface';

// Mock global fetch
global.fetch = jest.fn();

describe('GeminiProvider - configuration', () => {
  let provider: GeminiProvider;

  beforeEach(() => {
    provider = new GeminiProvider();
    (global.fetch as jest.Mock).mockClear();
  });

  test('should not be configured without API key', () => {
    expect(provider.isConfigured()).toBe(false);
  });

  test('should be configured after setting API key', () => {
    provider.setApiKey('AIza-test123');
    expect(provider.isConfigured()).toBe(true);
  });

  test('should clear API key on clearApiKey()', () => {
    provider.setApiKey('AIza-test123');
    expect(provider.isConfigured()).toBe(true);
    provider.clearApiKey();
    expect(provider.isConfigured()).toBe(false);
  });
});

describe('GeminiProvider - complete()', () => {
  let provider: GeminiProvider;
  const mockRequest: LLMRequest = {
    prompt: 'Test prompt',
    taskType: 'code',
    complexity: TaskComplexity.SIMPLE,
    maxTokens: 100,
    temperature: 0.7
  };

  beforeEach(() => {
    provider = new GeminiProvider();
    provider.setApiKey('AIza-test123');
    (global.fetch as jest.Mock).mockClear();
  });

  test('should send POST to generateContent endpoint', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Test response' }] } }],
        usageMetadata: { totalTokenCount: 30 }
      })
    });

    await provider.complete(mockRequest);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('models/gemini-1.5-flash:generateContent'),
      expect.objectContaining({
        method: 'POST'
      })
    );
  });

  test('should include API key as query parameter', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Test' }] } }],
        usageMetadata: { totalTokenCount: 30 }
      })
    });

    await provider.complete(mockRequest);

    const url = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(url).toContain('key=AIza-test123');
  });

  test('should include contents array with user prompt', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Test' }] } }],
        usageMetadata: { totalTokenCount: 30 }
      })
    });

    await provider.complete(mockRequest);

    const callArgs = (global.fetch as jest.Mock).mock.calls[0][1];
    const body = JSON.parse(callArgs.body);
    expect(body.contents[0].parts[0].text).toBe('Test prompt');
  });

  test('should parse Gemini response format correctly', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Gemini response' }] } }],
        usageMetadata: { totalTokenCount: 30 }
      })
    });

    const response = await provider.complete(mockRequest);

    expect(response.content).toBe('Gemini response');
    expect(response.provider).toBe(LLMProvider.GEMINI);
  });

  test('should include token counts from usageMetadata', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Test' }] } }],
        usageMetadata: { totalTokenCount: 45 }
      })
    });

    const response = await provider.complete(mockRequest);

    expect(response.tokensUsed).toBe(45);
  });

  test('should include latency measurement', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Test' }] } }],
        usageMetadata: { totalTokenCount: 30 }
      })
    });

    const response = await provider.complete(mockRequest);

    expect(response.latencyMs).toBeGreaterThanOrEqual(0);
    expect(typeof response.latencyMs).toBe('number');
  });
});

describe('GeminiProvider - error handling', () => {
  let provider: GeminiProvider;

  beforeEach(() => {
    provider = new GeminiProvider();
    provider.setApiKey('AIza-test123');
    (global.fetch as jest.Mock).mockClear();
  });

  test('should throw ProviderError with AUTH code on 403', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden'
    });

    await expect(provider.complete({
      prompt: 'test',
      taskType: 'code',
      complexity: TaskComplexity.SIMPLE
    })).rejects.toMatchObject({
      provider: LLMProvider.GEMINI,
      code: 'AUTH'
    });
  });

  test('should throw ProviderError with RATE_LIMIT code on 429', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded'
    });

    await expect(provider.complete({
      prompt: 'test',
      taskType: 'code',
      complexity: TaskComplexity.SIMPLE
    })).rejects.toMatchObject({
      provider: LLMProvider.GEMINI,
      code: 'RATE_LIMIT'
    });
  });

  test('should throw ProviderError with INVALID_REQUEST code on 400', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'Invalid request'
    });

    await expect(provider.complete({
      prompt: 'test',
      taskType: 'code',
      complexity: TaskComplexity.SIMPLE
    })).rejects.toMatchObject({
      provider: LLMProvider.GEMINI,
      code: 'INVALID_REQUEST'
    });
  });

  test('should throw ProviderError with NETWORK code on fetch rejection', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network failure'));

    await expect(provider.complete({
      prompt: 'test',
      taskType: 'code',
      complexity: TaskComplexity.SIMPLE
    })).rejects.toMatchObject({
      provider: LLMProvider.GEMINI,
      code: 'NETWORK'
    });
  });
});

describe('GeminiProvider - validateApiKey()', () => {
  let provider: GeminiProvider;

  beforeEach(() => {
    provider = new GeminiProvider();
    (global.fetch as jest.Mock).mockClear();
  });

  test('should return true for valid key response', async () => {
    provider.setApiKey('AIza-valid');
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true
    });

    const result = await provider.validateApiKey();

    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('models/gemini-1.5-flash'),
      expect.objectContaining({
        method: 'GET'
      })
    );
  });

  test('should return false for 403 response', async () => {
    provider.setApiKey('AIza-invalid');
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403
    });

    const result = await provider.validateApiKey();

    expect(result).toBe(false);
  });
});
