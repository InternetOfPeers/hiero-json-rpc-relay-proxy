# 🗄️ Database Persistence for Message Listener

## Overview

The Hiero JSON-RPC Relay Proxy now includes **database persistence** for the Hedera message listener, ensuring that the system remembers the last processed message even after server restarts. This prevents message duplication and provides reliable state management across server sessions.

## 🎯 Key Features

### ✅ **Persistent Message Tracking**
- Saves the last processed message sequence number to the database
- Automatically restores state on server restart
- Prevents duplicate processing of messages
- Works with the existing JSON database system

### ✅ **Automatic State Management**
- **On First Check**: Saves the latest message sequence number found in the topic
- **On New Messages**: Updates the database with the latest processed sequence
- **On Server Restart**: Restores the last known sequence number and continues from there
- **Error Handling**: Gracefully handles database save failures without affecting message processing

### ✅ **Zero Configuration Required**
- Works automatically with existing Hedera setup
- Uses the same database file as routing information
- No additional setup or configuration needed

## 🔧 Technical Implementation

### Database Schema Extension

The message sequence tracking extends the existing routing database with topic-specific keys:

```json
{
  "0x4f1a953df9df8d1c6073ce57f7493e50515fa73f": "https://testnet.hashio.io/api",
  "0x0000000000000000000000000000000000000000": "https://testnet.hashio.io/api",
  "rsaKeys": {
    "publicKey": "-----BEGIN PUBLIC KEY-----...",
    "privateKey": "-----BEGIN PRIVATE KEY-----...",
    "createdAt": "2025-06-06T22:14:55.560Z"
  },
  "lastSequence_0.0.123456": 42,
  "lastSequence_0.0.789012": 15
}
```

### New Database Functions

#### `getLastProcessedSequence(topicId)`
Retrieves the last processed sequence number for a specific topic.

**Parameters:**
- `topicId` (string): The Hedera topic ID (e.g., "0.0.123456")

**Returns:**
- `number`: The last processed sequence number, or 0 if no record exists

#### `storeLastProcessedSequence(topicId, sequenceNumber, dbFile)`
Stores the last processed sequence number for a specific topic.

**Parameters:**
- `topicId` (string): The Hedera topic ID
- `sequenceNumber` (number): The sequence number to store
- `dbFile` (string): Path to the database file (optional for in-memory storage)

**Returns:**
- `Promise<void>`: Resolves when the sequence is saved

### HederaManager Integration

The `HederaManager` class now accepts database persistence functions in its constructor:

```javascript
const hederaManager = new HederaManager({
  accountId: process.env.HEDERA_ACCOUNT_ID,
  privateKey: process.env.HEDERA_PRIVATE_KEY,
  network: process.env.HEDERA_NETWORK,
  topicId: process.env.HEDERA_TOPIC_ID,
  getLastProcessedSequence,      // Database read function
  storeLastProcessedSequence,    // Database write function
  dbFile: getDBFilePath(),       // Database file path
});
```

## 🚀 Usage Examples

### Automatic Server Integration

The server automatically includes persistence functionality:

```bash
npm start
# ✅ Database initialized
# ✅ Hedera topic setup
# ✅ Message listener starts with persistence
# 📚 Restored last processed sequence: 42 for topic 0.0.123456
# 🔗 Continues monitoring from sequence 43+
```

### Manual Integration

For custom implementations:

```javascript
const { HederaManager } = require('./src/hederaManager');
const { 
  initDatabase, 
  getLastProcessedSequence, 
  storeLastProcessedSequence 
} = require('./src/dbManager');

// Initialize database
await initDatabase('data/routing_db_testnet.json');

// Create HederaManager with persistence
const hederaManager = new HederaManager({
  accountId: '0.0.123456',
  privateKey: 'your-private-key',
  network: 'testnet',
  topicId: '0.0.789012',
  getLastProcessedSequence,
  storeLastProcessedSequence,
  dbFile: 'data/routing_db_testnet.json',
});

// Start listening with persistence
const intervalId = hederaManager.startMessageListener(30000);
```

### Demo Script with Persistence

```bash
npm run demo
# 🚀 Hedera Message Listener Demo
# 0️⃣  Initializing database...
# 📚 Restored last processed sequence: 5 for topic 0.0.123456
# 🔗 Starting message listener...
```

## 📊 Persistence Behavior

### First Run (No Previous State)
```
🔗 Starting message listener for topic 0.0.123456
   Checking for new messages every 30 seconds
📊 Found 3 existing messages in topic (sequence 1 to 3)
📝 Saved last processed sequence 3 for topic 0.0.123456
```

### Subsequent Runs (With Previous State)
```
🔗 Starting message listener for topic 0.0.123456
   Checking for new messages every 30 seconds
📚 Restored last processed sequence: 3 for topic 0.0.123456
📊 Found 5 existing messages in topic (sequence 1 to 5)

🆕 Found 2 new message(s) in topic 0.0.123456:
   📝 Message #4 (2025-06-06T22:15:30.123Z):
      Content: New message content
      Payer: 0.0.789012
   📝 Message #5 (2025-06-06T22:16:45.456Z):
      Content: Another new message
      Payer: 0.0.789012
📝 Saved last processed sequence 5 for topic 0.0.123456
```

### Server Restart Scenario
```
# Server shutdown
🛑 Message listener stopped

# Server restart
📚 Restored last processed sequence: 5 for topic 0.0.123456
🔗 Starting message listener for topic 0.0.123456
   Checking for new messages every 30 seconds
# Only processes messages with sequence > 5
```

## 🧪 Testing

### Unit Tests
The persistence functionality includes comprehensive tests:

```bash
npm run test:unit
# ✅ should store and retrieve last processed sequence number
# ✅ should handle multiple topic sequence numbers
# ✅ should handle invalid inputs for sequence storage
# ✅ should restore last processed sequence from database on startup
# ✅ should save processed messages to database
# ✅ should handle database save errors gracefully
# ✅ should work without database persistence functions
```

### Integration Testing
```bash
npm run test:integration
# ✅ Full end-to-end testing with real database persistence
# ✅ Server startup/shutdown with state preservation
# ✅ Message processing continuity across restarts
```

## 🔧 Error Handling

### Database Save Failures
- **Behavior**: Logs error but continues message processing
- **Impact**: Message listener continues working, but state may not persist
- **Recovery**: Automatic retry on next successful message processing

```
❌ Error: Failed to save sequence to database: Permission denied
🆕 Found 1 new message(s) in topic 0.0.123456:
   📝 Message #6 (2025-06-06T22:17:30.123Z):
      Content: Processing continues normally
      Payer: 0.0.789012
```

### Missing Database Functions
- **Behavior**: Message listener works without persistence
- **Impact**: State resets on server restart (original behavior)
- **Detection**: No restoration logs on startup

### Database File Issues
- **Behavior**: In-memory storage as fallback
- **Impact**: State persists during session but not across restarts
- **Recovery**: Automatic when database file becomes accessible

## 🎯 Benefits

### 🔄 **Reliability**
- No duplicate message processing
- Consistent state across server restarts
- Automatic recovery from failures

### ⚡ **Performance**
- Skip already-processed messages
- Efficient startup with large topics
- Minimal database overhead

### 🛡️ **Robustness**
- Graceful degradation when persistence fails
- Backward compatibility with non-persistent setups
- Comprehensive error handling

## 📈 Migration from Non-Persistent Setup

Existing installations automatically gain persistence without configuration changes:

1. **First Run**: System detects no previous state and processes all existing messages
2. **State Capture**: Records the latest sequence number in the database
3. **Future Runs**: Automatically resumes from the last processed message

No manual migration or data conversion required!

---

**🎉 The Hiero JSON-RPC Relay Proxy now provides enterprise-grade message processing with full state persistence across server restarts!**
