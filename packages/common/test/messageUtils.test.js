const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const {
  isChunkedMessage,
  getChunkGroupKey,
  combineChunkedMessages,
  parseMessageContent,
  extractChunkInfo,
  validateMessageStructure,
} = require('../src/messageUtils');

describe('messageUtils', function () {
  let sampleMessage;
  let chunkedMessage;
  let validChunks;

  beforeEach(() => {
    sampleMessage = {
      message: Buffer.from('{"test": "data"}', 'utf8').toString('base64'),
      consensus_timestamp: '1234567890.123456789',
      sequence_number: 1,
      transaction_valid_start: {
        seconds: 1234567890,
        nanos: 123456789,
      },
    };

    chunkedMessage = {
      message: Buffer.from(
        JSON.stringify({
          chunk_info: { current: 1, total: 3 },
          data: 'chunk1',
        }),
        'utf8'
      ).toString('base64'),
      consensus_timestamp: '1234567890.123456789',
      sequence_number: 1,
      transaction_valid_start: {
        seconds: 1234567890,
        nanos: 123456789,
      },
    };

    validChunks = [
      {
        message: Buffer.from('part1', 'utf8').toString('base64'),
        consensus_timestamp: '1234567890.123456789',
        sequence_number: 1,
        transaction_valid_start: { seconds: 1234567890, nanos: 123456789 },
      },
      {
        message: Buffer.from('part2', 'utf8').toString('base64'),
        consensus_timestamp: '1234567890.123456790',
        sequence_number: 2,
        transaction_valid_start: { seconds: 1234567890, nanos: 123456789 },
      },
    ];
  });

  describe('isChunkedMessage', () => {
    test('should return false for non-chunked message', () => {
      const result = isChunkedMessage(sampleMessage);
      assert.strictEqual(result, false);
    });

    test('should return true for chunked message', () => {
      const result = isChunkedMessage(chunkedMessage);
      assert.strictEqual(result, true);
    });

    test('should return false for single chunk message', () => {
      const singleChunk = {
        message: Buffer.from(
          JSON.stringify({
            chunk_info: { current: 1, total: 1 },
            data: 'single',
          }),
          'utf8'
        ).toString('base64'),
        consensus_timestamp: '1234567890.123456789',
        sequence_number: 1,
      };
      const result = isChunkedMessage(singleChunk);
      assert.strictEqual(result, false);
    });

    test('should return false for invalid message', () => {
      const invalidMessage = { message: 'invalid-base64' };
      const result = isChunkedMessage(invalidMessage);
      assert.strictEqual(result, false);
    });
  });

  describe('getChunkGroupKey', () => {
    test('should generate correct group key', () => {
      const result = getChunkGroupKey(sampleMessage);
      assert.strictEqual(result, '1234567890_123456789');
    });

    test('should throw error for message without transaction_valid_start', () => {
      const invalidMessage = { message: 'test' };
      assert.throws(() => {
        getChunkGroupKey(invalidMessage);
      }, /Message missing transaction_valid_start/);
    });
  });

  describe('combineChunkedMessages', () => {
    test('should combine chunks correctly', () => {
      const result = combineChunkedMessages(validChunks);

      assert.ok(result);
      assert.strictEqual(
        result.consensus_timestamp,
        validChunks[0].consensus_timestamp
      );
      assert.strictEqual(
        result.sequence_number,
        validChunks[0].sequence_number
      );

      const combinedContent = parseMessageContent(result);
      assert.strictEqual(combinedContent, 'part1part2');
    });

    test('should throw error for empty chunks array', () => {
      assert.throws(() => {
        combineChunkedMessages([]);
      }, /No chunks provided for combining/);
    });

    test('should throw error for null chunks', () => {
      assert.throws(() => {
        combineChunkedMessages(null);
      }, /No chunks provided for combining/);
    });
  });

  describe('parseMessageContent', () => {
    test('should parse message content correctly', () => {
      const result = parseMessageContent(sampleMessage);
      assert.strictEqual(result, '{"test": "data"}');
    });

    test('should handle empty message', () => {
      const emptyMessage = { message: '' };
      const result = parseMessageContent(emptyMessage);
      assert.strictEqual(result, '');
    });
  });

  describe('extractChunkInfo', () => {
    test('should extract chunk info from chunked message', () => {
      const result = extractChunkInfo(chunkedMessage);
      assert.ok(result);
      assert.strictEqual(result.current, 1);
      assert.strictEqual(result.total, 3);
    });

    test('should return null for non-chunked message', () => {
      const result = extractChunkInfo(sampleMessage);
      assert.strictEqual(result, null);
    });

    test('should return null for invalid message', () => {
      const invalidMessage = { message: 'invalid-base64' };
      const result = extractChunkInfo(invalidMessage);
      assert.strictEqual(result, null);
    });
  });

  describe('validateMessageStructure', () => {
    test('should validate correct message structure', () => {
      const result = validateMessageStructure(sampleMessage);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    test('should detect missing message content', () => {
      const invalidMessage = {
        consensus_timestamp: '1234567890.123456789',
        sequence_number: 1,
      };
      const result = validateMessageStructure(invalidMessage);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.includes('Message content is missing'));
    });

    test('should detect missing consensus timestamp', () => {
      const invalidMessage = {
        message: 'test',
        sequence_number: 1,
      };
      const result = validateMessageStructure(invalidMessage);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.includes('Consensus timestamp is missing'));
    });

    test('should detect missing sequence number', () => {
      const invalidMessage = {
        message: 'test',
        consensus_timestamp: '1234567890.123456789',
      };
      const result = validateMessageStructure(invalidMessage);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.includes('Sequence number is missing'));
    });

    test('should detect null message', () => {
      const result = validateMessageStructure(null);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.includes('Message is null or undefined'));
    });
  });
});
