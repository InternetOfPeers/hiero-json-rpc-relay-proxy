# @hiero-json-rpc-relay/proxy

The proxy component of the Hiero JSON-RPC Relay system. This package provides an Ethereum JSON-RPC proxy server with Hedera Consensus Service integration, RSA key management, and dynamic transaction routing.

## Features

- 🔄 **JSON-RPC Proxy**: Full Ethereum JSON-RPC 2.0 compatible proxy server
- 🔐 **RSA Encryption**: Automatic RSA key pair generation and management
- 🏗️ **Dynamic Routing**: Route transactions based on encrypted Hedera messages
- 📡 **Hedera Integration**: Listen to Hedera Consensus Service for routing updates
- 🗄️ **Database Management**: Persistent storage for routing configurations
- 📊 **Status Endpoint**: Real-time status and configuration information

## Installation

```bash
# Install dependencies
npm install

# Or install from the workspace root
npm install --workspace=packages/proxy
```

## Dependencies

This package depends on the shared `@hiero-json-rpc-relay/common` package for cryptographic utilities, environment management, validation functions, and HTTP utilities. The common package provides:

- RSA/AES encryption and signature verification
- Environment variable loading and validation
- Route signature validation with comprehensive error reporting
- HTTP request parsing and CORS handling
- Hedera client utilities and helper functions

## Configuration

The proxy automatically loads configuration from environment variables and `.env` files.

### Environment Variables

```bash
# Server Configuration
PORT=3000
TARGET_URL=http://localhost:8545

# Hedera Configuration
HEDERA_ACCOUNT_ID=0.0.1545
HEDERA_PRIVATE_KEY=0x...
HEDERA_NETWORK=testnet
HEDERA_TOPIC_ID=0.0.1234567

# Database Configuration
DB_PATH=./data/routing_db_testnet.json
```

## Usage

### Start the Proxy Server

```bash
# From the proxy directory
npm start

# Development mode with auto-restart
npm run dev

# From the workspace root
npm run start
```

### Run Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Clean Database

```bash
npm run clean-db
```

## API Endpoints

### JSON-RPC Proxy

All standard Ethereum JSON-RPC methods are supported:

```bash
# Example requests
curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0x...", "latest"],"id":1}'
```

### Status Endpoint

Get current proxy status and configuration:

```bash
curl http://localhost:3000/status
```

Response:

```json
{
  "status": "active",
  "timestamp": "2025-06-09T12:00:00.000Z",
  "topicId": "0.0.1234567",
  "hederaNetwork": "testnet",
  "publicKey": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----",
  "routingTable": {
    "0x...": "http://localhost:8545"
  }
}
```

### Route Management

**Important**: Route updates can only be done through verified Hedera messages with challenge-response verification. Manual route updates via HTTP endpoints have been removed for security.

To update routes:

1. Sign route data with ECDSA (proving contract ownership)
2. Encrypt the payload with the proxy's RSA public key
3. Submit to the Hedera topic
4. Proxy verifies signatures and sends challenges to URLs
5. Respond to challenges to complete verification

```

## Architecture

### Core Components

- **Proxy Server**: HTTP server handling JSON-RPC requests
- **Hedera Manager**: Manages Hedera client and topic operations
- **Message Listener**: Processes encrypted messages from Hedera topics
- **Crypto Utils**: RSA encryption/decryption and key management
- **DB Manager**: Handles routing database persistence
- **ETH Transaction Decoder**: Extracts sender addresses from transactions

### Request Flow

1. **Client Request**: Ethereum JSON-RPC request received
2. **Route Resolution**: Determine target server based on sender address
3. **Request Forwarding**: Proxy request to appropriate backend
4. **Response Return**: Forward response back to client

### Hedera Integration

1. **Topic Listening**: Continuously monitor Hedera topic for routing updates
2. **Message Decryption**: Decrypt incoming messages using RSA private key
3. **Route Updates**: Update routing table with new configurations
4. **Persistence**: Save routing changes to database

## Project Structure

```

proxy/
├── src/
│ ├── proxy.js # Main proxy server
│ ├── hederaManager.js # Hedera client management
│ ├── messageListener.js # Hedera message processing
│ ├── cryptoUtils.js # RSA encryption utilities
│ ├── dbManager.js # Database operations
│ ├── ethTxDecoder.js # Transaction analysis
│ └── envLoader.js # Environment configuration
├── test/
│ ├── server.test.js # Proxy server tests
│ ├── hederaManager.test.js
│ ├── messageListener.test.js
│ ├── cryptoUtils.test.js
│ ├── dbManager.test.js
│ ├── ethTxDecoder.test.js
│ ├── envLoader.test.js
│ └── integration.test.js
├── data/
│ └── routing_db_testnet.json
├── package.json
└── README.md

````

## Configuration Files

### Routing Database

The routing database (`data/routing_db_testnet.json`) stores address-to-URL mappings:

```json
{
  "routes": {
    "0x1234567890123456789012345678901234567890": "http://localhost:8545",
    "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd": "http://localhost:7546"
  },
  "metadata": {
    "lastUpdated": "2025-06-09T12:00:00.000Z",
    "version": "1.0.0"
  }
}
````

## Security

### RSA Key Management

- **Automatic Generation**: RSA key pairs generated on first startup
- **Secure Storage**: Private keys stored securely on the filesystem
- **Key Rotation**: Support for key rotation and management

### Message Validation

- **Signature Verification**: Validate message signatures using ECDSA
- **Encryption**: All routing updates encrypted with RSA
- **Access Control**: Only authorized signers can update routing

## Development

### Environment Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and configure
4. Start the server: `npm start`

### Testing

The package includes comprehensive test coverage:

- **Unit Tests**: Individual component testing
- **Integration Tests**: End-to-end workflow testing
- **Error Handling**: Edge case and error scenario testing
- **Performance Tests**: Load and stress testing

### Debugging

Enable debug logging:

```bash
DEBUG=proxy:* npm start
```

## License

Apache-2.0 - See LICENSE file for details
