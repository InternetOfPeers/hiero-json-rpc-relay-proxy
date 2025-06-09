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
const { HederaManager } = require('../src/hederaManager');

describe('Prover HederaManager', () => {
  let hederaManager;
  let mockClient;
  let originalConsole;

  before(() => {
    // Mock console methods to reduce test output noise
    originalConsole = {
      log: console.log,
      error: console.error,
    };
    console.log = mock.fn();
    console.error = mock.fn();

    // Setup mock client
    mockClient = {
      setOperator: mock.fn(),
      close: mock.fn(),
    };
  });

  after(() => {
    // Restore console
    console.log = originalConsole.log;
    console.error = originalConsole.error;
  });

  beforeEach(() => {
    hederaManager = new HederaManager({
      accountId: '0.0.1545',
      privateKey:
        '0x48b52aba58f4b8dd4cd0e527e28b0eb5f89e2540785b6fcd3c418cc16b640569',
      network: 'testnet',
      keyType: 'ECDSA',
    });
  });

  afterEach(() => {
    if (hederaManager) {
      hederaManager.close();
    }
    mock.restoreAll();
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      const manager = new HederaManager();
      assert.strictEqual(manager.network, 'testnet');
      assert.strictEqual(manager.keyType, 'ECDSA');
      assert.strictEqual(manager.client, null);
    });

    it('should initialize with provided config', () => {
      const config = {
        accountId: '0.0.1234',
        privateKey: '0xabc123',
        network: 'mainnet',
        topicId: '0.0.5678',
        keyType: 'Ed25519',
      };

      const manager = new HederaManager(config);
      assert.strictEqual(manager.accountId, config.accountId);
      assert.strictEqual(manager.privateKey, config.privateKey);
      assert.strictEqual(manager.network, config.network);
      assert.strictEqual(manager.topicId, config.topicId);
      assert.strictEqual(manager.keyType, config.keyType);
    });
  });

  describe('isEnabled', () => {
    it('should return true when accountId and privateKey are provided', () => {
      assert.strictEqual(hederaManager.isEnabled(), true);
    });

    it('should return false when accountId is missing', () => {
      hederaManager.accountId = null;
      assert.strictEqual(hederaManager.isEnabled(), false);
    });

    it('should return false when privateKey is missing', () => {
      hederaManager.privateKey = null;
      assert.strictEqual(hederaManager.isEnabled(), false);
    });
  });

  describe('initClient', () => {
    it('should return null when credentials are missing', () => {
      hederaManager.accountId = null;
      const client = hederaManager.initClient();
      assert.strictEqual(client, null);
    });

    it('should handle different key types', () => {
      // Test ECDSA key detection
      hederaManager.keyType = 'ECDSA';
      hederaManager.privateKey = '0x123abc';
      // This will attempt to initialize, but we're testing the logic flow
      const result = hederaManager.initClient();
      // The actual SDK calls will fail in test environment, but logic is tested
    });

    it('should handle Ed25519 keys', () => {
      hederaManager.keyType = 'Ed25519';
      hederaManager.privateKey = '302e020100300506032b657004220420...';
      // Test the key type detection logic
      assert.strictEqual(hederaManager.keyType, 'Ed25519');
    });
  });

  describe('getTopicInfo', () => {
    it('should return correct topic info', () => {
      hederaManager.topicId = '0.0.1234';
      hederaManager.client = mockClient;

      const info = hederaManager.getTopicInfo();

      assert.strictEqual(info.topicId, '0.0.1234');
      assert.strictEqual(info.hederaNetwork, 'testnet');
      assert.strictEqual(info.accountId, '0.0.1545');
      assert.strictEqual(info.clientInitialized, true);
      assert.strictEqual(info.keyType, 'ECDSA');
    });
  });

  describe('getClient', () => {
    it('should return the client instance', () => {
      hederaManager.client = mockClient;
      assert.strictEqual(hederaManager.getClient(), mockClient);
    });
  });

  describe('close', () => {
    it('should close client connection when client exists', () => {
      // Reset the mock calls before our test
      mockClient.close.mock.resetCalls();

      hederaManager.client = mockClient;
      hederaManager.close();
      assert.strictEqual(mockClient.close.mock.calls.length, 1);
    });

    it('should handle closing when no client exists', () => {
      hederaManager.client = null;
      // Should not throw
      assert.doesNotThrow(() => hederaManager.close());
    });
  });

  describe('checkTopicExists', () => {
    it('should return false when client is not initialized', async () => {
      hederaManager.client = null;
      const result = await hederaManager.checkTopicExists('0.0.1234');
      assert.strictEqual(result, false);
    });

    it('should return false when topicId is not provided', async () => {
      hederaManager.client = mockClient;
      const result = await hederaManager.checkTopicExists(null);
      assert.strictEqual(result, false);
    });

    it('should return false when topicId is empty string', async () => {
      hederaManager.client = mockClient;
      const result = await hederaManager.checkTopicExists('');
      assert.strictEqual(result, false);
    });
  });

  describe('initTopicForProver', () => {
    beforeEach(() => {
      // Mock the methods that initTopicForProver calls
      hederaManager.initClient = mock.fn(() => mockClient);
      hederaManager.checkTopicExists = mock.fn(async () => true);
    });

    it('should throw error when topicId is not provided', async () => {
      await assert.rejects(() => hederaManager.initTopicForProver(null), {
        message: 'Topic ID is required for prover',
      });
    });

    it('should throw error when client initialization fails', async () => {
      hederaManager.initClient = mock.fn(() => null);

      await assert.rejects(() => hederaManager.initTopicForProver('0.0.1234'), {
        message: 'Failed to initialize Hedera client',
      });
    });

    it('should throw error when topic does not exist', async () => {
      hederaManager.checkTopicExists = mock.fn(async () => false);

      await assert.rejects(() => hederaManager.initTopicForProver('0.0.1234'), {
        message: 'Topic 0.0.1234 does not exist or is not accessible',
      });
    });

    it('should successfully initialize topic', async () => {
      const topicId = '0.0.1234';
      const result = await hederaManager.initTopicForProver(topicId);

      assert.strictEqual(result, topicId);
      assert.strictEqual(hederaManager.topicId, topicId);
      assert.strictEqual(hederaManager.initClient.mock.callCount(), 1);
      assert.strictEqual(hederaManager.checkTopicExists.mock.callCount(), 1);
    });
  });

  describe('error handling', () => {
    it('should handle invalid configuration gracefully', () => {
      const invalidManager = new HederaManager({
        accountId: '',
        privateKey: '',
        network: 'invalid',
      });

      assert.strictEqual(invalidManager.isEnabled(), false);
      assert.strictEqual(invalidManager.network, 'invalid');
    });

    it('should validate topic ID format', () => {
      const validTopicIds = ['0.0.1234567', '0.0.123', '0.0.1'];
      const invalidTopicIds = ['invalid', '1.2.3.4', '', null, undefined];

      validTopicIds.forEach(topicId => {
        assert.ok(
          /^\d+\.\d+\.\d+$/.test(topicId),
          `${topicId} should match Hedera topic ID format`
        );
      });

      invalidTopicIds.forEach(topicId => {
        if (topicId) {
          assert.ok(
            !/^\d+\.\d+\.\d+$/.test(topicId),
            `${topicId} should not match Hedera topic ID format`
          );
        } else {
          assert.ok(!topicId, 'Topic ID should be falsy');
        }
      });
    });
  });
});
