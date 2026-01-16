import { Config, ElasticResponse } from '../types/elastic.js';

/**
 * Elasticsearch HTTP client with support for multiple authentication methods
 */
export class ElasticClient {
  private baseUrl: string;
  private headers: Record<string, string>;
  private timeout: number;
  private skipSslVerify: boolean;

  constructor(config: Config) {
    // Remove trailing slash from URL
    this.baseUrl = config.elasticUrl.replace(/\/$/, '');
    this.timeout = config.timeout;
    this.skipSslVerify = config.skipSslVerify;

    // Set up authentication headers
    this.headers = {
      'Content-Type': 'application/json',
    };

    if (config.apiKeyEncoded) {
      // Pre-encoded API key (most common for Elastic Cloud)
      this.headers['Authorization'] = `ApiKey ${config.apiKeyEncoded}`;
    } else if (config.apiKeyId && config.apiKeySecret) {
      // Separate ID and secret - need to encode
      const credentials = Buffer.from(`${config.apiKeyId}:${config.apiKeySecret}`).toString('base64');
      this.headers['Authorization'] = `ApiKey ${credentials}`;
    } else if (config.username && config.password) {
      // Basic auth fallback
      const credentials = Buffer.from(`${config.username}:${config.password}`).toString('base64');
      this.headers['Authorization'] = `Basic ${credentials}`;
    } else {
      throw new Error('No authentication credentials provided. Set ELASTIC_API_KEY_ENCODED, or ELASTIC_API_KEY_ID + ELASTIC_API_KEY_SECRET, or ELASTIC_USERNAME + ELASTIC_PASSWORD');
    }
  }

  /**
   * Make an HTTP request to Elasticsearch
   */
  async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    queryParams?: Record<string, string | number | boolean>
  ): Promise<ElasticResponse<T>> {
    let url = `${this.baseUrl}${path}`;

    // Add query parameters
    if (queryParams && Object.keys(queryParams).length > 0) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(queryParams)) {
        params.append(key, String(value));
      }
      url += `?${params.toString()}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const fetchOptions: RequestInit = {
        method,
        headers: this.headers,
        signal: controller.signal,
      };

      if (body && method !== 'GET' && method !== 'HEAD') {
        fetchOptions.body = JSON.stringify(body);
      }

      // Note: skipSslVerify would require a custom agent in Node.js
      // For production, proper certificates should be configured
      const response = await fetch(url, fetchOptions);

      clearTimeout(timeoutId);

      const responseText = await response.text();
      let responseData: unknown;

      try {
        responseData = responseText ? JSON.parse(responseText) : {};
      } catch {
        responseData = { raw: responseText };
      }

      if (!response.ok) {
        const errorData = responseData as Record<string, unknown>;
        const error = errorData.error as Record<string, unknown> | undefined;
        return {
          success: false,
          error: {
            type: (error?.type as string) || 'request_error',
            reason: (error?.reason as string) || response.statusText || 'Request failed',
            status: response.status,
          },
        };
      }

      return {
        success: true,
        data: responseData as T,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            error: {
              type: 'timeout',
              reason: `Request timed out after ${this.timeout}ms`,
            },
          };
        }

        return {
          success: false,
          error: {
            type: 'connection_error',
            reason: error.message,
          },
        };
      }

      return {
        success: false,
        error: {
          type: 'unknown_error',
          reason: 'An unknown error occurred',
        },
      };
    }
  }

  // Convenience methods
  async get<T = unknown>(path: string, queryParams?: Record<string, string | number | boolean>): Promise<ElasticResponse<T>> {
    return this.request<T>('GET', path, undefined, queryParams);
  }

  async post<T = unknown>(path: string, body?: unknown, queryParams?: Record<string, string | number | boolean>): Promise<ElasticResponse<T>> {
    return this.request<T>('POST', path, body, queryParams);
  }

  async put<T = unknown>(path: string, body?: unknown, queryParams?: Record<string, string | number | boolean>): Promise<ElasticResponse<T>> {
    return this.request<T>('PUT', path, body, queryParams);
  }

  async delete<T = unknown>(path: string, body?: unknown, queryParams?: Record<string, string | number | boolean>): Promise<ElasticResponse<T>> {
    return this.request<T>('DELETE', path, body, queryParams);
  }

  /**
   * Test connection to Elasticsearch
   */
  async ping(): Promise<boolean> {
    const response = await this.get('/');
    return response.success;
  }

  /**
   * Get cluster info
   */
  async info(): Promise<ElasticResponse<Record<string, unknown>>> {
    return this.get('/');
  }
}

/**
 * Create ElasticClient from environment variables
 */
export function createClientFromEnv(): ElasticClient {
  const elasticUrl = process.env.ELASTIC_URL;
  if (!elasticUrl) {
    throw new Error('ELASTIC_URL environment variable is required');
  }

  return new ElasticClient({
    elasticUrl,
    apiKeyEncoded: process.env.ELASTIC_API_KEY_ENCODED,
    apiKeyId: process.env.ELASTIC_API_KEY_ID,
    apiKeySecret: process.env.ELASTIC_API_KEY_SECRET,
    username: process.env.ELASTIC_USERNAME,
    password: process.env.ELASTIC_PASSWORD,
    skipSslVerify: process.env.ELASTIC_SKIP_SSL_VERIFY === 'true',
    timeout: parseInt(process.env.ELASTIC_TIMEOUT || '30000', 10),
  });
}
