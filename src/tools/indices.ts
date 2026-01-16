import { z } from 'zod';
import { ElasticClient } from '../utils/client.js';
import { CreateIndexSchema, IndexInfo } from '../types/elastic.js';

/**
 * Index management tools
 */
export function createIndexTools(client: ElasticClient) {
  return {
    /**
     * List all indices
     */
    list_indices: {
      name: 'list_indices',
      description: 'List all indices in the cluster with their health, status, and document counts.',
      schema: z.object({
        pattern: z.string().optional().describe('Index pattern to filter (e.g., "logs-*")'),
        health: z.enum(['green', 'yellow', 'red']).optional().describe('Filter by health status'),
        include_hidden: z.boolean().default(false).describe('Include hidden indices (starting with .)'),
      }),
      handler: async (params: { pattern?: string; health?: string; include_hidden?: boolean }) => {
        const queryParams: Record<string, string> = {
          format: 'json',
          h: 'health,status,index,uuid,pri,rep,docs.count,docs.deleted,store.size,pri.store.size',
        };

        if (params.health) queryParams.health = params.health;
        if (params.include_hidden) queryParams.expand_wildcards = 'all';

        const path = params.pattern ? `/_cat/indices/${params.pattern}` : '/_cat/indices';
        const response = await client.get<IndexInfo[]>(path, queryParams);

        if (!response.success) {
          return {
            content: [{ type: 'text' as const, text: `Failed to list indices: ${response.error?.reason}` }],
            isError: true,
          };
        }

        const indices = response.data!;
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              count: indices.length,
              indices: indices.map(idx => ({
                index: idx.index,
                health: idx.health,
                status: idx.status,
                docs: idx['docs.count'],
                size: idx['store.size'],
                primary_shards: idx.pri,
                replicas: idx.rep,
              })),
            }, null, 2),
          }],
        };
      },
    },

    /**
     * Get index details
     */
    get_index: {
      name: 'get_index',
      description: 'Get detailed information about a specific index including settings and mappings.',
      schema: z.object({
        index: z.string().describe('Index name'),
      }),
      handler: async (params: { index: string }) => {
        const response = await client.get<Record<string, unknown>>(`/${params.index}`);

        if (!response.success) {
          return {
            content: [{ type: 'text' as const, text: `Index not found: ${response.error?.reason}` }],
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
     * Get index mappings
     */
    get_mappings: {
      name: 'get_mappings',
      description: 'Get the field mappings for an index.',
      schema: z.object({
        index: z.string().describe('Index name or pattern'),
      }),
      handler: async (params: { index: string }) => {
        const response = await client.get<Record<string, unknown>>(`/${params.index}/_mapping`);

        if (!response.success) {
          return {
            content: [{ type: 'text' as const, text: `Failed to get mappings: ${response.error?.reason}` }],
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
     * Get index settings
     */
    get_settings: {
      name: 'get_settings',
      description: 'Get the settings for an index.',
      schema: z.object({
        index: z.string().describe('Index name or pattern'),
        include_defaults: z.boolean().default(false).describe('Include default settings'),
      }),
      handler: async (params: { index: string; include_defaults?: boolean }) => {
        const queryParams: Record<string, string | boolean> = {};
        if (params.include_defaults) queryParams.include_defaults = true;

        const response = await client.get<Record<string, unknown>>(
          `/${params.index}/_settings`,
          queryParams
        );

        if (!response.success) {
          return {
            content: [{ type: 'text' as const, text: `Failed to get settings: ${response.error?.reason}` }],
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
     * Create an index
     */
    create_index: {
      name: 'create_index',
      description: 'Create a new index with optional settings, mappings, and aliases.',
      schema: CreateIndexSchema,
      handler: async (params: z.infer<typeof CreateIndexSchema>) => {
        const { index, ...body } = params;

        const response = await client.put(`/${index}`, Object.keys(body).length > 0 ? body : undefined);

        if (!response.success) {
          return {
            content: [{ type: 'text' as const, text: `Failed to create index: ${response.error?.reason}` }],
            isError: true,
          };
        }

        return {
          content: [{
            type: 'text' as const,
            text: `Index '${index}' created successfully`,
          }],
        };
      },
    },

    /**
     * Delete an index
     */
    delete_index: {
      name: 'delete_index',
      description: 'Delete an index. WARNING: This permanently deletes all data in the index.',
      schema: z.object({
        index: z.string().describe('Index name to delete'),
        confirm: z.literal(true).describe('Must be true to confirm deletion'),
      }),
      handler: async (params: { index: string; confirm: true }) => {
        if (!params.confirm) {
          return {
            content: [{ type: 'text' as const, text: 'Deletion not confirmed. Set confirm: true to delete.' }],
            isError: true,
          };
        }

        const response = await client.delete(`/${params.index}`);

        if (!response.success) {
          return {
            content: [{ type: 'text' as const, text: `Failed to delete index: ${response.error?.reason}` }],
            isError: true,
          };
        }

        return {
          content: [{
            type: 'text' as const,
            text: `Index '${params.index}' deleted successfully`,
          }],
        };
      },
    },

    /**
     * Refresh an index
     */
    refresh_index: {
      name: 'refresh_index',
      description: 'Refresh an index to make recent changes available for search.',
      schema: z.object({
        index: z.string().describe('Index name or pattern'),
      }),
      handler: async (params: { index: string }) => {
        const response = await client.post(`/${params.index}/_refresh`);

        if (!response.success) {
          return {
            content: [{ type: 'text' as const, text: `Failed to refresh index: ${response.error?.reason}` }],
            isError: true,
          };
        }

        return {
          content: [{
            type: 'text' as const,
            text: `Index '${params.index}' refreshed successfully`,
          }],
        };
      },
    },

    /**
     * Get index stats
     */
    get_index_stats: {
      name: 'get_index_stats',
      description: 'Get statistics for one or more indices including document counts, storage, and operations.',
      schema: z.object({
        index: z.string().optional().describe('Index name or pattern (omit for all indices)'),
      }),
      handler: async (params: { index?: string }) => {
        const path = params.index ? `/${params.index}/_stats` : '/_stats';
        const response = await client.get<Record<string, unknown>>(path);

        if (!response.success) {
          return {
            content: [{ type: 'text' as const, text: `Failed to get stats: ${response.error?.reason}` }],
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
     * Get aliases
     */
    get_aliases: {
      name: 'get_aliases',
      description: 'Get index aliases.',
      schema: z.object({
        index: z.string().optional().describe('Index name or pattern'),
        alias: z.string().optional().describe('Alias name'),
      }),
      handler: async (params: { index?: string; alias?: string }) => {
        let path = '/_alias';
        if (params.index) path = `/${params.index}/_alias`;
        if (params.alias) path += `/${params.alias}`;

        const response = await client.get<Record<string, unknown>>(path);

        if (!response.success) {
          return {
            content: [{ type: 'text' as const, text: `Failed to get aliases: ${response.error?.reason}` }],
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
