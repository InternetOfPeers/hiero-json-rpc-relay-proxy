# Chunked Message Handling

When the prover sends a message larger than 1024 KB to Hedera, the message is automatically split into multiple chunked messages. The proxy now supports gathering all related chunks, composing them in the correct order (even if they arrive out of order), and processing them as a single message.

## How It Works

### Message Structure

Chunked messages have the following structure:

```json
{
  "chunk_info": {
    "initial_transaction_id": {
      "account_id": "0.0.1545",
      "nonce": 0,
      "scheduled": false,
      "transaction_valid_start": "1749506740.674505590"
    },
    "number": 1,
    "total": 2
  },
  "consensus_timestamp": "1749506748.960591000",
  "message": "base64-encoded-chunk-content",
  "payer_account_id": "0.0.1545",
  "sequence_number": 2,
  "topic_id": "0.0.6139083"
}
```

### Key Fields

- **`chunk_info.initial_transaction_id.transaction_valid_start`**: Used to group related chunks
- **`chunk_info.number`**: The chunk number (1-based)
- **`chunk_info.total`**: Total number of chunks in the group
- **`message`**: Base64-encoded chunk content

### Processing Flow

1. **Detection**: The proxy detects chunked messages by checking for the `chunk_info` field
2. **Grouping**: Messages are grouped by `transaction_valid_start`
3. **Assembly**: When all chunks are received, they are combined in correct order
4. **Processing**: The combined message is processed normally (decryption, verification, etc.)

## Implementation Details

### New Methods in HederaManager

#### `isChunkedMessage(message)`

Checks if a message is chunked by looking for the `chunk_info` field.

#### `getChunkGroupKey(message)`

Extracts the group identifier from `transaction_valid_start`.

#### `addChunk(message)`

Adds a chunk to the pending chunks collection and returns the complete message if all chunks are received.

#### `combineChunkedMessages(chunks)`

Combines multiple chunks into a single message by concatenating their content.

#### `cleanupOldChunks(maxAgeMs)`

Removes expired chunk groups that have been waiting too long (default: 5 minutes).

#### `processCompleteMessage(message)`

Processes a complete message (either regular or assembled from chunks).

### Modified Message Listener

The `startMessageListener` method has been enhanced to:

1. Detect chunked vs regular messages
2. Handle chunk assembly
3. Process complete messages only
4. Clean up expired chunks automatically

## Example Usage

```javascript
const { HederaManager } = require('./src/hederaManager');

const hederaManager = new HederaManager({
  accountId: '0.0.1545',
  privateKey: 'your-private-key',
  network: 'testnet',
});

// Chunked messages are handled automatically
// No additional configuration required
hederaManager.startMessageListener();
```

## Features

- **✅ Automatic Detection**: Seamlessly handles both chunked and regular messages
- **✅ Order Independence**: Chunks can arrive in any order and will be assembled correctly
- **✅ Error Handling**: Validates chunk totals and handles mismatched chunks
- **✅ Automatic Cleanup**: Expires old chunk groups to prevent memory leaks
- **✅ Backward Compatibility**: Works with existing message processing logic

## Limitations

- Maximum chunk age: 5 minutes (configurable)
- Chunk total validation ensures consistency across all chunks in a group
- Memory usage scales with the number of pending chunk groups

## Testing

Comprehensive tests cover:

- Chunk detection and grouping
- Order-independent assembly
- Error handling for mismatched totals
- Automatic cleanup of expired chunks
- Integration with existing message processing

Run tests with:

```bash
npm test
```

## Demo

A demonstration script is available to show the chunked message functionality:

```bash
node examples/chunked-messages-demo.js
```

This shows how the proxy detects, groups, and assembles chunked messages automatically.
