import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ElasticClient } from '../src/utils/client.js';
import { createSearchTools } from '../src/tools/search.js';
import { createSecurityTools } from '../src/tools/security.js';
import { createIndexTools } from '../src/tools/indices.js';
import { createClusterTools } from '../src/tools/cluster.js';

// Mock client factory
function createMockClient(mockResponses: Record<string, unknown> = {}) {
  const mockFetch = vi.fn();

  // Setup default responses
  mockFetch.mockImplementation((url: string) => {
    const path = new URL(url).pathname;
    const response = mockResponses[path];

    if (response) {
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(response)),
      });
    }

    return Promise.resolve({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: () => Promise.resolve(JSON.stringify({
        error: { type: 'not_found', reason: 'Resource not found' },
      })),
    });
  });

  global.fetch = mockFetch;

  return {
    client: new ElasticClient({
      elasticUrl: 'https://test.elastic.cloud',
      apiKeyEncoded: 'test-key',
      timeout: 30000,
      skipSslVerify: false,
    }),
    mockFetch,
  };
}

describe('Search Tools', () => {
  describe('search', () => {
    it('should execute search query successfully', async () => {
      const { client } = createMockClient({
        '/logs-*/_search': {
          took: 5,
          timed_out: false,
          hits: {
            total: { value: 100, relation: 'eq' },
            max_score: 1.0,
            hits: [
              { _index: 'logs-2024', _id: '1', _score: 1.0, _source: { message: 'test' } },
            ],
          },
        },
      });

      const tools = createSearchTools(client);
      const result = await tools.search.handler({
        index: 'logs-*',
        query: { match_all: {} },
        size: 10,
        from: 0,
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.summary).toContain('Found 100 results');
      expect(data.hits).toHaveLength(1);
    });

    it('should handle search errors', async () => {
      const { client, mockFetch } = createMockClient({});

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve(JSON.stringify({
          error: { type: 'parsing_exception', reason: 'Invalid query' },
        })),
      });

      const tools = createSearchTools(client);
      const result = await tools.search.handler({
        index: 'logs-*',
        query: { invalid: 'query' },
        size: 10,
        from: 0,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Search failed');
    });
  });

  describe('count', () => {
    it('should return document count', async () => {
      const { client } = createMockClient({
        '/logs-*/_count': { count: 12345 },
      });

      const tools = createSearchTools(client);
      const result = await tools.count.handler({ index: 'logs-*' });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('12345');
    });
  });

  describe('get_document', () => {
    it('should retrieve document by ID', async () => {
      const { client } = createMockClient({
        '/logs/_doc/abc123': {
          _index: 'logs',
          _id: 'abc123',
          _source: { message: 'test document', timestamp: '2024-01-01' },
        },
      });

      const tools = createSearchTools(client);
      const result = await tools.get_document.handler({
        index: 'logs',
        id: 'abc123',
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data._id).toBe('abc123');
    });
  });
});

describe('Security Tools', () => {
  describe('list_users', () => {
    it('should list all users', async () => {
      const { client } = createMockClient({
        '/_security/user': {
          elastic: { username: 'elastic', roles: ['superuser'], enabled: true },
          kibana: { username: 'kibana', roles: ['kibana_system'], enabled: true },
        },
      });

      const tools = createSecurityTools(client);
      const result = await tools.list_users.handler({});

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBe(2);
      expect(data.users).toHaveLength(2);
    });
  });

  describe('get_user', () => {
    it('should get user details', async () => {
      const { client } = createMockClient({
        '/_security/user/testuser': {
          testuser: { username: 'testuser', roles: ['viewer'], enabled: true },
        },
      });

      const tools = createSecurityTools(client);
      const result = await tools.get_user.handler({ username: 'testuser' });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.testuser).toBeDefined();
    });
  });

  describe('list_roles', () => {
    it('should list all roles', async () => {
      const { client } = createMockClient({
        '/_security/role': {
          superuser: { cluster: ['all'], indices: [{ names: ['*'], privileges: ['all'] }] },
          viewer: { cluster: ['monitor'], indices: [{ names: ['*'], privileges: ['read'] }] },
        },
      });

      const tools = createSecurityTools(client);
      const result = await tools.list_roles.handler({});

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBe(2);
    });
  });

  describe('authenticate', () => {
    it('should return current user info', async () => {
      const { client } = createMockClient({
        '/_security/_authenticate': {
          username: 'api_key_user',
          roles: ['admin'],
          authentication_type: 'api_key',
        },
      });

      const tools = createSecurityTools(client);
      const result = await tools.authenticate.handler({});

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.authentication_type).toBe('api_key');
    });
  });

  describe('list_api_keys', () => {
    it('should list API keys', async () => {
      const { client } = createMockClient({
        '/_security/api_key': {
          api_keys: [
            { id: 'key1', name: 'test-key-1', creation: 1704067200000 },
            { id: 'key2', name: 'test-key-2', creation: 1704153600000 },
          ],
        },
      });

      const tools = createSecurityTools(client);
      const result = await tools.list_api_keys.handler({});

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.api_keys).toHaveLength(2);
    });
  });
});

describe('Index Tools', () => {
  describe('list_indices', () => {
    it('should list indices', async () => {
      const { client } = createMockClient({
        '/_cat/indices': [
          { index: 'logs-2024-01', health: 'green', status: 'open', 'docs.count': '1000', 'store.size': '10mb' },
          { index: 'logs-2024-02', health: 'green', status: 'open', 'docs.count': '2000', 'store.size': '20mb' },
        ],
      });

      const tools = createIndexTools(client);
      const result = await tools.list_indices.handler({});

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBe(2);
    });
  });

  describe('get_mappings', () => {
    it('should get index mappings', async () => {
      const { client } = createMockClient({
        '/logs/_mapping': {
          logs: {
            mappings: {
              properties: {
                message: { type: 'text' },
                timestamp: { type: 'date' },
              },
            },
          },
        },
      });

      const tools = createIndexTools(client);
      const result = await tools.get_mappings.handler({ index: 'logs' });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.logs.mappings.properties.message).toBeDefined();
    });
  });

  describe('delete_index', () => {
    it('should require confirmation', async () => {
      const { client } = createMockClient({});

      const tools = createIndexTools(client);

      // TypeScript won't allow this normally, but testing the runtime check
      const result = await tools.delete_index.handler({
        index: 'test',
        confirm: false as unknown as true,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not confirmed');
    });
  });
});

describe('Cluster Tools', () => {
  describe('cluster_health', () => {
    it('should return cluster health', async () => {
      const { client } = createMockClient({
        '/_cluster/health': {
          cluster_name: 'test-cluster',
          status: 'green',
          number_of_nodes: 3,
          number_of_data_nodes: 3,
          active_shards: 100,
          active_primary_shards: 50,
          relocating_shards: 0,
          initializing_shards: 0,
          unassigned_shards: 0,
          active_shards_percent_as_number: 100.0,
          number_of_pending_tasks: 0,
        },
      });

      const tools = createClusterTools(client);
      const result = await tools.cluster_health.handler({});

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.status).toBe('green');
      expect(data.summary).toContain('GREEN');
    });
  });

  describe('cluster_info', () => {
    it('should return cluster info', async () => {
      const { client } = createMockClient({
        '/': {
          name: 'test-node',
          cluster_name: 'test-cluster',
          cluster_uuid: 'abc123',
          version: {
            number: '8.12.0',
            build_flavor: 'default',
          },
        },
      });

      const tools = createClusterTools(client);
      const result = await tools.cluster_info.handler({});

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.cluster_name).toBe('test-cluster');
      expect(data.version.number).toBe('8.12.0');
    });
  });

  describe('nodes_info', () => {
    it('should return nodes info', async () => {
      const { client } = createMockClient({
        '/_nodes': {
          cluster_name: 'test-cluster',
          nodes: {
            node1: { name: 'node-1', roles: ['master', 'data'] },
            node2: { name: 'node-2', roles: ['data'] },
          },
        },
      });

      const tools = createClusterTools(client);
      const result = await tools.nodes_info.handler({});

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(Object.keys(data.nodes)).toHaveLength(2);
    });
  });
});
