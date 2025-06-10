# @hiero-json-rpc-relay/prover

The prover component of the Hiero JSON-RPC Relay system. This package is responsible for sending encrypted messages to Hedera Consensus Service topics, achieving the complete encryption workflow between the prover and proxy.

## Features

- 🔐 **AES+RSA Encryption**: Encrypts payloads using AES shared secret encrypted with a RSA public keys from the proxy
- 🏗️ **ECDSA Support**: Full support for ECDSA private keys in addition to Ed25519
- 💰 **HIP-991 Integration**: Automatic payment of $0.50 topic submission fees
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

## Dependencies

This package depends on the shared `@hiero-json-rpc-relay/common` package for cryptographic utilities, environment management, and validation functions. The common package provides:

- RSA encryption and ECDSA signature verification
- Environment variable loading with validation
- Route signature validation for ensuring data integrity
- Hedera client initialization and utility functions

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

## HIP-991 Paid Topic Integration

The prover automatically handles **HIP-991 paid topic** submissions with built-in fee management and balance checking.

### Economic Requirements

- **Submission Fee**: 0.5 HBAR per route registration message
- **Account Balance**: Minimum 1 HBAR recommended (covers submission + network fees)
- **Fee Buffer**: Additional balance recommended for network fee variations
- **Automatic Payment**: Fees are deducted automatically during message submission

### Fee Handling

The prover implements robust fee management:

```bash
# Account balance check before submission
💰 Account balance: 5.0 HBAR
📤 Submitting message to HIP-991 topic 0.0.1234567...
💰 Prover paid custom fee for HIP-991 topic (max: 0.6 HBAR)
✅ Message submitted successfully
```

### Configuration for Paid Topics

```bash
# Minimum recommended balance for reliable operation
HEDERA_ACCOUNT_ID=0.0.1545
HEDERA_PRIVATE_KEY=0x48b52aba58f4b8dd4cd0e527e28b0eb5f89e2540785b6fcd3c418cc16b640569

# Ensure account has sufficient balance
# - Topic submission: 0.5 HBAR
# - Network fees: ~0.1 HBAR
# - Buffer for variations: 0.4+ HBAR
# Recommended minimum: 1.0 HBAR
```

### Economic Benefits for Provers

1. **Quality Network**: 0.5 HBAR fee ensures serious network participants
2. **Spam-Free Environment**: Economic barrier prevents frivolous registrations
3. **Fair Access**: No gatekeeping - transparent fee structure for all
4. **Predictable Costs**: Fixed 0.5 HBAR fee regardless of network congestion
5. **Investment Protection**: Fees support network infrastructure and stability

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
5. **Submit to Hedera**: Sends the encrypted message to the specified Hedera topic (pays 0.5 HBAR fee)
6. **Start Challenge Server**: Starts HTTP server to respond to URL reachability challenges and receive confirmation
7. **Handle Challenges**: Responds to challenge-response verification requests from proxy
8. **Receive Confirmation**: Waits for confirmation message from proxy when verification is complete
9. **Save Results**: Saves comprehensive session results to a JSON file
10. **Exit Gracefully**: Automatically exits when confirmation is received from proxy

## Results and Logging

The prover automatically saves detailed results to a JSON file in the `data/` directory when the flow completes. The results include:

- **Session Information**: Start/end times, duration, status, proxy URL, Hedera network
- **Payload Details**: Route information, original/encrypted sizes
- **Hedera Submission**: Success status, sequence number, errors
- **Challenge Processing**: Server status, received challenges, success/failure counts
- **Error Log**: Detailed error information throughout the process

Example results file: `data/prover-results-2025-06-09T23-42-15-745Z.json`

## Completion Detection

The prover uses direct confirmation from the proxy:

- **Challenge Responses**: Responds to challenges from the proxy for each route
- **Direct Confirmation**: Waits for confirmation message from proxy to `/confirmation` endpoint
- **Timeout Protection**: Maximum 5-minute execution time to prevent indefinite hanging
- **Graceful Shutdown**: Handles SIGINT (Ctrl+C) for manual termination
- **Automatic Exit**: Exits automatically when confirmation is received from proxy

### Payload Format

The prover now uses a new array-based routes format with contract ownership verification for both CREATE and CREATE2 deployments:

**CREATE deployment example:**

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

**CREATE2 deployment example:**

```json
{
  "routes": [
    {
      "addr": "0x8ba1f109551bd432803012645hac136c5edf4aef",
      "proofType": "create2",
      "salt": "0x0000000000000000000000000000000000000000000000000000000000000001",
      "initCodeHash": "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
      "url": "http://localhost:7546",
      "sig": "0x9876543210fedcba..."
    }
  ]
}
```

**Field descriptions:**

- `addr`: Contract address that should route to the URL
- `proofType`: Type of contract deployment proof (`create` or `create2`)
- `nonce`: Deployment nonce used for CREATE address computation
- `salt`: 32-byte salt used for CREATE2 address computation
- `initCodeHash`: 32-byte hash of the init code used for CREATE2 address computation
- `url`: JSON-RPC endpoint URL for this address
- `sig`: ECDSA signature of concatenated fields (see below)

**Signature format:**

- **CREATE**: Signs `addr+proofType+nonce+url`
- **CREATE2**: Signs `addr+proofType+salt+url`

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
await manager.configureTopicForProver('0.0.1234567');

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
