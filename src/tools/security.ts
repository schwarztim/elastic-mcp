import { z } from 'zod';
import { ElasticClient } from '../utils/client.js';
import { CreateUserSchema, CreateRoleSchema, CreateApiKeySchema } from '../types/elastic.js';

/**
 * Security tools for managing users, roles, API keys, and privileges
 */
export function createSecurityTools(client: ElasticClient) {
  return {
    // ==================== USER MANAGEMENT ====================

    /**
     * List all users
     */
    list_users: {
      name: 'list_users',
      description: 'List all users in the Elasticsearch security realm.',
      schema: z.object({}),
      handler: async () => {
        const response = await client.get<Record<string, unknown>>('/_security/user');

        if (!response.success) {
          return {
            content: [{ type: 'text' as const, text: `Failed to list users: ${response.error?.reason}` }],
            isError: true,
          };
        }

        const users = Object.entries(response.data!).map(([username, data]) => ({
          username,
          ...(data as Record<string, unknown>),
        }));

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ count: users.length, users }, null, 2),
          }],
        };
      },
    },

    /**
     * Get user details
     */
    get_user: {
      name: 'get_user',
      description: 'Get detailed information about a specific user.',
      schema: z.object({
        username: z.string().describe('Username to retrieve'),
      }),
      handler: async (params: { username: string }) => {
        const response = await client.get<Record<string, unknown>>(`/_security/user/${params.username}`);

        if (!response.success) {
          return {
            content: [{ type: 'text' as const, text: `User not found: ${response.error?.reason}` }],
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
     * Create a new user
     */
    create_user: {
      name: 'create_user',
      description: 'Create a new user with specified roles and permissions.',
      schema: CreateUserSchema,
      handler: async (params: z.infer<typeof CreateUserSchema>) => {
        const { username, ...body } = params;

        const response = await client.post(`/_security/user/${username}`, body);

        if (!response.success) {
          return {
            content: [{ type: 'text' as const, text: `Failed to create user: ${response.error?.reason}` }],
            isError: true,
          };
        }

        return {
          content: [{
            type: 'text' as const,
            text: `User '${username}' created successfully with roles: ${params.roles.join(', ')}`,
          }],
        };
      },
    },

    /**
     * Delete a user
     */
    delete_user: {
      name: 'delete_user',
      description: 'Delete a user from Elasticsearch. This action cannot be undone.',
      schema: z.object({
        username: z.string().describe('Username to delete'),
      }),
      handler: async (params: { username: string }) => {
        const response = await client.delete(`/_security/user/${params.username}`);

        if (!response.success) {
          return {
            content: [{ type: 'text' as const, text: `Failed to delete user: ${response.error?.reason}` }],
            isError: true,
          };
        }

        return {
          content: [{
            type: 'text' as const,
            text: `User '${params.username}' deleted successfully`,
          }],
        };
      },
    },

    /**
     * Enable or disable a user
     */
    set_user_enabled: {
      name: 'set_user_enabled',
      description: 'Enable or disable a user account.',
      schema: z.object({
        username: z.string().describe('Username'),
        enabled: z.boolean().describe('Whether to enable (true) or disable (false) the user'),
      }),
      handler: async (params: { username: string; enabled: boolean }) => {
        const endpoint = params.enabled
          ? `/_security/user/${params.username}/_enable`
          : `/_security/user/${params.username}/_disable`;

        const response = await client.put(endpoint);

        if (!response.success) {
          return {
            content: [{ type: 'text' as const, text: `Failed to update user: ${response.error?.reason}` }],
            isError: true,
          };
        }

        return {
          content: [{
            type: 'text' as const,
            text: `User '${params.username}' ${params.enabled ? 'enabled' : 'disabled'} successfully`,
          }],
        };
      },
    },

    // ==================== ROLE MANAGEMENT ====================

    /**
     * List all roles
     */
    list_roles: {
      name: 'list_roles',
      description: 'List all roles defined in Elasticsearch.',
      schema: z.object({}),
      handler: async () => {
        const response = await client.get<Record<string, unknown>>('/_security/role');

        if (!response.success) {
          return {
            content: [{ type: 'text' as const, text: `Failed to list roles: ${response.error?.reason}` }],
            isError: true,
          };
        }

        const roles = Object.entries(response.data!).map(([name, data]) => ({
          name,
          ...(data as Record<string, unknown>),
        }));

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ count: roles.length, roles }, null, 2),
          }],
        };
      },
    },

    /**
     * Get role details
     */
    get_role: {
      name: 'get_role',
      description: 'Get detailed information about a specific role.',
      schema: z.object({
        name: z.string().describe('Role name'),
      }),
      handler: async (params: { name: string }) => {
        const response = await client.get<Record<string, unknown>>(`/_security/role/${params.name}`);

        if (!response.success) {
          return {
            content: [{ type: 'text' as const, text: `Role not found: ${response.error?.reason}` }],
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
     * Create or update a role
     */
    create_role: {
      name: 'create_role',
      description: 'Create or update a role with specified cluster and index privileges.',
      schema: CreateRoleSchema,
      handler: async (params: z.infer<typeof CreateRoleSchema>) => {
        const { name, ...body } = params;

        const response = await client.put(`/_security/role/${name}`, body);

        if (!response.success) {
          return {
            content: [{ type: 'text' as const, text: `Failed to create role: ${response.error?.reason}` }],
            isError: true,
          };
        }

        return {
          content: [{
            type: 'text' as const,
            text: `Role '${name}' created/updated successfully`,
          }],
        };
      },
    },

    /**
     * Delete a role
     */
    delete_role: {
      name: 'delete_role',
      description: 'Delete a role from Elasticsearch.',
      schema: z.object({
        name: z.string().describe('Role name to delete'),
      }),
      handler: async (params: { name: string }) => {
        const response = await client.delete(`/_security/role/${params.name}`);

        if (!response.success) {
          return {
            content: [{ type: 'text' as const, text: `Failed to delete role: ${response.error?.reason}` }],
            isError: true,
          };
        }

        return {
          content: [{
            type: 'text' as const,
            text: `Role '${params.name}' deleted successfully`,
          }],
        };
      },
    },

    // ==================== API KEY MANAGEMENT ====================

    /**
     * List API keys
     */
    list_api_keys: {
      name: 'list_api_keys',
      description: 'List API keys. Can filter by owner, name, or realm.',
      schema: z.object({
        owner: z.boolean().optional().describe('If true, only return keys owned by the current user'),
        name: z.string().optional().describe('Filter by API key name (supports wildcards)'),
        realm_name: z.string().optional().describe('Filter by authentication realm'),
      }),
      handler: async (params: { owner?: boolean; name?: string; realm_name?: string }) => {
        const queryParams: Record<string, string | boolean> = {};
        if (params.owner !== undefined) queryParams.owner = params.owner;
        if (params.name) queryParams.name = params.name;
        if (params.realm_name) queryParams.realm_name = params.realm_name;

        const response = await client.get<{ api_keys: unknown[] }>('/_security/api_key', queryParams);

        if (!response.success) {
          return {
            content: [{ type: 'text' as const, text: `Failed to list API keys: ${response.error?.reason}` }],
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
     * Create an API key
     */
    create_api_key: {
      name: 'create_api_key',
      description: 'Create a new API key for authentication.',
      schema: CreateApiKeySchema,
      handler: async (params: z.infer<typeof CreateApiKeySchema>) => {
        const response = await client.post<{
          id: string;
          name: string;
          api_key: string;
          encoded: string;
          expiration?: number;
        }>('/_security/api_key', params);

        if (!response.success) {
          return {
            content: [{ type: 'text' as const, text: `Failed to create API key: ${response.error?.reason}` }],
            isError: true,
          };
        }

        const data = response.data!;
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              message: 'API key created successfully. IMPORTANT: Save the api_key value - it cannot be retrieved again!',
              id: data.id,
              name: data.name,
              encoded: data.encoded,
              expiration: data.expiration,
              // Note: We intentionally don't return the raw api_key to encourage using the encoded version
            }, null, 2),
          }],
        };
      },
    },

    /**
     * Invalidate API keys
     */
    invalidate_api_key: {
      name: 'invalidate_api_key',
      description: 'Invalidate one or more API keys.',
      schema: z.object({
        ids: z.array(z.string()).optional().describe('Array of API key IDs to invalidate'),
        name: z.string().optional().describe('API key name to invalidate (supports wildcards)'),
        owner: z.boolean().optional().describe('If true, only invalidate keys owned by current user'),
      }),
      handler: async (params: { ids?: string[]; name?: string; owner?: boolean }) => {
        const body: Record<string, unknown> = {};
        if (params.ids) body.ids = params.ids;
        if (params.name) body.name = params.name;
        if (params.owner !== undefined) body.owner = params.owner;

        const response = await client.delete<{
          invalidated_api_keys: string[];
          previously_invalidated_api_keys: string[];
          error_count: number;
        }>('/_security/api_key', body);

        if (!response.success) {
          return {
            content: [{ type: 'text' as const, text: `Failed to invalidate API keys: ${response.error?.reason}` }],
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

    // ==================== PRIVILEGES ====================

    /**
     * Get user privileges
     */
    get_privileges: {
      name: 'get_privileges',
      description: 'Get the privileges for the current authenticated user.',
      schema: z.object({}),
      handler: async () => {
        const response = await client.get('/_security/user/_privileges');

        if (!response.success) {
          return {
            content: [{ type: 'text' as const, text: `Failed to get privileges: ${response.error?.reason}` }],
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
     * Check if user has specific privileges
     */
    has_privileges: {
      name: 'has_privileges',
      description: 'Check if the current user has specific cluster or index privileges.',
      schema: z.object({
        cluster: z.array(z.string()).optional().describe('Cluster privileges to check'),
        index: z.array(z.object({
          names: z.array(z.string()).describe('Index patterns'),
          privileges: z.array(z.string()).describe('Privileges to check'),
        })).optional().describe('Index privileges to check'),
      }),
      handler: async (params: {
        cluster?: string[];
        index?: Array<{ names: string[]; privileges: string[] }>;
      }) => {
        const response = await client.post('/_security/user/_has_privileges', params);

        if (!response.success) {
          return {
            content: [{ type: 'text' as const, text: `Failed to check privileges: ${response.error?.reason}` }],
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
     * Authenticate and get current user info
     */
    authenticate: {
      name: 'authenticate',
      description: 'Get information about the currently authenticated user.',
      schema: z.object({}),
      handler: async () => {
        const response = await client.get('/_security/_authenticate');

        if (!response.success) {
          return {
            content: [{ type: 'text' as const, text: `Authentication check failed: ${response.error?.reason}` }],
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
