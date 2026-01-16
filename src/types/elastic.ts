import { z } from 'zod';

// Configuration schema
export const ConfigSchema = z.object({
  elasticUrl: z.string().url(),
  apiKeyEncoded: z.string().optional(),
  apiKeyId: z.string().optional(),
  apiKeySecret: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  skipSslVerify: z.boolean().default(false),
  timeout: z.number().default(30000),
});

export type Config = z.infer<typeof ConfigSchema>;

// Search request schema
export const SearchRequestSchema = z.object({
  index: z.string().describe('Index name or pattern (e.g., "logs-*")'),
  query: z.record(z.unknown()).optional().describe('Elasticsearch Query DSL object'),
  size: z.number().min(0).max(10000).default(10).describe('Number of results to return'),
  from: z.number().min(0).default(0).describe('Offset for pagination'),
  sort: z.array(z.record(z.unknown())).optional().describe('Sort criteria'),
  _source: z.union([z.boolean(), z.array(z.string())]).optional().describe('Fields to include/exclude'),
  aggs: z.record(z.unknown()).optional().describe('Aggregations'),
});

export type SearchRequest = z.infer<typeof SearchRequestSchema>;

// ES|QL query schema
export const EsqlQuerySchema = z.object({
  query: z.string().describe('ES|QL query string'),
  format: z.enum(['json', 'csv', 'txt']).default('json').describe('Response format'),
});

export type EsqlQuery = z.infer<typeof EsqlQuerySchema>;

// User management schemas
export const CreateUserSchema = z.object({
  username: z.string().describe('Username'),
  password: z.string().optional().describe('Password (optional if using external auth)'),
  roles: z.array(z.string()).describe('List of role names'),
  full_name: z.string().optional().describe('Full name'),
  email: z.string().email().optional().describe('Email address'),
  enabled: z.boolean().default(true).describe('Whether the user is enabled'),
  metadata: z.record(z.unknown()).optional().describe('Custom metadata'),
});

export type CreateUser = z.infer<typeof CreateUserSchema>;

// Role management schemas
export const CreateRoleSchema = z.object({
  name: z.string().describe('Role name'),
  cluster: z.array(z.string()).optional().describe('Cluster privileges'),
  indices: z.array(z.object({
    names: z.array(z.string()).describe('Index patterns'),
    privileges: z.array(z.string()).describe('Index privileges'),
    field_security: z.object({
      grant: z.array(z.string()).optional(),
      except: z.array(z.string()).optional(),
    }).optional(),
    query: z.string().optional().describe('Document-level security query'),
  })).optional().describe('Index privileges'),
  applications: z.array(z.object({
    application: z.string(),
    privileges: z.array(z.string()),
    resources: z.array(z.string()),
  })).optional().describe('Application privileges'),
  run_as: z.array(z.string()).optional().describe('Users this role can impersonate'),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateRole = z.infer<typeof CreateRoleSchema>;

// API Key schemas
export const CreateApiKeySchema = z.object({
  name: z.string().describe('API key name'),
  expiration: z.string().optional().describe('Expiration time (e.g., "1d", "30d")'),
  role_descriptors: z.record(z.object({
    cluster: z.array(z.string()).optional(),
    indices: z.array(z.object({
      names: z.array(z.string()),
      privileges: z.array(z.string()),
    })).optional(),
  })).optional().describe('Custom role descriptors'),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateApiKey = z.infer<typeof CreateApiKeySchema>;

// Index management schemas
export const CreateIndexSchema = z.object({
  index: z.string().describe('Index name'),
  settings: z.object({
    number_of_shards: z.number().optional(),
    number_of_replicas: z.number().optional(),
  }).passthrough().optional().describe('Index settings'),
  mappings: z.object({
    properties: z.record(z.unknown()),
  }).passthrough().optional().describe('Field mappings'),
  aliases: z.record(z.object({
    filter: z.record(z.unknown()).optional(),
    routing: z.string().optional(),
  })).optional().describe('Index aliases'),
});

export type CreateIndex = z.infer<typeof CreateIndexSchema>;

// Watch/Alert schemas
export const CreateWatchSchema = z.object({
  id: z.string().describe('Watch ID'),
  trigger: z.object({
    schedule: z.record(z.unknown()),
  }).describe('Watch trigger (schedule)'),
  input: z.record(z.unknown()).describe('Watch input (data source)'),
  condition: z.record(z.unknown()).optional().describe('Watch condition'),
  actions: z.record(z.unknown()).describe('Watch actions'),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateWatch = z.infer<typeof CreateWatchSchema>;

// Response types
export interface ElasticResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    type: string;
    reason: string;
    status?: number;
  };
}

export interface SearchHit {
  _index: string;
  _id: string;
  _score: number | null;
  _source: Record<string, unknown>;
  highlight?: Record<string, string[]>;
}

export interface SearchResponse {
  took: number;
  timed_out: boolean;
  hits: {
    total: { value: number; relation: string };
    max_score: number | null;
    hits: SearchHit[];
  };
  aggregations?: Record<string, unknown>;
}

export interface ClusterHealth {
  cluster_name: string;
  status: 'green' | 'yellow' | 'red';
  timed_out: boolean;
  number_of_nodes: number;
  number_of_data_nodes: number;
  active_primary_shards: number;
  active_shards: number;
  relocating_shards: number;
  initializing_shards: number;
  unassigned_shards: number;
  delayed_unassigned_shards: number;
  number_of_pending_tasks: number;
  number_of_in_flight_fetch: number;
  task_max_waiting_in_queue_millis: number;
  active_shards_percent_as_number: number;
}

export interface IndexInfo {
  health: string;
  status: string;
  index: string;
  uuid: string;
  pri: string;
  rep: string;
  'docs.count': string;
  'docs.deleted': string;
  'store.size': string;
  'pri.store.size': string;
}
