# 🚀 Demo Scripts

This folder contains demonstration scripts for the Hiero JSON-RPC Relay Proxy.

## 📁 Contents

- `message-listener.js` - Demonstrates the Hedera message listener functionality with database persistence
- `data/` - Demo database files (separate from production and test data)

## 🎯 Running the Demo

### Message Listener Demo

Demonstrates real-time message monitoring with database persistence:

```bash
# From the project root
node demo/message-listener.js

# Or from the demo folder
cd demo
node message-listener.js
```

**Prerequisites:**
- Valid Hedera credentials in `.env` file:
  - `HEDERA_ACCOUNT_ID`
  - `HEDERA_PRIVATE_KEY`
  - `HEDERA_TOPIC_ID` (optional, will create new topic if not provided)

**What it does:**
1. Initializes a demo database in `demo/data/`
2. Sets up Hedera client and topic
3. Starts the message listener with database persistence
4. Submits a test message to demonstrate detection
5. Shows real-time message monitoring

**Demo Features:**
- ✅ Database persistence across restarts
- ✅ Real-time message detection
- ✅ Message content logging
- ✅ Graceful error handling
- ✅ Clean shutdown on Ctrl+C

## 🗄️ Database Isolation

The demo uses its own database files in `demo/data/` to keep demo data completely separate from:
- Production data in `data/`
- Test data in `test/data/`

This ensures demos don't interfere with production routing or test suites.

## 🧪 Demo vs Production

| Aspect | Demo | Production |
|--------|------|------------|
| Database Location | `demo/data/` | `data/` |
| Purpose | Demonstration | Live operations |
| Data Persistence | Yes | Yes |
| Isolation | Complete | Complete |

The demo provides the full production experience while maintaining complete data isolation.
