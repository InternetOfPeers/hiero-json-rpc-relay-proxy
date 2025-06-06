# Hedera Relay Proxy - Minimized Dependencies

This version of the Hedera relay proxy has been optimized to minimize external dependencies.

## Dependencies Removed

1. **dotenv** - Replaced with native Node.js environment variable handling
2. **mocha** - Replaced with Node.js native test runner (`node --test`)
3. **node-fetch** - Replaced with native Node.js `http`/`https` modules

## Current Dependencies

- `@hashgraph/sdk` - Required for Hedera functionality (cannot be removed)

## Environment Variables

Instead of using dotenv, set environment variables directly:

```bash
# Using environment variables
PORT=3000 DB_FILE=routing_db.json DEFAULT_SERVER=https://mainnet.hashio.io/api node index.js

# Or export them
export PORT=3000
export DB_FILE=routing_db.json
export DEFAULT_SERVER=https://mainnet.hashio.io/api
node index.js
```

## Available Scripts

- `npm start` - Start the server
- `npm test` - Run tests using Node.js native test runner

## Testing

Tests now use Node.js built-in test runner instead of mocha, and native `http`/`https` modules instead of node-fetch.

```bash
npm test
```

## Benefits of Minimized Dependencies

1. **Smaller footprint** - Reduced `node_modules` size
2. **Fewer security vulnerabilities** - Less third-party code
3. **Better performance** - Native modules are typically faster
4. **Reduced maintenance** - Fewer dependencies to update
5. **Better compatibility** - Native modules are always compatible

## Migration Notes

- Environment variables must now be set externally (shell environment, process manager, etc.)
- Tests use Node.js native test runner syntax
- HTTP requests in tests use native modules
