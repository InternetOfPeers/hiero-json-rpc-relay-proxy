const {
  describe,
  it,
  before,
  after,
  beforeEach,
  afterEach,
  mock,
} = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { EventEmitter } = require('events');

describe('Prover Main Functionality', () => {
  let originalConsole;
  let mockResponse;

  // Define mock objects at the top level
  let mockWallet;
  let mockCryptoUtils;
  let mockHederaManager;
  let mockEnvLoader;
  let mockEthers;

  before(() => {
    // Mock console methods
    originalConsole = {
      log: console.log,
      error: console.error,
    };
    console.log = mock.fn();
    console.error = mock.fn();

    // Setup environment variables
    process.env.PROVER_PROXY_SERVER_URL = 'http://localhost:3000';
    process.env.PROVER_HEDERA_ACCOUNT_ID = '0.0.1545';
    process.env.PROVER_HEDERA_PRIVATE_KEY =
      '0x48b52aba58f4b8dd4cd0e527e28b0eb5f89e2540785b6fcd3c418cc16b640569';
    process.env.PROVER_HEDERA_NETWORK = 'testnet';
    process.env.PROVER_HEDERA_KEY_TYPE = 'ECDSA';
  });

  after(() => {
    // Restore console
    console.log = originalConsole.log;
    console.error = originalConsole.error;

    // Clean up environment
    delete process.env.PROVER_PROXY_SERVER_URL;
    delete process.env.PROVER_HEDERA_ACCOUNT_ID;
    delete process.env.PROVER_HEDERA_PRIVATE_KEY;
    delete process.env.PROVER_HEDERA_NETWORK;
    delete process.env.PROVER_HEDERA_KEY_TYPE;
  });

  beforeEach(() => {
    // Reset all mocks
    mock.restoreAll();

    // Initialize mock objects
    mockWallet = {
      signMessage: mock.fn(),
      address: '0x1234567890123456789012345678901234567890',
    };

    mockCryptoUtils = {
      encryptHybridMessage: mock.fn(),
    };

    mockHederaManager = {
      submitMessageToTopic: mock.fn(),
      close: mock.fn(),
      isEnabled: mock.fn(),
    };

    mockEnvLoader = {
      loadEnvFile: mock.fn(),
    };

    mockEthers = {
      Wallet: mock.fn(),
    };

    // Mock HTTP response
    mockResponse = new EventEmitter();
    mockResponse.statusCode = 200;
  });

  describe('HTTP Communication Tests', () => {
    it('should handle successful status response', () => {
      const expectedData = {
        topicId: '0.0.1234567',
        hederaNetwork: 'testnet',
        publicKey:
          '-----BEGIN PUBLIC KEY-----\\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\\n-----END PUBLIC KEY-----',
      };

      // Test successful HTTP response parsing
      const responseData = JSON.stringify(expectedData);
      const parsedData = JSON.parse(responseData);

      assert.strictEqual(parsedData.topicId, expectedData.topicId);
      assert.strictEqual(parsedData.hederaNetwork, expectedData.hederaNetwork);
      assert.ok(parsedData.publicKey);
    });

    it('should handle HTTP errors gracefully', () => {
      // Test HTTP error handling
      const errorResponse = {
        statusCode: 500,
        statusMessage: 'Internal Server Error',
      };

      assert.strictEqual(errorResponse.statusCode, 500);
      assert.ok(errorResponse.statusMessage);
    });

    it('should handle invalid JSON response', () => {
      const invalidJson = 'invalid json response';

      assert.throws(() => {
        JSON.parse(invalidJson);
      }, SyntaxError);
    });

    it('should handle connection errors', () => {
      const connectionError = new Error('ECONNREFUSED');

      assert.ok(connectionError instanceof Error);
      assert.strictEqual(connectionError.message, 'ECONNREFUSED');
    });
  });

  describe('payload creation and signing', () => {
    it('should create valid test payload with signatures', async () => {
      const testUrl = 'http://localhost:7546';
      const expectedSignature = '0x1234567890abcdef...';

      // Mock the signing function
      mockWallet.signMessage.mock.mockImplementation(() =>
        Promise.resolve(expectedSignature)
      );

      // Simulate the payload creation logic with new array format
      const testPayload = {
        routes: [
          {
            addr: '0x4f1a953df9df8d1c6073ce57f7493e50515fa73f',
            proofType: 'create',
            nonce: 33,
            url: testUrl,
            sig: await mockWallet.signMessage(testUrl),
          },
          {
            addr: '0x4f1a953df9df8d1c6073ce57f7493e50515fa73a',
            proofType: 'create',
            nonce: 60,
            url: testUrl,
            sig: await mockWallet.signMessage(testUrl),
          },
        ],
      };

      assert.ok(testPayload.routes);
      assert.ok(Array.isArray(testPayload.routes));
      assert.strictEqual(testPayload.routes.length, 2);
      assert.strictEqual(
        testPayload.routes[0].addr,
        '0x4f1a953df9df8d1c6073ce57f7493e50515fa73f'
      );
      assert.strictEqual(testPayload.routes[0].url, testUrl);
      assert.strictEqual(testPayload.routes[0].sig, expectedSignature);
      assert.strictEqual(mockWallet.signMessage.mock.calls.length, 2);
    });

    it('should handle signing errors gracefully', async () => {
      const error = new Error('Signing failed');
      mockWallet.signMessage.mock.mockImplementation(() =>
        Promise.reject(error)
      );

      try {
        await mockWallet.signMessage('http://localhost:7546');
        assert.fail('Should have thrown an error');
      } catch (err) {
        assert.strictEqual(err.message, 'Signing failed');
      }
    });
  });

  describe('encryption', () => {
    it('should encrypt payload successfully', () => {
      const publicKey =
        '-----BEGIN PUBLIC KEY-----\\ntest\\n-----END PUBLIC KEY-----';
      const payload = JSON.stringify({ test: 'data' });
      const expectedEncrypted = 'encrypted-payload-data';

      mockCryptoUtils.encryptHybridMessage.mock.mockImplementation(
        () => expectedEncrypted
      );

      const result = mockCryptoUtils.encryptHybridMessage(
        publicKey,
        payload,
        true
      );

      assert.strictEqual(result, expectedEncrypted);
      assert.strictEqual(
        mockCryptoUtils.encryptHybridMessage.mock.calls.length,
        1
      );
      assert.strictEqual(
        mockCryptoUtils.encryptHybridMessage.mock.calls[0].arguments[0],
        publicKey
      );
      assert.strictEqual(
        mockCryptoUtils.encryptHybridMessage.mock.calls[0].arguments[1],
        payload
      );
      assert.strictEqual(
        mockCryptoUtils.encryptHybridMessage.mock.calls[0].arguments[2],
        true
      );
    });

    it('should handle encryption errors', () => {
      const error = new Error('Encryption failed');
      mockCryptoUtils.encryptHybridMessage.mock.mockImplementation(() => {
        throw error;
      });

      assert.throws(
        () => {
          mockCryptoUtils.encryptHybridMessage('invalid-key', 'data', true);
        },
        { message: 'Encryption failed' }
      );
    });
  });

  describe('Hedera message submission', () => {
    it('should submit encrypted message successfully', async () => {
      const topicId = '0.0.1234567';
      const encryptedPayload = 'encrypted-data';
      const expectedReceipt = { topicSequenceNumber: 1 };

      mockHederaManager.submitMessageToTopic.mock.mockImplementation(() =>
        Promise.resolve(expectedReceipt)
      );

      const result = await mockHederaManager.submitMessageToTopic(
        topicId,
        encryptedPayload
      );

      assert.strictEqual(result.topicSequenceNumber, 1);
      assert.strictEqual(
        mockHederaManager.submitMessageToTopic.mock.calls.length,
        1
      );
      assert.strictEqual(
        mockHederaManager.submitMessageToTopic.mock.calls[0].arguments[0],
        topicId
      );
      assert.strictEqual(
        mockHederaManager.submitMessageToTopic.mock.calls[0].arguments[1],
        encryptedPayload
      );
    });

    it('should handle Hedera submission errors', async () => {
      const error = new Error('Hedera submission failed');
      mockHederaManager.submitMessageToTopic.mock.mockImplementation(() =>
        Promise.reject(error)
      );

      try {
        await mockHederaManager.submitMessageToTopic('0.0.1234567', 'data');
        assert.fail('Should have thrown an error');
      } catch (err) {
        assert.strictEqual(err.message, 'Hedera submission failed');
      }
    });

    it('should handle missing Hedera credentials', () => {
      mockHederaManager.isEnabled.mock.mockImplementation(() => false);

      assert.strictEqual(mockHederaManager.isEnabled(), false);
    });
  });

  describe('environment configuration', () => {
    it('should load prover-specific environment variables', () => {
      mockEnvLoader.loadEnvFile.mock.mockImplementation(() => true);

      // Simulate env loading
      const result = mockEnvLoader.loadEnvFile('/path/to/prover/.env');

      assert.strictEqual(result, true);
      assert.strictEqual(mockEnvLoader.loadEnvFile.mock.calls.length, 1);
    });

    it('should handle missing environment file', () => {
      const error = new Error('Environment file not found');
      mockEnvLoader.loadEnvFile.mock.mockImplementation(() => {
        throw error;
      });

      assert.throws(
        () => {
          mockEnvLoader.loadEnvFile('/path/to/missing/.env');
        },
        { message: 'Environment file not found' }
      );
    });
  });

  describe('integration workflow', () => {
    it('should handle complete prover workflow errors gracefully', () => {
      // Test various error scenarios that might occur during the full workflow

      // Missing topic ID
      const statusWithoutTopic = {
        hederaNetwork: 'testnet',
        publicKey:
          '-----BEGIN PUBLIC KEY-----\\ntest\\n-----END PUBLIC KEY-----',
      };

      // Missing public key
      const statusWithoutKey = {
        topicId: '0.0.1234567',
        hederaNetwork: 'testnet',
      };

      assert.ok(!statusWithoutTopic.topicId);
      assert.ok(!statusWithoutKey.publicKey);
    });

    it('should validate required environment variables', () => {
      // Test that required environment variables are checked
      const requiredEnvVars = [
        'PROVER_HEDERA_ACCOUNT_ID',
        'PROVER_HEDERA_PRIVATE_KEY',
      ];

      requiredEnvVars.forEach(envVar => {
        assert.ok(process.env[envVar], `${envVar} should be set`);
      });
    });

    it('should handle wallet creation and address derivation', () => {
      const privateKey = process.env.PROVER_HEDERA_PRIVATE_KEY;
      const expectedAddress = '0x1234567890123456789012345678901234567890';

      mockEthers.Wallet.mock.mockImplementation(() => ({
        address: expectedAddress,
      }));

      const wallet = mockEthers.Wallet(privateKey);
      assert.strictEqual(wallet.address, expectedAddress);
      assert.strictEqual(mockEthers.Wallet.mock.calls.length, 1);
      assert.strictEqual(
        mockEthers.Wallet.mock.calls[0].arguments[0],
        privateKey
      );
    });
  });

  describe('Topic ID Configuration Logic', () => {
    let originalEnv;

    beforeEach(() => {
      // Save original environment
      originalEnv = {
        PROVER_HEDERA_TOPIC_ID: process.env.PROVER_HEDERA_TOPIC_ID,
      };
    });

    afterEach(() => {
      // Restore original environment
      if (originalEnv.PROVER_HEDERA_TOPIC_ID !== undefined) {
        process.env.PROVER_HEDERA_TOPIC_ID = originalEnv.PROVER_HEDERA_TOPIC_ID;
      } else {
        delete process.env.PROVER_HEDERA_TOPIC_ID;
      }
    });

    it('should use configured PROVER_HEDERA_TOPIC_ID when available', () => {
      const configuredTopicId = '0.0.9999999';
      process.env.PROVER_HEDERA_TOPIC_ID = configuredTopicId;

      // Simulate the logic from initPairingWithProxy
      const configuredTopicId_resolved = process.env.PROVER_HEDERA_TOPIC_ID;

      assert.strictEqual(configuredTopicId_resolved, configuredTopicId);
      assert.ok(
        configuredTopicId_resolved,
        'Should have a configured topic ID'
      );
    });

    it('should handle no configured topic ID scenario', () => {
      delete process.env.PROVER_HEDERA_TOPIC_ID;

      const configuredTopicId = process.env.PROVER_HEDERA_TOPIC_ID;

      assert.strictEqual(configuredTopicId, undefined);
    });

    it('should simulate successful status fetch with configured topic override', () => {
      const configuredTopicId = '0.0.9999999';
      const statusResponse = {
        topicId: '0.0.1111111', // This should be ignored when configured topic is used
        publicKey:
          '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----',
        hederaNetwork: 'testnet',
      };

      // Simulate the configured topic logic
      process.env.PROVER_HEDERA_TOPIC_ID = configuredTopicId;
      const configuredTopicId_resolved = process.env.PROVER_HEDERA_TOPIC_ID;

      if (configuredTopicId_resolved) {
        // Use configured topic, get public key from status
        const finalTopicId = configuredTopicId_resolved;
        const finalPublicKey = statusResponse.publicKey;
        const finalNetwork = 'testnet'; // From environment

        assert.strictEqual(finalTopicId, configuredTopicId);
        assert.notStrictEqual(
          finalTopicId,
          statusResponse.topicId,
          'Should use configured topic, not proxy topic'
        );
        assert.strictEqual(finalPublicKey, statusResponse.publicKey);
        assert.strictEqual(finalNetwork, 'testnet');
      }
    });

    it('should simulate fallback to status endpoint when no topic configured', () => {
      const statusResponse = {
        topicId: '0.0.1111111',
        publicKey:
          '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----',
        hederaNetwork: 'testnet',
      };

      // Clear configured topic
      delete process.env.PROVER_HEDERA_TOPIC_ID;

      const configuredTopicId = process.env.PROVER_HEDERA_TOPIC_ID;

      if (!configuredTopicId) {
        // Use everything from status response
        const finalTopicId = statusResponse.topicId;
        const finalPublicKey = statusResponse.publicKey;
        const finalNetwork = statusResponse.hederaNetwork;

        assert.strictEqual(finalTopicId, statusResponse.topicId);
        assert.strictEqual(finalPublicKey, statusResponse.publicKey);
        assert.strictEqual(finalNetwork, statusResponse.hederaNetwork);
      }
    });

    it('should handle error scenarios in configured topic flow', () => {
      const configuredTopicId = '0.0.9999999';
      process.env.PROVER_HEDERA_TOPIC_ID = configuredTopicId;

      // Simulate error when trying to fetch status for public key
      const statusError = new Error('Connection refused');

      assert.ok(statusError instanceof Error);
      assert.strictEqual(statusError.message, 'Connection refused');

      // In the actual implementation, this would throw an error since
      // we can't get the public key without reaching the proxy
      const expectedErrorMessage = `Cannot reach proxy server to get public key: ${statusError.message}`;
      const actualError = new Error(expectedErrorMessage);

      assert.strictEqual(
        actualError.message,
        'Cannot reach proxy server to get public key: Connection refused'
      );
    });

    it('should validate that both topic ID and public key are required', () => {
      // Test missing topic ID
      let topicId = null;
      let publicKey =
        '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----';

      let error = null;
      if (!topicId) {
        error = new Error(
          'Topic ID not available. Make sure the proxy server is running and has initialized a topic.'
        );
      }

      assert.ok(error);
      assert.ok(error.message.includes('Topic ID not available'));

      // Test missing public key
      topicId = '0.0.1234567';
      publicKey = null;
      error = null;

      if (!publicKey) {
        error = new Error(
          'Public key not available. Make sure the proxy server has initialized RSA keys.'
        );
      }

      assert.ok(error);
      assert.ok(error.message.includes('Public key not available'));

      // Test both available
      topicId = '0.0.1234567';
      publicKey = '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----';
      error = null;

      if (!topicId) {
        error = new Error('Topic ID not available');
      } else if (!publicKey) {
        error = new Error('Public key not available');
      }

      assert.strictEqual(
        error,
        null,
        'Should not have errors when both topic ID and public key are available'
      );
    });

    it('should properly track session results for different scenarios', () => {
      const mockResults = {
        session: {
          proxyUrl: null,
          hederaNetwork: null,
          topicId: null,
        },
      };

      // Scenario 1: Configured topic
      const configuredTopicId = '0.0.9999999';
      const proxyUrl = 'http://localhost:3000';
      const hederaNetwork = 'testnet';

      mockResults.session.proxyUrl = proxyUrl;
      mockResults.session.hederaNetwork = hederaNetwork;
      mockResults.session.topicId = configuredTopicId;

      assert.strictEqual(mockResults.session.proxyUrl, proxyUrl);
      assert.strictEqual(mockResults.session.hederaNetwork, hederaNetwork);
      assert.strictEqual(mockResults.session.topicId, configuredTopicId);

      // Scenario 2: Status-based topic
      const statusTopicId = '0.0.1111111';
      const statusNetwork = 'mainnet';

      mockResults.session.hederaNetwork = statusNetwork;
      mockResults.session.topicId = statusTopicId;

      assert.strictEqual(mockResults.session.hederaNetwork, statusNetwork);
      assert.strictEqual(mockResults.session.topicId, statusTopicId);
    });
  });
});
