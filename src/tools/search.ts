import { z } from 'zod';
import { ElasticClient } from '../utils/client.js';
import { SearchRequestSchema, EsqlQuerySchema, SearchResponse } from '../types/elastic.js';

/**
 * Search tools for querying Elasticsearch data
 */
export function createSearchTools(client: ElasticClient) {
  return {
    /**
     * Execute a search query using Elasticsearch Query DSL
     */
    search: {
      name: 'search',
      description: 'Execute a search query using Elasticsearch Query DSL. Supports full-text search, filters, aggregations, and sorting.',
      schema: SearchRequestSchema,
      handler: async (params: z.infer<typeof SearchRequestSchema>) => {
        const { index, query, size, from, sort, _source, aggs } = params;

        const body: Record<string, unknown> = {
          size,
          from,
        };

        if (query) body.query = query;
        if (sort) body.sort = sort;
        if (_source !== undefined) body._source = _source;
        if (aggs) body.aggs = aggs;

        const response = await client.post<SearchResponse>(`/${index}/_search`, body);

        if (!response.success) {
          return {
            content: [{ type: 'text' as const, text: `Search failed: ${response.error?.reason}` }],
            isError: true,
          };
        }

        const data = response.data!;
        const summary = `Found ${data.hits.total.value} results (showing ${data.hits.hits.length})`;

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              summary,
              took_ms: data.took,
              timed_out: data.timed_out,
              total: data.hits.total,
              hits: data.hits.hits.map(hit => ({
                _id: hit._id,
                _index: hit._index,
                _score: hit._score,
                _source: hit._source,
              })),
              aggregations: data.aggregations,
            }, null, 2),
          }],
        };
      },
    },

    /**
     * Execute an ES|QL query
     */
    esql_query: {
      name: 'esql_query',
      description: 'Execute an ES|QL query for data analysis. ES|QL is a piped query language for filtering, transforming, and aggregating data.',
      schema: EsqlQuerySchema,
      handler: async (params: z.infer<typeof EsqlQuerySchema>) => {
        const { query, format } = params;

        const response = await client.post('/_query', { query }, { format });

        if (!response.success) {
          return {
            content: [{ type: 'text' as const, text: `ES|QL query failed: ${response.error?.reason}` }],
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
     * Get a specific document by ID
     */
    get_document: {
      name: 'get_document',
      description: 'Retrieve a specific document by its ID from an index.',
      schema: z.object({
        index: z.string().describe('Index name'),
        id: z.string().describe('Document ID'),
        _source: z.union([z.boolean(), z.array(z.string())]).optional().describe('Fields to include'),
      }),
      handler: async (params: { index: string; id: string; _source?: boolean | string[] }) => {
        const { index, id, _source } = params;

        const queryParams: Record<string, string | boolean> = {};
        if (_source !== undefined) {
          queryParams._source = Array.isArray(_source) ? _source.join(',') : String(_source);
        }

        const response = await client.get(`/${index}/_doc/${id}`, queryParams);

        if (!response.success) {
          return {
            content: [{ type: 'text' as const, text: `Document not found or error: ${response.error?.reason}` }],
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
     * Count documents matching a query
     */
    count: {
      name: 'count',
      description: 'Count documents in an index that match a query.',
      schema: z.object({
        index: z.string().describe('Index name or pattern'),
        query: z.record(z.unknown()).optional().describe('Optional Query DSL to filter documents'),
      }),
      handler: async (params: { index: string; query?: Record<string, unknown> }) => {
        const { index, query } = params;

        const body = query ? { query } : undefined;
        const response = await client.post<{ count: number }>(`/${index}/_count`, body);

        if (!response.success) {
          return {
            content: [{ type: 'text' as const, text: `Count failed: ${response.error?.reason}` }],
            isError: true,
          };
        }

        return {
          content: [{
            type: 'text' as const,
            text: `Document count: ${response.data!.count}`,
          }],
        };
      },
    },

    /**
     * Multi-search (multiple queries in one request)
     */
    msearch: {
      name: 'msearch',
      description: 'Execute multiple search queries in a single request for efficiency.',
      schema: z.object({
        searches: z.array(z.object({
          index: z.string().describe('Index name'),
          query: z.record(z.unknown()).optional(),
          size: z.number().optional(),
        })).describe('Array of search requests'),
      }),
      handler: async (params: { searches: Array<{ index: string; query?: Record<string, unknown>; size?: number }> }) => {
        // Build NDJSON body for msearch
        const lines: string[] = [];
        for (const search of params.searches) {
          lines.push(JSON.stringify({ index: search.index }));
          lines.push(JSON.stringify({
            query: search.query || { match_all: {} },
            size: search.size || 10,
          }));
        }

        const response = await client.post<{ responses: SearchResponse[] }>(
          '/_msearch',
          lines.join('\n') + '\n'
        );

        if (!response.success) {
          return {
            content: [{ type: 'text' as const, text: `Multi-search failed: ${response.error?.reason}` }],
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
