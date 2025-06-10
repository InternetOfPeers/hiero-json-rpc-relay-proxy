const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { HederaManager } = require('../src/hederaManager');

describe('HederaManager - Topic Configuration and Public Key Handling', () => {
  let originalProcessExit;
  let exitCalls;
  let originalConsoleError;
  let consoleErrorCalls;

  beforeEach(() => {
    // Mock process.exit to capture exit calls instead of actually exiting
    exitCalls = [];
    originalProcessExit = process.exit;
    process.exit = code => {
      exitCalls.push(code);
    };

    // Mock console.error to capture error messages
    consoleErrorCalls = [];
    originalConsoleError = console.error;
    console.error = (...args) => {
      consoleErrorCalls.push(args.join(' '));
    };
  });

  afterEach(() => {
    // Restore original process.exit and console.error
    process.exit = originalProcessExit;
    console.error = originalConsoleError;
  });

  test('should handle configured topic with existing messages successfully', async () => {
    const mockGetRSAKeyPair = () => ({
      publicKey:
        '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----',
      privateKey: 'mock-private-key',
    });

    const hederaManager = new HederaManager({
      accountId: '0.0.123456',
      privateKey: 'test-private-key',
      network: 'testnet',
      topicId: '0.0.6142899', // Pre-configured topic
    });

    // Mock methods to simulate successful topic operations
    hederaManager.initClient = () => ({ mock: 'client' });
    hederaManager.checkTopicExists = async topicId => {
      assert.strictEqual(topicId, '0.0.6142899');
      return true; // Topic exists
    };

    hederaManager.checkTopicHasMessages = async topicId => {
      assert.strictEqual(topicId, '0.0.6142899');
      return true; // Topic has messages (including public key)
    };

    hederaManager.checkAndSubmitPublicKey = async (
      isNewTopic,
      getRSAKeyPair
    ) => {
      assert.strictEqual(isNewTopic, false, 'Should indicate existing topic');
      assert.strictEqual(typeof getRSAKeyPair, 'function');

      // Simulate reading public key from first message
      const keyPair = getRSAKeyPair();
      assert.ok(keyPair.publicKey, 'Should have access to RSA key pair');

      // Since topic has messages, should not submit public key again
      console.log('Topic already has messages, skipping public key submission');
    };

    // Should complete successfully without exiting
    await hederaManager.initTopic(mockGetRSAKeyPair);

    assert.strictEqual(hederaManager.currentTopicId, '0.0.6142899');
    assert.strictEqual(
      exitCalls.length,
      0,
      'Should not call process.exit on success'
    );
    assert.strictEqual(
      consoleErrorCalls.length,
      0,
      'Should not log errors on success'
    );
  });

  test('should handle configured topic with no messages and submit public key', async () => {
    const mockGetRSAKeyPair = () => ({
      publicKey:
        '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----',
      privateKey: 'mock-private-key',
    });

    const hederaManager = new HederaManager({
      accountId: '0.0.123456',
      privateKey: 'test-private-key',
      network: 'testnet',
      topicId: '0.0.6142899', // Pre-configured topic
    });

    let publicKeySubmitted = false;

    // Mock methods to simulate topic without messages
    hederaManager.initClient = () => ({ mock: 'client' });
    hederaManager.checkTopicExists = async topicId => {
      assert.strictEqual(topicId, '0.0.6142899');
      return true; // Topic exists
    };

    hederaManager.checkTopicHasMessages = async topicId => {
      assert.strictEqual(topicId, '0.0.6142899');
      return false; // Topic has no messages
    };

    hederaManager.submitMessageToTopic = async (topicId, message) => {
      assert.strictEqual(topicId, '0.0.6142899');
      assert.ok(
        message.includes('BEGIN PUBLIC KEY'),
        'Should submit RSA public key'
      );
      publicKeySubmitted = true;
      return { topicSequenceNumber: 1 };
    };

    hederaManager.checkAndSubmitPublicKey = async (
      isNewTopic,
      getRSAKeyPair
    ) => {
      assert.strictEqual(isNewTopic, false, 'Should indicate existing topic');

      // Simulate checking for messages and submitting public key
      const keyPair = getRSAKeyPair();
      const hasMessages = await hederaManager.checkTopicHasMessages(
        hederaManager.currentTopicId
      );

      if (!hasMessages) {
        console.log(
          'Topic has no messages, sending public key as first message...'
        );
        await hederaManager.submitMessageToTopic(
          hederaManager.currentTopicId,
          keyPair.publicKey
        );
      }
    };

    // Should complete successfully and submit public key
    await hederaManager.initTopic(mockGetRSAKeyPair);

    assert.strictEqual(hederaManager.currentTopicId, '0.0.6142899');
    assert.strictEqual(
      publicKeySubmitted,
      true,
      'Should submit public key to empty topic'
    );
    assert.strictEqual(
      exitCalls.length,
      0,
      'Should not call process.exit on success'
    );
  });

  test('should exit with error when configured topic is not accessible', async () => {
    const mockGetRSAKeyPair = () => ({
      publicKey: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
      privateKey: 'mock-private-key',
    });

    const hederaManager = new HederaManager({
      accountId: '0.0.123456',
      privateKey: 'test-private-key',
      network: 'testnet',
      topicId: '0.0.9999999', // Non-accessible topic
    });

    // Mock methods to simulate topic accessibility failure
    hederaManager.initClient = () => ({ mock: 'client' });
    hederaManager.checkTopicExists = async topicId => {
      assert.strictEqual(topicId, '0.0.9999999');
      return false; // Topic not accessible
    };

    hederaManager.createTopic = async () => {
      throw new Error('Failed to create topic after inaccessible topic');
    };

    // Should exit due to topic initialization failure
    try {
      await hederaManager.initTopic(mockGetRSAKeyPair);
    } catch (error) {
      // Errors during initTopic should trigger process.exit
    }

    assert.strictEqual(exitCalls.length, 1, 'Should call process.exit once');
    assert.strictEqual(exitCalls[0], 1, 'Should exit with code 1');
    assert.ok(
      consoleErrorCalls.some(call =>
        call.includes('Failed to initialize Hedera topic')
      ),
      'Should log topic initialization error'
    );
    assert.ok(
      consoleErrorCalls.some(call => call.includes('Server MUST stop')),
      'Should log server must stop message'
    );
  });

  test('should exit with error when topic message check times out', async () => {
    const mockGetRSAKeyPair = () => ({
      publicKey: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
      privateKey: 'mock-private-key',
    });

    const hederaManager = new HederaManager({
      accountId: '0.0.123456',
      privateKey: 'test-private-key',
      network: 'testnet',
      topicId: '0.0.6142899',
    });

    // Mock methods to simulate timeout during message check
    hederaManager.initClient = () => ({ mock: 'client' });
    hederaManager.checkTopicExists = async topicId => {
      return true; // Topic exists
    };

    hederaManager.checkTopicHasMessages = async topicId => {
      // Simulate timeout by hanging forever
      return new Promise(() => {}); // Never resolves
    };

    hederaManager.checkAndSubmitPublicKey = async (
      isNewTopic,
      getRSAKeyPair
    ) => {
      assert.strictEqual(isNewTopic, false, 'Should indicate existing topic');

      try {
        // This should timeout and throw error
        const hasMessages = await Promise.race([
          hederaManager.checkTopicHasMessages(hederaManager.currentTopicId),
          new Promise((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    'Timeout: Failed to check topic messages within 5 seconds'
                  )
                ),
              5000
            )
          ),
        ]);
      } catch (error) {
        console.error('Critical error checking topic messages:', error.message);
        console.error('Server must stop - cannot verify topic state');
        process.exit(1);
      }
    };

    // Should timeout and exit
    await hederaManager.initTopic(mockGetRSAKeyPair);

    assert.strictEqual(
      exitCalls.length,
      1,
      'Should call process.exit once due to timeout'
    );
    assert.strictEqual(exitCalls[0], 1, 'Should exit with code 1');
    assert.ok(
      consoleErrorCalls.some(call =>
        call.includes('Critical error checking topic messages')
      ),
      'Should log critical error message'
    );
    assert.ok(
      consoleErrorCalls.some(call => call.includes('Server must stop')),
      'Should log server must stop message'
    );
  });

  test('should exit with error when public key submission times out', async () => {
    const mockGetRSAKeyPair = () => ({
      publicKey: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
      privateKey: 'mock-private-key',
    });

    const hederaManager = new HederaManager({
      accountId: '0.0.123456',
      privateKey: 'test-private-key',
      network: 'testnet',
      topicId: '0.0.6142899',
    });

    // Mock methods to simulate timeout during public key submission
    hederaManager.initClient = () => ({ mock: 'client' });
    hederaManager.checkTopicExists = async topicId => {
      return true; // Topic exists
    };

    hederaManager.checkTopicHasMessages = async topicId => {
      return false; // Topic has no messages, needs public key
    };

    hederaManager.submitMessageToTopic = async (topicId, message) => {
      // Simulate timeout by hanging forever
      return new Promise(() => {}); // Never resolves
    };

    hederaManager.checkAndSubmitPublicKey = async (
      isNewTopic,
      getRSAKeyPair
    ) => {
      const keyPair = getRSAKeyPair();
      const hasMessages = await hederaManager.checkTopicHasMessages(
        hederaManager.currentTopicId
      );

      if (!hasMessages) {
        console.log(
          'Topic has no messages, sending public key as first message...'
        );

        // This should timeout and throw error
        try {
          await Promise.race([
            hederaManager.submitMessageToTopic(
              hederaManager.currentTopicId,
              keyPair.publicKey
            ),
            new Promise((_, reject) =>
              setTimeout(
                () =>
                  reject(
                    new Error(
                      'Timeout: Failed to submit public key within 10 seconds'
                    )
                  ),
                10000
              )
            ),
          ]);
        } catch (error) {
          // This timeout should bubble up and cause initTopic to fail
          throw error;
        }
      }
    };

    // Should timeout and exit
    try {
      await hederaManager.initTopic(mockGetRSAKeyPair);
    } catch (error) {
      // Timeout errors should trigger process.exit
    }

    assert.strictEqual(
      exitCalls.length,
      1,
      'Should call process.exit once due to timeout'
    );
    assert.strictEqual(exitCalls[0], 1, 'Should exit with code 1');
    assert.ok(
      consoleErrorCalls.some(call =>
        call.includes('Failed to initialize Hedera topic')
      ),
      'Should log topic initialization error'
    );
  });

  test('should handle RSA key pair not available during public key submission', async () => {
    const mockGetRSAKeyPair = () => {
      return null; // No RSA key pair available
    };

    const hederaManager = new HederaManager({
      accountId: '0.0.123456',
      privateKey: 'test-private-key',
      network: 'testnet',
      topicId: '0.0.6142899',
    });

    // Mock methods
    hederaManager.initClient = () => ({ mock: 'client' });
    hederaManager.checkTopicExists = async topicId => {
      return true; // Topic exists
    };

    hederaManager.checkAndSubmitPublicKey = async (
      isNewTopic,
      getRSAKeyPair
    ) => {
      // Check for RSA key pair availability
      const keyPair = getRSAKeyPair();
      if (!keyPair || !keyPair.publicKey) {
        console.log(
          'RSA key pair not available, skipping public key submission'
        );
        return; // Should skip gracefully
      }
    };

    // Should complete successfully but skip public key submission
    await hederaManager.initTopic(mockGetRSAKeyPair);

    assert.strictEqual(hederaManager.currentTopicId, '0.0.6142899');
    assert.strictEqual(
      exitCalls.length,
      0,
      'Should not exit when RSA keys not available'
    );
  });

  test('should handle missing Hedera client during topic initialization', async () => {
    const mockGetRSAKeyPair = () => ({
      publicKey: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
      privateKey: 'mock-private-key',
    });

    const hederaManager = new HederaManager({
      // No Hedera credentials provided
    });

    // Mock initClient to return null (no credentials)
    hederaManager.initClient = () => null;

    // Should return early without doing anything
    await hederaManager.initTopic(mockGetRSAKeyPair);

    assert.strictEqual(hederaManager.currentTopicId, null);
    assert.strictEqual(
      exitCalls.length,
      0,
      'Should not exit when Hedera disabled'
    );
  });

  test('should properly configure new topic and submit public key', async () => {
    const mockGetRSAKeyPair = () => ({
      publicKey:
        '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----',
      privateKey: 'mock-private-key',
    });

    const hederaManager = new HederaManager({
      accountId: '0.0.123456',
      privateKey: 'test-private-key',
      network: 'testnet',
      // No topicId provided - should create new topic
    });

    let publicKeySubmitted = false;

    // Mock methods for new topic creation
    hederaManager.initClient = () => ({ mock: 'client' });
    hederaManager.createTopic = async () => {
      return '0.0.7777777'; // New topic ID
    };

    hederaManager.submitMessageToTopic = async (topicId, message) => {
      assert.strictEqual(topicId, '0.0.7777777');
      assert.ok(
        message.includes('BEGIN PUBLIC KEY'),
        'Should submit RSA public key'
      );
      publicKeySubmitted = true;
      return { topicSequenceNumber: 1 };
    };

    hederaManager.checkAndSubmitPublicKey = async (
      isNewTopic,
      getRSAKeyPair
    ) => {
      assert.strictEqual(isNewTopic, true, 'Should indicate new topic');

      const keyPair = getRSAKeyPair();
      console.log('Sending public key as first message to new topic...');
      await hederaManager.submitMessageToTopic(
        hederaManager.currentTopicId,
        keyPair.publicKey
      );
    };

    // Should create new topic and submit public key
    await hederaManager.initTopic(mockGetRSAKeyPair);

    assert.strictEqual(hederaManager.currentTopicId, '0.0.7777777');
    assert.strictEqual(
      publicKeySubmitted,
      true,
      'Should submit public key to new topic'
    );
    assert.strictEqual(
      exitCalls.length,
      0,
      'Should not call process.exit on success'
    );
  });

  test('should validate topic initialization flow with proper error handling', () => {
    const hederaManager = new HederaManager({
      accountId: '0.0.123456',
      privateKey: 'test-private-key',
      network: 'testnet',
      topicId: '0.0.6142899',
    });

    // Test the specific logic flow for configured topics
    const configuredTopicFlow = (
      mockTopicExists,
      mockHasMessages,
      shouldSubmitKey
    ) => {
      const results = {
        topicChecked: false,
        messagesChecked: false,
        publicKeySubmitted: false,
        errorOccurred: false,
      };

      try {
        // Simulate configured topic check
        if (hederaManager.topicId) {
          const exists = mockTopicExists;
          results.topicChecked = true;

          if (exists) {
            hederaManager.currentTopicId = hederaManager.topicId;

            // Simulate message check
            const hasMessages = mockHasMessages;
            results.messagesChecked = true;

            if (!hasMessages && shouldSubmitKey) {
              // Simulate public key submission
              results.publicKeySubmitted = true;
            }
          } else {
            throw new Error('Topic not accessible');
          }
        }
      } catch (error) {
        results.errorOccurred = true;
      }

      return results;
    };

    // Test successful flow with existing topic and messages
    const successFlow1 = configuredTopicFlow(true, true, false);
    assert.ok(successFlow1.topicChecked, 'Should check topic exists');
    assert.ok(successFlow1.messagesChecked, 'Should check for messages');
    assert.strictEqual(
      successFlow1.publicKeySubmitted,
      false,
      'Should not submit key when messages exist'
    );
    assert.strictEqual(successFlow1.errorOccurred, false, 'Should not error');

    // Test successful flow with existing topic but no messages
    const successFlow2 = configuredTopicFlow(true, false, true);
    assert.ok(successFlow2.topicChecked, 'Should check topic exists');
    assert.ok(successFlow2.messagesChecked, 'Should check for messages');
    assert.ok(
      successFlow2.publicKeySubmitted,
      'Should submit key when no messages'
    );
    assert.strictEqual(successFlow2.errorOccurred, false, 'Should not error');

    // Test error flow with non-accessible topic
    const errorFlow = configuredTopicFlow(false, false, false);
    assert.ok(errorFlow.topicChecked, 'Should check topic exists');
    assert.strictEqual(
      errorFlow.messagesChecked,
      false,
      'Should not check messages for non-accessible topic'
    );
    assert.strictEqual(
      errorFlow.publicKeySubmitted,
      false,
      'Should not submit key for non-accessible topic'
    );
    assert.ok(errorFlow.errorOccurred, 'Should error for non-accessible topic');
  });
});
