# MCP Claude FileMaker

A comprehensive Model Context Protocol (MCP) server for integrating Claude with FileMaker databases. This server enables Claude to interact with your FileMaker databases through the FileMaker Data API, providing seamless database operations, script execution, and metadata discovery.

## 🌟 Features

### Core Functionality
- **Multi-Database Support**: Connect to multiple FileMaker databases simultaneously
- **Dynamic Configuration**: Configure databases via environment variables
- **Intelligent Caching**: Built-in caching for improved performance
- **Self-Signed Certificate Support**: Works with FileMaker Cloud and on-premise servers
- **Comprehensive Error Handling**: Robust error handling and recovery

### Database Operations
- **List Databases**: Enumerate all configured databases
- **Test Connections**: Verify database connectivity
- **Get Metadata**: Retrieve database schemas and layout information
- **Query Records**: Advanced record querying with filtering and sorting
- **Create Records**: Insert new records into layouts
- **Update Records**: Modify existing records
- **Delete Records**: Remove records from the database
- **Execute Scripts**: Run FileMaker scripts with parameters
- **Script Discovery**: List available scripts

### Authentication Methods
- **Username/Password**: Traditional FileMaker authentication
- **API Key**: OttoFMS and modern FileMaker authentication

## 📦 Installation

### Prerequisites
- Node.js 18+ installed
- FileMaker Server with Data API enabled
- Claude Desktop (for MCP integration)

### Quick Start

1. **Clone or Download**
   ```bash
   git clone https://github.com/YOUR_USERNAME/MCP-Claude-FileMaker.git
   cd MCP-Claude-FileMaker
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your FileMaker database details
   ```

4. **Configure Claude Desktop**
   Add to your Claude Desktop configuration:
   ```json
   {
     "mcpServers": {
       "filemaker": {
         "command": "node",
         "args": ["/path/to/MCP-Claude-FileMaker/server.js"],
         "env": {
           "FM_PROTOCOL": "https",
           "FM_API_VERSION": "v1",
           "FM_SSL_VERIFY": "false",
           "NODE_TLS_REJECT_UNAUTHORIZED": "0",
           "FM_SERVER_MYDB": "your-filemaker-server.com",
           "FM_DATABASE_MYDB": "YourDatabase",
           "FM_ACCOUNT_MYDB": "your_username",
           "FM_PASSWORD_MYDB": "your_password"
         }
       }
     }
   }
   ```

5. **Restart Claude Desktop**

## ⚙️ Configuration

### Environment Variables

The server uses environment variables for configuration. You can configure multiple databases using a simple naming pattern.

#### Global Settings
```env
FM_PROTOCOL=https              # http or https
FM_API_VERSION=v1              # FileMaker Data API version
FM_SSL_VERIFY=false            # Set to true for production
NODE_TLS_REJECT_UNAUTHORIZED=0 # Set to 1 for production
CACHE_TTL=840                  # Data cache TTL in seconds (14 minutes)
SESSION_TTL=780                # Session cache TTL in seconds (13 minutes)
```

#### Database Configuration Pattern

**For Username/Password Authentication:**
```env
FM_SERVER_IDENTIFIER=your-server.com
FM_DATABASE_IDENTIFIER=YourDatabase
FM_ACCOUNT_IDENTIFIER=username
FM_PASSWORD_IDENTIFIER=password
```

**For API Key Authentication:**
```env
FM_SERVER_IDENTIFIER=your-server.com
FM_DATABASE_IDENTIFIER=YourDatabase
FM_API_KEY_IDENTIFIER=your-api-key
```

#### Multiple Database Example
```env
# Production Database
FM_SERVER_PROD=prod.filemaker-server.com
FM_DATABASE_PROD=MainDatabase
FM_ACCOUNT_PROD=api_user
FM_PASSWORD_PROD=secure_password

# Development Database
FM_SERVER_DEV=dev.filemaker-server.com
FM_DATABASE_DEV=TestDatabase
FM_API_KEY_DEV=dev-api-key-12345

# Customer Database
FM_SERVER_CUSTOMERS=customers.filemaker-server.com
FM_DATABASE_CUSTOMERS=CustomerDB
FM_ACCOUNT_CUSTOMERS=readonly
FM_PASSWORD_CUSTOMERS=readonly_pass
```

### Claude Desktop Configuration

#### Simple Single Database
```json
{
  "mcpServers": {
    "filemaker": {
      "command": "node",
      "args": ["/absolute/path/to/MCP-Claude-FileMaker/server.js"],
      "env": {
        "FM_PROTOCOL": "https",
        "FM_API_VERSION": "v1",
        "FM_SSL_VERIFY": "false",
        "NODE_TLS_REJECT_UNAUTHORIZED": "0",
        "FM_SERVER_MAIN": "your-server.com",
        "FM_DATABASE_MAIN": "YourDatabase",
        "FM_ACCOUNT_MAIN": "your_username",
        "FM_PASSWORD_MAIN": "your_password"
      }
    }
  }
}
```

#### Multiple Databases
```json
{
  "mcpServers": {
    "filemaker": {
      "command": "node",
      "args": ["/absolute/path/to/MCP-Claude-FileMaker/server.js"],
      "env": {
        "FM_PROTOCOL": "https",
        "FM_API_VERSION": "v1",
        "FM_SSL_VERIFY": "false",
        "NODE_TLS_REJECT_UNAUTHORIZED": "0",
        "FM_SERVER_PROD": "prod.your-server.com",
        "FM_DATABASE_PROD": "Production",
        "FM_ACCOUNT_PROD": "api_user",
        "FM_PASSWORD_PROD": "prod_password",
        "FM_SERVER_DEV": "dev.your-server.com",
        "FM_DATABASE_DEV": "Development",
        "FM_API_KEY_DEV": "dev-api-key-123"
      }
    }
  }
}
```

## 🔧 Available Tools

### Database Management

#### `fm_list_databases`
List all configured databases.
```
No parameters required
```

#### `fm_test_connection`
Test connection to a specific database.
```
database: Database identifier to test
```

#### `fm_get_metadata`
Get database metadata (layouts/tables).
```
database: Database identifier
```

#### `fm_get_layout_metadata`
Get detailed metadata for a specific layout.
```
database: Database identifier
layout: Layout name
```

### Data Operations

#### `fm_query_records`
Query records with advanced filtering and sorting.
```
database: Database identifier
layout: Layout name
query: (optional) Array of find requests
sort: (optional) Sort array
limit: (optional) Max records to return
offset: (optional) Records to skip
```

#### `fm_create_record`
Create a new record.
```
database: Database identifier
layout: Layout name
fieldData: Object with field names and values
```

#### `fm_update_record`
Update an existing record.
```
database: Database identifier
layout: Layout name
recordId: FileMaker record ID
fieldData: Object with field names and new values
```

#### `fm_delete_record`
Delete a record.
```
database: Database identifier
layout: Layout name
recordId: FileMaker record ID
```

### Script Operations

#### `fm_run_script`
Execute a FileMaker script.
```
database: Database identifier
layout: Layout context
script: Script name
parameter: (optional) Script parameter
```

#### `fm_get_scripts`
Get list of available scripts.
```
database: Database identifier
```

### Utility Operations

#### `fm_clear_cache`
Clear cached data.
```
type: Type of cache to clear ("data", "session", "all")
```

## 🚀 Usage Examples

### Basic Usage with Claude

1. **List Available Databases**
   ```
   "List all my FileMaker databases"
   ```

2. **Explore Database Structure**
   ```
   "Show me the layouts in my PROD database"
   "Get the field definitions for the Customers layout"
   ```

3. **Query Data**
   ```
   "Find all customers with status 'Active' in the PROD database"
   "Show me the last 10 orders from the Orders layout"
   ```

4. **Create Records**
   ```
   "Create a new customer record with name 'John Doe' and email 'john@example.com'"
   ```

5. **Run Scripts**
   ```
   "Run the 'Calculate Totals' script on the Orders layout"
   "Execute the backup script with parameter 'weekly'"
   ```

### Advanced Queries

```javascript
// Complex find request
{
  "query": [
    {
      "FirstName": "John",
      "Status": "Active"
    },
    {
      "LastName": "Smith",
      "omit": "true"
    }
  ],
  "sort": [
    {
      "fieldName": "LastName",
      "sortOrder": "ascend"
    }
  ],
  "limit": 50
}
```

## 🔒 Security Considerations

### Production Deployment
- Set `FM_SSL_VERIFY=true`
- Set `NODE_TLS_REJECT_UNAUTHORIZED=1`
- Use strong passwords or API keys
- Limit database privileges for API accounts
- Use HTTPS for all connections
- Keep the MCP server updated

### Authentication Best Practices
- Create dedicated API accounts with minimal required privileges
- Use API keys when possible (OttoFMS)
- Regularly rotate passwords and API keys
- Monitor access logs

## 🐳 Docker Deployment

### Build and Run
```bash
# Build the image
docker build -t mcp-claude-filemaker .

# Run with environment file
docker run -d --env-file .env --name mcp-filemaker mcp-claude-filemaker

# Run with inline environment variables
docker run -d \
  -e FM_PROTOCOL=https \
  -e FM_SERVER_MAIN=your-server.com \
  -e FM_DATABASE_MAIN=YourDB \
  -e FM_ACCOUNT_MAIN=username \
  -e FM_PASSWORD_MAIN=password \
  --name mcp-filemaker \
  mcp-claude-filemaker
```

## 📁 FileMaker Connector Extension

Included in the `connectors/` directory is `filemaker-connector-v2.1.0.dxt` - a powerful FileMaker extension that provides enhanced integration capabilities with Claude and the MCP server. This drag-and-drop extension simplifies the process of connecting your FileMaker databases to Claude.

### What is the FileMaker Connector?
The FileMaker Connector is a pre-built extension (`.dxt` file) that:
- Provides a user-friendly interface for configuring database connections
- Automatically generates the necessary server configuration
- Includes connection testing and validation tools
- Streamlines the setup process for non-technical users
- Works alongside the MCP server to provide seamless Claude integration

### Installation Steps

#### Step 1: Install the Extension
1. **Open FileMaker Pro** on your computer
2. **Locate the connector file**: `connectors/filemaker-connector-v2.1.0.dxt`
3. **Drag and drop** the `.dxt` file directly onto the FileMaker Pro application window
4. **Follow the installation prompts** that appear
5. **Restart FileMaker Pro** if prompted

#### Step 2: Access the Connector
After installation, the connector will be available in:
- **Extensions menu** → FileMaker Connector
- **Tools menu** → Extensions → FileMaker Connector
- Or look for a "Claude Integration" or "MCP Connector" option

#### Step 3: Configure Your Connection
1. **Open the connector** from the Extensions menu
2. **Fill in your server details**:
   - **Server Address**: Your FileMaker Server URL (e.g., `your-server.com`)
   - **Database Name**: The FileMaker database filename (without .fmp12)
   - **Username/Password**: FileMaker account credentials with API access
   - **Protocol**: Usually `https` for production servers
   - **API Version**: Typically `v1` (FileMaker Data API version)

#### Step 4: Test and Generate Configuration
1. **Test the connection** using the built-in connection tester
2. **Generate MCP configuration** - the connector will create the proper environment variables
3. **Copy the generated configuration** to use in your Claude Desktop setup

### Using the Generated Configuration

After configuring the connector, it will generate environment variables in this format:
```env
FM_PROTOCOL=https
FM_API_VERSION=v1
FM_SSL_VERIFY=false
FM_SERVER_YOURDB=your-server.com
FM_DATABASE_YOURDB=YourDatabase
FM_ACCOUNT_YOURDB=your_username
FM_PASSWORD_YOURDB=your_password
```

You can then use these in your Claude Desktop configuration or `.env` file.

### Connector Features

#### Connection Management
- **Multiple Database Support**: Configure connections to multiple FileMaker databases
- **Credential Validation**: Test credentials before saving configuration
- **SSL Certificate Handling**: Automatic handling of self-signed certificates
- **Connection Status Monitoring**: Real-time connection health checks

#### Configuration Generation
- **Auto-Generate Environment Variables**: Creates properly formatted `.env` files
- **Claude Desktop Config**: Generates ready-to-use Claude Desktop JSON configuration
- **Export/Import Settings**: Save and share configuration templates
- **Backup Configuration**: Keep copies of working configurations

#### Advanced Features
- **Script Discovery**: Browse available FileMaker scripts
- **Layout Inspection**: View database schema and field definitions
- **Permission Testing**: Verify account privileges and access levels
- **Performance Monitoring**: Check response times and server performance

### Troubleshooting the Connector

**Connector Won't Install**
- Ensure you're using FileMaker Pro 19.0 or later
- Check that FileMaker Pro has permission to install extensions
- Try restarting FileMaker Pro and installing again

**Connection Test Fails**
- Verify server URL is correct and accessible
- Check that FileMaker Server Data API is enabled
- Confirm username/password are correct and account is active
- Test network connectivity to the FileMaker Server

**Configuration Not Working**
- Double-check generated environment variables
- Ensure MCP server can access the same network as FileMaker Server
- Verify Claude Desktop is using the correct configuration file path

### Manual Configuration (Alternative)

If you prefer not to use the connector extension, you can manually configure the MCP server by:
1. Setting up environment variables as shown in the Configuration section above
2. Testing connections using the MCP server's built-in connection tools
3. Configuring Claude Desktop manually with your database details

The connector simply automates this process and provides a user-friendly interface for configuration management.

## 🛠️ Development

### Build from Source
```bash
# Install dependencies
npm install

# Build TypeScript (if using src/)
npm run build

# Start development server
npm run dev

# Run tests
npm test
```

### Project Structure
```
MCP-Claude-FileMaker/
├── server.js              # Main server file (production ready)
├── src/                   # TypeScript source files
│   ├── index.ts           # TypeScript entry point
│   └── filemaker-client.ts # FileMaker client class
├── connectors/            # FileMaker extensions
│   └── filemaker-connector-v2.1.0.dxt
├── package.json           # Node.js package configuration
├── tsconfig.json          # TypeScript configuration
├── Dockerfile             # Docker container definition
├── .env.example           # Environment configuration template
└── README.md              # This file
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Setup
1. Fork the repository
2. Clone your fork
3. Create a feature branch
4. Make your changes
5. Test thoroughly
6. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚡ Troubleshooting

### Common Issues

**Connection Failed**
- Verify FileMaker Server Data API is enabled
- Check server URL and credentials
- Ensure firewall allows connections on port 443/80
- Verify SSL certificate settings

**Authentication Errors**
- Check username/password or API key
- Verify account privileges in FileMaker
- Ensure account is not disabled

**No Databases Found**
- Check environment variable naming pattern
- Verify all required variables are set
- Check for typos in variable names

**Cache Issues**
- Use `fm_clear_cache` to clear cached data
- Restart the server for persistent issues

### Debug Mode
Set environment variable `DEBUG=1` for verbose logging:
```bash
DEBUG=1 node server.js
```

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review FileMaker Data API documentation

---

**Made with ❤️ for the FileMaker and Claude communities**