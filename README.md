# Hiero JSON-RPC Relay Proxy

A lightweight Ethereum transaction routing proxy server with integrated Hedera Consensus Service (HCS) topic management and RSA key pair generation. Routes Ethereum transactions to different backend servers based on the "to" address and provides comprehensive Hedera topic functionality with automatic public key management.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Copy and configure environment (recommended)
cp .env.example .env
# Edit .env with your configuration

# Start the server
npm start
```

## ✨ Features

- **Transaction Routing**: Routes Ethereum JSON-RPC requests based on "to" address extraction
- **Custom RLP Decoder**: Native implementation for both legacy and EIP-1559 transactions
- **Dynamic Route Management**: REST API for updating routing rules
- **Hedera Topic Integration**: Automatic topic creation, verification, and public key management
- **Message Listener with Persistence**: Real-time message monitoring with database persistence across server restarts
- **RSA Key Pair Management**: Automatic generation and storage of RSA key pairs
- **Mirror Node Integration**: Uses Hedera mirror node API for efficient topic message verification
- **Database Persistence**: SQLite-like JSON database with automatic state recovery
- **Fail-Safe Operation**: Server stops on critical Hedera operation failures to ensure data integrity
- **Minimal Dependencies**: Only `@hashgraph/sdk` required (built-in .env support)
- **Production Ready**: Comprehensive error handling and graceful degradation

## 📦 Installation & Setup

```bash
git clone <repository-url>
cd hiero-json-rpc-relay-proxy
npm install
```

### Configuration

Configure using a `.env` file (recommended) or environment variables:

```bash
# Server Configuration
PORT=3000
DATA_FOLDER=data
DEFAULT_SERVER=https://testnet.hashio.io/api

# Hedera Configuration (optional but recommended)
HEDERA_ACCOUNT_ID=0.0.123456
HEDERA_PRIVATE_KEY=302e020100300506...
HEDERA_NETWORK=testnet
HEDERA_TOPIC_ID=0.0.654321
```

**Notes**:

- Environment variables take precedence over `.env` file values.
- The `DATA_FOLDER` parameter specifies the directory for database files.
- Database files are network-specific: `routing_db_testnet.json` and `routing_db_mainnet.json`.
- Each network maintains separate routing tables and RSA key pairs for isolation.

**Network-Specific Database Files**:

```bash
# Testnet configuration will use:
data/routing_db_testnet.json

# Mainnet configuration will use:
data/routing_db_mainnet.json
```

This ensures that testnet and mainnet configurations remain completely isolated, including:

- Separate routing tables for different network environments
- Independent RSA key pairs for each network
- Network-specific Hedera topic configurations

### Getting Hedera Credentials (Optional)

- **Testnet**: Create account at [Hedera Portal](https://portal.hedera.com/)
- **Mainnet**: Create account through exchange or wallet with HBAR balance

## 🔗 API Endpoints

### Proxy Routing

- `ALL /*` - Routes requests to backend servers based on transaction analysis

### Route Management

- `GET /routes` - View current routing configuration
- `POST /routes` - Update routing rules

### Hedera Topic Management

- `GET /hedera/topic` - Get topic information and status

**Example Response:**

```json
{
  "topicId": "0.0.123456",
  "hederaNetwork": "testnet", 
  "accountId": "0.0.789012",
  "clientInitialized": true
}
```

### RSA Key Management

- `GET /rsa/public-key` - Get RSA public key information

**Example Response:**

```json
{
  "publicKey": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQ...",
  "createdAt": "2025-06-06T19:54:56.294Z",
  "hasPrivateKey": true
}
```

## 🌐 Hedera Integration

### Automatic Topic Management

The proxy automatically handles comprehensive Hedera topic lifecycle with fail-safe operation:

1. **Topic Verification**: Uses mirror node API to check if provided `HEDERA_TOPIC_ID` exists and has messages
2. **Auto-Creation**: Creates new topic if none exists or provided topic is inaccessible  
3. **Public Key Management**: Automatically submits RSA public key as first message to new or empty topics
4. **Message Verification**: Uses Hedera mirror node REST API for fast topic message checking
5. **Fail-Safe Operation**: Server stops on timeout or critical failures to ensure data integrity
6. **Cost**: ~$0.01 USD for topic creation, ~$0.0001 USD per message

### RSA Key Pair Features

- **Automatic Generation**: Creates 2048-bit RSA key pairs on first startup
- **Persistent Storage**: Keys stored in database for reuse across restarts  
- **Public Key Publishing**: Automatically submits public key to Hedera topics
- **API Access**: RESTful endpoint for public key retrieval

### Mirror Node Integration

- **Fast Verification**: Uses HTTP API instead of WebSocket subscriptions
- **Network Agnostic**: Automatically selects testnet or mainnet mirror node
- **Timeout Handling**: 5-second timeout with graceful error handling
- **Fail-Safe Design**: Server stops on mirror node verification failures

### Usage Examples

```bash
# Start with Hedera support (recommended)
HEDERA_ACCOUNT_ID=0.0.123456 \
HEDERA_PRIVATE_KEY=302e... \
HEDERA_NETWORK=testnet \
npm start

# Start without Hedera (basic routing only)
npm start
```

## 🧪 Testing

### Test Commands

```bash
# Unit tests only (default, skips integration tests)
npm test
npm run test:unit

# Integration tests only
npm run test:integration

# All tests including integration (~10 seconds)
npm run test:all
```

### Test Coverage

- **Unit Tests (36 tests)**: RLP decoding, database operations, routing logic, RSA key management, HederaManager functionality, message listener with persistence
- **Integration Tests (5 tests)**: HTTP endpoints, server startup, Hedera functionality, RSA endpoints, JSON-RPC forwarding

**Test Files:**

- `test/ethTxDecoder.test.js` - Ethereum transaction parsing and RLP decoding (5 tests)
- `test/dbManager.test.js` - Database operations, routing logic, and message persistence (8 tests)  
- `test/hederaManager.test.js` - Hedera Consensus Service integration (11 tests)
- `test/messageListener.test.js` - Message listener functionality with database persistence (12 tests)
- `test/integration.test.js` - End-to-end HTTP server tests (5 tests)

**Test Organization:**

Each test file focuses on a specific module for better maintainability:

- **ethTxDecoder**: Transaction "to" address extraction, contract creation handling, RLP encoding/decoding
- **dbManager**: Route persistence, target server routing, RSA key pair management, sequence number storage
- **hederaManager**: Client initialization, topic management, network configuration  
- **messageListener**: Message processing, database persistence, error handling, state recovery
- **integration**: Management endpoints, JSON-RPC forwarding, server lifecycle

**Note**: Integration tests require valid Hedera credentials in environment for full coverage.

## 🔔 Message Listener

The proxy includes an automatic message listener that monitors the Hedera topic for new messages with full database persistence:

### Features

- **Automatic Startup**: Starts listening immediately after server initialization if Hedera is enabled
- **Database Persistence**: Saves the last processed message sequence number to prevent duplicate processing across server restarts
- **Real-time Monitoring**: Polls the mirror node API every 30 seconds for new messages
- **Message Content Logging**: Displays message sequence number, timestamp, content, and payer account
- **State Recovery**: Automatically resumes from the last processed message after server restart
- **Graceful Error Handling**: Continues operation even if individual API calls or database operations fail
- **Clean Shutdown**: Automatically stops when server is terminated

### Database Persistence

The message listener uses the database to maintain state across server restarts:

```javascript
// Automatic sequence tracking per topic
getLastProcessedSequence(topicId)     // Retrieves last processed sequence
storeLastProcessedSequence(topicId, sequenceNumber)  // Saves current position
```

**Key Benefits:**

- **No Duplicate Processing**: Prevents reprocessing messages after server restart
- **Graceful Degradation**: Message processing continues even if database saves fail
- **Topic-Specific Tracking**: Each topic maintains its own sequence counter
- **Enterprise Ready**: Reliable state management for production environments

### Message Display Format

When new messages are detected, they are logged in the following format:

```text
🆕 Found 1 new message(s) in topic 0.0.123456:
   📝 Message #2 (2025-06-06T22:15:30.123Z):
      Content: Hello World (truncated to 200 chars if longer)
      Payer: 0.0.789012
```

### Configuration

The message listener uses the following settings:

- **Poll Interval**: 30 seconds (configurable via code)
- **Content Truncation**: Long messages are truncated to 200 characters in logs
- **Timeout**: 5 seconds per mirror node API call
- **Database Storage**: Sequence numbers stored in `data/routing_db_[network].json`

**Note**: There may be a 1-2 minute delay between message submission and appearance in the mirror node API.

## 🏗️ Architecture

### Listener Settings

- **Poll Interval**: 30 seconds (configurable via code)
- **Content Truncation**: Long messages are truncated to 200 characters in logs
- **Timeout**: 5 seconds per mirror node API call

**Note**: There may be a 1-2 minute delay between message submission and appearance in the mirror node API.

Total: **26 tests** across **4 test files**

## 🏗️ Architecture

### Project Structure

The project is organized into focused, modular components for maintainability and testability:

```text
├── src/
│   ├── server.js           # Main HTTP server and routing logic
│   ├── hederaManager.js    # Hedera Consensus Service integration (NEW)
│   ├── ethTxDecoder.js     # Custom RLP decoder for Ethereum transactions
│   └── dbManager.js        # Route database and RSA key management
├── test/
│   ├── test.js             # Main test suite (integration + unit tests)
│   └── hederaManager.test.js # HederaManager unit tests (NEW)
├── data/
│   └── routing_db.json     # Persistent route and RSA key storage
└── package.json            # Dependencies (minimal)
```

### HederaManager Module

The **HederaManager** is a dedicated module that encapsulates all Hedera Consensus Service functionality:

**Key Features:**

- **Isolated Hedera Logic**: All Hedera-specific code separated from main server
- **Comprehensive API**: Handles client initialization, topic management, and public key operations
- **Fail-Safe Design**: Server stops on critical failures to ensure data integrity
- **Network Agnostic**: Supports both testnet and mainnet configurations
- **Mirror Node Integration**: Uses REST API for efficient topic verification

**Public Methods:**

- `initClient()` - Initialize Hedera client with credentials
- `initTopic(getRSAKeyPair)` - Complete topic initialization orchestration
- `checkTopicExists(topicId)` - Verify topic accessibility
- `createTopic()` - Create new Hedera topic with auto-generated memo
- `submitPublicKeyToTopic(topicId, publicKey)` - Submit RSA public key to topic
- `checkTopicHasMessages(topicId)` - Check if topic has messages via mirror node
- `getTopicInfo()` - Get topic status for API endpoints
- `getTopicId()` - Get current topic ID
- `getClient()` - Get Hedera client instance
- `isEnabled()` - Check if Hedera credentials are provided

**Usage Example:**

```javascript
const { HederaManager } = require('./hederaManager');

const hederaManager = new HederaManager({
  accountId: process.env.HEDERA_ACCOUNT_ID,
  privateKey: process.env.HEDERA_PRIVATE_KEY,
  network: process.env.HEDERA_NETWORK || 'testnet',
  topicId: process.env.HEDERA_TOPIC_ID,
});

// Initialize topic (handles all complexity internally)
await hederaManager.initTopic(getRSAKeyPair);

// Get topic info for API responses
const info = hederaManager.getTopicInfo();
```

### Transaction Routing Flow

1. **Request Reception** → Server receives Ethereum JSON-RPC request
2. **Transaction Analysis** → Extracts "to" address using custom RLP decoder
3. **Route Lookup** → Checks routing database for address-specific server
4. **Request Forwarding** → Proxies to target server or default fallback

### Hedera Integration Flow

1. **HederaManager Initialization** → Creates manager instance with configuration
2. **Client Setup** → Initializes Hedera client if credentials provided
3. **Topic Orchestration** → Handles topic verification, creation, and public key submission
4. **Mirror Node Verification** → Uses REST API to validate topic state efficiently
5. **Fail-Safe Operation** → Server stops on critical failures to ensure data integrity

### Benefits of Separation

✅ **Improved Maintainability**: Hedera logic isolated in dedicated module  
✅ **Better Testing**: Comprehensive unit tests for HederaManager  
✅ **Code Reusability**: HederaManager can be used in other projects  
✅ **Cleaner Server Logic**: Main server focuses on routing and HTTP handling  
✅ **Enhanced Reliability**: Fail-safe design prevents inconsistent states

## 🔧 Troubleshooting

### Common Issues

1. **"Failed to initialize Hedera client"**
   - Verify `HEDERA_ACCOUNT_ID` and `HEDERA_PRIVATE_KEY` are correctly set
   - Check private key format (DER encoded hex string)

2. **"Topic does not exist or is not accessible"**
   - Verify `HEDERA_TOPIC_ID` is correct
   - Remove `HEDERA_TOPIC_ID` to auto-create new topic

3. **"Server must stop - cannot verify topic state"**
   - Mirror node API timeout or failure during topic verification
   - Check network connectivity and try restarting
   - Verify topic ID format (e.g., `0.0.123456`)

4. **"Insufficient account balance"**
   - Ensure HBAR balance for transaction fees
   - Use testnet faucet for development

5. **"RSA key pair not initialized"**
   - Database corruption or permissions issue
   - Delete `data/routing_db.json` to regenerate

6. **Message listener not resuming from correct position**
   - Check database file permissions in `data/` folder
   - Verify sequence numbers are being saved (check database file)
   - Database persistence gracefully degrades - message processing continues even if saves fail

### Debug Commands

```bash
# Check Hedera topic status
curl http://localhost:3000/hedera/topic

# Check RSA public key
curl http://localhost:3000/rsa/public-key

# View current routes
curl http://localhost:3000/routes
```

## 🛡️ Fail-Safe Operation

The server implements fail-safe mechanisms to ensure data integrity:

- **Topic Verification Timeout**: Server stops if mirror node API doesn't respond within 5 seconds
- **Public Key Submission Timeout**: Server stops if public key submission fails or times out (10 seconds)
- **Critical Error Handling**: Server stops on Hedera initialization failures to prevent inconsistent state
- **Graceful Degradation**: Can run without Hedera credentials for basic routing functionality

This design ensures that the server never runs in an undefined state when Hedera functionality is enabled.

## 📚 Resources

- [Hedera Consensus Service Docs](https://docs.hedera.com/hedera/core-concepts/consensus-service)
- [Hedera JavaScript SDK](https://github.com/hashgraph/hedera-sdk-js)
- [Hedera Mirror Node API](https://docs.hedera.com/hedera/sdks-and-apis/rest-api)
- [HCS Topic Management](https://docs.hedera.com/hedera/sdks-and-apis/sdks/consensus-service)
- [Hedera Testnet Portal](https://portal.hedera.com/)
- [Database Persistence Guide](./DATABASE_PERSISTENCE_GUIDE.md)
