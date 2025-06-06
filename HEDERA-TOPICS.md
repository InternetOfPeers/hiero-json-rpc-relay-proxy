# Hedera Topic Management for Relay Proxy

This document explains how to set up and use Hedera topic functionality in the Ethereum relay proxy server.

## Overview

The relay proxy can automatically create and manage a Hedera Consensus Service (HCS) topic for logging transaction routing decisions, audit trails, or other blockchain-related events.

## Setup

### 1. Environment Variables

Add the following environment variables to enable Hedera functionality:

```bash
# Required for Hedera functionality
HEDERA_ACCOUNT_ID=0.0.123456         # Your Hedera account ID
HEDERA_PRIVATE_KEY=302e020100300506... # Your Hedera private key (DER encoded)
HEDERA_NETWORK=testnet                # "testnet" or "mainnet"

# Optional - if you already have a topic
HEDERA_TOPIC_ID=0.0.654321           # Existing topic ID (optional)
```

### 2. Getting Hedera Credentials

#### For Testnet:
1. Go to [Hedera Portal](https://portal.hedera.com/)
2. Create a testnet account
3. Note your Account ID and Private Key

#### For Mainnet:
1. Create a mainnet account through an exchange or wallet
2. Ensure you have HBAR for transaction fees

### 3. Topic Creation

When the server starts:

1. **If `HEDERA_TOPIC_ID` is provided**: The server checks if the topic exists and is accessible
2. **If no topic ID or topic is inaccessible**: The server creates a new topic automatically
3. **If creation succeeds**: The new topic ID is logged and you can add it to your `.env` file

## API Endpoints

### Get Topic Information

```bash
GET /hedera/topic
```

**Response:**
```json
{
  "topicId": "0.0.123456",
  "hederaNetwork": "testnet",
  "accountId": "0.0.789012",
  "clientInitialized": true
}
```

## Usage Examples

### 1. Start Server with Hedera Support

```bash
# Set environment variables
export HEDERA_ACCOUNT_ID=0.0.123456
export HEDERA_PRIVATE_KEY=302e020100300506032b657004220420...
export HEDERA_NETWORK=testnet

# Start the server
npm start
```

### 2. Check Topic Status

```bash
curl http://localhost:3000/hedera/topic
```

### 3. Automatic Transaction Routing Logging

You can extend the server to automatically log routing decisions to the Hedera topic for audit purposes.

## Topic Costs

- **Topic Creation**: ~$0.01 USD (varies with HBAR price)
- **Topic Info Query**: ~$0.0001 USD

## Security Considerations

1. **Private Key Security**: Store private keys securely, never commit to version control
2. **Network Selection**: Use testnet for development, mainnet for production
3. **Access Control**: The topic is publicly readable but only writable by the account holder

## Troubleshooting

### Common Issues

1. **"Failed to initialize Hedera client"**
   - Check that `HEDERA_ACCOUNT_ID` and `HEDERA_PRIVATE_KEY` are correctly set
   - Verify the private key format (should be DER encoded hex string)

2. **"Topic does not exist or is not accessible"**
   - The provided `HEDERA_TOPIC_ID` might be incorrect
   - The account might not have permission to access the topic
   - Remove `HEDERA_TOPIC_ID` to create a new topic

3. **"Insufficient account balance"**
   - Ensure your Hedera account has sufficient HBAR balance
   - Testnet accounts can get free HBAR from the faucet

### Debug Mode

Set `DEBUG=1` environment variable for detailed logging:

```bash
DEBUG=1 npm start
```

## Further Reading

- [Hedera Consensus Service Documentation](https://docs.hedera.com/hedera/core-concepts/consensus-service)
- [Hedera JavaScript SDK](https://github.com/hashgraph/hedera-sdk-js)
- [HCS Topic Management](https://docs.hedera.com/hedera/sdks-and-apis/sdks/consensus-service)
