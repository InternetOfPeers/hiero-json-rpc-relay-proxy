# Migration Guide: Common Package Refactoring

This document outlines the changes made during the common package refactoring and provides guidance for developers.

## Overview

The shared utilities from the proxy package have been extracted into a new `@hiero-json-rpc-relay/common` package to eliminate code duplication and improve maintainability.

## Changes Made

### New Package Structure

```
packages/
├── common/           # NEW: Shared utilities package
│   ├── src/
│   │   ├── cryptoUtils.js    # Moved from proxy
│   │   ├── envLoader.js      # Moved from proxy
│   │   ├── validation.js     # NEW: Route validation utilities
│   │   ├── httpUtils.js      # NEW: HTTP utilities
│   │   ├── hederaUtils.js    # NEW: Hedera utilities
│   │   └── index.js          # Package exports
│   └── test/         # Comprehensive test suite
├── proxy/            # Updated to use common package
└── prover/           # Updated to use common package
```

### Moved Files

**From `packages/proxy/src/` to `packages/common/src/`:**

- `cryptoUtils.js` → `@hiero-json-rpc-relay/common`
- `envLoader.js` → `@hiero-json-rpc-relay/common`

**Removed Files:**

- `packages/proxy/src/cryptoUtils.js` ❌
- `packages/proxy/src/envLoader.js` ❌
- `packages/proxy/test/cryptoUtils.test.js` ❌
- `packages/proxy/test/envLoader.test.js` ❌

### New Shared Utilities

**`validation.js`** - Route signature validation and error handling:

- `validateRouteSignatures()` - Validates ECDSA signatures for route data
- `signRouteData()` - Signs route data with ECDSA
- `createError()` - Creates standardized error objects
- `validateConfig()` - Configuration validation

**`httpUtils.js`** - HTTP request utilities:

- `parseRequestBody()` - Parses HTTP request bodies
- `makeHttpRequest()` - Makes HTTP requests with timeout support
- `setCorsHeaders()` - Sets CORS headers
- `sendJsonResponse()` - Sends JSON responses
- `sendErrorResponse()` - Sends error responses
- `createServer()` - Creates HTTP server with CORS

**`hederaUtils.js`** - Hedera client utilities:

- `getMirrorNodeUrl()` - Gets mirror node URL for network
- `isValidAccountId()` - Validates Hedera account IDs
- `isValidTopicId()` - Validates Hedera topic IDs
- `validatePrivateKey()` - Validates ECDSA private keys
- `hederaTimestampToDate()` - Converts Hedera timestamps
- `parseTopicMessage()` - Parses Hedera topic messages

## Import Changes

### Before (Proxy/Prover)

```javascript
// Old way - accessing proxy files directly
const { encryptHybridMessage } = require('../../proxy/src/cryptoUtils');
const { loadEnvFile } = require('../../proxy/src/envLoader');
```

### After (Proxy/Prover)

```javascript
// New way - using common package
const {
  encryptHybridMessage,
  loadEnvFile,
  validateRouteSignatures,
} = require('@hiero-json-rpc-relay/common');
```

## Updated Dependencies

### Package.json Changes

**Root `package.json`:**

```json
{
  "scripts": {
    "test:common": "npm test --workspace=packages/common",
    "common": "npm run start --workspace=packages/common"
  }
}
```

**Proxy `package.json`:**

```json
{
  "dependencies": {
    "@hiero-json-rpc-relay/common": "workspace:*"
  }
}
```

**Prover `package.json`:**

```json
{
  "dependencies": {
    "@hiero-json-rpc-relay/common": "workspace:*"
  }
}
```

## Code Refactoring

### Signature Validation Simplification

**Before (140+ lines in hederaManager.js):**

```javascript
// Complex custom validation logic with manual error handling
// ... 140+ lines of validation code
```

**After (20 lines in hederaManager.js):**

```javascript
const { validateRouteSignatures } = require('@hiero-json-rpc-relay/common');

const validationResult = validateRouteSignatures(messageData.routes);
if (!validationResult.success) {
  const invalidAddresses = validationResult.invalidRoutes
    .map(item => item.route.addr || 'unknown')
    .join(', ');
  throw new Error(
    `Signature verification failed for ${validationResult.invalidCount} route(s): ${invalidAddresses}`
  );
}
```

### Removed Duplicate Functions

- ❌ `validateRouteSignatures()` removed from prover (now using common)
- ❌ `parseRequestBody()` removed from proxy (now using common)
- ❌ Duplicate signature validation logic removed from proxy

## Running Tests

```bash
# Test all packages
npm test

# Test specific packages
npm run test:common
npm run test:proxy
npm run test:prover
```

## Benefits

1. **Code Deduplication**: Eliminated duplicate utilities across packages
2. **Centralized Testing**: All shared utilities have comprehensive test coverage
3. **Consistent Behavior**: Standardized error handling and validation logic
4. **Easier Maintenance**: Single source of truth for shared functionality
5. **Better Documentation**: Clear separation of concerns and responsibilities

## Breaking Changes

⚠️ **For developers extending this codebase:**

1. Import paths have changed - use `@hiero-json-rpc-relay/common` instead of direct file paths
2. Some function signatures have been standardized (see validation functions)
3. Error objects now have consistent structure via `createError()`

## Migration Checklist

- ✅ Common package created with shared utilities
- ✅ Proxy package updated to use common package
- ✅ Prover package updated to use common package
- ✅ All tests passing
- ✅ Documentation updated
- ✅ README files updated with dependency information
- ✅ Legacy files removed
- ✅ Import statements updated

---

For questions or issues related to this migration, please refer to the individual package READMEs or the main project documentation.
