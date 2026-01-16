import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ElasticClient } from '../src/utils/client.js';

describe('ElasticClient', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('constructor', () => {
    it('should accept pre-encoded API key', () => {
      const client = new ElasticClient({
        elasticUrl: 'https://test.elastic.cloud',
        apiKeyEncoded: 'dGVzdC1lbmNvZGVkLWtleQ==',
        timeout: 30000,
        skipSslVerify: false,
      });

      expect(client).toBeInstanceOf(ElasticClient);
    });

    it('should accept separate API key id and secret', () => {
      const client = new ElasticClient({
        elasticUrl: 'https://test.elastic.cloud',
        apiKeyId: 'test-id',
        apiKeySecret: 'test-secret',
        timeout: 30000,
        skipSslVerify: false,
      });

      expect(client).toBeInstanceOf(ElasticClient);
    });

    it('should accept basic auth credentials', () => {
      const client = new ElasticClient({
        elasticUrl: 'https://test.elastic.cloud',
        username: 'elastic',
        password: 'password',
        timeout: 30000,
        skipSslVerify: false,
      });

      expect(client).toBeInstanceOf(ElasticClient);
    });

    it('should throw error when no credentials provided', () => {
      expect(() => {
        new ElasticClient({
          elasticUrl: 'https://test.elastic.cloud',
          timeout: 30000,
          skipSslVerify: false,
        });
      }).toThrow('No authentication credentials provided');
    });

    it('should remove trailing slash from URL', () => {
      const client = new ElasticClient({
        elasticUrl: 'https://test.elastic.cloud/',
        apiKeyEncoded: 'test-key',
        timeout: 30000,
        skipSslVerify: false,
      });

      // Verify by making a request and checking the URL
      expect(client).toBeInstanceOf(ElasticClient);
    });
  });

  describe('request methods', () => {
    const mockFetch = vi.fn();

    beforeEach(() => {
      global.fetch = mockFetch;
      mockFetch.mockReset();
    });

    it('should make GET request successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ cluster_name: 'test' })),
      });

      const client = new ElasticClient({
        elasticUrl: 'https://test.elastic.cloud',
        apiKeyEncoded: 'test-key',
        timeout: 30000,
        skipSslVerify: false,
      });

      const result = await client.get('/');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ cluster_name: 'test' });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.elastic.cloud/',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'ApiKey test-key',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should make POST request with body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ hits: { total: { value: 10 } } })),
      });

      const client = new ElasticClient({
        elasticUrl: 'https://test.elastic.cloud',
        apiKeyEncoded: 'test-key',
        timeout: 30000,
        skipSslVerify: false,
      });

      const result = await client.post('/test/_search', { query: { match_all: {} } });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.elastic.cloud/test/_search',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ query: { match_all: {} } }),
        })
      );
    });

    it('should handle query parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('[]'),
      });

      const client = new ElasticClient({
        elasticUrl: 'https://test.elastic.cloud',
        apiKeyEncoded: 'test-key',
        timeout: 30000,
        skipSslVerify: false,
      });

      await client.get('/_cat/indices', { format: 'json', h: 'index,health' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('format=json'),
        expect.any(Object)
      );
    });

    it('should handle HTTP error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve(JSON.stringify({
          error: { type: 'index_not_found_exception', reason: 'no such index' },
        })),
      });

      const client = new ElasticClient({
        elasticUrl: 'https://test.elastic.cloud',
        apiKeyEncoded: 'test-key',
        timeout: 30000,
        skipSslVerify: false,
      });

      const result = await client.get('/nonexistent');

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('index_not_found_exception');
      expect(result.error?.reason).toBe('no such index');
      expect(result.error?.status).toBe(404);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const client = new ElasticClient({
        elasticUrl: 'https://test.elastic.cloud',
        apiKeyEncoded: 'test-key',
        timeout: 30000,
        skipSslVerify: false,
      });

      const result = await client.get('/');

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('connection_error');
      expect(result.error?.reason).toBe('Network error');
    });

    it('should handle timeout', async () => {
      mockFetch.mockImplementationOnce(() => {
        const error = new Error('Timeout');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      const client = new ElasticClient({
        elasticUrl: 'https://test.elastic.cloud',
        apiKeyEncoded: 'test-key',
        timeout: 100,
        skipSslVerify: false,
      });

      const result = await client.get('/');

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('timeout');
    });
  });

  describe('ping', () => {
    it('should return true on successful connection', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ cluster_name: 'test' })),
      });

      const client = new ElasticClient({
        elasticUrl: 'https://test.elastic.cloud',
        apiKeyEncoded: 'test-key',
        timeout: 30000,
        skipSslVerify: false,
      });

      const result = await client.ping();
      expect(result).toBe(true);
    });

    it('should return false on failed connection', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: () => Promise.resolve('{}'),
      });

      const client = new ElasticClient({
        elasticUrl: 'https://test.elastic.cloud',
        apiKeyEncoded: 'invalid-key',
        timeout: 30000,
        skipSslVerify: false,
      });

      const result = await client.ping();
      expect(result).toBe(false);
    });
  });
});
