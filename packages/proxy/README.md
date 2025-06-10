# @hiero-json-rpc-relay/proxy

**Version**: 1.0.0  
**Description**: Ethereum transaction routing proxy with Hedera Consensus Service integration and RSA key management

The proxy component of the Hiero JSON-RPC Relay system. This package provides an Ethereum JSON-RPC proxy server with Hedera Consensus Service integration, RSA key management, and dynamic transaction routing.

## Features

- 🔄 **JSON-RPC Proxy**: Full Ethereum JSON-RPC 2.0 compatible proxy server
- 🔐 **RSA Encryption**: Automatic RSA key pair generation and management
- 💰 **HIP-991 Paid Topics**: Creates and manages paid Hedera topics with $0.50 submission fee
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

This package depends on:

- **@hiero-json-rpc-relay/common**: ^1.0.0 - Shared utilities package providing:
  - RSA/AES encryption and signature verification
  - Environment variable loading and validation
  - Route signature validation with comprehensive error reporting
  - HTTP request parsing and CORS handling
  - Hedera client utilities and helper functions
  - Database management and persistence utilities
- **@hashgraph/sdk**: ^2.66.0 - Official Hedera SDK for blockchain integration
- **ethers**: ^6.14.3 - Ethereum library for transaction processing and cryptography

## Configuration

The proxy automatically loads configuration from environment variables and `.env` files.

### Environment Variables

```bash
# Server Configuration
PROXY_PORT=3000
PROXY_DEFAULT_SERVER=https://testnet.hashio.io/api

# Proxy Hedera Configuration
PROXY_HEDERA_ACCOUNT_ID=0.0.1545
PROXY_HEDERA_PRIVATE_KEY=302e020100300506032b65700...
PROXY_HEDERA_NETWORK=testnet
PROXY_HEDERA_TOPIC_ID=0.0.1234567

# Database Configuration
PROXY_DATA_FOLDER=data
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

````

## HIP-991 Paid Topic Implementation

The proxy implements **HIP-991 Paid Topics** to prevent spam and ensure quality route registrations while maintaining decentralized access.

### Economic Security Model

- **Submission Fee**: $0.50 USD equivalent (0.5 HBAR) per message submission
- **Spam Prevention**: Economic barrier prevents frivolous route registration attempts
- **Fee Collection**: Proxy collects all submission fees as the topic creator
- **Operational Exemption**: Proxy is exempt from fees for publishing RSA public keys and confirmations

### Topic Creation and Management

When the proxy starts, it automatically:

1. **Creates HIP-991 Topic**: If no topic ID is provided in configuration
2. **Sets Custom Fee**: 0.5 HBAR submission fee for all message submissions
3. **Configures Fee Exemption**: Proxy account is exempt via fee exempt key
4. **Publishes Public Key**: First message contains RSA public key for encryption
5. **Starts Message Listener**: Monitors topic for encrypted route registration messages

### Fee Structure

```javascript
// HIP-991 Topic Configuration
const customFee = new CustomFixedFee()
  .setAmount(50000000)  // 0.5 HBAR in tinybars
  .setFeeCollectorAccountId(proxyAccountId);

const topic = new TopicCreateTransaction()
  .setTopicMemo('Hiero JSON-RPC Relay Proxy Topic (HIP-991)')
  .addCustomFee(customFee)
  .addFeeExemptKey(proxyPrivateKey.publicKey)
  .setFeeScheduleKey(proxyPrivateKey.publicKey);
````

### Balance Requirements

- **Proxy Account**: Minimum 25 HBAR recommended for topic creation
- **Prover Account**: Minimum 1 HBAR recommended for route submissions
- **Fee Buffer**: Additional balance recommended for network fee variations

### Economic Benefits

1. **Quality Assurance**: Only serious projects will pay for route registration
2. **Network Sustainability**: Fees support proxy operation and infrastructure
3. **Scalable Revenue**: Fee collection scales with network usage
4. **Fair Access**: No gatekeeping - transparent fee structure for all users
5. **Spam Resistance**: Economic cost makes spam attacks unfeasible

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

```

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
```

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
3. **Set up pre-commit hooks** (recommended):

   ```bash
   # From the root directory
   npm run install:hooks
   ```

4. Copy `.env.example` to `.env` and configure
5. Start the server: `npm start`

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
