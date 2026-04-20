/**
 * Unit tests for OllamaProvider and OllamaModelManager
 */

import { OllamaProvider } from '../llm/providers/ollamaProvider';
import { OllamaModelManager } from '../llm/providers/ollamaModelManager';
import { LLMRequest, TaskComplexity, LLMProvider } from '../llm/types';
import { ProviderError } from '../llm/providers/providerInterface';

// Mock global fetch
global.fetch = jest.fn();

describe('OllamaProvider - configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should always be configured (no API key required)', () => {
    const provider = new OllamaProvider();
    expect(provider.isConfigured()).toBe(true);
  });

  it('setApiKey should be a no-op (does not throw)', () => {
    const provider = new OllamaProvider();
    expect(() => provider.setApiKey('dummy-key')).not.toThrow();
  });

  it('should have requiresApiKey set to false', () => {
    const provider = new OllamaProvider();
    expect(provider.requiresApiKey).toBe(false);
  });
});

describe('OllamaProvider - complete()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should POST to /api/generate endpoint', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: 'Test response', eval_count: 50 }),
    } as Response);

    const provider = new OllamaProvider();
    const request: LLMRequest = {
      prompt: 'Test prompt',
      taskType: 'test',
      complexity: TaskComplexity.SIMPLE,
    };

    await provider.complete(request);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/generate',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('should include model and prompt in request body', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: 'Test', eval_count: 10 }),
    } as Response);

    const provider = new OllamaProvider('mistral');
    const request: LLMRequest = {
      prompt: 'Hello world',
      taskType: 'test',
      complexity: TaskComplexity.TRIVIAL,
    };

    await provider.complete(request);

    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1]?.body as string);
    expect(body.model).toBe('mistral');
    expect(body.prompt).toBe('Hello world');
  });

  it('should include stream: false by default', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: 'Test', eval_count: 10 }),
    } as Response);

    const provider = new OllamaProvider();
    const request: LLMRequest = {
      prompt: 'Test',
      taskType: 'test',
      complexity: TaskComplexity.SIMPLE,
    };

    await provider.complete(request);

    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(body.stream).toBe(false);
  });

  it('should parse response.response field', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: 'Ollama response text', eval_count: 25 }),
    } as Response);

    const provider = new OllamaProvider();
    const request: LLMRequest = {
      prompt: 'Test',
      taskType: 'test',
      complexity: TaskComplexity.SIMPLE,
    };

    const result = await provider.complete(request);
    expect(result.content).toBe('Ollama response text');
  });

  it('should return cost of 0 (free local inference)', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: 'Test', eval_count: 10 }),
    } as Response);

    const provider = new OllamaProvider();
    const request: LLMRequest = {
      prompt: 'Test',
      taskType: 'test',
      complexity: TaskComplexity.SIMPLE,
    };

    const result = await provider.complete(request);
    expect(result.costUsd).toBe(0);
  });

  it('should extract eval_count for token counting', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: 'Test', eval_count: 42 }),
    } as Response);

    const provider = new OllamaProvider();
    const request: LLMRequest = {
      prompt: 'Test',
      taskType: 'test',
      complexity: TaskComplexity.SIMPLE,
    };

    const result = await provider.complete(request);
    expect(result.tokensUsed).toBe(42);
  });

  it('should include latency measurement', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: 'Test', eval_count: 10 }),
    } as Response);

    const provider = new OllamaProvider();
    const request: LLMRequest = {
      prompt: 'Test',
      taskType: 'test',
      complexity: TaskComplexity.SIMPLE,
    };

    const result = await provider.complete(request);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.latencyMs).toBe('number');
  });
});

describe('OllamaProvider - error handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw NETWORK error on connection refused', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    const error: any = new Error('fetch failed');
    error.cause = { code: 'ECONNREFUSED' };
    mockFetch.mockRejectedValue(error);

    const provider = new OllamaProvider();
    const request: LLMRequest = {
      prompt: 'Test',
      taskType: 'test',
      complexity: TaskComplexity.SIMPLE,
    };

    await expect(provider.complete(request)).rejects.toThrow(ProviderError);
    await expect(provider.complete(request)).rejects.toThrow('Ollama is not running');
  });

  it('should throw INVALID_REQUEST on 404 model not found', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => 'Model not found',
    } as Response);

    const provider = new OllamaProvider('nonexistent-model');
    const request: LLMRequest = {
      prompt: 'Test',
      taskType: 'test',
      complexity: TaskComplexity.SIMPLE,
    };

    await expect(provider.complete(request)).rejects.toThrow(ProviderError);
  });

  it('should throw UNKNOWN on unexpected error', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockRejectedValueOnce(new Error('Unexpected error'));

    const provider = new OllamaProvider();
    const request: LLMRequest = {
      prompt: 'Test',
      taskType: 'test',
      complexity: TaskComplexity.SIMPLE,
    };

    await expect(provider.complete(request)).rejects.toThrow(ProviderError);
  });
});

describe('OllamaProvider - validateApiKey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return true when /api/tags returns 200', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
    } as Response);

    const provider = new OllamaProvider();
    const isValid = await provider.validateApiKey();
    expect(isValid).toBe(true);
  });

  it('should return false when fetch rejects', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockRejectedValueOnce(new Error('Connection failed'));

    const provider = new OllamaProvider();
    const isValid = await provider.validateApiKey();
    expect(isValid).toBe(false);
  });
});

describe('OllamaModelManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('listModels should GET /api/tags and parse models array', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        models: [
          { name: 'llama3.1', size: 4_000_000_000, digest: 'abc123', modified_at: new Date().toISOString() },
        ],
      }),
    } as Response);

    const manager = new OllamaModelManager();
    const models = await manager.listModels();

    expect(models).toHaveLength(1);
    expect(models[0].name).toBe('llama3.1');
  });

  it('modelExists should return true for installed model', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        models: [{ name: 'llama3.1', size: 4_000_000_000, digest: 'abc', modified_at: new Date().toISOString() }],
      }),
    } as Response);

    const manager = new OllamaModelManager();
    const exists = await manager.modelExists('llama3.1');
    expect(exists).toBe(true);
  });

  it('modelExists should return false for missing model', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [] }),
    } as Response);

    const manager = new OllamaModelManager();
    const exists = await manager.modelExists('nonexistent');
    expect(exists).toBe(false);
  });

  it('getRecommendedModels should return non-empty list', () => {
    const manager = new OllamaModelManager();
    const recommended = manager.getRecommendedModels();
    expect(recommended.length).toBeGreaterThan(0);
    expect(recommended).toContain('llama3.1');
  });
});
