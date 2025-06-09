# @hiero-json-rpc-relay/prover

The prover component of the Hiero JSON-RPC Relay system. This package is responsible for sending encrypted messages to Hedera Consensus Service topics, demonstrating the complete encryption workflow between client and proxy.

## Features

- 🔐 **RSA Encryption**: Encrypts payloads using RSA public keys from the proxy
- 🏗️ **ECDSA Support**: Full support for ECDSA private keys in addition to Ed25519
- 📡 **HTTP Communication**: Fetches status and configuration from the proxy server
- 🔗 **Hedera Integration**: Submits encrypted messages to Hedera Consensus Service
- ✅ **Route Signing**: Signs routing URLs using Ethereum-compatible signatures

## Installation

```bash
# Install dependencies
npm install

# Or install from the workspace root
npm install --workspace=packages/prover
```

## Configuration

Create a `.env` file in the prover package directory:

```bash
# Proxy Server Configuration
PROXY_SERVER_URL=http://localhost:3000

# Hedera Consensus Service Configuration
HEDERA_ACCOUNT_ID=0.0.1545
HEDERA_PRIVATE_KEY=0x48b52aba58f4b8dd4cd0e527e28b0eb5f89e2540785b6fcd3c418cc16b640569
HEDERA_NETWORK=testnet
HEDERA_KEY_TYPE=ECDSA

# Optional: Specific topic ID (if not set, will be fetched from proxy)
# HEDERA_TOPIC_ID=0.0.1234567
```

## Usage

### Run the Prover

```bash
# From the prover directory
npm start

# From the workspace root
npm run prover
```

### Run Tests

```bash
# Unit tests
npm test

# Watch mode for development
npm run test:watch

# Coverage report
npm run test:coverage
```

## How It Works

1. **Fetch Status**: Connects to the proxy server to get topic ID and RSA public key
2. **Create Payload**: Generates a test payload with route signatures using the new format
3. **Sign Routes**: Uses ECDSA to sign concatenated `addr+proofType+nonce+url` for authentication
4. **Encrypt Payload**: Encrypts the JSON payload using the proxy's RSA public key
5. **Submit to Hedera**: Sends the encrypted message to the specified Hedera topic

### Payload Format

The prover now uses a new array-based routes format with contract ownership verification:

```json
{
  "routes": [
    {
      "addr": "0x3ed660420aa9bc674e8f80f744f8062603da385e",
      "proofType": "create",
      "nonce": 33,
      "url": "http://localhost:7546",
      "sig": "0x1234567890abcdef..."
    }
  ]
}
```

Where:
- `addr`: Contract address that should route to the URL
- `proofType`: Type of contract deployment proof (`create` or `create2`)
- `nonce`: Deployment nonce used for deterministic address computation
- `url`: JSON-RPC endpoint URL for this address
- `sig`: ECDSA signature of `addr+proofType+nonce+url`

The signature verification ensures that only the deployer of the contract at `addr` can register routes for it.

## Example Output

```
🔐 Encrypted Message Sender Prover
=================================

1️⃣  Fetching status from proxy server...
📊 Status received:
   Topic ID: 0.0.1234567
   Network: testnet
   Has Public Key: true

2️⃣  Creating test payload...
🔑 Signer address: 0x1234567890123456789012345678901234567890

3️⃣  Encrypting payload...
🔐 Encrypting with RSA-OAEP...
✅ Encryption successful

4️⃣  Sending encrypted message to Hedera topic...
📤 Submitting message to topic 0.0.1234567...
✅ Message submitted to topic 0.0.1234567 successfully

🎉 Prover completed successfully!
```

## API Reference

### HederaManager

The prover includes its own HederaManager implementation optimized for sending messages:

```javascript
const { HederaManager } = require('./src/hederaManager');

const manager = new HederaManager({
  accountId: '0.0.1545',
  privateKey: '0x...',
  network: 'testnet',
  keyType: 'ECDSA',
});

// Initialize for a specific topic
await manager.initTopicForProver('0.0.1234567');

// Submit encrypted message
const receipt = await manager.submitMessageToTopic(topicId, encryptedData);
```

## Error Handling

The prover handles various error scenarios:

- **Proxy Unavailable**: Graceful exit if proxy server is not running
- **Missing Credentials**: Clear error messages for missing Hedera configuration
- **Network Issues**: Timeout handling and retry logic
- **Encryption Failures**: Validation of public key format and encryption process

## Development

### Project Structure

```
prover/
├── src/
│   ├── prover.js          # Main prover script
│   └── hederaManager.js   # Hedera client management
├── test/
│   ├── prover.test.js     # Main functionality tests
│   ├── hederaManager.test.js # HederaManager tests
│   └── integration.test.js   # Integration tests
├── package.json
└── README.md
```

### Testing

The package includes comprehensive tests:

- **Unit Tests**: Test individual components and functions
- **Integration Tests**: Test prover-proxy communication
- **Error Handling**: Test various failure scenarios
- **Performance Tests**: Validate memory usage and payload limits

### Contributing

1. Ensure all tests pass: `npm test`
2. Add tests for new functionality
3. Update documentation as needed

## License

Apache-2.0 - See LICENSE file for details
