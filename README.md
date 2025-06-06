# Hedera Relay Proxy

A lightweight Ethereum transaction routing proxy server with integrated Hedera Consensus Service (HCS) topic management. Routes Ethereum transactions to different backend servers based on the "to" address and provides optional Hedera topic functionality.

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
- **Hedera Integration**: Automatic topic creation and management
- **Minimal Dependencies**: Only `@hashgraph/sdk` required (built-in .env support)
- **Production Ready**: Comprehensive error handling and graceful degradation

## 📦 Installation & Setup

```bash
git clone <repository-url>
cd hedera-relay-proxy
npm install
```

### Configuration

Configure using a `.env` file (recommended) or environment variables:

```bash
# Server Configuration
PORT=3000
DB_FILE=routing_db.json
DEFAULT_SERVER=https://mainnet.hashio.io/api

# Hedera Configuration (optional)
HEDERA_ACCOUNT_ID=0.0.123456
HEDERA_PRIVATE_KEY=302e020100300506...
HEDERA_NETWORK=testnet
HEDERA_TOPIC_ID=0.0.654321
```

**Note**: Environment variables take precedence over `.env` file values.

### Getting Hedera Credentials (Optional)

- **Testnet**: Create account at [Hedera Portal](https://portal.hedera.com/)
- **Mainnet**: Create account through exchange or wallet with HBAR balance

## 🔗 API Endpoints

### Proxy Routing
- `ALL /*` - Routes requests to backend servers based on transaction analysis

### Route Management
- `GET /routes` - View current routing configuration
- `POST /routes` - Update routing rules

### Hedera Topic
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

## 🌐 Hedera Integration

### Automatic Topic Management

The proxy automatically handles Hedera topic lifecycle:

1. **Topic Verification**: Checks if provided `HEDERA_TOPIC_ID` exists and is accessible
2. **Auto-Creation**: Creates new topic if none exists or provided topic is inaccessible  
3. **Cost**: ~$0.01 USD for topic creation, ~$0.0001 USD for queries

### Usage Examples

```bash
# Start with Hedera support
HEDERA_ACCOUNT_ID=0.0.123456 \
HEDERA_PRIVATE_KEY=302e... \
HEDERA_NETWORK=testnet \
npm start

# Check topic status
curl http://localhost:3000/hedera/topic
```

## 🧪 Testing

### Test Commands

```bash
# Unit tests only (default, ~80ms)
npm test

# All tests including integration (~3 seconds)
npm run test:all
```

### Test Coverage

- **Unit Tests (8 tests)**: RLP decoding, database operations, routing logic
- **Integration Tests (3 tests)**: HTTP endpoints, server startup, Hedera functionality

**Note**: Integration tests require valid Hedera credentials in environment.

## 🏗️ Architecture

### Transaction Routing Flow

1. **Request Reception** → Server receives Ethereum JSON-RPC request
2. **Transaction Analysis** → Extracts "to" address using custom RLP decoder
3. **Route Lookup** → Checks routing database for address-specific server
4. **Request Forwarding** → Proxies to target server or default fallback

### Hedera Topic Flow

1. **Client Initialization** → Sets up Hedera client if credentials provided
2. **Topic Verification** → Validates existing topic accessibility
3. **Auto-Creation** → Creates new topic if needed
4. **Topic Operations** → Enables status queries and future extensions

### File Structure

```
├── index.js              # Main server with Hedera integration
├── ethTxDecoder.js       # Custom RLP decoder
├── dbManager.js          # Route database management
├── test.js               # Test suite
├── package.json          # Dependencies (minimal)
├── .env.example          # Configuration template
└── routing_db.json       # Persistent route storage
```

## 🔧 Troubleshooting

### Common Issues

1. **"Failed to initialize Hedera client"**
   - Verify `HEDERA_ACCOUNT_ID` and `HEDERA_PRIVATE_KEY` are correctly set
   - Check private key format (DER encoded hex string)

2. **"Topic does not exist or is not accessible"**
   - Verify `HEDERA_TOPIC_ID` is correct
   - Remove `HEDERA_TOPIC_ID` to auto-create new topic

3. **"Insufficient account balance"**
   - Ensure HBAR balance for transaction fees
   - Use testnet faucet for development

### Debug Mode

```bash
DEBUG=1 npm start  # Enable detailed logging
```

## 📚 Resources

- [Hedera Consensus Service Docs](https://docs.hedera.com/hedera/core-concepts/consensus-service)
- [Hedera JavaScript SDK](https://github.com/hashgraph/hedera-sdk-js)
- [HCS Topic Management](https://docs.hedera.com/hedera/sdks-and-apis/sdks/consensus-service)
