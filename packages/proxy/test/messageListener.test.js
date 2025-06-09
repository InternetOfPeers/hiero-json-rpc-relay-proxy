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
});
