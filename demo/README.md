# Demo Scripts

This folder contains demonstration scripts for the Hiero JSON-RPC Relay Proxy.

## Setup

1. **Copy the demo environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Update the demo `.env` file with your credentials:**
   ```bash
   # Required Hedera credentials
   HEDERA_ACCOUNT_ID=0.0.123456
   HEDERA_PRIVATE_KEY=302e020100300506032b657004220420...
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

## Available Demo Scripts

### 1. Message Listener Demo
Tests the message listener functionality by submitting a test message and monitoring for new messages.

```bash
npm run demo
# or
node demo/message-listener.js
```

### 2. Encrypted Message Sender Demo
Demonstrates the complete encrypted messaging workflow:
- Fetches status from the `/status` endpoint
- Extracts topic ID and RSA public key
- Encrypts a test payload
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

If `demo/.env` doesn't exist, the scripts will automatically fall back to using the project root `.env` file.

## Demo Features

### Encrypted Message Sender
- **Configurable payload size**: Set `DEMO_PAYLOAD_SIZE=large` for extended test data
- **Status endpoint integration**: Automatically fetches topic ID and public key
- **RSA encryption**: Uses RSA-OAEP-SHA256 encryption
- **Structured messages**: Sends JSON metadata with encrypted payload

### Message Listener
- **Persistence**: Uses demo-specific database in `demo/data/`
- **Sequence tracking**: Remembers last processed message
- **Real-time monitoring**: Checks for new messages every 5 seconds (configurable)

## Troubleshooting

1. **Make sure the proxy server is running:**
   ```bash
   npm start
   ```

2. **Verify Hedera credentials are set in `demo/.env`**

3. **Check that the topic has been initialized**

4. **Ensure RSA keys have been generated**

## Security Note

The `demo/.env` file is automatically ignored by git to prevent committing sensitive credentials. Always use the `.env.example` as a template.
