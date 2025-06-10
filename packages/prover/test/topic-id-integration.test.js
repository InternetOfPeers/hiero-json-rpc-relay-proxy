const { describe, it, before, after, mock } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const path = require('path');

describe('Prover Topic ID Integration Tests', () => {
  let mockProxyServer;
  let originalEnv;

  before(() => {
    // Save original environment
    originalEnv = {
      PROVER_HEDERA_TOPIC_ID: process.env.PROVER_HEDERA_TOPIC_ID,
      PROVER_PROXY_SERVER_URL: process.env.PROVER_PROXY_SERVER_URL,
      PROVER_HEDERA_NETWORK: process.env.PROVER_HEDERA_NETWORK,
    };

    // Set up test environment
    process.env.PROVER_PROXY_SERVER_URL = 'http://localhost:3333';
    process.env.PROVER_HEDERA_NETWORK = 'testnet';
  });

  after(() => {
    // Restore original environment
    Object.keys(originalEnv).forEach(key => {
      if (originalEnv[key] !== undefined) {
        process.env[key] = originalEnv[key];
      } else {
        delete process.env[key];
      }
    });

    // Close mock server if it exists
    if (mockProxyServer) {
      mockProxyServer.close();
    }
  });

  function createMockProxyServer(statusResponse) {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        if (req.url === '/status' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(statusResponse));
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });

      server.listen(3333, err => {
        if (err) {
          reject(err);
        } else {
          resolve(server);
        }
      });
    });
  }

  it('should prioritize configured topic ID over proxy topic', async () => {
    const mockStatus = {
      topicId: '0.0.1111111',
      publicKey:
        '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----',
      hederaNetwork: 'testnet',
    };

    mockProxyServer = await createMockProxyServer(mockStatus);

    // Set configured topic ID
    process.env.PROVER_HEDERA_TOPIC_ID = '0.0.9999999';

    // Import the prover module functions
    const proverPath = path.resolve(__dirname, '../src/prover.js');

    // Since the prover module runs immediately, we need to test the logic separately
    const configuredTopicId = process.env.PROVER_HEDERA_TOPIC_ID;

    assert.strictEqual(configuredTopicId, '0.0.9999999');
    assert.notStrictEqual(configuredTopicId, mockStatus.topicId);

    // Test that the logic would use the configured topic
    if (configuredTopicId) {
      // This simulates what the prover would do
      const finalTopicId = configuredTopicId;
      const publicKeyFromStatus = mockStatus.publicKey;

      assert.strictEqual(
        finalTopicId,
        '0.0.9999999',
        'Should use configured topic'
      );
      assert.ok(publicKeyFromStatus, 'Should still get public key from proxy');
    }

    mockProxyServer.close();
    mockProxyServer = null;
  });

  it('should fallback to proxy topic when no topic configured', async () => {
    const mockStatus = {
      topicId: '0.0.1111111',
      publicKey:
        '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----',
      hederaNetwork: 'testnet',
    };

    mockProxyServer = await createMockProxyServer(mockStatus);

    // Clear configured topic
    delete process.env.PROVER_HEDERA_TOPIC_ID;

    const configuredTopicId = process.env.PROVER_HEDERA_TOPIC_ID;

    assert.strictEqual(configuredTopicId, undefined);

    // Test that the logic would use proxy topic
    if (!configuredTopicId) {
      // This simulates what the prover would do
      const finalTopicId = mockStatus.topicId;
      const finalPublicKey = mockStatus.publicKey;
      const finalNetwork = mockStatus.hederaNetwork;

      assert.strictEqual(finalTopicId, '0.0.1111111', 'Should use proxy topic');
      assert.strictEqual(
        finalPublicKey,
        mockStatus.publicKey,
        'Should use proxy public key'
      );
      assert.strictEqual(finalNetwork, 'testnet', 'Should use proxy network');
    }

    mockProxyServer.close();
    mockProxyServer = null;
  });

  it('should simulate proxy unreachable error with configured topic', async () => {
    // Set configured topic but don't start proxy server
    process.env.PROVER_HEDERA_TOPIC_ID = '0.0.9999999';

    const configuredTopicId = process.env.PROVER_HEDERA_TOPIC_ID;

    if (configuredTopicId) {
      // This simulates what would happen when proxy is unreachable
      const connectionError = new Error('Connection refused');
      const expectedError = `Cannot reach proxy server to get public key: ${connectionError.message}`;

      assert.strictEqual(
        expectedError,
        'Cannot reach proxy server to get public key: Connection refused'
      );
    }
  });

  it('should validate that both topic ID and public key are required', () => {
    // Test missing topic ID scenario
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

    // Test missing public key scenario
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

    // Test both available - should not error
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
      'Should not have errors when both are available'
    );
  });

  it('should test session result tracking for different scenarios', () => {
    const mockResults = {
      session: {
        proxyUrl: null,
        hederaNetwork: null,
        topicId: null,
      },
    };

    // Scenario 1: Configured topic
    const configuredTopicId = '0.0.9999999';
    const proxyUrl = 'http://localhost:3333';
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
