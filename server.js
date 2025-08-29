#!/usr/bin/env node

// Load environment variables directly in this file
import dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import https from 'https';
import NodeCache from 'node-cache';

// Create an agent that accepts self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.FM_SSL_VERIFY === 'true' && process.env.NODE_TLS_REJECT_UNAUTHORIZED === '1'
});

// Cache for data (14 minutes)
const dataCache = new NodeCache({ 
  stdTTL: parseInt(process.env.CACHE_TTL) || 840,
  checkperiod: 120 
});

// Cache for sessions (13 minutes)
const sessionCache = new NodeCache({ 
  stdTTL: parseInt(process.env.SESSION_TTL) || 780,
  checkperiod: 60 
});

// Discover databases from environment variables
const databases = {};
const databaseNames = [];
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
    databases[identifier] = {
      server,
      database,
      username,
      password,
      apiKey,
      protocol,
      apiVersion
    };
    databaseNames.push(identifier);
  }
}

if (databaseNames.length === 0) {
  console.error('No valid FileMaker database configurations found in environment variables');
  console.error('Please set up databases using the pattern: FM_SERVER_<ID>, FM_DATABASE_<ID>, etc.');
  process.exit(1);
}

console.error(`Found ${databaseNames.length} FileMaker database(s): ${databaseNames.join(', ')}`);

// FileMaker authentication and request handling
async function authenticateFileMaker(dbConfig) {
  const cacheKey = `session_${dbConfig.database}`;
  const cachedSession = sessionCache.get(cacheKey);
  
  if (cachedSession) {
    return cachedSession;
  }

  try {
    const baseURL = `${dbConfig.protocol}://${dbConfig.server}/fmi/data/${dbConfig.apiVersion}/databases/${dbConfig.database}`;
    const response = await axios.post(`${baseURL}/sessions`, {}, {
      auth: {
        username: dbConfig.username,
        password: dbConfig.password
      },
      httpsAgent
    });

    const token = response.data.response.token;
    sessionCache.set(cacheKey, token);
    return token;
  } catch (error) {
    throw new Error(`Authentication failed for ${dbConfig.database}: ${error.response?.data?.messages?.[0]?.message || error.message}`);
  }
}

async function makeFileMakerRequest(dbConfig, method, endpoint, data = null) {
  const token = await authenticateFileMaker(dbConfig);
  const baseURL = `${dbConfig.protocol}://${dbConfig.server}/fmi/data/${dbConfig.apiVersion}/databases/${dbConfig.database}`;
  
  try {
    const response = await axios({
      method,
      url: `${baseURL}${endpoint}`,
      data,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      httpsAgent
    });
    
    return response.data;
  } catch (error) {
    // If unauthorized, clear session and retry once
    if (error.response?.status === 401) {
      sessionCache.del(`session_${dbConfig.database}`);
      const newToken = await authenticateFileMaker(dbConfig);
      
      const retryResponse = await axios({
        method,
        url: `${baseURL}${endpoint}`,
        data,
        headers: {
          'Authorization': `Bearer ${newToken}`,
          'Content-Type': 'application/json'
        },
        httpsAgent
      });
      
      return retryResponse.data;
    }
    
    throw new Error(`Request failed: ${error.response?.data?.messages?.[0]?.message || error.message}`);
  }
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
        name: 'fm_test_connection',
        description: 'Test connection to a FileMaker database',
        inputSchema: {
          type: 'object',
          properties: {
            database: {
              type: 'string',
              enum: databaseNames,
              description: 'Database identifier to test'
            }
          },
          required: ['database']
        }
      },
      {
        name: 'fm_get_metadata',
        description: 'Get database metadata (layouts/tables)',
        inputSchema: {
          type: 'object',
          properties: {
            database: {
              type: 'string',
              enum: databaseNames,
              description: 'Database identifier'
            }
          },
          required: ['database']
        }
      },
      {
        name: 'fm_get_layout_metadata',
        description: 'Get detailed metadata for a specific layout',
        inputSchema: {
          type: 'object',
          properties: {
            database: {
              type: 'string',
              enum: databaseNames,
              description: 'Database identifier'
            },
            layout: {
              type: 'string',
              description: 'Layout name'
            }
          },
          required: ['database', 'layout']
        }
      },
      {
        name: 'fm_query_records',
        description: 'Query records with advanced filtering and sorting',
        inputSchema: {
          type: 'object',
          properties: {
            database: {
              type: 'string',
              enum: databaseNames,
              description: 'Database identifier'
            },
            layout: {
              type: 'string',
              description: 'Layout name'
            },
            query: {
              type: 'array',
              description: 'Find requests array',
              items: {
                type: 'object',
                additionalProperties: true
              }
            },
            sort: {
              type: 'array',
              description: 'Sort array',
              items: {
                type: 'object',
                properties: {
                  fieldName: { type: 'string' },
                  sortOrder: { type: 'string', enum: ['ascend', 'descend'] }
                }
              }
            },
            limit: {
              type: 'number',
              description: 'Max records to return'
            },
            offset: {
              type: 'number',
              description: 'Records to skip'
            }
          },
          required: ['database', 'layout']
        }
      },
      {
        name: 'fm_create_record',
        description: 'Create a new record',
        inputSchema: {
          type: 'object',
          properties: {
            database: {
              type: 'string',
              enum: databaseNames,
              description: 'Database identifier'
            },
            layout: {
              type: 'string',
              description: 'Layout name'
            },
            fieldData: {
              type: 'object',
              description: 'Field data for the new record',
              additionalProperties: true
            }
          },
          required: ['database', 'layout', 'fieldData']
        }
      },
      {
        name: 'fm_update_record',
        description: 'Update an existing record',
        inputSchema: {
          type: 'object',
          properties: {
            database: {
              type: 'string',
              enum: databaseNames,
              description: 'Database identifier'
            },
            layout: {
              type: 'string',
              description: 'Layout name'
            },
            recordId: {
              type: 'string',
              description: 'FileMaker record ID'
            },
            fieldData: {
              type: 'object',
              description: 'Field data to update',
              additionalProperties: true
            }
          },
          required: ['database', 'layout', 'recordId', 'fieldData']
        }
      },
      {
        name: 'fm_delete_record',
        description: 'Delete a record',
        inputSchema: {
          type: 'object',
          properties: {
            database: {
              type: 'string',
              enum: databaseNames,
              description: 'Database identifier'
            },
            layout: {
              type: 'string',
              description: 'Layout name'
            },
            recordId: {
              type: 'string',
              description: 'FileMaker record ID'
            }
          },
          required: ['database', 'layout', 'recordId']
        }
      },
      {
        name: 'fm_run_script',
        description: 'Execute a FileMaker script',
        inputSchema: {
          type: 'object',
          properties: {
            database: {
              type: 'string',
              enum: databaseNames,
              description: 'Database identifier'
            },
            layout: {
              type: 'string',
              description: 'Layout context'
            },
            script: {
              type: 'string',
              description: 'Script name'
            },
            parameter: {
              type: 'string',
              description: 'Script parameter'
            }
          },
          required: ['database', 'layout', 'script']
        }
      },
      {
        name: 'fm_get_scripts',
        description: 'Get list of available scripts',
        inputSchema: {
          type: 'object',
          properties: {
            database: {
              type: 'string',
              enum: databaseNames,
              description: 'Database identifier'
            }
          },
          required: ['database']
        }
      },
      {
        name: 'fm_clear_cache',
        description: 'Clear cached data',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['data', 'session', 'all'],
              description: 'Type of cache to clear'
            }
          },
          required: ['type']
        }
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    switch (name) {
      case 'fm_list_databases':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              databases: databaseNames,
              count: databaseNames.length
            }, null, 2)
          }]
        };
        
      case 'fm_test_connection': {
        const dbConfig = databases[args.database];
        if (!dbConfig) throw new Error('Database not found');
        
        try {
          await authenticateFileMaker(dbConfig);
          return {
            content: [{
              type: 'text',
              text: `✅ Connection successful to ${args.database}`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: `❌ Connection failed to ${args.database}: ${error.message}`
            }]
          };
        }
      }
      
      case 'fm_get_metadata': {
        const dbConfig = databases[args.database];
        if (!dbConfig) throw new Error('Database not found');
        
        const cacheKey = `metadata_${args.database}`;
        let result = dataCache.get(cacheKey);
        
        if (!result) {
          result = await makeFileMakerRequest(dbConfig, 'GET', '/layouts');
          dataCache.set(cacheKey, result);
        }
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result.response, null, 2)
          }]
        };
      }
      
      case 'fm_get_layout_metadata': {
        const dbConfig = databases[args.database];
        if (!dbConfig) throw new Error('Database not found');
        
        const cacheKey = `layout_${args.database}_${args.layout}`;
        let result = dataCache.get(cacheKey);
        
        if (!result) {
          result = await makeFileMakerRequest(dbConfig, 'GET', `/layouts/${encodeURIComponent(args.layout)}`);
          dataCache.set(cacheKey, result);
        }
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result.response, null, 2)
          }]
        };
      }
      
      case 'fm_query_records': {
        const dbConfig = databases[args.database];
        if (!dbConfig) throw new Error('Database not found');
        
        let endpoint = `/layouts/${encodeURIComponent(args.layout)}/records`;
        let method = 'GET';
        let requestData = null;
        
        // If query is provided, use POST to _find
        if (args.query && args.query.length > 0) {
          endpoint = `/layouts/${encodeURIComponent(args.layout)}/_find`;
          method = 'POST';
          requestData = {
            query: args.query,
            ...(args.sort && { sort: args.sort }),
            ...(args.limit && { limit: args.limit }),
            ...(args.offset && { offset: args.offset })
          };
        } else {
          // Simple GET request with parameters
          const params = new URLSearchParams();
          if (args.limit) params.append('_limit', args.limit.toString());
          if (args.offset) params.append('_offset', args.offset.toString());
          if (params.toString()) endpoint += `?${params.toString()}`;
        }
        
        const result = await makeFileMakerRequest(dbConfig, method, endpoint, requestData);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result.response, null, 2)
          }]
        };
      }
      
      case 'fm_create_record': {
        const dbConfig = databases[args.database];
        if (!dbConfig) throw new Error('Database not found');
        
        const requestData = {
          fieldData: args.fieldData
        };
        
        const result = await makeFileMakerRequest(
          dbConfig, 
          'POST', 
          `/layouts/${encodeURIComponent(args.layout)}/records`, 
          requestData
        );
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result.response, null, 2)
          }]
        };
      }
      
      case 'fm_update_record': {
        const dbConfig = databases[args.database];
        if (!dbConfig) throw new Error('Database not found');
        
        const requestData = {
          fieldData: args.fieldData
        };
        
        const result = await makeFileMakerRequest(
          dbConfig,
          'PATCH',
          `/layouts/${encodeURIComponent(args.layout)}/records/${args.recordId}`,
          requestData
        );
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result.response, null, 2)
          }]
        };
      }
      
      case 'fm_delete_record': {
        const dbConfig = databases[args.database];
        if (!dbConfig) throw new Error('Database not found');
        
        const result = await makeFileMakerRequest(
          dbConfig,
          'DELETE',
          `/layouts/${encodeURIComponent(args.layout)}/records/${args.recordId}`
        );
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result.response || { success: true }, null, 2)
          }]
        };
      }
      
      case 'fm_run_script': {
        const dbConfig = databases[args.database];
        if (!dbConfig) throw new Error('Database not found');
        
        let endpoint = `/layouts/${encodeURIComponent(args.layout)}/script/${encodeURIComponent(args.script)}`;
        if (args.parameter) {
          endpoint += `?script.param=${encodeURIComponent(args.parameter)}`;
        }
        
        const result = await makeFileMakerRequest(dbConfig, 'GET', endpoint);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result.response || { success: true }, null, 2)
          }]
        };
      }
      
      case 'fm_get_scripts': {
        const dbConfig = databases[args.database];
        if (!dbConfig) throw new Error('Database not found');
        
        const cacheKey = `scripts_${args.database}`;
        let result = dataCache.get(cacheKey);
        
        if (!result) {
          result = await makeFileMakerRequest(dbConfig, 'GET', '/scripts');
          dataCache.set(cacheKey, result);
        }
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result.response, null, 2)
          }]
        };
      }
      
      case 'fm_clear_cache': {
        switch (args.type) {
          case 'data':
            dataCache.flushAll();
            break;
          case 'session':
            sessionCache.flushAll();
            break;
          case 'all':
            dataCache.flushAll();
            sessionCache.flushAll();
            break;
        }
        
        return {
          content: [{
            type: 'text',
            text: `✅ ${args.type} cache cleared`
          }]
        };
      }
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error: ${error.message}`
      }]
    };
  }
});

// Start server
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('MCP Claude FileMaker server started successfully');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

main();