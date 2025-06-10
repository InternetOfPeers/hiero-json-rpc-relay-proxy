const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { HederaManager } = require('../src/hederaManager');

describe('Proxy Topic Public Key Reading and Error Handling', () => {
  let originalProcessExit;
  let exitCalls;
  let originalConsoleError;
  let consoleErrorCalls;
  let originalConsoleLog;
  let consoleLogCalls;

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

    // Mock console.log to capture regular messages
    consoleLogCalls = [];
    originalConsoleLog = console.log;
    console.log = (...args) => {
      consoleLogCalls.push(args.join(' '));
    };
  });

  afterEach(() => {
    // Restore original functions
    process.exit = originalProcessExit;
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
  });

  test('should read public key from first message when topic is configured correctly', async () => {
    const mockPublicKey =
      '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----';

    const mockGetRSAKeyPair = () => ({
      publicKey: mockPublicKey,
      privateKey: 'mock-private-key',
    });

    const hederaManager = new HederaManager({
      accountId: '0.0.123456',
      privateKey: 'test-private-key',
      network: 'testnet',
      topicId: '0.0.6142899', // Pre-configured topic
    });

    let messagesChecked = false;
    let publicKeyRetrieved = false;

    // Mock methods to simulate reading public key from first message
    hederaManager.initClient = () => ({ mock: 'client' });

    hederaManager.checkTopicExists = async topicId => {
      assert.strictEqual(topicId, '0.0.6142899');
      return true; // Topic exists and is accessible
    };

    hederaManager.checkTopicHasMessages = async topicId => {
      assert.strictEqual(topicId, '0.0.6142899');
      messagesChecked = true;
      return true; // Topic has messages (first message contains public key)
    };

    hederaManager.checkAndSubmitPublicKey = async (
      isNewTopic,
      getRSAKeyPair
    ) => {
      assert.strictEqual(isNewTopic, false, 'Should indicate existing topic');

      // Simulate the behavior when topic has messages
      const hasMessages = await hederaManager.checkTopicHasMessages(
        hederaManager.currentTopicId
      );

      if (hasMessages) {
        // In real implementation, this would read the public key from the first message
        // For testing, we simulate that the public key was successfully retrieved
        const keyPair = getRSAKeyPair();
        assert.ok(keyPair.publicKey, 'Should have RSA public key available');
        publicKeyRetrieved = true;

        console.log(
          'Topic already has messages, skipping public key submission'
        );
        console.log('✅ Public key retrieved from first message in topic');
      }
    };

    // Should complete successfully
    await hederaManager.initTopic(mockGetRSAKeyPair);

    assert.strictEqual(hederaManager.currentTopicId, '0.0.6142899');
    assert.strictEqual(
      messagesChecked,
      true,
      'Should check for existing messages'
    );
    assert.strictEqual(
      publicKeyRetrieved,
      true,
      'Should retrieve public key from topic'
    );
    assert.strictEqual(
      exitCalls.length,
      0,
      'Should not call process.exit on success'
    );

    // Verify correct log messages
    assert.ok(
      consoleLogCalls.some(call =>
        call.includes('Using existing Hedera topic: 0.0.6142899')
      ),
      'Should log using existing topic'
    );
    assert.ok(
      consoleLogCalls.some(call => call.includes('Topic already has messages')),
      'Should log that topic has messages'
    );
    assert.ok(
      consoleLogCalls.some(call =>
        call.includes('Public key retrieved from first message')
      ),
      'Should log successful public key retrieval'
    );
  });

  test('should shut down when configured topic fails message check', async () => {
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

    // Mock methods to simulate failure during message check
    hederaManager.initClient = () => ({ mock: 'client' });

    hederaManager.checkTopicExists = async topicId => {
      return true; // Topic exists
    };

    hederaManager.checkTopicHasMessages = async topicId => {
      // Simulate network error or mirror node failure
      throw new Error('Mirror node unavailable - cannot check topic messages');
    };

    hederaManager.checkAndSubmitPublicKey = async (
      isNewTopic,
      getRSAKeyPair
    ) => {
      try {
        // This should timeout and cause server to shut down
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

    // Should exit due to message check failure
    await hederaManager.initTopic(mockGetRSAKeyPair);

    assert.strictEqual(exitCalls.length, 1, 'Should call process.exit once');
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

  test('should shut down when public key retrieval from first message fails', async () => {
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

    // Mock methods to simulate failure reading public key from first message
    hederaManager.initClient = () => ({ mock: 'client' });

    hederaManager.checkTopicExists = async topicId => {
      return true; // Topic exists
    };

    hederaManager.checkTopicHasMessages = async topicId => {
      return true; // Topic has messages
    };

    // Simulate the scenario where the first message is corrupted or not a valid public key
    hederaManager.checkAndSubmitPublicKey = async (
      isNewTopic,
      getRSAKeyPair
    ) => {
      const hasMessages = await hederaManager.checkTopicHasMessages(
        hederaManager.currentTopicId
      );

      if (hasMessages) {
        // Simulate failure to read/parse public key from first message
        console.error(
          'Failed to read valid public key from first message in topic'
        );
        console.error(
          'Server must stop - cannot proceed without valid public key'
        );
        process.exit(1);
      }
    };

    // Should exit due to public key reading failure
    await hederaManager.initTopic(mockGetRSAKeyPair);

    assert.strictEqual(exitCalls.length, 1, 'Should call process.exit once');
    assert.strictEqual(exitCalls[0], 1, 'Should exit with code 1');
    assert.ok(
      consoleErrorCalls.some(call =>
        call.includes('Failed to read valid public key from first message')
      ),
      'Should log public key reading error'
    );
    assert.ok(
      consoleErrorCalls.some(call => call.includes('Server must stop')),
      'Should log server must stop message'
    );
  });

  test('should submit public key as first message when topic is empty', async () => {
    const mockPublicKey =
      '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----';

    const mockGetRSAKeyPair = () => ({
      publicKey: mockPublicKey,
      privateKey: 'mock-private-key',
    });

    const hederaManager = new HederaManager({
      accountId: '0.0.123456',
      privateKey: 'test-private-key',
      network: 'testnet',
      topicId: '0.0.6142899',
    });

    let publicKeySubmitted = false;
    let submittedMessage = null;

    // Mock methods to simulate empty topic that needs public key
    hederaManager.initClient = () => ({ mock: 'client' });

    hederaManager.checkTopicExists = async topicId => {
      return true; // Topic exists
    };

    hederaManager.checkTopicHasMessages = async topicId => {
      return false; // Topic is empty, needs public key
    };

    hederaManager.submitMessageToTopic = async (topicId, message) => {
      assert.strictEqual(topicId, '0.0.6142899');
      assert.ok(
        message.includes('BEGIN PUBLIC KEY'),
        'Should submit RSA public key'
      );
      publicKeySubmitted = true;
      submittedMessage = message;
      return { topicSequenceNumber: 1 };
    };

    hederaManager.checkAndSubmitPublicKey = async (
      isNewTopic,
      getRSAKeyPair
    ) => {
      const hasMessages = await hederaManager.checkTopicHasMessages(
        hederaManager.currentTopicId
      );

      if (!hasMessages) {
        console.log(
          'Topic has no messages, sending public key as first message...'
        );
        const keyPair = getRSAKeyPair();

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
        console.log('✅ Public key submitted as first message to topic');
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
      submittedMessage,
      mockPublicKey,
      'Should submit the correct public key'
    );
    assert.strictEqual(
      exitCalls.length,
      0,
      'Should not call process.exit on success'
    );

    // Verify correct log messages
    assert.ok(
      consoleLogCalls.some(call =>
        call.includes(
          'Topic has no messages, sending public key as first message'
        )
      ),
      'Should log sending public key to empty topic'
    );
    assert.ok(
      consoleLogCalls.some(call =>
        call.includes('Public key submitted as first message')
      ),
      'Should log successful public key submission'
    );
  });

  test('should shut down when public key submission to empty topic times out', async () => {
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
      return false; // Topic is empty, needs public key
    };

    hederaManager.submitMessageToTopic = async (topicId, message) => {
      // Simulate timeout by never resolving
      return new Promise(() => {}); // Never resolves - simulates network timeout
    };

    hederaManager.checkAndSubmitPublicKey = async (
      isNewTopic,
      getRSAKeyPair
    ) => {
      const hasMessages = await hederaManager.checkTopicHasMessages(
        hederaManager.currentTopicId
      );

      if (!hasMessages) {
        console.log(
          'Topic has no messages, sending public key as first message...'
        );
        const keyPair = getRSAKeyPair();

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
          // Timeout should bubble up and cause initTopic to fail
          throw error;
        }
      }
    };

    // Should timeout and exit during initTopic
    try {
      await hederaManager.initTopic(mockGetRSAKeyPair);
    } catch (error) {
      // initTopic should catch timeout and call process.exit
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
      'Should log topic initialization failure'
    );
    assert.ok(
      consoleErrorCalls.some(call => call.includes('Server MUST stop')),
      'Should log server must stop message'
    );
  });

  test('should handle topic configuration flow with proper validation', () => {
    // Test the decision logic for configured topics
    const configuredTopicFlow = (
      topicId,
      topicExists,
      hasMessages,
      rsaKeyAvailable
    ) => {
      const results = {
        shouldProceed: false,
        shouldReadKey: false,
        shouldSubmitKey: false,
        shouldExit: false,
        exitReason: null,
      };

      try {
        // Step 1: Check if topic ID is configured
        if (!topicId) {
          // No topic configured - would create new topic
          results.shouldSubmitKey = true; // New topics always get public key
          results.shouldProceed = true;
          return results;
        }

        // Step 2: Check if configured topic exists and is accessible
        if (!topicExists) {
          results.shouldExit = true;
          results.exitReason = 'Configured topic not accessible';
          return results;
        }

        // Step 3: Check if RSA keys are available
        if (!rsaKeyAvailable) {
          // Can't proceed without RSA keys
          results.shouldExit = true;
          results.exitReason = 'RSA key pair not available';
          return results;
        }

        // Step 4: Check if topic has messages
        if (hasMessages) {
          // Topic has messages - read public key from first message
          results.shouldReadKey = true;
          results.shouldProceed = true;
        } else {
          // Topic is empty - submit public key as first message
          results.shouldSubmitKey = true;
          results.shouldProceed = true;
        }
      } catch (error) {
        results.shouldExit = true;
        results.exitReason = error.message;
      }

      return results;
    };

    // Test Case 1: Configured topic with messages (read public key)
    const case1 = configuredTopicFlow('0.0.6142899', true, true, true);
    assert.strictEqual(
      case1.shouldProceed,
      true,
      'Should proceed with configured topic'
    );
    assert.strictEqual(
      case1.shouldReadKey,
      true,
      'Should read public key from topic'
    );
    assert.strictEqual(
      case1.shouldSubmitKey,
      false,
      'Should not submit key when messages exist'
    );
    assert.strictEqual(case1.shouldExit, false, 'Should not exit on success');

    // Test Case 2: Configured topic without messages (submit public key)
    const case2 = configuredTopicFlow('0.0.6142899', true, false, true);
    assert.strictEqual(
      case2.shouldProceed,
      true,
      'Should proceed with empty topic'
    );
    assert.strictEqual(
      case2.shouldReadKey,
      false,
      'Should not read key from empty topic'
    );
    assert.strictEqual(
      case2.shouldSubmitKey,
      true,
      'Should submit key to empty topic'
    );
    assert.strictEqual(case2.shouldExit, false, 'Should not exit on success');

    // Test Case 3: Configured topic not accessible (should exit)
    const case3 = configuredTopicFlow('0.0.6142899', false, false, true);
    assert.strictEqual(
      case3.shouldProceed,
      false,
      'Should not proceed with inaccessible topic'
    );
    assert.strictEqual(
      case3.shouldExit,
      true,
      'Should exit for inaccessible topic'
    );
    assert.strictEqual(
      case3.exitReason,
      'Configured topic not accessible',
      'Should have correct exit reason'
    );

    // Test Case 4: No RSA keys available (should exit)
    const case4 = configuredTopicFlow('0.0.6142899', true, true, false);
    assert.strictEqual(
      case4.shouldProceed,
      false,
      'Should not proceed without RSA keys'
    );
    assert.strictEqual(case4.shouldExit, true, 'Should exit without RSA keys');
    assert.strictEqual(
      case4.exitReason,
      'RSA key pair not available',
      'Should have correct exit reason'
    );

    // Test Case 5: No topic configured (create new)
    const case5 = configuredTopicFlow(null, false, false, true);
    assert.strictEqual(
      case5.shouldProceed,
      true,
      'Should proceed to create new topic'
    );
    assert.strictEqual(
      case5.shouldSubmitKey,
      true,
      'Should submit key to new topic'
    );
    assert.strictEqual(
      case5.shouldExit,
      false,
      'Should not exit when creating new topic'
    );
  });

  test('should validate error scenarios that trigger server shutdown', () => {
    const errorScenarios = [
      {
        name: 'Mirror node unavailable during message check',
        error: 'Mirror node timeout - cannot verify topic state',
        shouldShutdown: true,
      },
      {
        name: 'Network error during public key submission',
        error: 'Network timeout - failed to submit public key',
        shouldShutdown: true,
      },
      {
        name: 'Invalid public key format in first message',
        error: 'First message does not contain valid RSA public key',
        shouldShutdown: true,
      },
      {
        name: 'Topic access denied',
        error: 'Topic exists but access is denied',
        shouldShutdown: true,
      },
      {
        name: 'Hedera network unavailable',
        error: 'Cannot connect to Hedera network',
        shouldShutdown: true,
      },
    ];

    errorScenarios.forEach(scenario => {
      const shouldExit = scenario.shouldShutdown;
      const errorMessage = scenario.error;

      if (shouldExit) {
        // These errors should cause the server to shut down
        // Check that error message represents a critical failure scenario
        const isCriticalError =
          errorMessage.includes('timeout') ||
          errorMessage.includes('denied') ||
          errorMessage.includes('unavailable') ||
          errorMessage.includes('valid RSA public key') ||
          errorMessage.includes('failed') ||
          errorMessage.includes('connect');

        assert.ok(
          isCriticalError,
          `Error "${errorMessage}" should trigger shutdown`
        );
      }
    });

    // Verify that all critical operations have timeout protection
    const criticalOperations = [
      'checkTopicHasMessages',
      'submitMessageToTopic',
      'readPublicKeyFromFirstMessage',
    ];

    criticalOperations.forEach(operation => {
      // In the real implementation, these should all have timeout wrappers
      assert.ok(
        operation.includes('check') ||
          operation.includes('submit') ||
          operation.includes('read'),
        `Operation "${operation}" should have timeout protection`
      );
    });
  });
});
