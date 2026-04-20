/**
 * Unit tests for OpenAIProvider
 * All API calls are mocked - no real network requests
 */

import { OpenAIProvider } from '../llm/providers/openAIProvider';
import { LLMRequest, TaskComplexity, LLMProvider } from '../llm/types';
import { ProviderError } from '../llm/providers/providerInterface';

// Mock global fetch
global.fetch = jest.fn();

describe('OpenAIProvider - configuration', () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    provider = new OpenAIProvider();
    (global.fetch as jest.Mock).mockClear();
  });

  test('should not be configured without API key', () => {
    expect(provider.isConfigured()).toBe(false);
  });

  test('should be configured after setting API key', () => {
    provider.setApiKey('sk-test123');
    expect(provider.isConfigured()).toBe(true);
  });

  test('should clear API key on clearApiKey()', () => {
    provider.setApiKey('sk-test123');
    expect(provider.isConfigured()).toBe(true);
    provider.clearApiKey();
    expect(provider.isConfigured()).toBe(false);
  });
});

describe('OpenAIProvider - complete()', () => {
  let provider: OpenAIProvider;
  const mockRequest: LLMRequest = {
    prompt: 'Test prompt',
    taskType: 'code',
    complexity: TaskComplexity.SIMPLE,
    maxTokens: 100,
    temperature: 0.7
  };

  beforeEach(() => {
    provider = new OpenAIProvider();
    provider.setApiKey('sk-test123');
    (global.fetch as jest.Mock).mockClear();
  });

  test('should send POST to /chat/completions with correct headers', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Test response' } }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
      })
    });

    await provider.complete(mockRequest);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Authorization': 'Bearer sk-test123'
        })
      })
    );
  });

  test('should include model in request body', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Test' } }],
        usage: { total_tokens: 30 }
      })
    });

    await provider.complete(mockRequest);

    const callArgs = (global.fetch as jest.Mock).mock.calls[0][1];
    const body = JSON.parse(callArgs.body);
    expect(body.model).toBe('gpt-4o-mini');
  });

  test('should include messages array with user prompt', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Test' } }],
        usage: { total_tokens: 30 }
      })
    });

    await provider.complete(mockRequest);

    const callArgs = (global.fetch as jest.Mock).mock.calls[0][1];
    const body = JSON.parse(callArgs.body);
    expect(body.messages).toEqual([
      { role: 'user', content: 'Test prompt' }
    ]);
  });

  test('should parse response and return LLMResponse', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'AI response' } }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
      })
    });

    const response = await provider.complete(mockRequest);

    expect(response.content).toBe('AI response');
    expect(response.provider).toBe(LLMProvider.OPENAI);
  });

  test('should include token counts from usage field', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Test' } }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
      })
    });

    const response = await provider.complete(mockRequest);

    expect(response.tokensUsed).toBe(30);
  });

  test('should include latency measurement', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Test' } }],
        usage: { total_tokens: 30 }
      })
    });

    const response = await provider.complete(mockRequest);

    expect(response.latencyMs).toBeGreaterThanOrEqual(0);
    expect(typeof response.latencyMs).toBe('number');
  });
});

describe('OpenAIProvider - error handling', () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    provider = new OpenAIProvider();
    provider.setApiKey('sk-test123');
    (global.fetch as jest.Mock).mockClear();
  });

  test('should throw ProviderError with AUTH code on 401', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized'
    });

    await expect(provider.complete({
      prompt: 'test',
      taskType: 'code',
      complexity: TaskComplexity.SIMPLE
    })).rejects.toThrow(ProviderError);

    await expect(provider.complete({
      prompt: 'test',
      taskType: 'code',
      complexity: TaskComplexity.SIMPLE
    })).rejects.toMatchObject({
      provider: LLMProvider.OPENAI,
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
      provider: LLMProvider.OPENAI,
      code: 'RATE_LIMIT'
    });
  });

  test('should throw ProviderError with NETWORK code on fetch rejection', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network failure'));

    await expect(provider.complete({
      prompt: 'test',
      taskType: 'code',
      complexity: TaskComplexity.SIMPLE
    })).rejects.toMatchObject({
      provider: LLMProvider.OPENAI,
      code: 'NETWORK'
    });
  });

  test('should throw ProviderError with UNKNOWN code on unexpected error', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'Service unavailable'
    });

    await expect(provider.complete({
      prompt: 'test',
      taskType: 'code',
      complexity: TaskComplexity.SIMPLE
    })).rejects.toMatchObject({
      provider: LLMProvider.OPENAI,
      code: 'NETWORK'
    });
  });
});

describe('OpenAIProvider - validateApiKey()', () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    provider = new OpenAIProvider();
    (global.fetch as jest.Mock).mockClear();
  });

  test('should return true for valid key response', async () => {
    provider.setApiKey('sk-valid');
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true
    });

    const result = await provider.validateApiKey();

    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/models',
      expect.objectContaining({
        method: 'GET'
      })
    );
  });

  test('should return false for 401 response', async () => {
    provider.setApiKey('sk-invalid');
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401
    });

    const result = await provider.validateApiKey();

    expect(result).toBe(false);
  });
});
