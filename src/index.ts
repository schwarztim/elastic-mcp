#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { createClientFromEnv, ElasticClient } from './utils/client.js';
import { createSearchTools } from './tools/search.js';
import { createSecurityTools } from './tools/security.js';
import { createIndexTools } from './tools/indices.js';
import { createClusterTools } from './tools/cluster.js';

// Tool definition type
interface ToolDefinition {
  name: string;
  description: string;
  schema: { parse: (data: unknown) => unknown; _def?: { shape?: () => Record<string, unknown> } };
  handler: (params: unknown) => Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }>;
}

/**
 * Elastic MCP Server
 *
 * A comprehensive MCP server for Elasticsearch with InfoSec-focused tools
 * for security management, search, index operations, and cluster monitoring.
 */
class ElasticMCPServer {
  private server: Server;
  private client: ElasticClient;
  private tools: Map<string, ToolDefinition> = new Map();

  constructor() {
    // Initialize Elasticsearch client from environment variables
    this.client = createClientFromEnv();

    // Initialize MCP server
    this.server = new Server(
      {
        name: 'elastic-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Register all tools
    this.registerTools();

    // Set up request handlers
    this.setupHandlers();

    // Error handling
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  /**
   * Register all tool modules
   */
  private registerTools(): void {
    // Search tools
    const searchTools = createSearchTools(this.client);
    for (const tool of Object.values(searchTools)) {
      this.tools.set(tool.name, tool as ToolDefinition);
    }

    // Security tools
    const securityTools = createSecurityTools(this.client);
    for (const tool of Object.values(securityTools)) {
      this.tools.set(tool.name, tool as ToolDefinition);
    }

    // Index tools
    const indexTools = createIndexTools(this.client);
    for (const tool of Object.values(indexTools)) {
      this.tools.set(tool.name, tool as ToolDefinition);
    }

    // Cluster tools
    const clusterTools = createClusterTools(this.client);
    for (const tool of Object.values(clusterTools)) {
      this.tools.set(tool.name, tool as ToolDefinition);
    }

    console.error(`[Elastic MCP] Registered ${this.tools.size} tools`);
  }

  /**
   * Set up MCP request handlers
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools: Tool[] = [];

      for (const tool of this.tools.values()) {
        // Convert Zod schema to JSON Schema
        const inputSchema = this.zodToJsonSchema(tool.schema);

        tools.push({
          name: tool.name,
          description: tool.description,
          inputSchema: inputSchema as Tool['inputSchema'],
        });
      }

      return { tools };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      const tool = this.tools.get(name);
      if (!tool) {
        return {
          content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
          isError: true,
        };
      }

      try {
        // Validate and parse arguments using Zod schema
        const parsedArgs = tool.schema.parse(args || {});

        // Execute the tool handler
        const result = await tool.handler(parsedArgs);
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [{ type: 'text' as const, text: `Tool execution failed: ${errorMessage}` }],
          isError: true,
        };
      }
    });
  }

  /**
   * Convert Zod schema to JSON Schema (simplified)
   */
  private zodToJsonSchema(schema: { _def?: { shape?: () => Record<string, unknown> } }): {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
  } {
    // This is a simplified conversion - for production, use zod-to-json-schema
    const jsonSchema: {
      type: 'object';
      properties: Record<string, unknown>;
      required: string[];
    } = {
      type: 'object',
      properties: {},
      required: [],
    };

    // Try to extract shape from Zod object schema
    try {
      if (schema._def && typeof schema._def.shape === 'function') {
        const shape = schema._def.shape();
        const properties: Record<string, unknown> = {};
        const required: string[] = [];

        for (const [key, fieldSchema] of Object.entries(shape)) {
          const field = fieldSchema as { _def?: { description?: string; typeName?: string; defaultValue?: () => unknown } };
          const fieldDef = field._def || {};

          // Basic type inference
          let type = 'string';
          if (fieldDef.typeName === 'ZodNumber') type = 'number';
          if (fieldDef.typeName === 'ZodBoolean') type = 'boolean';
          if (fieldDef.typeName === 'ZodArray') type = 'array';
          if (fieldDef.typeName === 'ZodObject') type = 'object';

          properties[key] = {
            type,
            description: fieldDef.description,
          };

          // Check if required (not optional and no default)
          if (fieldDef.typeName !== 'ZodOptional' && !fieldDef.defaultValue) {
            required.push(key);
          }
        }

        jsonSchema.properties = properties;
        if (required.length > 0) {
          jsonSchema.required = required;
        }
      }
    } catch {
      // If schema extraction fails, return basic object schema
    }

    return jsonSchema;
  }

  /**
   * Start the MCP server
   */
  async run(): Promise<void> {
    // Test connection before starting
    try {
      const pingResult = await this.client.ping();
      if (pingResult) {
        console.error('[Elastic MCP] Successfully connected to Elasticsearch');
      } else {
        console.error('[Elastic MCP] Warning: Could not verify Elasticsearch connection');
      }
    } catch (error) {
      console.error('[Elastic MCP] Warning: Connection test failed:', error);
    }

    // Start server with stdio transport
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('[Elastic MCP] Server started on stdio');
  }
}

// Entry point
const server = new ElasticMCPServer();
server.run().catch((error) => {
  console.error('[Elastic MCP] Fatal error:', error);
  process.exit(1);
});
