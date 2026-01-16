import { z } from 'zod';
import { ElasticClient } from '../utils/client.js';
import { ClusterHealth } from '../types/elastic.js';

/**
 * Cluster management and monitoring tools
 */
export function createClusterTools(client: ElasticClient) {
  return {
    /**
     * Get cluster health
     */
    cluster_health: {
      name: 'cluster_health',
      description: 'Get the health status of the Elasticsearch cluster including node counts, shard status, and overall health.',
      schema: z.object({
        level: z.enum(['cluster', 'indices', 'shards']).default('cluster').describe('Level of detail'),
        wait_for_status: z.enum(['green', 'yellow', 'red']).optional().describe('Wait for cluster to reach this status'),
        timeout: z.string().optional().describe('Timeout to wait (e.g., "30s")'),
      }),
      handler: async (params: { level?: string; wait_for_status?: string; timeout?: string }) => {
        const queryParams: Record<string, string> = {};
        if (params.level) queryParams.level = params.level;
        if (params.wait_for_status) queryParams.wait_for_status = params.wait_for_status;
        if (params.timeout) queryParams.timeout = params.timeout;

        const response = await client.get<ClusterHealth>('/_cluster/health', queryParams);

        if (!response.success) {
          return {
            content: [{ type: 'text' as const, text: `Failed to get cluster health: ${response.error?.reason}` }],
            isError: true,
          };
        }

        const health = response.data!;
        const statusEmoji = health.status === 'green' ? 'GREEN' : health.status === 'yellow' ? 'YELLOW' : 'RED';

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              summary: `Cluster '${health.cluster_name}' is ${statusEmoji}`,
              cluster_name: health.cluster_name,
              status: health.status,
              nodes: {
                total: health.number_of_nodes,
                data: health.number_of_data_nodes,
              },
              shards: {
                active: health.active_shards,
                primary: health.active_primary_shards,
                relocating: health.relocating_shards,
                initializing: health.initializing_shards,
                unassigned: health.unassigned_shards,
              },
              active_shards_percent: health.active_shards_percent_as_number,
              pending_tasks: health.number_of_pending_tasks,
            }, null, 2),
          }],
        };
      },
    },

    /**
     * Get cluster stats
     */
    cluster_stats: {
      name: 'cluster_stats',
      description: 'Get comprehensive cluster statistics including indices, nodes, and resource usage.',
      schema: z.object({}),
      handler: async () => {
        const response = await client.get<Record<string, unknown>>('/_cluster/stats');

        if (!response.success) {
          return {
            content: [{ type: 'text' as const, text: `Failed to get cluster stats: ${response.error?.reason}` }],
            isError: true,
          };
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(response.data, null, 2),
          }],
        };
      },
    },

    /**
     * Get cluster info
     */
    cluster_info: {
      name: 'cluster_info',
      description: 'Get basic cluster information including version and build details.',
      schema: z.object({}),
      handler: async () => {
        const response = await client.get<Record<string, unknown>>('/');

        if (!response.success) {
          return {
            content: [{ type: 'text' as const, text: `Failed to get cluster info: ${response.error?.reason}` }],
            isError: true,
          };
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(response.data, null, 2),
          }],
        };
      },
    },

    /**
     * Get nodes info
     */
    nodes_info: {
      name: 'nodes_info',
      description: 'Get information about cluster nodes including roles, JVM settings, and plugins.',
      schema: z.object({
        node_id: z.string().optional().describe('Specific node ID (omit for all nodes)'),
        metric: z.array(z.enum([
          'settings', 'os', 'process', 'jvm', 'thread_pool',
          'transport', 'http', 'plugins', 'ingest', 'indices'
        ])).optional().describe('Specific metrics to retrieve'),
      }),
      handler: async (params: { node_id?: string; metric?: string[] }) => {
        let path = '/_nodes';
        if (params.node_id) path += `/${params.node_id}`;
        if (params.metric && params.metric.length > 0) {
          path += `/${params.metric.join(',')}`;
        }

        const response = await client.get<Record<string, unknown>>(path);

        if (!response.success) {
          return {
            content: [{ type: 'text' as const, text: `Failed to get nodes info: ${response.error?.reason}` }],
            isError: true,
          };
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(response.data, null, 2),
          }],
        };
      },
    },

    /**
     * Get nodes stats
     */
    nodes_stats: {
      name: 'nodes_stats',
      description: 'Get statistics for cluster nodes including CPU, memory, disk, and index operations.',
      schema: z.object({
        node_id: z.string().optional().describe('Specific node ID'),
        metric: z.array(z.enum([
          'indices', 'os', 'process', 'jvm', 'thread_pool',
          'fs', 'transport', 'http', 'breaker', 'script'
        ])).optional().describe('Specific metrics'),
      }),
      handler: async (params: { node_id?: string; metric?: string[] }) => {
        let path = '/_nodes';
        if (params.node_id) path += `/${params.node_id}`;
        path += '/stats';
        if (params.metric && params.metric.length > 0) {
          path += `/${params.metric.join(',')}`;
        }

        const response = await client.get<Record<string, unknown>>(path);

        if (!response.success) {
          return {
            content: [{ type: 'text' as const, text: `Failed to get node stats: ${response.error?.reason}` }],
            isError: true,
          };
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(response.data, null, 2),
          }],
        };
      },
    },

    /**
     * Get pending cluster tasks
     */
    pending_tasks: {
      name: 'pending_tasks',
      description: 'Get a list of pending cluster-level tasks.',
      schema: z.object({}),
      handler: async () => {
        const response = await client.get<{ tasks: unknown[] }>('/_cluster/pending_tasks');

        if (!response.success) {
          return {
            content: [{ type: 'text' as const, text: `Failed to get pending tasks: ${response.error?.reason}` }],
            isError: true,
          };
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(response.data, null, 2),
          }],
        };
      },
    },

    /**
     * Get cluster allocation explanation
     */
    allocation_explain: {
      name: 'allocation_explain',
      description: 'Explain why a shard is unassigned or why it remains on its current node.',
      schema: z.object({
        index: z.string().optional().describe('Index name'),
        shard: z.number().optional().describe('Shard number'),
        primary: z.boolean().optional().describe('Whether to explain primary (true) or replica (false)'),
      }),
      handler: async (params: { index?: string; shard?: number; primary?: boolean }) => {
        const body = Object.keys(params).length > 0 ? params : undefined;
        const response = await client.get<Record<string, unknown>>('/_cluster/allocation/explain', body as Record<string, string | number | boolean> | undefined);

        if (!response.success) {
          return {
            content: [{ type: 'text' as const, text: `Failed to explain allocation: ${response.error?.reason}` }],
            isError: true,
          };
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(response.data, null, 2),
          }],
        };
      },
    },

    /**
     * Get shard information
     */
    get_shards: {
      name: 'get_shards',
      description: 'Get detailed shard allocation information.',
      schema: z.object({
        index: z.string().optional().describe('Index pattern to filter'),
      }),
      handler: async (params: { index?: string }) => {
        const path = params.index ? `/_cat/shards/${params.index}` : '/_cat/shards';
        const response = await client.get<unknown[]>(path, { format: 'json' });

        if (!response.success) {
          return {
            content: [{ type: 'text' as const, text: `Failed to get shards: ${response.error?.reason}` }],
            isError: true,
          };
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(response.data, null, 2),
          }],
        };
      },
    },
  };
}
