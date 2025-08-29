# Installation and Setup Guide

This guide will walk you through setting up the MCP Claude FileMaker server step-by-step.

## Prerequisites

### System Requirements
- **Node.js 18+**: [Download Node.js](https://nodejs.org/)
- **FileMaker Server**: With Data API enabled
- **Claude Desktop**: Latest version
- **Git**: For cloning the repository (optional)

### FileMaker Requirements
- FileMaker Server 19.0+ (recommended)
- Data API enabled on the server
- Valid user accounts with appropriate privileges
- Network access to FileMaker Server (port 443 for HTTPS, port 80 for HTTP)

## Step 1: Download and Install

### Option A: Download ZIP
1. Download the repository as a ZIP file from GitHub
2. Extract to your desired location (e.g., `/Users/YourName/MCP-Claude-FileMaker/`)
3. Open Terminal and navigate to the extracted folder

### Option B: Clone Repository
```bash
git clone https://github.com/YOUR_USERNAME/MCP-Claude-FileMaker.git
cd MCP-Claude-FileMaker
```

## Step 2: Install Dependencies

```bash
npm install
```

This will install all required Node.js packages.

## Step 3: Configure Your Databases

### Create Environment File
```bash
cp .env.example .env
```

### Edit Configuration
Open `.env` in your text editor and configure your FileMaker databases:

#### Single Database Example
```env
# Global settings
FM_PROTOCOL=https
FM_API_VERSION=v1
FM_SSL_VERIFY=false
NODE_TLS_REJECT_UNAUTHORIZED=0
CACHE_TTL=840
SESSION_TTL=780

# Your main database
FM_SERVER_MAIN=your-filemaker-server.com
FM_DATABASE_MAIN=YourDatabase
FM_ACCOUNT_MAIN=your_username
FM_PASSWORD_MAIN=your_password
```

#### Multiple Databases Example
```env
# Global settings
FM_PROTOCOL=https
FM_API_VERSION=v1
FM_SSL_VERIFY=false
NODE_TLS_REJECT_UNAUTHORIZED=0

# Production database
FM_SERVER_PROD=prod.your-server.com
FM_DATABASE_PROD=Production
FM_ACCOUNT_PROD=api_user
FM_PASSWORD_PROD=secure_password

# Development database
FM_SERVER_DEV=dev.your-server.com
FM_DATABASE_DEV=Development
FM_API_KEY_DEV=dev-api-key-12345

# Customer database
FM_SERVER_CUSTOMERS=customers.your-server.com
FM_DATABASE_CUSTOMERS=CustomerDB
FM_ACCOUNT_CUSTOMERS=readonly
FM_PASSWORD_CUSTOMERS=readonly_pass
```

### Configuration Variables Explained

| Variable | Description | Example |
|----------|-------------|----------|
| `FM_PROTOCOL` | Connection protocol | `https` or `http` |
| `FM_API_VERSION` | FileMaker Data API version | `v1` |
| `FM_SSL_VERIFY` | Verify SSL certificates | `false` for self-signed, `true` for production |
| `NODE_TLS_REJECT_UNAUTHORIZED` | Node.js SSL setting | `0` for self-signed, `1` for production |
| `FM_SERVER_ID` | FileMaker Server hostname | `server.company.com` |
| `FM_DATABASE_ID` | Database filename (without .fmp12) | `MyDatabase` |
| `FM_ACCOUNT_ID` | FileMaker username | `api_user` |
| `FM_PASSWORD_ID` | FileMaker password | `secure_password` |
| `FM_API_KEY_ID` | API key (alternative to username/password) | `key-12345` |
| `CACHE_TTL` | Data cache duration (seconds) | `840` (14 minutes) |
| `SESSION_TTL` | Session cache duration (seconds) | `780` (13 minutes) |

## Step 4: Test Your Configuration

### Quick Test
```bash
node server.js
```

If configured correctly, you should see:
```
Found 1 FileMaker database(s): MAIN
MCP Claude FileMaker server started successfully
```

Press `Ctrl+C` to stop the test.

### Test Connections
You can also create a simple test script:

```javascript
// test-connection.js
import dotenv from 'dotenv';
import axios from 'axios';
import https from 'https';

dotenv.config();

const testConnection = async () => {
  const server = process.env.FM_SERVER_MAIN;
  const database = process.env.FM_DATABASE_MAIN;
  const username = process.env.FM_ACCOUNT_MAIN;
  const password = process.env.FM_PASSWORD_MAIN;
  
  if (!server || !database || !username || !password) {
    console.log('❌ Missing configuration variables');
    return;
  }
  
  try {
    const baseURL = `https://${server}/fmi/data/v1/databases/${database}`;
    const response = await axios.post(`${baseURL}/sessions`, {}, {
      auth: { username, password },
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });
    
    console.log('✅ Connection successful!');
    console.log('Token:', response.data.response.token);
  } catch (error) {
    console.log('❌ Connection failed:', error.message);
  }
};

testConnection();
```

Run with: `node test-connection.js`

## Step 4b: Understanding the Architecture

### System Architecture Overview

Before proceeding with alternative setup methods, it's helpful to understand the architecture of the MCP-Claude-FileMaker system:

```
Claude AI → MCP Protocol → MCP Server → FileMaker Data API → FileMaker Server
```

### Key Architectural Components

#### **1. Database Discovery System**
The server automatically discovers FileMaker databases from environment variables:
- It scans for variables following the pattern `FM_SERVER_*`, `FM_DATABASE_*`, etc.
- Each unique identifier (the part after the underscore) represents a separate database connection
- You can configure unlimited database connections with different authentication methods

#### **2. Dual Cache System**
The server implements two separate caches for optimal performance:
- **Data Cache (14 min TTL)**: Stores database metadata, layouts, script lists, and query results
- **Session Cache (13 min TTL)**: Stores authentication tokens to minimize re-authentication

This caching strategy significantly improves performance while respecting FileMaker's session timeout limits.

#### **3. Authentication Manager**
Handles the FileMaker authentication process:
- Supports both username/password and API key authentication methods
- Automatically caches authentication tokens for performance
- Handles token refresh when tokens expire
- Provides automatic retry mechanisms for authentication failures

#### **4. Script Execution Engine**
Offers comprehensive script execution capabilities:
- Script discovery via FileMaker Data API's `/scripts` endpoint
- Script execution with proper layout context
- Parameter passing with URL encoding
- Script result/error capture and handling

#### **5. Security Layer**
Handles secure communication with FileMaker Server:
- Self-signed certificate support for development environments
- Production-ready SSL/TLS configuration options
- Credential isolation through environment variables
- No persistent storage of sensitive data

### Why Understanding the Architecture Matters

Understanding this architecture helps you:
1. **Configure optimally**: Set appropriate cache TTLs and connection settings
2. **Troubleshoot effectively**: Identify which component might be causing issues
3. **Scale appropriately**: Know how to handle multiple database connections
4. **Secure properly**: Understand security implications and best practices
5. **Extend functionality**: Build upon the architecture for custom needs

## Step 4c: FileMaker Connector Extension (Alternative Setup Method)

**🎯 Quick Setup Option**: Instead of manually configuring environment variables, you can use the included FileMaker Connector extension for a user-friendly setup experience.

### What is the FileMaker Connector?
The `filemaker-connector-v2.1.0.dxt` file in the `connectors/` folder is a FileMaker extension that:
- Provides a graphical interface for configuring your database connections
- Automatically generates the correct environment variables
- Tests connections before saving configuration
- Eliminates manual configuration errors

### Using the FileMaker Connector

#### Step 1: Install the Extension
1. **Open Claude Desktop** on your computer
2. **Drag and drop** `connectors/filemaker-connector-v2.1.0.dxt` onto the Claude Desktop window
3. **Follow the installation prompts** that appear
4. Claude Desktop will automatically integrate the FileMaker connector

#### Step 2: Configure Your Databases
1. **Access the connector** through Claude Desktop's FileMaker integration interface
2. **Add your database(s)** by filling in:
   - **Server Address**: `your-server.com` (without https://)
   - **Database Name**: `YourDatabase` (filename without .fmp12)
   - **Username**: Your FileMaker account username
   - **Password**: Your FileMaker account password
   - **Protocol**: Select `https` for most servers
   - **API Version**: Leave as `v1`

#### Step 3: Test and Generate
1. **Test connection** using the built-in connection tester
2. **Generate configuration** - the extension creates:
   - Environment variables for `.env` file
   - Claude Desktop JSON configuration
   - Ready-to-use configuration snippets

#### Step 4: Use Generated Configuration
1. **Copy environment variables** to your `.env` file, OR
2. **Copy Claude Desktop config** directly to your claude_desktop_config.json

### Benefits of Using the Connector
- ✅ **No manual typing** of configuration variables
- ✅ **Built-in connection testing** before saving
- ✅ **Error prevention** with validation
- ✅ **Multiple database support** with easy management
- ✅ **Export/import** configurations for team sharing

### When to Use Manual Configuration Instead
- You don't have FileMaker Pro available
- You prefer command-line/text-based configuration
- You're setting up in a server environment without GUI
- You need to script the configuration process

## Step 5: Configure Claude Desktop

### Find Your Configuration File

**macOS:**
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```

### Add MCP Server Configuration

Edit the Claude Desktop configuration file and add:

```json
{
  "mcpServers": {
    "filemaker": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/MCP-Claude-FileMaker/server.js"],
      "env": {
        "FM_PROTOCOL": "https",
        "FM_API_VERSION": "v1",
        "FM_SSL_VERIFY": "false",
        "NODE_TLS_REJECT_UNAUTHORIZED": "0",
        "FM_SERVER_MAIN": "your-filemaker-server.com",
        "FM_DATABASE_MAIN": "YourDatabase",
        "FM_ACCOUNT_MAIN": "your_username",
        "FM_PASSWORD_MAIN": "your_password"
      }
    }
  }
}
```

**Important Notes:**
- Use the **absolute path** to your server.js file
- Replace the example values with your actual FileMaker server details
- You can include multiple databases in the `env` section

### Multiple Databases Configuration
```json
{
  "mcpServers": {
    "filemaker": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/MCP-Claude-FileMaker/server.js"],
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
        "FM_API_KEY_DEV": "dev-api-key-12345"
      }
    }
  }
}
```

## Step 6: Start Using the MCP Server

1. **Restart Claude Desktop** completely (quit and reopen)
2. **Start a new conversation** with Claude
3. **Test the connection** by asking: "List my FileMaker databases"

### Example Usage

```
User: List my FileMaker databases
Claude: I'll check your FileMaker databases...
```

```
User: Show me the layouts in my MAIN database
Claude: Here are the layouts in your MAIN database...
```

```
User: Find all active customers in the Customers layout
Claude: I'll search for active customers...
```

## Advanced Configuration

### Using Environment Files with Claude Desktop

Instead of putting credentials in the Claude config, you can use an environment file:

```json
{
  "mcpServers": {
    "filemaker": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/MCP-Claude-FileMaker/server.js"],
      "envFile": "/ABSOLUTE/PATH/TO/MCP-Claude-FileMaker/.env"
    }
  }
}
```

### SSL Certificate Configuration

For production environments with valid SSL certificates:

```env
FM_SSL_VERIFY=true
NODE_TLS_REJECT_UNAUTHORIZED=1
```

### API Key Authentication (OttoFMS)

If using OttoFMS or API key authentication:

```env
FM_SERVER_MAIN=your-server.com
FM_DATABASE_MAIN=YourDatabase
FM_API_KEY_MAIN=your-api-key-here
# Don't set FM_ACCOUNT_MAIN and FM_PASSWORD_MAIN when using API keys
```

## FileMaker Server Setup

### Enable Data API
1. Open FileMaker Admin Console
2. Navigate to **Configuration** > **FileMaker Data API**
3. Enable **FileMaker Data API**
4. Set appropriate security settings

### Create API User Account
1. Open your FileMaker database
2. Go to **File** > **Manage** > **Security**
3. Create a new account with appropriate privileges:
   - **Account Name**: `api_user` (or your preferred name)
   - **Password**: Strong password
   - **Privilege Set**: Create custom set with needed access
   - **FileMaker Data API**: Enable

### Recommended Privilege Set for API Account
- **Data Access**: Records: View, Edit, Create, Delete (as needed)
- **Layouts**: All or specific layouts
- **Scripts**: Execute only (for script access)
- **Extended Privileges**: 
  - `fmrest` (FileMaker Data API)
  - Any other required privileges

## Troubleshooting

### Connection Issues

**"Authentication failed"**
- Verify username and password
- Check that the account exists and is active
- Ensure the account has FileMaker Data API extended privilege

**"Network error"**
- Verify server hostname and port
- Check firewall settings
- Test connection with curl:
  ```bash
  curl -k -u username:password https://your-server.com/fmi/data/v1/databases/YourDB/sessions
  ```

**"No databases found"**
- Check environment variable naming (FM_SERVER_ID, FM_DATABASE_ID, etc.)
- Verify all required variables are set
- Check for typos in variable names

### Claude Desktop Issues

**MCP server not recognized**
- Verify absolute paths in configuration
- Check JSON syntax in claude_desktop_config.json
- Restart Claude Desktop completely

**"Tool not available"**
- Check server.js is running (test independently)
- Verify Node.js is installed and accessible
- Check file permissions

### Debug Mode

Enable debug logging:

```bash
DEBUG=1 node server.js
```

Or add to Claude Desktop config:

```json
"env": {
  "DEBUG": "1",
  ...
}
```

## Security Best Practices

1. **Use dedicated API accounts** with minimal required privileges
2. **Enable SSL/TLS** in production (`FM_SSL_VERIFY=true`)
3. **Use strong passwords** or API keys
4. **Regularly rotate credentials**
5. **Monitor access logs** in FileMaker Server
6. **Keep the MCP server updated**
7. **Use firewall rules** to restrict access to FileMaker Server

## Next Steps

Once everything is working:

1. **Explore the available tools** - try different commands with Claude
2. **Test with your specific layouts** - ask Claude to explore your database structure
3. **Try script execution** - run FileMaker scripts through Claude
4. **Set up multiple databases** if needed
5. **Consider Docker deployment** for production environments

---

**Need help?** Check the main README.md for more detailed information and troubleshooting tips.