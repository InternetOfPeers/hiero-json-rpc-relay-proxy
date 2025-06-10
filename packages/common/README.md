# @hiero-json-rpc-relay/common

**Version**: 1.0.0  
**Description**: Common utilities and shared code for the Hiero JSON-RPC Relay system

This package provides reusable components for cryptography, HTTP handling, validation, environment loading, and Hedera integration.

## Features

- 🔐 **Crypto Utilities**: RSA key generation/validation, RSA+AES hybrid encryption, ECDSA signatures, challenge-response protocols
- 🗄️ **Database Utilities**: Database path management, data migration, persistent storage
- 🌐 **HTTP Utilities**: Request parsing, CORS handling, standardized responses
- ✅ **Validation**: Route signature validation, configuration validation, error handling
- 📁 **Environment Loading**: Simple .env file parsing without external dependencies
- 💰 **HIP-991 Support**: Custom fee handling, paid topic integration utilities
- 🔗 **Hedera Integration**: Client initialization, timestamp handling, message parsing
- 📨 **Message Utilities**: Message parsing, chunking support, validation
- ⚡ **Ethereum Utilities**: Transaction decoding, address validation

## Installation

```bash
# Install from workspace
npm install --workspace=packages/common

# Install as dependency in other packages
npm install @hiero-json-rpc-relay/common
```

## Usage

### Import Everything

```javascript
const {
  encryptHybridMessage,
  validateRouteSignatures,
  makeHttpRequest,
  loadEnvFile,
  initHederaClient,
} = require('@hiero-json-rpc-relay/common');
```

### Import by Category

```javascript
const {
  crypto,
  validation,
  http,
  env,
  hedera,
} = require('@hiero-json-rpc-relay/common');

// Use crypto utilities
const encrypted = crypto.encryptHybridMessage(publicKey, data);

// Use validation utilities
const result = validation.validateRouteSignatures(routes);

// Use HTTP utilities
const response = await http.makeHttpRequest('http://example.com');

// Use environment loading
env.loadEnvFile('/path/to/.env');

// Use Hedera utilities
const client = hedera.initHederaClient(config);
```

## API Reference

### Crypto Utilities

#### `encryptHybridMessage(publicKeyPem, data, verbose?)`

Encrypt data using hybrid RSA+AES encryption.

#### `decryptHybridMessage(encryptedData, privateKeyPem)`

Decrypt hybrid encrypted data.

#### `generateChallenge(privateKeyPem, url, contractAddress)`

Generate a signed challenge for URL verification.

#### `verifyChallenge(challenge, signature, publicKeyPem)`

Verify a challenge signature.

#### `signChallengeResponse(challenge, privateKey)`

Sign a challenge response with ECDSA.

#### `verifyChallengeResponse(challenge, signature, expectedAddress)`

Verify a challenge response signature.

### Validation Utilities

#### `validateRouteSignatures(routes, privateKey?)`

Validate signatures for an array of route objects.

```javascript
const routes = [
  {
    addr: '0x...',
    proofType: 'create',
    nonce: 33,
    url: 'http://localhost:7546',
    sig: '0x...',
  },
];

const result = validateRouteSignatures(routes);
// Returns: { success, validCount, invalidCount, invalidRoutes, derivedSignerAddress, errors }
```

#### `signRouteData(addr, proofType, nonce, url, privateKey)`

Create a standardized route signature.

#### `createError(type, message, details?)`

Create a standardized error object with timestamp.

#### `validateConfig(config, requiredFields)`

Validate configuration object against required fields.

### HTTP Utilities

#### `parseRequestBody(req)`

Parse HTTP request body with JSON support.

#### `makeHttpRequest(url, options?)`

Make HTTP request with timeout and error handling.

#### `setCorsHeaders(res, options?)`

Set CORS headers on HTTP response.

#### `sendJsonResponse(res, statusCode, data)`

Send JSON response with proper headers.

#### `sendErrorResponse(res, statusCode, message, details?)`

Send standardized error response.

#### `createServer(requestHandler, options?)`

Create HTTP server with common middleware.

### Environment Loading

#### `loadEnvFile(envPath?)`

Load environment variables from .env file.

```javascript
// Load from default location
loadEnvFile();

// Load from specific path
loadEnvFile('/path/to/.env');
```

### Hedera Utilities

#### `initHederaClient(config)`

Initialize Hedera client with ECDSA/Ed25519 support.

```javascript
const client = initHederaClient({
  accountId: '0.0.123456',
  privateKey: '0x...',
  network: 'testnet',
  keyType: 'ECDSA',
});
```

#### `getMirrorNodeUrl(network)`

Get mirror node URL for network.

#### `isValidAccountId(accountId)` / `isValidTopicId(topicId)`

Validate Hedera ID formats.

#### `validatePrivateKey(privateKey, keyType?)`

Validate private key format.

#### `hederaTimestampToDate(hederaTimestamp)`

Convert Hedera timestamp to JavaScript Date.

#### `parseTopicMessage(message)`

Parse raw Hedera topic message.

## Error Types

The package exports standardized error types:

```javascript
const {
  ErrorTypes,
  HederaErrorTypes,
} = require('@hiero-json-rpc-relay/common');

// General error types
ErrorTypes.INVALID_SIGNATURE;
ErrorTypes.MISSING_SIGNATURE;
ErrorTypes.INVALID_OWNERSHIP;
ErrorTypes.MISSING_FIELDS;
ErrorTypes.VERIFICATION_ERROR;
ErrorTypes.ENCRYPTION_ERROR;
ErrorTypes.NETWORK_ERROR;
ErrorTypes.TIMEOUT_ERROR;

// Hedera-specific error types
HederaErrorTypes.INVALID_ACCOUNT_ID;
HederaErrorTypes.INVALID_TOPIC_ID;
HederaErrorTypes.INVALID_PRIVATE_KEY;
HederaErrorTypes.CLIENT_INIT_FAILED;
HederaErrorTypes.TOPIC_NOT_FOUND;
HederaErrorTypes.INSUFFICIENT_BALANCE;
HederaErrorTypes.NETWORK_ERROR;
```

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Development

### Adding New Utilities

1. Create the utility module in `src/`
2. Export it from `src/index.js`
3. Add comprehensive tests in `test/`
4. Update this README

### Testing Guidelines

- Write unit tests for all public functions
- Mock external dependencies
- Test error conditions
- Aim for high test coverage

## Dependencies

- `@hashgraph/sdk`: Hedera SDK for blockchain integration
- `ethers`: Ethereum utilities for signatures and addresses

## License

Apache-2.0 - See LICENSE file for details
