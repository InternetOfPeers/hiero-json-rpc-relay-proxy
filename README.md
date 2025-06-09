# Hiero JSON-RPC Relay Proxy

A monorepo containing a lightweight Ethereum transaction routing proxy with Hedera Consensus Service integration and RSA key management. The system consists of two main packages: a proxy server and a prover client that demonstrate encrypted communication via Hedera topics.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Ethereum      │    │     Proxy       │    │    Hedera       │
│   Clients       │◄──►│    Server       │◄──►│   Consensus     │
│                 │    │                 │    │   Service       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                ▲
                                │ Encrypted
                                │ Messages
                                ▼
                       ┌─────────────────┐
                       │     Prover      │
                       │    Client       │
                       └─────────────────┘
```

## 📦 Packages

### [@hiero-json-rpc-relay/proxy](./packages/proxy)
The main proxy server that:
- Handles Ethereum JSON-RPC requests
- Routes transactions based on sender addresses
- Manages RSA encryption keys
- Listens to Hedera topics for routing updates
- Provides status and configuration endpoints

### [@hiero-json-rpc-relay/prover](./packages/prover)
A demonstration client that:
- Fetches proxy configuration and public keys
- Creates and signs routing payloads
- Encrypts messages using RSA
- Submits encrypted data to Hedera topics

## 🚀 Quick Start

### Prerequisites

- Node.js 18.0.0 or higher
- Hedera testnet account with HBAR balance
- Ethereum JSON-RPC endpoint (optional, for testing)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/hiero-json-rpc-relay-proxy.git
cd hiero-json-rpc-relay-proxy

# Install all dependencies
npm install

# Or install for specific packages
npm install --workspaces
```

### Configuration

1. **Configure the Proxy** (required):
   ```bash
   cd packages/proxy
   cp .env.example .env
   # Edit .env with your Hedera credentials
   ```

2. **Configure the Prover** (optional for demo):
   ```bash
   cd packages/prover
   cp .env.example .env
   # Edit .env with your Hedera credentials
   ```

### Running the System

1. **Start the Proxy Server**:
   ```bash
   npm run start
   # or
   npm run proxy
   ```

2. **Run the Prover** (in another terminal):
   ```bash
   npm run prover
   ```

3. **Test the Proxy**:
   ```bash
   # Check status
   curl http://localhost:3000/status
   
   # Test JSON-RPC
   curl -X POST http://localhost:3000 \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
   ```

## 🧪 Testing

### Run All Tests

```bash
# All packages + integration tests
npm run test:all

# Individual packages
npm run test:proxy
npm run test:prover

# Integration tests only
npm run test:integration
```

### Test Coverage

```bash
# Coverage for all packages
npm test -- --experimental-test-coverage

# Package-specific coverage
npm run test:coverage --workspace=packages/proxy
npm run test:coverage --workspace=packages/prover
```

## 📋 Available Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start the proxy server |
| `npm run proxy` | Start the proxy server |
| `npm run prover` | Run the prover client |
| `npm run dev` | Start proxy in development mode |
| `npm test` | Run all package tests |
| `npm run test:proxy` | Run proxy tests only |
| `npm run test:prover` | Run prover tests only |
| `npm run test:integration` | Run integration tests |
| `npm run test:all` | Run all tests including integration |
| `npm run clean` | Clean the routing database |
| `npm run clean:all` | Clean all node_modules and databases |

## 🔧 Development

### Project Structure

```
hiero-json-rpc-relay-proxy/
├── packages/
│   ├── proxy/                 # Proxy server package
│   │   ├── src/              # Source code
│   │   ├── test/             # Unit and integration tests
│   │   ├── data/             # Routing database
│   │   └── package.json      # Package configuration
│   └── prover/               # Prover client package
│       ├── src/              # Source code
│       ├── test/             # Unit and integration tests
│       └── package.json      # Package configuration
├── test/                     # Cross-package integration tests
├── scripts/                  # Utility scripts
├── package.json              # Workspace configuration
└── README.md                 # This file
```

### Adding New Features

1. **For Proxy Features**:
   ```bash
   cd packages/proxy
   # Add your feature to src/
   # Add tests to test/
   npm test
   ```

2. **For Prover Features**:
   ```bash
   cd packages/prover
   # Add your feature to src/
   # Add tests to test/
   npm test
   ```

3. **For Integration Features**:
   ```bash
   # Add tests to test/
   npm run test:integration
   ```

### Code Style

- Use Node.js built-in test runner for testing
- Follow ESLint configuration (when available)
- Maintain consistent error handling patterns
- Document all public APIs
- Add tests for new functionality

## 🔐 Security Considerations

### RSA Key Management
- Private keys are generated automatically and stored securely
- Public keys are exposed via the status endpoint
- Key rotation is supported but requires manual intervention

### Message Validation
- All routing messages must be signed with valid ECDSA signatures
- Encryption ensures message confidentiality
- Replay protection through timestamp validation

### Network Security
- Use HTTPS in production environments
- Implement proper firewall rules
- Monitor Hedera topic access patterns

## 🐛 Troubleshooting

### Common Issues

1. **Proxy won't start**:
   - Check Hedera credentials in `.env`
   - Verify network connectivity
   - Ensure port 3000 is available

2. **Prover can't connect**:
   - Verify proxy is running (`curl http://localhost:3000/status`)
   - Check prover `.env` configuration
   - Confirm Hedera credentials are valid

3. **Tests failing**:
   - Run `npm run clean:all` and reinstall
   - Check Node.js version (requires 18+)
   - Verify test environment variables

### Debug Mode

Enable detailed logging:

```bash
DEBUG=* npm start        # All debug logs
DEBUG=proxy:* npm start  # Proxy logs only
DEBUG=prover:* npm run prover  # Prover logs only
```

## 📄 License

Apache-2.0 - See [LICENSE](./LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📞 Support

For issues and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review package-specific READMEs
