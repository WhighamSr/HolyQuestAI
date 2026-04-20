/**
 * Unit tests for OllamaDetector
 */

import { OllamaDetector, OllamaStatus } from '../onboarding/ollamaDetector';

// Mock global fetch
global.fetch = jest.fn();

describe('OllamaDetector - detectStatus()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return RUNNING when /api/version returns 200', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ version: '0.1.0' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [] }),
      } as Response);

    const detector = new OllamaDetector();
    const result = await detector.detectStatus();

    expect(result.status).toBe(OllamaStatus.RUNNING);
  });

  it('should include version when available', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ version: '0.1.5' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [] }),
      } as Response);

    const detector = new OllamaDetector();
    const result = await detector.detectStatus();

    expect(result.version).toBe('0.1.5');
  });

  it('should include modelCount when /api/tags responds', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ version: '0.1.0' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [
            { name: 'llama3.1' },
            { name: 'mistral' },
          ],
        }),
      } as Response);

    const detector = new OllamaDetector();
    const result = await detector.detectStatus();

    expect(result.modelCount).toBe(2);
  });

  it('should return UNKNOWN on connection refused', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

    const detector = new OllamaDetector();
    const result = await detector.detectStatus();

    expect(result.status).toBe(OllamaStatus.UNKNOWN);
  });

  it('should return UNKNOWN on fetch rejection', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const detector = new OllamaDetector();
    const result = await detector.detectStatus();

    expect(result.status).toBe(OllamaStatus.UNKNOWN);
    expect(result.suggestedAction).toContain('Install Ollama');
  });

  it('should include install URL in UNKNOWN status', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockRejectedValueOnce(new Error('Connection failed'));

    const detector = new OllamaDetector();
    const result = await detector.detectStatus();

    expect(result.installUrl).toBeDefined();
    expect(result.installUrl).toContain('ollama.com');
  });
});

describe('OllamaDetector - isRunning()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return true for RUNNING status', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ version: '0.1.0' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [] }),
      } as Response);

    const detector = new OllamaDetector();
    const isRunning = await detector.isRunning();

    expect(isRunning).toBe(true);
  });

  it('should return false for UNKNOWN status', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockRejectedValueOnce(new Error('Connection failed'));

    const detector = new OllamaDetector();
    const isRunning = await detector.isRunning();

    expect(isRunning).toBe(false);
  });
});

describe('OllamaDetector - getInstallUrl()', () => {
  it('should return Windows URL for win32 platform', () => {
    const detector = new OllamaDetector();
    const url = detector.getInstallUrl('win32');
    expect(url).toBe('https://ollama.com/download/windows');
  });

  it('should return Mac URL for darwin platform', () => {
    const detector = new OllamaDetector();
    const url = detector.getInstallUrl('darwin');
    expect(url).toBe('https://ollama.com/download/mac');
  });

  it('should return Linux URL for linux platform', () => {
    const detector = new OllamaDetector();
    const url = detector.getInstallUrl('linux');
    expect(url).toBe('https://ollama.com/download/linux');
  });

  it('should return generic URL for unknown platform', () => {
    const detector = new OllamaDetector();
    const url = detector.getInstallUrl('unknown' as NodeJS.Platform);
    expect(url).toBe('https://ollama.com');
  });
});

describe('OllamaDetector - getVersion()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return version string when available', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: '0.2.0' }),
    } as Response);

    const detector = new OllamaDetector();
    const version = await detector.getVersion();

    expect(version).toBe('0.2.0');
  });

  it('should return undefined on error', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockRejectedValueOnce(new Error('Failed'));

    const detector = new OllamaDetector();
    const version = await detector.getVersion();

    expect(version).toBeUndefined();
  });
});
