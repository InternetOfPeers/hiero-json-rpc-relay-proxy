# Demo Scripts

This folder contains demonstration scripts for the Hiero JSON-RPC Relay Proxy using a dedicated ECDSA-based Hedera manager.

## 🔑 Key Features

- **Dedicated Demo Manager**: Uses `DemoHederaManager` with ECDSA private key support
- **Isolated Environment**: Demo-specific configuration separate from main server
- **ECDSA Support**: Preferred key type for demo scripts (more widely supported)
- **Simplified API**: Focused on demonstration rather than production features

## Setup

1. **Copy the demo environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Update the demo `.env` file with your credentials:**
   ```bash
   # Required Hedera credentials
   HEDERA_ACCOUNT_ID=0.0.123456
   # ECDSA Private Key (hex format starting with 0x) - preferred for demos
   HEDERA_PRIVATE_KEY=0x1234567890abcdef...
   # Ed25519 Private Key (alternative format)
   # HEDERA_PRIVATE_KEY=302e020100300506032b657004220420...
   HEDERA_KEY_TYPE=ECDSA
   ```

3. **Configure demo settings (optional):**
   ```bash
   # Proxy server URL (default: http://localhost:3000)
   PROXY_SERVER_URL=http://localhost:3000
   
   # Hedera network (testnet or mainnet)
   HEDERA_NETWORK=testnet
   
   # Demo payload size (small or large)
   DEMO_PAYLOAD_SIZE=small
   
   # Message interval in milliseconds
   DEMO_MESSAGE_INTERVAL=5000
   ```

## 🔐 Private Key Formats

The demo supports both key formats:

- **ECDSA (Recommended)**: Hex format starting with `0x`
- **Ed25519**: Standard Hedera format

ECDSA keys are preferred for demos as they're more widely supported and easier to work with.

## Available Demo Scripts

### 1. Message Listener Demo

Tests the message listener functionality by submitting a test message using the dedicated ECDSA manager.

```bash
npm run demo
# or
node demo/message-listener.js
```

**Note**: This demo requires `HEDERA_TOPIC_ID` to be set. Run the main server first to create a topic.

### 2. Encrypted Message Sender Demo

Demonstrates the complete encrypted messaging workflow:
- Fetches status from the `/status` endpoint
- Extracts topic ID and RSA public key
- Encrypts a test payload using hybrid encryption
- Sends the encrypted message to the Hedera topic

```bash
npm run demo:encrypted
# or
node demo/encrypted-message-sender.js
```

## Environment Configuration

The demo scripts use a **dedicated `.env` file** located in the `demo/` folder. This allows you to:

- Use different credentials for demos vs production
- Test with different Hedera networks  
- Configure demo-specific parameters
- Keep demo settings isolated from the main server

### Fallback Behavior

If `demo/.env` doesn't exist, the scripts will stop execution to ensure proper demo configuration.

## Demo Features

### DemoHederaManager

The demos use a dedicated `DemoHederaManager` class that provides:

- **ECDSA Support**: Native support for ECDSA private keys (hex format)
- **Simplified API**: Focused on demo functionality without production complexity
- **Better Error Handling**: Clear error messages for demo setup issues
- **Auto Key Detection**: Automatically detects key format (ECDSA vs Ed25519)
- **Connection Management**: Proper client lifecycle management

### Encrypted Message Sender

- **Configurable payload size**: Set `DEMO_PAYLOAD_SIZE=large` for extended test data
- **Status endpoint integration**: Automatically fetches topic ID and public key
- **Hybrid encryption**: Uses RSA-OAEP-SHA256 + AES-256-CBC for large payloads
- **Structured messages**: Sends JSON metadata with encrypted payload
- **Key type tracking**: Records which key type was used for the message

### Message Listener

- **Simplified approach**: Direct message submission without persistent listening
- **ECDSA demonstration**: Shows ECDSA key usage for Hedera transactions  
- **Topic validation**: Verifies topic exists before attempting to send messages

## Usage Instructions

### Prerequisites

1. **Start the main server** (for encrypted message demo):
   ```bash
   npm start
   ```

2. **Set up demo credentials** in `demo/.env`:
   ```bash
   HEDERA_ACCOUNT_ID=0.0.123456
   HEDERA_PRIVATE_KEY=0x1234567890abcdef...
   HEDERA_KEY_TYPE=ECDSA
   ```

3. **Get a topic ID** (for message listener demo):
   - Run the main server to auto-create a topic, or
   - Set `HEDERA_TOPIC_ID` in your demo `.env` file

### Running the Demos

1. **Encrypted Message Sender** (fetches topic from server):
   ```bash
   npm run demo:encrypted
   ```

2. **Message Listener** (requires topic ID):
   ```bash
   HEDERA_TOPIC_ID=0.0.123456 npm run demo
   ```

## Troubleshooting

### Common Issues

1. **"HEDERA_TOPIC_ID is required"**: Set topic ID in demo/.env or run main server first
2. **"Failed to initialize Hedera client"**: Check private key format (should start with 0x for ECDSA)
3. **"Topic does not exist"**: Verify topic ID exists and is accessible
4. **"Connection refused"**: Make sure proxy server is running on correct port

### Key Format Issues

- **ECDSA keys**: Must start with `0x` (hex format)
- **Ed25519 keys**: Use standard Hedera format (long string without 0x)
- **Mixed formats**: Set `HEDERA_KEY_TYPE=Ed25519` if using Ed25519 keys

## Security Note

The `demo/.env` file is automatically ignored by git to prevent committing sensitive credentials. Always use the `.env.example` as a template.
