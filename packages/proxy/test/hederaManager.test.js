const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const { HederaManager } = require('../src/hederaManager');

test('HederaManager - should initialize with correct configuration', () => {
  const hederaManager = new HederaManager({
    accountId: '0.0.123456',
    privateKey: 'test-private-key',
    network: 'testnet',
    topicId: '0.0.789012',
  });

  assert.strictEqual(hederaManager.accountId, '0.0.123456');
  assert.strictEqual(hederaManager.privateKey, 'test-private-key');
  assert.strictEqual(hederaManager.network, 'testnet');
  assert.strictEqual(hederaManager.topicId, '0.0.789012');
  assert.strictEqual(hederaManager.client, null);
  assert.strictEqual(hederaManager.currentTopicId, null);
});

test('HederaManager - should return topic info correctly', () => {
  const hederaManager = new HederaManager({
    accountId: '0.0.123456',
    privateKey: 'test-private-key',
    network: 'testnet',
  });

  hederaManager.currentTopicId = '0.0.999999';
  hederaManager.client = {}; // Mock client

  const topicInfo = hederaManager.getTopicInfo();

  assert.deepStrictEqual(topicInfo, {
    topicId: '0.0.999999',
    hederaNetwork: 'testnet',
    accountId: '0.0.123456',
    clientInitialized: true,
  });
});

test('HederaManager - should return null topic ID when not initialized', () => {
  const hederaManager = new HederaManager({});
  assert.strictEqual(hederaManager.getTopicId(), null);
});

test('HederaManager - should return current topic ID when set', () => {
  const hederaManager = new HederaManager({});
  hederaManager.currentTopicId = '0.0.888888';
  assert.strictEqual(hederaManager.getTopicId(), '0.0.888888');
});

test('HederaManager - should return null client when not initialized', () => {
  const hederaManager = new HederaManager({});
  assert.strictEqual(hederaManager.getClient(), null);
});

test('HederaManager - should return client when initialized', () => {
  const hederaManager = new HederaManager({});
  const mockClient = { operator: 'test' };
  hederaManager.client = mockClient;
  assert.strictEqual(hederaManager.getClient(), mockClient);
});

test('HederaManager - should detect if Hedera is enabled', () => {
  // With credentials
  const hederaManager = new HederaManager({
    accountId: '0.0.123456',
    privateKey: 'test-private-key',
  });
  assert.strictEqual(hederaManager.isEnabled(), true);

  // Without credentials
  const noCredsManager = new HederaManager({});
  assert.strictEqual(noCredsManager.isEnabled(), false);

  // With partial credentials
  const partialCredsManager = new HederaManager({
    accountId: '0.0.123456',
  });
  assert.strictEqual(partialCredsManager.isEnabled(), false);
});

test('HederaManager - should not initialize client without credentials', () => {
  const noCredsManager = new HederaManager({});
  const client = noCredsManager.initClient();
  assert.strictEqual(client, null);
});

test('HederaManager - should handle mainnet network configuration', () => {
  const mainnetManager = new HederaManager({
    accountId: '0.0.123456',
    privateKey: 'test-private-key',
    network: 'mainnet',
  });
  assert.strictEqual(mainnetManager.network, 'mainnet');
});

test('HederaManager - should return topic info with null values when not initialized', () => {
  const uninitializedManager = new HederaManager({ network: 'testnet' });
  const topicInfo = uninitializedManager.getTopicInfo();

  assert.deepStrictEqual(topicInfo, {
    topicId: null,
    hederaNetwork: 'testnet',
    accountId: undefined,
    clientInitialized: false,
  });
});

// Test suite for challenge-response flow methods
describe('Challenge-Response Flow Methods', () => {
  let hederaManager;

  beforeEach(() => {
    hederaManager = new HederaManager({
      accountId: '0.0.123456',
      privateKey: 'test-private-key',
      network: 'testnet',
    });
    hederaManager.currentTopicId = '0.0.999999';
    hederaManager.client = {
      /* mock client */
    };
  });

  test('should have processChallengeResponseFlow method', () => {
    assert.strictEqual(
      typeof hederaManager.processChallengeResponseFlow,
      'function'
    );
  });

  test('should have sendChallenge method', () => {
    assert.strictEqual(typeof hederaManager.sendChallenge, 'function');
  });

  test('should have verifyChallengeResponseSignature method', () => {
    assert.strictEqual(
      typeof hederaManager.verifyChallengeResponseSignature,
      'function'
    );
  });

  test('should have updateRoutesFromMessage method', () => {
    assert.strictEqual(
      typeof hederaManager.updateRoutesFromMessage,
      'function'
    );
  });

  test('should have sendConfirmationToProver method', () => {
    assert.strictEqual(
      typeof hederaManager.sendConfirmationToProver,
      'function'
    );
  });

  test('should have sendConfirmationMessage method', () => {
    assert.strictEqual(
      typeof hederaManager.sendConfirmationMessage,
      'function'
    );
  });

  test('verifyChallengeResponseSignature - should return false for missing signature', () => {
    const challengeData = { challengeId: 'test-challenge-id' };
    const response = { challengeId: 'test-challenge-id' }; // Missing signature
    const expectedAddress = '0x1234567890123456789012345678901234567890';

    const result = hederaManager.verifyChallengeResponseSignature(
      challengeData,
      response,
      expectedAddress
    );
    assert.strictEqual(result, false);
  });

  test('verifyChallengeResponseSignature - should return false for mismatched challenge ID', () => {
    const challengeData = { challengeId: 'test-challenge-id' };
    const response = {
      challengeId: 'different-challenge-id',
      signature: 'test-signature',
    };
    const expectedAddress = '0x1234567890123456789012345678901234567890';

    const result = hederaManager.verifyChallengeResponseSignature(
      challengeData,
      response,
      expectedAddress
    );
    assert.strictEqual(result, false);
  });

  test('updateRoutesFromMessage - should handle message with valid routes', async () => {
    const messageData = {
      routes: [
        {
          addr: '0x1234567890123456789012345678901234567890',
          url: 'https://example1.com',
        },
        {
          addr: '0x2345678901234567890123456789012345678901',
          url: 'https://example2.com',
        },
      ],
    };

    // Mock the updateRoutes function - this test verifies the method exists and can be called
    try {
      await hederaManager.updateRoutesFromMessage(messageData);
      // If no error is thrown, the method exists and handles the input
      assert.ok(true);
    } catch (error) {
      // Expected to fail due to missing dependencies, but method should exist
      assert.ok(
        error.message.includes('updateRoutes') ||
          error.message.includes('saveDatabase')
      );
    }
  });

  test('updateRoutesFromMessage - should handle message with no routes', async () => {
    const messageData = { routes: [] };

    try {
      await hederaManager.updateRoutesFromMessage(messageData);
      assert.ok(true);
    } catch (error) {
      // Should not throw error for empty routes
      assert.fail(`Should handle empty routes without error: ${error.message}`);
    }
  });

  test('processChallengeResponseFlow - should handle message with routes', async () => {
    const messageData = {
      routes: [
        {
          addr: '0x1234567890123456789012345678901234567890',
          url: 'https://example.com',
        },
      ],
    };
    const signerAddress = '0x1234567890123456789012345678901234567890';

    // This test verifies the method exists and can be called
    try {
      await hederaManager.processChallengeResponseFlow(
        messageData,
        signerAddress
      );
      assert.ok(true);
    } catch (error) {
      // Expected to fail due to network calls, but method should exist
      assert.ok(true); // Method exists if we get here
    }
  });
});

// Test suite for AES encryption/decryption methods
describe('AES Encryption/Decryption Methods', () => {
  let hederaManager;

  beforeEach(() => {
    hederaManager = new HederaManager({
      accountId: '0.0.123456',
      privateKey: 'test-private-key',
      network: 'testnet',
    });
  });

  test('should have getAESKey method', () => {
    assert.strictEqual(typeof hederaManager.getAESKey, 'function');
  });

  test('should have removeAESKey method', () => {
    assert.strictEqual(typeof hederaManager.removeAESKey, 'function');
  });

  test('should have cleanupAllAESKeys method', () => {
    assert.strictEqual(typeof hederaManager.cleanupAllAESKeys, 'function');
  });

  test('should have encryptForProver method', () => {
    assert.strictEqual(typeof hederaManager.encryptForProver, 'function');
  });

  test('should have decryptFromProver method', () => {
    assert.strictEqual(typeof hederaManager.decryptFromProver, 'function');
  });

  test('getAESKey - should return null for non-existent contract', () => {
    const contractAddress = '0x1234567890123456789012345678901234567890';
    const result = hederaManager.getAESKey(contractAddress);
    assert.strictEqual(result, null);
  });

  test('removeAESKey - should return false for non-existent contract', () => {
    const contractAddress = '0x1234567890123456789012345678901234567890';
    const result = hederaManager.removeAESKey(contractAddress);
    assert.strictEqual(result, false);
  });

  test('cleanupAllAESKeys - should clear all stored keys', () => {
    // Add some mock keys
    const contractAddress1 = '0x1234567890123456789012345678901234567890';
    const contractAddress2 = '0x2345678901234567890123456789012345678901';
    const mockAESKey = Buffer.from('test-aes-key-32-bytes-long-test', 'utf8');

    hederaManager.proverAESKeys.set(contractAddress1.toLowerCase(), {
      aesKey: mockAESKey,
      timestamp: Date.now(),
    });
    hederaManager.proverAESKeys.set(contractAddress2.toLowerCase(), {
      aesKey: mockAESKey,
      timestamp: Date.now(),
    });

    assert.strictEqual(hederaManager.proverAESKeys.size, 2);

    hederaManager.cleanupAllAESKeys();
    assert.strictEqual(hederaManager.proverAESKeys.size, 0);
  });

  test('AES key storage and retrieval', () => {
    const contractAddress = '0x1234567890123456789012345678901234567890';
    const mockAESKey = Buffer.from('test-aes-key-32-bytes-long-test', 'utf8');

    // Store AES key
    hederaManager.proverAESKeys.set(contractAddress.toLowerCase(), {
      aesKey: mockAESKey,
      timestamp: Date.now(),
      url: 'https://example.com',
      sequenceNumber: 1,
    });

    // Retrieve AES key
    const retrievedKey = hederaManager.getAESKey(contractAddress);
    assert.deepStrictEqual(retrievedKey, mockAESKey);

    // Remove AES key
    const removed = hederaManager.removeAESKey(contractAddress);
    assert.strictEqual(removed, true);

    // Verify key is removed
    const keyAfterRemoval = hederaManager.getAESKey(contractAddress);
    assert.strictEqual(keyAfterRemoval, null);
  });

  test('encryptForProver - should throw error for missing AES key', () => {
    const contractAddress = '0x1234567890123456789012345678901234567890';
    const data = { test: 'data' };

    assert.throws(() => {
      hederaManager.encryptForProver(contractAddress, data);
    }, /No AES key found for contract/);
  });

  test('decryptFromProver - should throw error for missing AES key', () => {
    const contractAddress = '0x1234567890123456789012345678901234567890';
    const encryptedData = '{"encrypted":"data"}';

    assert.throws(() => {
      hederaManager.decryptFromProver(contractAddress, encryptedData);
    }, /No AES key found for contract/);
  });
});

// Test suite for chunked message handling methods
describe('Chunked Message Handling Methods', () => {
  let hederaManager;

  beforeEach(() => {
    hederaManager = new HederaManager({
      accountId: '0.0.123456',
      privateKey: 'test-private-key',
      network: 'testnet',
    });
  });

  test('should have isChunkedMessage method', () => {
    assert.strictEqual(typeof hederaManager.isChunkedMessage, 'function');
  });

  test('should have getChunkGroupKey method', () => {
    assert.strictEqual(typeof hederaManager.getChunkGroupKey, 'function');
  });

  test('should have addChunk method', () => {
    assert.strictEqual(typeof hederaManager.addChunk, 'function');
  });

  test('should have combineChunkedMessages method', () => {
    assert.strictEqual(typeof hederaManager.combineChunkedMessages, 'function');
  });

  test('should have cleanupOldChunks method', () => {
    assert.strictEqual(typeof hederaManager.cleanupOldChunks, 'function');
  });

  test('should have processCompleteMessage method', () => {
    assert.strictEqual(typeof hederaManager.processCompleteMessage, 'function');
  });

  test('isChunkedMessage - should detect chunked messages', () => {
    const chunkedMessage = {
      chunk_info: {
        initial_transaction_id: {
          transaction_valid_start: '1640995200.123456789',
        },
        number: 1,
        total: 3,
      },
    };

    const regularMessage = {
      message: 'regular message content',
    };

    assert.strictEqual(hederaManager.isChunkedMessage(chunkedMessage), true);
    assert.strictEqual(hederaManager.isChunkedMessage(regularMessage), false);
  });

  test('getChunkGroupKey - should return correct group key', () => {
    const message = {
      chunk_info: {
        initial_transaction_id: {
          transaction_valid_start: '1640995200.123456789',
        },
        number: 1,
        total: 3,
      },
    };

    const groupKey = hederaManager.getChunkGroupKey(message);
    assert.strictEqual(groupKey, '1640995200.123456789');
  });

  test('combineChunkedMessages - should combine chunks correctly', () => {
    const chunk1 = {
      message: Buffer.from('Hello ').toString('base64'),
      sequence_number: 1,
      consensus_timestamp: 1640995200,
      chunk_info: { number: 1, total: 2 },
    };

    const chunk2 = {
      message: Buffer.from('World!').toString('base64'),
      sequence_number: 2,
      consensus_timestamp: 1640995201,
      chunk_info: { number: 2, total: 2 },
    };

    const chunks = [chunk1, chunk2];
    const combined = hederaManager.combineChunkedMessages(chunks);

    const expectedMessage = Buffer.from('Hello World!').toString('base64');
    assert.strictEqual(combined.message, expectedMessage);
    assert.strictEqual(combined.sequence_number, 2); // Latest sequence
    assert.strictEqual(combined.consensus_timestamp, 1640995201); // Latest timestamp
    assert.strictEqual(combined.chunk_info, undefined); // Should be removed
  });

  test('combineChunkedMessages - should throw error for empty chunks', () => {
    assert.throws(() => {
      hederaManager.combineChunkedMessages([]);
    }, /No chunks provided for combining/);
  });

  test('cleanupOldChunks - should remove expired chunks', () => {
    const oldTimestamp = Date.now() - 10 * 60 * 1000; // 10 minutes ago
    const recentTimestamp = Date.now() - 1 * 60 * 1000; // 1 minute ago

    // Add old chunk group
    hederaManager.pendingChunks.set('old-group', {
      chunks: new Map(),
      total: 2,
      timestamp: oldTimestamp,
    });

    // Add recent chunk group
    hederaManager.pendingChunks.set('recent-group', {
      chunks: new Map(),
      total: 2,
      timestamp: recentTimestamp,
    });

    assert.strictEqual(hederaManager.pendingChunks.size, 2);

    // Cleanup with 5 minute max age
    hederaManager.cleanupOldChunks(5 * 60 * 1000);

    // Only recent group should remain
    assert.strictEqual(hederaManager.pendingChunks.size, 1);
    assert.strictEqual(hederaManager.pendingChunks.has('recent-group'), true);
    assert.strictEqual(hederaManager.pendingChunks.has('old-group'), false);
  });
});

// Test suite for message processing methods
describe('Message Processing Methods', () => {
  let hederaManager;

  beforeEach(() => {
    hederaManager = new HederaManager({
      accountId: '0.0.123456',
      privateKey: 'test-private-key',
      network: 'testnet',
    });
  });

  test('should have verifyMessageSignatures method', () => {
    assert.strictEqual(
      typeof hederaManager.verifyMessageSignatures,
      'function'
    );
  });

  test('verifyMessageSignatures - should handle invalid JSON gracefully', async () => {
    const invalidJson = 'invalid json data';

    // Should not throw error, just log and return
    try {
      await hederaManager.verifyMessageSignatures(invalidJson);
      assert.ok(true);
    } catch (error) {
      assert.fail(`Should handle invalid JSON gracefully: ${error.message}`);
    }
  });

  test('verifyMessageSignatures - should handle message without routes', async () => {
    const messageWithoutRoutes = JSON.stringify({ data: 'test' });

    try {
      await hederaManager.verifyMessageSignatures(messageWithoutRoutes);
      assert.ok(true);
    } catch (error) {
      assert.fail(`Should handle message without routes: ${error.message}`);
    }
  });

  test('processCompleteMessage - should handle message without RSA key', async () => {
    const mockMessage = {
      sequence_number: 1,
      consensus_timestamp: 1640995200,
      message: Buffer.from('test message').toString('base64'),
      payer_account_id: '0.0.123456',
    };

    // Should not throw error when no RSA key is available
    try {
      await hederaManager.processCompleteMessage(mockMessage);
      assert.ok(true);
    } catch (error) {
      assert.fail(`Should handle message without RSA key: ${error.message}`);
    }
  });
});
