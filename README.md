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
- **RSA Key Pair Management**: Automatic generation and storage of RSA key pairs
- **Mirror Node Integration**: Uses Hedera mirror node API for efficient topic message verification
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
DEFAULT_SERVER=https://mainnet.hashio.io/api

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

# All tests including integration (~10 seconds)
npm run test:all
```

### Test Coverage

- **Unit Tests (10 tests)**: RLP decoding, database operations, routing logic, RSA key management
- **Integration Tests (4 tests)**: HTTP endpoints, server startup, Hedera functionality, RSA endpoints

**Note**: Integration tests require valid Hedera credentials in environment for full coverage.

## 🏗️ Architecture

### Transaction Routing Flow

1. **Request Reception** → Server receives Ethereum JSON-RPC request
2. **Transaction Analysis** → Extracts "to" address using custom RLP decoder
3. **Route Lookup** → Checks routing database for address-specific server
4. **Request Forwarding** → Proxies to target server or default fallback

### Hedera Topic Flow

1. **Client Initialization** → Sets up Hedera client if credentials provided
2. **Topic Verification** → Uses mirror node API to validate existing topic and check for messages
3. **Auto-Creation** → Creates new topic if needed with automatic memo
4. **RSA Key Management** → Generates and stores RSA key pairs, submits public key to topics
5. **Fail-Safe Operation** → Server stops on critical failures to ensure data integrity

### File Structure

```text
├── src/
│   ├── server.js         # Main server with Hedera integration  
│   ├── ethTxDecoder.js   # Custom RLP decoder
│   └── dbManager.js      # Route database and RSA key management
├── test/
│   └── test.js           # Comprehensive test suite
├── data/
│   └── routing_db.json   # Persistent route and RSA key storage
├── package.json          # Dependencies (minimal)
├── .env.example          # Configuration template
└── README.md             # This file
```

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
