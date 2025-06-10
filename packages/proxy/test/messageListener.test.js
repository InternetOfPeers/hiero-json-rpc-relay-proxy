const { describe, it, mock, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { HederaManager } = require('../src/hederaManager');

describe('HederaManager Message Listener', () => {
  let hederaManager;
  let originalConsoleLog;
  let originalConsoleError;
  let logOutput;
  let activeIntervals = [];

  beforeEach(() => {
    // Mock console.log and console.error to capture output
    logOutput = [];
    originalConsoleLog = console.log;
    originalConsoleError = console.error;

    console.log = (...args) => {
      logOutput.push(args.join(' '));
    };

    console.error = (...args) => {
      logOutput.push('ERROR: ' + args.join(' '));
    };

    hederaManager = new HederaManager({
      accountId: '0.0.123456',
      privateKey: '302e020100300506032b657004220420' + 'a'.repeat(64),
      network: 'testnet',
      topicId: '0.0.789012',
    });
    hederaManager.currentTopicId = '0.0.789012';
    activeIntervals = [];
  });

  afterEach(() => {
    // Clean up all active intervals
    activeIntervals.forEach(intervalId => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    });
    activeIntervals = [];

    // Restore console functions
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  it('should not start listener without topic ID', () => {
    hederaManager.currentTopicId = null;

    const intervalId = hederaManager.startMessageListener();

    assert.strictEqual(intervalId, null);
    assert.ok(logOutput.some(log => log.includes('No topic ID available')));
  });

  it('should start message listener with correct configuration', () => {
    // Mock getTopicMessages to return empty array
    hederaManager.getTopicMessages = mock.fn(async () => []);

    const intervalId = hederaManager.startMessageListener(5000);
    activeIntervals.push(intervalId);

    assert.ok(intervalId !== null);
    assert.ok(logOutput.some(log => log.includes('Starting message listener')));
    assert.ok(
      logOutput.some(log =>
        log.includes('Checking for new messages every 5 seconds')
      )
    );
  });

  it('should detect existing messages on first check', async () => {
    const mockMessages = [
      {
        sequence_number: 1,
        consensus_timestamp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        message: Buffer.from('Hello World').toString('base64'),
        payer_account_id: '0.0.123456',
      },
      {
        sequence_number: 2,
        consensus_timestamp: Math.floor(Date.now() / 1000) - 1800, // 30 minutes ago
        message: Buffer.from('Second message').toString('base64'),
        payer_account_id: '0.0.123456',
      },
    ];

    // Mock getTopicMessages to return mock messages
    hederaManager.getTopicMessages = mock.fn(async () => mockMessages);

    const intervalId = hederaManager.startMessageListener(60000);
    activeIntervals.push(intervalId);

    // Wait a bit for the async call to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    assert.ok(logOutput.some(log => log.includes('Found 2 existing messages')));
    assert.ok(
      logOutput.some(log =>
        log.includes('skipped message #1, processed sequence 2 to 2')
      )
    );
  });

  it('should detect new messages after initial check', async () => {
    let callCount = 0;
    const initialMessages = [
      {
        sequence_number: 1,
        consensus_timestamp: Math.floor(Date.now() / 1000) - 3600,
        message: Buffer.from('Initial message').toString('base64'),
        payer_account_id: '0.0.123456',
      },
    ];

    const newMessages = [
      ...initialMessages,
      {
        sequence_number: 2,
        consensus_timestamp: Math.floor(Date.now() / 1000) - 60,
        message: Buffer.from('New message').toString('base64'),
        payer_account_id: '0.0.789012',
      },
    ];

    // Mock getTopicMessages to return different results on subsequent calls
    hederaManager.getTopicMessages = mock.fn(async () => {
      callCount++;
      return callCount === 1 ? initialMessages : newMessages;
    });

    const intervalId = hederaManager.startMessageListener(100); // Very short interval for testing
    activeIntervals.push(intervalId);

    // Wait for initial check
    await new Promise(resolve => setTimeout(resolve, 50));

    // Wait for second check
    await new Promise(resolve => setTimeout(resolve, 150));

    assert.ok(logOutput.some(log => log.includes('Found 1 existing messages')));
    assert.ok(logOutput.some(log => log.includes('Found 1 new message(s)')));
    assert.ok(logOutput.some(log => log.includes('Message #2')));
    assert.ok(logOutput.some(log => log.includes('New message')));
  });

  it('should handle API errors gracefully', async () => {
    // Mock getTopicMessages to throw an error
    hederaManager.getTopicMessages = mock.fn(async () => {
      throw new Error('Mirror node API error');
    });

    const intervalId = hederaManager.startMessageListener(100);
    activeIntervals.push(intervalId);

    // Wait for the error to occur
    await new Promise(resolve => setTimeout(resolve, 150));

    assert.ok(
      logOutput.some(log => log.includes('Error checking for new messages'))
    );
    assert.ok(logOutput.some(log => log.includes('Mirror node API error')));
  });

  it('should stop message listener correctly', () => {
    // Mock getTopicMessages
    hederaManager.getTopicMessages = mock.fn(async () => []);

    const intervalId = hederaManager.startMessageListener();
    assert.ok(intervalId !== null);

    hederaManager.stopMessageListener(intervalId);

    assert.ok(logOutput.some(log => log.includes('Message listener stopped')));
  });

  it('should handle empty messages array', async () => {
    // Mock getTopicMessages to return empty array
    hederaManager.getTopicMessages = mock.fn(async () => []);

    const intervalId = hederaManager.startMessageListener(100);
    activeIntervals.push(intervalId);

    // Wait for initial check
    await new Promise(resolve => setTimeout(resolve, 150));

    assert.ok(
      logOutput.some(log => log.includes('No existing messages found'))
    );
  });

  it('should truncate long message content in logs', async () => {
    const longMessage = 'A'.repeat(300); // 300 character message
    const mockMessages = [
      {
        sequence_number: 1,
        consensus_timestamp: Math.floor(Date.now() / 1000) - 3600,
        message: Buffer.from('Initial').toString('base64'),
        payer_account_id: '0.0.123456',
      },
    ];

    const newMessages = [
      ...mockMessages,
      {
        sequence_number: 2,
        consensus_timestamp: Math.floor(Date.now() / 1000) - 60,
        message: Buffer.from(longMessage).toString('base64'),
        payer_account_id: '0.0.789012',
      },
    ];

    let callCount = 0;
    hederaManager.getTopicMessages = mock.fn(async () => {
      callCount++;
      return callCount === 1 ? mockMessages : newMessages;
    });

    const intervalId = hederaManager.startMessageListener(100);
    activeIntervals.push(intervalId);

    // Wait for both checks
    await new Promise(resolve => setTimeout(resolve, 250));

    // Should find a log entry with truncated content (ending with ...)
    const contentLogs = logOutput.filter(log => log.includes('Content:'));
    assert.ok(
      contentLogs.some(
        log => log.includes('...') && log.length < longMessage.length + 100
      )
    );
  });

  it('should restore last processed sequence from database on startup', () => {
    const mockGetLastProcessedSequence = mock.fn(() => 42);

    hederaManager.getLastProcessedSequence = mockGetLastProcessedSequence;
    hederaManager.getTopicMessages = mock.fn(async () => []);

    const intervalId = hederaManager.startMessageListener(100);
    activeIntervals.push(intervalId);

    // Should have called getLastProcessedSequence with topic ID
    assert.strictEqual(mockGetLastProcessedSequence.mock.callCount(), 1);
    assert.strictEqual(
      mockGetLastProcessedSequence.mock.calls[0].arguments[0],
      '0.0.789012'
    );

    // Should log restored sequence
    assert.ok(
      logOutput.some(log =>
        log.includes('Restored last processed sequence: 42')
      )
    );
  });

  it('should save processed messages to database', async () => {
    const mockStoreLastProcessedSequence = mock.fn();
    const mockMessages = [
      {
        sequence_number: 1,
        consensus_timestamp: Math.floor(Date.now() / 1000) - 3600,
        message: Buffer.from('Initial message').toString('base64'),
        payer_account_id: '0.0.123456',
      },
    ];

    const newMessages = [
      ...mockMessages,
      {
        sequence_number: 2,
        consensus_timestamp: Math.floor(Date.now() / 1000) - 60,
        message: Buffer.from('New message').toString('base64'),
        payer_account_id: '0.0.789012',
      },
    ];

    let callCount = 0;
    hederaManager.getTopicMessages = mock.fn(async () => {
      callCount++;
      return callCount === 1 ? mockMessages : newMessages;
    });

    hederaManager.storeLastProcessedSequence = mockStoreLastProcessedSequence;
    hederaManager.dbFile = 'test.db';

    const intervalId = hederaManager.startMessageListener(100);
    activeIntervals.push(intervalId);

    // Wait for both checks to complete
    await new Promise(resolve => setTimeout(resolve, 250));

    // Should have saved the latest sequence number twice (initial check + new message)
    assert.ok(mockStoreLastProcessedSequence.mock.callCount() >= 1);

    const lastCall =
      mockStoreLastProcessedSequence.mock.calls[
      mockStoreLastProcessedSequence.mock.callCount() - 1
      ];
    assert.strictEqual(lastCall.arguments[0], '0.0.789012'); // topic ID
    assert.strictEqual(lastCall.arguments[1], 2); // sequence number
    assert.strictEqual(lastCall.arguments[2], 'test.db'); // db file
  });

  it('should handle database save errors gracefully', async () => {
    const mockStoreLastProcessedSequence = mock.fn(async () => {
      throw new Error('Database save failed');
    });

    const mockMessages = [
      {
        sequence_number: 1,
        consensus_timestamp: Math.floor(Date.now() / 1000) - 3600,
        message: Buffer.from('Test message').toString('base64'),
        payer_account_id: '0.0.123456',
      },
    ];

    hederaManager.getTopicMessages = mock.fn(async () => mockMessages);
    hederaManager.storeLastProcessedSequence = mockStoreLastProcessedSequence;
    hederaManager.dbFile = 'test.db';

    const intervalId = hederaManager.startMessageListener(100);
    activeIntervals.push(intervalId);

    // Wait for check to complete
    await new Promise(resolve => setTimeout(resolve, 150));

    // Should have attempted to save but logged the error
    assert.ok(mockStoreLastProcessedSequence.mock.callCount() >= 1);
    assert.ok(logOutput.some(log => log.includes('Failed to save')));
  });

  it('should work without database persistence functions', async () => {
    const mockMessages = [
      {
        sequence_number: 1,
        consensus_timestamp: Math.floor(Date.now() / 1000) - 3600,
        message: Buffer.from('Test message').toString('base64'),
        payer_account_id: '0.0.123456',
      },
    ];

    hederaManager.getTopicMessages = mock.fn(async () => mockMessages);
    // Don't set persistence functions - should work without them

    const intervalId = hederaManager.startMessageListener(100);
    activeIntervals.push(intervalId);

    // Wait for check to complete
    await new Promise(resolve => setTimeout(resolve, 150));

    // Should still process messages normally
    assert.ok(logOutput.some(log => log.includes('Found 1 existing messages')));
  });

  describe('Chunked Message Handling', () => {
    it('should detect chunked messages correctly', () => {
      const chunkedMessage = {
        chunk_info: {
          initial_transaction_id: {
            account_id: "0.0.1545",
            nonce: 0,
            scheduled: false,
            transaction_valid_start: "1749506740.674505590"
          },
          number: 1,
          total: 2
        },
        consensus_timestamp: "1749506748.960591000",
        message: "eyJrZXkiOiJkYzFwVWVydFRMbUhhQjFHNm9zdURhTExjUUoyNDVTVGp0cHZ1RGhJQ3plWThsb3FmTzhFOUZSLyswZ2lzMFBITHFOWnVpUU4yU2h5Z2ljb3kzOEZTUnpMVlVENms5OXc1WWxrK3pjV2dsL0NqRjJvR0tVbVVkTjVadFlzb1I0T3o4ZTVRdkErYnpRK0trcHZHdkhsM05ZajdycUIrTkhFd1BXU0JhL0ZNNitIODUvdURvOUlrRW02dkYybkkyaDVOS3cvUWM1djNtSG56a3UvZytsTTBGK2M0ejUwVFlvMzVrS2pCb3dzMmo3eHp2VStVMFpreHRvOERIMjNOOHJralNhQnA0R2tLSngwY3pXZzk1K2x3UXBQTTBySHJock5YYUQvYWt3dTd4YmRrc3pKZ1lFZEV0WVREZEtxakdycnlXTlBad0l1N0ZVODF6dDkrOGhvRGc9PSIsIml2Ijoib2lHMWVBOXp0ZGhGYjlYVEZ0WEFvUT09IiwiZGF0YSI6IjlaajFkaW1JTmd6bU5qZHNCZU9XYUxweTZwbHduaG1VVUJJajV6R1pCNVc2MmNDU2ZGUVVoajVHTys0L0UyNXlLTDRnb3BzVnhXZG4wWjBRKytuVTJYUXJyTytWWnRhQzRUM3RtMVBzMGdrYit3blNocmNwa09KVFRxeTlzdGtSSGFkaUtxTDNwZUdEUWg2c05FR01PTDFKdGdQTGhBcDdMYll0OVdKa2J4YXdvKzNXZEptUVpaZUNOelI1NHFDUDk1dXJIM2xCcWYxb3M0UzRUL2xzQ1o1YW1YSUx1YWkwQkc2cFM4ZmhHUXdVcXNCL0NzR0ppVkR6M2FHQmtuY0FDUE0wLytDR3MrNlNoMERCYjBseTNTVDlWc1R0ZXZieUk3QVZDVk5oOFVYM1kyNEhpOVdBL1kxNHV0Wko4V3ljb0pNSEZxYUhPNXNqZ2VoajhVWnVpdDhjUU9pcjd2NWJrbmhZZU4zVGl2MHRRaTUrb0R4UXgrcmE1NENlcnhnMXlLeTBLeWdNWk1LM0xtcGZKaytzY1Jla2hqR2RLK2ZlSDBTUmQwdnZvb2hWTHpldVZNTkR5ZG5JRjlvQkxuVzd3WDRHTTlpcWNPa3dkdlBWY1B4MGV1RlI5VFdJNTFFM3NUUDc0NytuRGp0b0lkYm1ZeUZVdVMvajJNaXBlbjcyMXhkTDNuY0h4MURHVithWnByTkdTWURkZXg5eWFrREQ2RmJNZXltREliT0luU1h4NUlXYUJsM0NEeTM5Z25YL2FsK3hlOUJHWmRYTFRhZWlRK1FYZVBYT3RGL1JKUHlHYzVJODdMUFNlbzNWMFJVV0NVMEduZA==",
        payer_account_id: "0.0.1545",
        running_hash: "5xsTd9M3S1hh5QyeqTYTrFRnT3CXn1t5TKxo9jlFrl7qK9/tszIA9p9AuuRL2hj3",
        running_hash_version: 3,
        sequence_number: 2,
        topic_id: "0.0.6139083"
      };

      const regularMessage = {
        consensus_timestamp: "1749506748.960591000",
        message: "eyJrZXkiOiJkYzFwVWVydFRMbUhhQjFHNm9zdURhTExjUUoyNDVTVGp0cHZ1RGhJQ3plWThsb3FmTzhFOUZSLyswZ2lzMFBITHFOWnVpUU4yU2h5Z2ljb3kzOEZTUnpMVlVENms5OXc1WWxrK3pjV2dsL0NqRjJvR0tVbVVkTjVadFlzb1I0T3o4ZTVRdkErYnpRK0trcHZHdkhsM05ZajdycUIrTkhFd1BXU0JhL0ZNNitIODUvdURvOUlrRW02dkYybkkyaDVOS3cvUWM1djNtSG56a3UvZytsTTBGK2M0ejUwVFlvMzVrS2pCb3dzMmo3eHp2VStVMFpreHRvOERIMjNOOHJralNhQnA0R2tLSngwY3pXZzk1K2x3UXBQTTBySHJock5YYUQvYWt3dTd4YmRrc3pKZ1lFZEV0WVREZEtxakdycnlXTlBad0l1N0ZVODF6dDkrOGhvRGc9PSIsIml2Ijoib2lHMWVBOXp0ZGhGYjlYVEZ0WEFvUT09IiwiZGF0YSI6IjlaajFkaW1JTmd6bU5qZHNCZU9XYUxweTZwbHduaG1VVUJJajV6R1pCNVc2MmNDU2ZGUVVoajVHTys0L0UyNXlLTDRnb3BzVnhXZG4wWjBRKytuVTJYUXJyTytWWnRhQzRUM3RtMVBzMGdrYit3blNocmNwa09KVFRxeTlzdGtSSGFkaUtxTDNwZUdEUWg2c05FR01PTDFKdGdQTGhBcDdMYll0OVdKa2J4YXdvKzNXZEptUVpaZUNOelI1NHFDUDk1dXJIM2xCcWYxb3M0UzRUL2xzQ1o1YW1YSUx1YWkwQkc2cFM4ZmhHUXdVcXNCL0NzR0ppVkR6M2FHQmtuY0FDUE0wLytDR3MrNlNoMERCYjBseTNTVDlWc1R0ZXZieUk3QVZDVk5oOFVYM1kyNEhpOVdBL1kxNHV0Wko4V3ljb0pNSEZxYUhPNXNqZ2VoajhVWnVpdDhjUU9pcjd2NWJrbmhZZU4zVGl2MHRRaTUrb0R4UXgrcmE1NENlcnhnMXlLeTBLeWdNWk1LM0xtcGZKaytzY1Jla2hqR2RLK2ZlSDBTUmQwdnZvb2hWTHpldVZNTkR5ZG5JRjlvQkxuVzd3WDRHTTlpcWNPa3dkdlBWY1B4MGV1RlI5VFdJNTFFM3NUUDc0NytuRGp0b0lkYm1ZeUZVdVMvajJNaXBlbjcyMXhkTDNuY0h4MURHVithWnByTkdTWURkZXg5eWFrREQ2RmJNZXltREliT0luU1h4NUlXYUJsM0NEeTM5Z25YL2FsK3hlOUJHWmRYTFRhZWlRK1FYZVBYT3RGL1JKUHlHYzVJODdMUFNlbzNWMFJVV0NVMEduZA==",
        payer_account_id: "0.0.1545",
        running_hash: "5xsTd9M3S1hh5QyeqTYTrFRnT3CXn1t5TKxo9jlFrl7qK9/tszIA9p9AuuRL2hj3",
        running_hash_version: 3,
        sequence_number: 2,
        topic_id: "0.0.6139083"
      };

      assert.strictEqual(hederaManager.isChunkedMessage(chunkedMessage), true);
      assert.strictEqual(hederaManager.isChunkedMessage(regularMessage), false);
    });

    it('should get correct chunk group key', () => {
      const message = {
        chunk_info: {
          initial_transaction_id: {
            account_id: "0.0.1545",
            nonce: 0,
            scheduled: false,
            transaction_valid_start: "1749506740.674505590"
          },
          number: 1,
          total: 2
        }
      };

      const groupKey = hederaManager.getChunkGroupKey(message);
      assert.strictEqual(groupKey, "1749506740.674505590");
    });

    it('should handle adding chunks and return complete message when all received', () => {
      const chunk1 = {
        chunk_info: {
          initial_transaction_id: {
            account_id: "0.0.1545",
            nonce: 0,
            scheduled: false,
            transaction_valid_start: "1749506740.674505590"
          },
          number: 1,
          total: 2
        },
        consensus_timestamp: "1749506748.960591000",
        message: Buffer.from("First part of message").toString('base64'),
        payer_account_id: "0.0.1545",
        sequence_number: 2,
        topic_id: "0.0.6139083"
      };

      const chunk2 = {
        chunk_info: {
          initial_transaction_id: {
            account_id: "0.0.1545",
            nonce: 0,
            scheduled: false,
            transaction_valid_start: "1749506740.674505590"
          },
          number: 2,
          total: 2
        },
        consensus_timestamp: "1749506749.452717106",
        message: Buffer.from(" - Second part of message").toString('base64'),
        payer_account_id: "0.0.1545",
        sequence_number: 3,
        topic_id: "0.0.6139083"
      };

      // Add first chunk - should return null (not complete)
      const result1 = hederaManager.addChunk(chunk1);
      assert.strictEqual(result1, null);

      // Add second chunk - should return complete message
      const result2 = hederaManager.addChunk(chunk2);
      assert.notStrictEqual(result2, null);

      // Verify combined message
      const combinedContent = Buffer.from(result2.message, 'base64').toString('utf8');
      assert.strictEqual(combinedContent, "First part of message - Second part of message");

      // Should have latest timestamp and sequence number
      assert.strictEqual(result2.consensus_timestamp, chunk2.consensus_timestamp);
      assert.strictEqual(result2.sequence_number, chunk2.sequence_number);

      // Should not have chunk_info
      assert.strictEqual(result2.chunk_info, undefined);
    });

    it('should handle chunks arriving out of order', () => {
      const chunk1 = {
        chunk_info: {
          initial_transaction_id: {
            account_id: "0.0.1545",
            nonce: 0,
            scheduled: false,
            transaction_valid_start: "1749506740.674505590"
          },
          number: 1,
          total: 3
        },
        consensus_timestamp: "1749506748.960591000",
        message: Buffer.from("Part1").toString('base64'),
        sequence_number: 2
      };

      const chunk3 = {
        chunk_info: {
          initial_transaction_id: {
            account_id: "0.0.1545",
            nonce: 0,
            scheduled: false,
            transaction_valid_start: "1749506740.674505590"
          },
          number: 3,
          total: 3
        },
        consensus_timestamp: "1749506750.000000000",
        message: Buffer.from("Part3").toString('base64'),
        sequence_number: 4
      };

      const chunk2 = {
        chunk_info: {
          initial_transaction_id: {
            account_id: "0.0.1545",
            nonce: 0,
            scheduled: false,
            transaction_valid_start: "1749506740.674505590"
          },
          number: 2,
          total: 3
        },
        consensus_timestamp: "1749506749.452717106",
        message: Buffer.from("Part2").toString('base64'),
        sequence_number: 3
      };

      // Add chunks out of order
      assert.strictEqual(hederaManager.addChunk(chunk3), null);
      assert.strictEqual(hederaManager.addChunk(chunk1), null);

      // Adding the final chunk should return complete message
      const result = hederaManager.addChunk(chunk2);
      assert.notStrictEqual(result, null);

      // Verify chunks are combined in correct order
      const combinedContent = Buffer.from(result.message, 'base64').toString('utf8');
      assert.strictEqual(combinedContent, "Part1Part2Part3");
    });

    it('should handle chunk total mismatch', () => {
      const chunk1 = {
        chunk_info: {
          initial_transaction_id: {
            account_id: "0.0.1545",
            nonce: 0,
            scheduled: false,
            transaction_valid_start: "1749506740.674505590"
          },
          number: 1,
          total: 2
        },
        message: Buffer.from("Part1").toString('base64')
      };

      const chunk2WithWrongTotal = {
        chunk_info: {
          initial_transaction_id: {
            account_id: "0.0.1545",
            nonce: 0,
            scheduled: false,
            transaction_valid_start: "1749506740.674505590"
          },
          number: 2,
          total: 3  // Different total!
        },
        message: Buffer.from("Part2").toString('base64')
      };

      // Add first chunk
      assert.strictEqual(hederaManager.addChunk(chunk1), null);

      // Add second chunk with wrong total - should return null
      assert.strictEqual(hederaManager.addChunk(chunk2WithWrongTotal), null);

      // Should log mismatch warning
      assert.ok(logOutput.some(log => log.includes('Chunk total mismatch')));
    });

    it('should clean up old pending chunks', () => {
      const oldChunk = {
        chunk_info: {
          initial_transaction_id: {
            account_id: "0.0.1545",
            nonce: 0,
            scheduled: false,
            transaction_valid_start: "1749506740.674505590"
          },
          number: 1,
          total: 2
        },
        message: Buffer.from("Old chunk").toString('base64')
      };

      // Add old chunk
      hederaManager.addChunk(oldChunk);

      // Verify chunk is stored
      assert.strictEqual(hederaManager.pendingChunks.size, 1);

      // Manually set timestamp to be old
      const groupKey = hederaManager.getChunkGroupKey(oldChunk);
      hederaManager.pendingChunks.get(groupKey).timestamp = Date.now() - (6 * 60 * 1000); // 6 minutes ago

      // Clean up old chunks (5 minute threshold)
      hederaManager.cleanupOldChunks();

      // Verify chunk was cleaned up
      assert.strictEqual(hederaManager.pendingChunks.size, 0);
      assert.ok(logOutput.some(log => log.includes('Cleaning up expired chunk group')));
    });
  });
});
