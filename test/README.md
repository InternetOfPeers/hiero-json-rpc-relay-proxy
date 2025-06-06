# Test Suite

This directory contains the test suite for the Hiero JSON-RPC Relay Proxy, organized into separate files for better maintainability.

## Test Files

### Unit Tests

- **`ethTxDecoder.test.js`** - Tests for Ethereum transaction decoding and RLP parsing functionality
  - Transaction "to" address extraction
  - Contract creation transaction handling
  - RLP encoding/decoding
  - Invalid transaction handling

- **`dbManager.test.js`** - Tests for database operations and routing management
  - Route database initialization and persistence
  - Target server routing logic
  - RSA key pair generation and management
  - Default route handling

- **`hederaManager.test.js`** - Tests for Hedera Consensus Service integration
  - Hedera client initialization
  - Topic management
  - Network configuration (testnet/mainnet)
  - Credential handling

- **`messageListener.test.js`** - Tests for the automatic message listener functionality
  - Message listener startup and configuration
  - New message detection and logging
  - API error handling and recovery
  - Interval cleanup and shutdown

### Integration Tests

- **`integration.test.js`** - End-to-end tests for the HTTP server
  - Management endpoints (`/routes`, `/hedera/topic`, `/rsa/public-key`)
  - JSON-RPC request forwarding (`eth_blockNumber`)
  - Server startup and health checks
  - Route updates and persistence

## Test Scripts

The following npm scripts are available:

```bash
# Run unit tests only (skips integration tests)
npm test
npm run test:unit

# Run integration tests only
npm run test:integration

# Run all tests (unit + integration)
npm run test:all
```

## Test Data

Test data is stored in the `test/data/` directory and is automatically cleaned up after tests run.

## Test Environment

- **Unit tests**: Run with `SKIP_INTEGRATION_TESTS=true` to avoid starting the server
- **Integration tests**: Start a real server instance on port 3999 with test data folder
- **All tests**: Include both unit and integration tests with proper server lifecycle management

## Test Coverage

The test suite covers:

- ✅ Ethereum transaction parsing and RLP decoding
- ✅ Database operations and routing logic
- ✅ RSA key pair generation and management
- ✅ Hedera Consensus Service integration
- ✅ HTTP server endpoints and middleware
- ✅ JSON-RPC request forwarding and proxying
- ✅ Error handling and edge cases

Total: **26 tests** across **3 test suites**
