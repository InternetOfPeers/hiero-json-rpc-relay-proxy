# Development Guide

This guide provides detailed information for developers working on the Hiero JSON-RPC Relay Proxy monorepo.

## 🏗️ Project Architecture

The monorepo is organized into two main packages:

### Proxy Package (`packages/proxy/`)
- **Purpose**: Main JSON-RPC proxy server
- **Responsibilities**:
  - Route incoming JSON-RPC requests
  - Manage routing database
  - Handle RSA key generation and storage
  - Provide management endpoints
  - Listen for Hedera messages

### Prover Package (`packages/prover/`)
- **Purpose**: Data validation and submission to Hedera
- **Responsibilities**:
  - Validate routing data
  - Encrypt payloads
  - Submit messages to Hedera Consensus Service
  - Manage Hedera client connections

## 📁 Directory Structure

```
├── packages/
│   ├── proxy/                 # Proxy server package
│   │   ├── src/              # Source code
│   │   │   ├── proxy.js      # Main server entry point
│   │   │   ├── cryptoUtils.js # Encryption/decryption utilities
│   │   │   ├── dbManager.js   # Database operations
│   │   │   ├── envLoader.js   # Environment file loader
│   │   │   ├── ethTxDecoder.js # Ethereum transaction decoder
│   │   │   └── hederaManager.js # Hedera network manager
│   │   ├── test/             # Test files
│   │   ├── data/             # Runtime data storage
│   │   └── package.json      # Package configuration
│   └── prover/               # Prover package
│       ├── src/              # Source code
│       │   ├── prover.js     # Main prover logic
│       │   └── hederaManager.js # Hedera client for prover
│       ├── test/             # Test files
│       ├── data/             # Runtime data storage
│       └── package.json      # Package configuration
├── test/                     # Cross-package integration tests
├── scripts/                  # Utility scripts
└── package.json             # Root workspace configuration
```

## 🛠️ Development Setup

### 1. Initial Setup
```bash
# Clone the repository
git clone <repository-url>
cd hiero-json-rpc-relay-proxy

# Install all dependencies
npm install
```

### 2. Environment Configuration
```bash
# Copy example environment files
cp packages/proxy/.env.example packages/proxy/.env
cp packages/prover/.env.example packages/prover/.env

# Edit the files with your actual configuration
```

### 3. Development Workflow

#### Working on Proxy Package
```bash
# Navigate to proxy package
cd packages/proxy

# Run proxy in development mode
npm run dev

# Run proxy tests
npm test
```

#### Working on Prover Package
```bash
# Navigate to prover package
cd packages/prover

# Run prover in development mode
npm run dev

# Run prover tests
npm test
```

#### Running from Root
```bash
# Start proxy server
npm run start:proxy

# Start prover
npm run start:prover

# Run all tests
npm test

# Run integration tests
npm run test:integration
```

## 🧪 Testing Strategy

### Test Categories

1. **Unit Tests**: Test individual functions and modules
   - Located in `packages/*/test/`
   - Use Node.js built-in test runner
   - Mock external dependencies

2. **Integration Tests**: Test package interactions
   - Located in `test/`
   - Test cross-package communication
   - Validate end-to-end workflows

3. **Component Tests**: Test individual components
   - Test real integrations with external services
   - May require actual Hedera credentials

### Running Tests

```bash
# Run all tests
npm test

# Run specific package tests
npm test --workspace=packages/proxy
npm test --workspace=packages/prover

# Run integration tests only
npm run test:integration

# Run with verbose output
npm test -- --verbose

# Skip integration tests (if they require external services)
SKIP_INTEGRATION_TESTS=true npm test
```

### Test Structure

```javascript
// Unit test example
const { describe, it, before, after, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');

describe('Component Name', () => {
  beforeEach(() => {
    mock.restoreAll();
  });

  it('should do something', () => {
    // Test implementation
    assert.strictEqual(actual, expected);
  });
});
```

## 🔧 Development Tools

### VSCode Workspace
The project includes a VSCode workspace configuration (`hiero-proxy.code-workspace`) with:
- Multi-root workspace setup
- ESLint configuration
- Debugging configurations
- Task definitions

### Scripts

| Command | Description |
|---------|-------------|
| `npm install` | Install all dependencies |
| `npm test` | Run all tests |
| `npm run clean` | Clean generated files |
| `npm run lint` | Lint all code |
| `npm run start:proxy` | Start proxy server |
| `npm run start:prover` | Start prover |

### Database Management

Each package maintains its own database:
- **Proxy**: Stores routes, RSA keys, sequence numbers
- **Prover**: Stores validation state, processed messages

```bash
# Clean all databases
npm run clean

# Manually inspect proxy database
cat packages/proxy/data/routing_db_testnet.json

# Manually inspect prover database
cat packages/prover/data/prover_db_testnet.json
```

## 🐛 Debugging

### Debug Modes

```bash
# Enable debug logging
export DEBUG=true
npm test

# Debug specific package
cd packages/proxy
DEBUG=true npm test

# Debug with Node.js inspector
node --inspect-brk --test test/specific.test.js
```

### Common Issues

1. **Port Conflicts**: Update port numbers in .env files
2. **Permission Errors**: Check file permissions for data directories
3. **Network Issues**: Verify Hedera network connectivity
4. **Environment Variables**: Ensure all required variables are set

### Logging

Both packages use console logging with prefixes:
- Proxy: Various emojis for different operations
- Prover: Specific logging for validation and submission

## 📦 Package Management

### Adding Dependencies

```bash
# Add to specific package
npm install <package> --workspace=packages/proxy
npm install <package> --workspace=packages/prover

# Add dev dependency
npm install <package> --save-dev --workspace=packages/proxy

# Add to root (for tooling)
npm install <package> --save-dev
```

### Cross-Package Dependencies

Packages can depend on each other using relative paths:
```javascript
// From prover package
const { cryptoUtils } = require('../../proxy/src/cryptoUtils');
```

### Version Management

Each package maintains its own version:
- Update version in package.json
- Consider compatibility between packages
- Update cross-package dependencies as needed

## 🚀 Deployment

### Production Build

```bash
# Install production dependencies only
npm ci --omit=dev

# Run production tests
NODE_ENV=production npm test

# Start services
npm run start:proxy &
npm run start:prover &
```

### Environment Variables

Ensure these are set in production:
- `HEDERA_ACCOUNT_ID`
- `HEDERA_PRIVATE_KEY`
- `HEDERA_NETWORK`
- `PROXY_SERVER_URL`

### Monitoring

Monitor these metrics in production:
- Server uptime and response times
- Database file sizes
- Memory usage
- Network connectivity to Hedera
- Error rates in logs

## 🤝 Contributing

### Code Style

- Use 2 spaces for indentation
- Follow ESLint configuration
- Write descriptive commit messages
- Add tests for new features

### Pull Request Process

1. Create feature branch
2. Implement changes with tests
3. Run full test suite
4. Update documentation
5. Submit pull request

### Release Process

1. Update package versions
2. Update CHANGELOG.md
3. Run full test suite
4. Create git tag
5. Deploy to production

## 📚 Additional Resources

- [Node.js Test Runner Documentation](https://nodejs.org/api/test.html)
- [npm Workspaces Documentation](https://docs.npmjs.com/cli/v7/using-npm/workspaces)
- [Hedera Documentation](https://docs.hedera.com/)
- [ESLint Configuration](https://eslint.org/docs/user-guide/configuring/)
