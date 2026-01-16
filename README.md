# Elastic MCP Server

A comprehensive MCP (Model Context Protocol) server for Elasticsearch with InfoSec-focused tools for security management, search operations, index management, and cluster monitoring.

## Features

- **Security Management**: Users, roles, API keys, privileges
- **Search & Query**: Full-text search, ES|QL, aggregations
- **Index Operations**: List, create, delete, mappings, settings
- **Cluster Monitoring**: Health, stats, nodes, shards
- **Cross-Platform**: Works on Windows, macOS, and Linux

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and configure your Elasticsearch connection:

```bash
# macOS/Linux
cp .env.example .env

# Windows (Command Prompt)
copy .env.example .env

# Windows (PowerShell)
Copy-Item .env.example .env
```

Edit `.env` with your credentials:

```bash
# Elasticsearch endpoint
ELASTIC_URL=https://your-deployment.es.region.azure.elastic-cloud.com

# API Key authentication (recommended)
ELASTIC_API_KEY_ENCODED=your-base64-encoded-api-key
```

### 3. Build

```bash
npm run build
```

### 4. Run

```bash
npm start
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ELASTIC_URL` | Yes | Elasticsearch cluster URL |
| `ELASTIC_API_KEY_ENCODED` | Yes* | Pre-encoded API key (base64) |
| `ELASTIC_API_KEY_ID` | Yes* | API key ID (alternative to encoded) |
| `ELASTIC_API_KEY_SECRET` | Yes* | API key secret (use with ID) |
| `ELASTIC_USERNAME` | Yes* | Basic auth username |
| `ELASTIC_PASSWORD` | Yes* | Basic auth password |
| `ELASTIC_SKIP_SSL_VERIFY` | No | Skip SSL verification (default: false) |
| `ELASTIC_TIMEOUT` | No | Request timeout in ms (default: 30000) |
| `LOG_LEVEL` | No | Logging level (default: info) |

*One authentication method is required: encoded API key, ID+secret, or username+password.

### Authentication Methods

#### API Key (Recommended)

Use the pre-encoded API key from the Elasticsearch API key creation response:

```bash
ELASTIC_API_KEY_ENCODED=YWNCT3hKc0JjVEtMYUN5ZWVNa046UGR4OUxwOFRtY2R5WElfTjBvMEhrQQ==
```

#### Separate ID and Secret

If you have the raw ID and secret:

```bash
ELASTIC_API_KEY_ID=acBOxJsBcTKLaCyeeMkN
ELASTIC_API_KEY_SECRET=Pdx9Lp8TmcdyXI_N0o0HkA
```

#### Basic Auth (Not Recommended)

```bash
ELASTIC_USERNAME=elastic
ELASTIC_PASSWORD=your-password
```

## Available Tools

### Search Tools (5 tools)

| Tool | Description |
|------|-------------|
| `search` | Execute search queries using Elasticsearch Query DSL |
| `esql_query` | Execute ES\|QL queries for data analysis |
| `get_document` | Retrieve a specific document by ID |
| `count` | Count documents matching a query |
| `msearch` | Execute multiple search queries in one request |

### Security Tools (12 tools)

| Tool | Description |
|------|-------------|
| `list_users` | List all users in the security realm |
| `get_user` | Get detailed user information |
| `create_user` | Create a new user with roles |
| `delete_user` | Delete a user |
| `set_user_enabled` | Enable or disable a user |
| `list_roles` | List all defined roles |
| `get_role` | Get role details |
| `create_role` | Create or update a role |
| `delete_role` | Delete a role |
| `list_api_keys` | List API keys |
| `create_api_key` | Create a new API key |
| `invalidate_api_key` | Invalidate API keys |
| `get_privileges` | Get current user privileges |
| `has_privileges` | Check specific privileges |
| `authenticate` | Get current authenticated user info |

### Index Tools (9 tools)

| Tool | Description |
|------|-------------|
| `list_indices` | List all indices with health and stats |
| `get_index` | Get index details |
| `get_mappings` | Get field mappings |
| `get_settings` | Get index settings |
| `create_index` | Create a new index |
| `delete_index` | Delete an index (requires confirmation) |
| `refresh_index` | Refresh an index |
| `get_index_stats` | Get index statistics |
| `get_aliases` | Get index aliases |

### Cluster Tools (8 tools)

| Tool | Description |
|------|-------------|
| `cluster_health` | Get cluster health status |
| `cluster_stats` | Get comprehensive cluster statistics |
| `cluster_info` | Get basic cluster info and version |
| `nodes_info` | Get node information |
| `nodes_stats` | Get node statistics |
| `pending_tasks` | List pending cluster tasks |
| `allocation_explain` | Explain shard allocation |
| `get_shards` | Get shard allocation details |

## Usage Examples

### Search for Security Events

```json
{
  "tool": "search",
  "arguments": {
    "index": "logs-*",
    "query": {
      "bool": {
        "must": [
          { "match": { "event.category": "authentication" } },
          { "match": { "event.outcome": "failure" } }
        ]
      }
    },
    "size": 100,
    "sort": [{ "@timestamp": "desc" }]
  }
}
```

### List All Users

```json
{
  "tool": "list_users",
  "arguments": {}
}
```

### Check Cluster Health

```json
{
  "tool": "cluster_health",
  "arguments": {
    "level": "indices"
  }
}
```

### Create an API Key

```json
{
  "tool": "create_api_key",
  "arguments": {
    "name": "my-api-key",
    "expiration": "30d",
    "role_descriptors": {
      "read-only": {
        "cluster": ["monitor"],
        "indices": [{
          "names": ["logs-*"],
          "privileges": ["read"]
        }]
      }
    }
  }
}
```

## Development

### Run Tests

```bash
npm test
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

### Lint

```bash
npm run lint
```

### Watch Mode

```bash
npm run dev
```

## Claude Desktop Integration

### macOS / Linux

Config location: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `~/.config/claude/claude_desktop_config.json` (Linux)

```json
{
  "mcpServers": {
    "elastic": {
      "command": "node",
      "args": ["/path/to/elastic-mcp/dist/index.js"],
      "env": {
        "ELASTIC_URL": "https://your-deployment.es.region.azure.elastic-cloud.com",
        "ELASTIC_API_KEY_ENCODED": "your-encoded-api-key"
      }
    }
  }
}
```

### Windows

Config location: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "elastic": {
      "command": "node",
      "args": ["C:\\Users\\YourName\\elastic-mcp\\dist\\index.js"],
      "env": {
        "ELASTIC_URL": "https://your-deployment.es.region.azure.elastic-cloud.com",
        "ELASTIC_API_KEY_ENCODED": "your-encoded-api-key"
      }
    }
  }
}
```

**Windows Notes:**
- Use double backslashes (`\\`) in JSON paths, or forward slashes (`/`) which also work
- Ensure Node.js is installed and available in your PATH
- Run `npm install` and `npm run build` before first use

## Security Considerations

- API keys are never logged or exposed in responses
- All credentials must be provided via environment variables
- SSL certificate verification is enabled by default
- The `delete_index` tool requires explicit confirmation
- Created API keys return the encoded value but not the raw secret

## License

MIT
