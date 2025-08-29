import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { FileMakerClient } from './filemaker-client.js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

// Initialize FileMaker clients dynamically from environment variables
let clients: Record<string, FileMakerClient> = {};
let databaseNames: string[] = [];

try {
  // Discover databases from environment variables
  const envKeys = Object.keys(process.env);
  const serverKeys = envKeys.filter(key => key.startsWith('FM_SERVER_'));
  
  for (const serverKey of serverKeys) {
    const identifier = serverKey.replace('FM_SERVER_', '');
    const server = process.env[serverKey];
    const database = process.env[`FM_DATABASE_${identifier}`];
    const username = process.env[`FM_ACCOUNT_${identifier}`];
    const password = process.env[`FM_PASSWORD_${identifier}`];
    const apiKey = process.env[`FM_API_KEY_${identifier}`];
    const protocol = process.env.FM_PROTOCOL || 'https';
    const apiVersion = process.env.FM_API_VERSION || 'v1';
    
    if (server && database && ((username && password) || apiKey)) {
      clients[identifier] = new FileMakerClient({
        server: server,
        database: database,
        username: username || '',
        password: password || '',
        protocol: protocol,
        apiVersion: apiVersion
      });
      databaseNames.push(identifier);
    }
  }
  
  if (databaseNames.length === 0) {
    throw new Error('No valid FileMaker database configurations found in environment variables');
  }
  
  console.error(`Initialized ${databaseNames.length} FileMaker database(s): ${databaseNames.join(', ')}`);
} catch (error) {
  console.error('Failed to initialize FileMaker clients:', error);
  process.exit(1);
}

// Create MCP server
const server = new Server(
  {
    name: 'mcp-claude-filemaker',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'fm_list_databases',
        description: 'List all configured FileMaker databases',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'fm_get_layouts',
        description: 'Get all layouts from a FileMaker database',
        inputSchema: {
          type: 'object',
          properties: {
            database: {
              type: 'string',
              enum: databaseNames,
              description: 'The database identifier to query'
            }
          },
          required: ['database']
        }
      },
      {
        name: 'fm_get_layout_metadata',
        description: 'Get metadata for a specific layout including field definitions',
        inputSchema: {
          type: 'object',
          properties: {
            database: {
              type: 'string',
              enum: databaseNames,
              description: 'The database identifier to query'
            },
            layout: {
              type: 'string',
              description: 'The layout name'
            }
          },
          required: ['database', 'layout']
        }
      },
      {
        name: 'fm_get_records',
        description: 'Get records from a FileMaker layout',
        inputSchema: {
          type: 'object',
          properties: {
            database: {
              type: 'string',
              enum: databaseNames,
              description: 'The database identifier to query'
            },
            layout: {
              type: 'string',
              description: 'The layout name'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of records to return (default: 100)'
            },
            offset: {
              type: 'number',
              description: 'Number of records to skip (default: 1)'
            }
          },
          required: ['database', 'layout']
        }
      },
      {
        name: 'fm_find_records',
        description: 'Find records in FileMaker using query criteria',
        inputSchema: {
          type: 'object',
          properties: {
            database: {
              type: 'string',
              enum: databaseNames,
              description: 'The database identifier to query'
            },
            layout: {
              type: 'string',
              description: 'The layout name'
            },
            query: {
              type: 'array',
              description: 'Array of find requests',
              items: {
                type: 'object',
                additionalProperties: true
              }
            },
            limit: {
              type: 'number',
              description: 'Maximum number of records to return'
            },
            offset: {
              type: 'number',
              description: 'Number of records to skip'
            }
          },
          required: ['database', 'layout', 'query']
        }
      },
      {
        name: 'fm_get_record',
        description: 'Get a specific record by ID',
        inputSchema: {
          type: 'object',
          properties: {
            database: {
              type: 'string',
              enum: databaseNames,
              description: 'The database identifier to query'
            },
            layout: {
              type: 'string',
              description: 'The layout name'
            },
            recordId: {
              type: 'string',
              description: 'The FileMaker record ID'
            }
          },
          required: ['database', 'layout', 'recordId']
        }
      },
      {
        name: 'fm_run_script',
        description: 'Run a FileMaker script',
        inputSchema: {
          type: 'object',
          properties: {
            database: {
              type: 'string',
              enum: databaseNames,
              description: 'The database identifier to run the script in'
            },
            layout: {
              type: 'string',
              description: 'The layout context for the script'
            },
            script: {
              type: 'string',
              description: 'The script name'
            },
            parameter: {
              type: 'string',
              description: 'Optional script parameter'
            }
          },
          required: ['database', 'layout', 'script']
        }
      },
      {
        name: 'fm_clear_cache',
        description: 'Clear the cache for a specific database or all databases',
        inputSchema: {
          type: 'object',
          properties: {
            database: {
              type: 'string',
              enum: [...databaseNames, 'all'],
              description: 'The database identifier to clear cache for, or "all" for all databases'
            }
          },
          required: ['database']
        }
      }
    ]
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    return {
      content: [
        {
          type: 'text',
          text: 'Error: No arguments provided'
        }
      ]
    };
  }

  try {
    switch (name) {
      case 'fm_list_databases': {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                databases: databaseNames,
                count: databaseNames.length
              }, null, 2)
            }
          ]
        };
      }

      case 'fm_get_layouts': {
        const database = args.database as keyof typeof clients;
        if (!database || !clients[database]) {
          throw new Error('Invalid database specified');
        }
        const client = clients[database];
        const result = await client.getLayouts();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.response, null, 2)
            }
          ]
        };
      }

      case 'fm_get_layout_metadata': {
        const database = args.database as keyof typeof clients;
        const layout = args.layout as string;
        if (!database || !clients[database]) {
          throw new Error('Invalid database specified');
        }
        if (!layout) {
          throw new Error('Layout is required');
        }
        const client = clients[database];
        const result = await client.getLayout(layout);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.response, null, 2)
            }
          ]
        };
      }

      case 'fm_get_records': {
        const database = args.database as keyof typeof clients;
        const layout = args.layout as string;
        const limit = (args.limit as number) || 100;
        const offset = (args.offset as number) || 1;
        if (!database || !clients[database]) {
          throw new Error('Invalid database specified');
        }
        if (!layout) {
          throw new Error('Layout is required');
        }
        const client = clients[database];
        const result = await client.getRecords(layout, limit, offset);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.response, null, 2)
            }
          ]
        };
      }

      case 'fm_find_records': {
        const database = args.database as keyof typeof clients;
        const layout = args.layout as string;
        const query = args.query as any[];
        const limit = args.limit as number | undefined;
        const offset = args.offset as number | undefined;
        if (!database || !clients[database]) {
          throw new Error('Invalid database specified');
        }
        if (!layout) {
          throw new Error('Layout is required');
        }
        if (!query) {
          throw new Error('Query is required');
        }
        const client = clients[database];
        const findRequest: any = {
          query: query,
          ...(limit && { limit: limit }),
          ...(offset && { offset: offset })
        };
        const result = await client.findRecords(layout, findRequest);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.response, null, 2)
            }
          ]
        };
      }

      case 'fm_get_record': {
        const database = args.database as keyof typeof clients;
        const layout = args.layout as string;
        const recordId = args.recordId as string;
        if (!database || !clients[database]) {
          throw new Error('Invalid database specified');
        }
        if (!layout) {
          throw new Error('Layout is required');
        }
        if (!recordId) {
          throw new Error('Record ID is required');
        }
        const client = clients[database];
        const result = await client.getRecord(layout, recordId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.response, null, 2)
            }
          ]
        };
      }

      case 'fm_run_script': {
        const database = args.database as keyof typeof clients;
        const layout = args.layout as string;
        const script = args.script as string;
        const parameter = args.parameter as string | undefined;
        if (!database || !clients[database]) {
          throw new Error('Invalid database specified');
        }
        if (!layout) {
          throw new Error('Layout is required');
        }
        if (!script) {
          throw new Error('Script name is required');
        }
        const client = clients[database];
        const result = await client.runScript(layout, script, parameter);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.response || { success: true }, null, 2)
            }
          ]
        };
      }

      case 'fm_clear_cache': {
        const database = args.database as string;
        if (!database) {
          throw new Error('Database is required');
        }
        if (database === 'all') {
          Object.values(clients).forEach(client => client.clearCache());
          return {
            content: [
              {
                type: 'text',
                text: 'Cache cleared for all databases'
              }
            ]
          };
        } else {
          const dbKey = database as keyof typeof clients;
          if (!clients[dbKey]) {
            throw new Error('Invalid database specified');
          }
          const client = clients[dbKey];
          client.clearCache();
          return {
            content: [
              {
                type: 'text',
                text: `Cache cleared for ${database}`
              }
            ]
          };
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`
        }
      ]
    };
  }
});

// Start the server
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // Use stderr for logging to avoid interfering with JSON protocol
    console.error('MCP Claude FileMaker server started');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

main();