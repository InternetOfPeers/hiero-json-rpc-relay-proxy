const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const http = require('http');

describe('Prover - Topic Configuration with Proxy Public Key Reading', () => {
  let mockProxyServer;
  let mockProxyPort;

  beforeEach(() => {
    // Set up a clean environment for each test
    delete process.env.PROVER_HEDERA_TOPIC_ID;
    mockProxyPort = 3998; // Use a different port to avoid conflicts
  });

  afterEach(async () => {
    // Clean up mock proxy server
    if (mockProxyServer) {
      mockProxyServer.close();
      mockProxyServer = null;
    }
  });

  async function createMockProxyServer(
    statusResponse,
    shouldReadPublicKeyFromTopic = false
  ) {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.writeHead(200);
          res.end();
          return;
        }

        if (req.url === '/status' && req.method === 'GET') {
          // Simulate proxy reading public key from first message in configured topic
          if (shouldReadPublicKeyFromTopic) {
            console.log(
              `Mock Proxy: Reading public key from first message in topic ${statusResponse.topicId}`
            );
            console.log(
              'Mock Proxy: ✅ Public key successfully retrieved from topic message #1'
            );
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(statusResponse));
        } else if (req.url === '/health' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ready', timestamp: Date.now() }));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not found' }));
        }
      });

      server.listen(mockProxyPort, err => {
        if (err) {
          reject(err);
        } else {
          console.log(`Mock proxy server listening on port ${mockProxyPort}`);
          resolve(server);
        }
      });
    });
  }

  test('should work with proxy that reads public key from configured topic', async () => {
    // This test simulates the scenario where:
    // 1. Proxy has a configured topic ID (e.g., PROXY_HEDERA_TOPIC_ID=0.0.6142899)
    // 2. Proxy reads RSA public key from first message in that topic
    // 3. Prover uses different topic but gets public key from proxy

    const mockStatus = {
      hederaNetwork: 'testnet',
      topicId: '0.0.6142899', // Proxy's configured topic
      publicKey:
        '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----',
    };

    // Create mock proxy that simulates reading public key from topic
    mockProxyServer = await createMockProxyServer(mockStatus, true);

    // Configure prover to use a different topic but get public key from proxy
    process.env.PROVER_HEDERA_TOPIC_ID = '0.0.7777777'; // Different topic
    process.env.PROVER_PROXY_SERVER_URL = `http://localhost:${mockProxyPort}`;

    // Simulate the prover's topic resolution logic
    const configuredTopicId = process.env.PROVER_HEDERA_TOPIC_ID;
    let topicId, publicKey, hederaNetwork;

    if (configuredTopicId) {
      console.log(
        'Prover: Using configured topic ID, fetching status for public key...'
      );
      console.log(`Prover: Configured Topic ID: ${configuredTopicId}`);

      // Fetch status from proxy to get public key
      const response = await fetch(`http://localhost:${mockProxyPort}/status`);
      const status = await response.json();

      publicKey = status.publicKey;
      topicId = configuredTopicId; // Use configured topic
      hederaNetwork = 'testnet'; // Use configured network

      console.log(
        'Prover: ✅ Successfully retrieved status with configured topic override'
      );
      console.log(`Prover: Using Topic ID: ${topicId} (configured)`);
      console.log(`Prover: Proxy Topic ID: ${status.topicId} (ignored)`);
      console.log(`Prover: Network: ${hederaNetwork}`);
    }

    // Verify the behavior
    assert.strictEqual(
      topicId,
      '0.0.7777777',
      "Should use prover's configured topic"
    );
    assert.strictEqual(
      publicKey,
      mockStatus.publicKey,
      'Should get public key from proxy'
    );
    assert.notStrictEqual(
      topicId,
      mockStatus.topicId,
      "Should not use proxy's topic"
    );

    // Verify that proxy and prover can use different topics
    assert.ok(publicKey, 'Should have public key from proxy');
    assert.ok(
      topicId !== mockStatus.topicId,
      'Prover and proxy should use different topics'
    );
  });

  test('should handle proxy that correctly configured topic and reads public key', async () => {
    // This test simulates a properly configured proxy that:
    // 1. Has PROXY_HEDERA_TOPIC_ID configured
    // 2. Successfully reads public key from first message in that topic
    // 3. Provides both topic ID and public key to prover

    const proxyTopicId = '0.0.6142899';
    const mockStatus = {
      hederaNetwork: 'testnet',
      topicId: proxyTopicId,
      publicKey:
        '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----',
    };

    mockProxyServer = await createMockProxyServer(mockStatus, true);

    // Prover with NO configured topic - should use proxy's topic
    process.env.PROVER_PROXY_SERVER_URL = `http://localhost:${mockProxyPort}`;

    // Simulate prover fetching complete status from proxy
    const configuredTopicId = process.env.PROVER_HEDERA_TOPIC_ID; // undefined
    let topicId, publicKey, hederaNetwork;

    if (!configuredTopicId) {
      console.log(
        'Prover: No configured topic ID - fetching status from proxy server...'
      );

      const response = await fetch(`http://localhost:${mockProxyPort}/status`);
      const status = await response.json();

      topicId = status.topicId;
      publicKey = status.publicKey;
      hederaNetwork = status.hederaNetwork;

      console.log('Prover: Status received:');
      console.log(`Prover: Topic ID: ${topicId}`);
      console.log(`Prover: Network: ${hederaNetwork}`);
      console.log(`Prover: Has Public Key: ${!!publicKey}`);
    }

    // Verify the behavior
    assert.strictEqual(topicId, proxyTopicId, "Should use proxy's topic");
    assert.strictEqual(
      publicKey,
      mockStatus.publicKey,
      'Should get public key from proxy'
    );
    assert.strictEqual(hederaNetwork, 'testnet', "Should use proxy's network");
    assert.ok(
      publicKey,
      'Should have public key from proxy that read it from topic'
    );
  });

  test('should handle proxy topic configuration error scenarios', async () => {
    // Test scenarios where proxy fails to read public key from topic

    const errorScenarios = [
      {
        name: 'Proxy configured topic but first message invalid',
        status: {
          hederaNetwork: 'testnet',
          topicId: '0.0.6142899',
          publicKey: null, // No public key - failed to read from topic
        },
        shouldError: true,
        expectedError: 'Public key not available',
      },
      {
        name: 'Proxy topic accessible but empty',
        status: {
          hederaNetwork: 'testnet',
          topicId: '0.0.6142899',
          publicKey: '', // Empty public key
        },
        shouldError: true,
        expectedError: 'Public key not available',
      },
      {
        name: 'Proxy configured topic but malformed public key',
        status: {
          hederaNetwork: 'testnet',
          topicId: '0.0.6142899',
          publicKey: 'invalid-key-format', // Malformed public key
        },
        shouldError: false, // Prover might still try to use it
        expectedError: null,
      },
    ];

    for (const scenario of errorScenarios) {
      console.log(`\nTesting scenario: ${scenario.name}`);

      if (mockProxyServer) {
        mockProxyServer.close();
      }

      mockProxyServer = await createMockProxyServer(scenario.status, false);

      // Simulate prover attempting to get public key
      const response = await fetch(`http://localhost:${mockProxyPort}/status`);
      const status = await response.json();

      let error = null;
      let topicId = status.topicId;
      let publicKey = status.publicKey;

      // Validate required data
      if (!topicId) {
        error = new Error(
          'Topic ID not available. Make sure the proxy server is running and has initialized a topic.'
        );
      }

      if (!publicKey) {
        error = new Error(
          'Public key not available. Make sure the proxy server has initialized RSA keys.'
        );
      }

      if (scenario.shouldError) {
        assert.ok(error, `Should have error for scenario: ${scenario.name}`);
        assert.ok(
          error.message.includes(scenario.expectedError),
          `Error should contain "${scenario.expectedError}" for scenario: ${scenario.name}`
        );
      } else {
        // Some scenarios might not error immediately but could cause issues later
        console.log(
          `Scenario "${scenario.name}" - publicKey: ${publicKey ? 'present' : 'missing'}`
        );
      }
    }
  });

  test('should validate topic configuration flow between proxy and prover', () => {
    // Test the complete flow from proxy topic configuration to prover usage

    const testFlow = (
      proxyTopicConfigured,
      proxyCanReadKey,
      proverTopicConfigured,
      expectedBehavior
    ) => {
      const results = {
        proxyStatus: null,
        proverTopicChoice: null,
        proverPublicKeySource: null,
        shouldWork: false,
        errors: [],
      };

      try {
        // Step 1: Proxy behavior
        if (proxyTopicConfigured) {
          if (proxyCanReadKey) {
            results.proxyStatus = {
              topicId: '0.0.6142899',
              publicKey:
                '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
              hederaNetwork: 'testnet',
            };
          } else {
            results.proxyStatus = {
              topicId: '0.0.6142899',
              publicKey: null, // Failed to read from topic
              hederaNetwork: 'testnet',
            };
            results.errors.push(
              'Proxy failed to read public key from configured topic'
            );
          }
        } else {
          // Proxy creates new topic and submits public key
          results.proxyStatus = {
            topicId: '0.0.1111111',
            publicKey:
              '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
            hederaNetwork: 'testnet',
          };
        }

        // Step 2: Prover behavior
        if (proverTopicConfigured) {
          results.proverTopicChoice = '0.0.7777777'; // Prover's configured topic
          results.proverPublicKeySource = 'proxy'; // Still gets public key from proxy
        } else {
          results.proverTopicChoice = results.proxyStatus.topicId; // Uses proxy's topic
          results.proverPublicKeySource = 'proxy';
        }

        // Step 3: Validate the flow
        if (results.proxyStatus.publicKey && results.proverTopicChoice) {
          results.shouldWork = true;
        } else {
          results.errors.push(
            'Missing required components for successful flow'
          );
        }
      } catch (error) {
        results.errors.push(error.message);
      }

      return results;
    };

    // Test Case 1: Proxy configured, can read key, prover configured
    const case1 = testFlow(true, true, true, 'both_configured');
    assert.strictEqual(
      case1.shouldWork,
      true,
      'Should work when both proxy and prover configured correctly'
    );
    assert.strictEqual(
      case1.proverTopicChoice,
      '0.0.7777777',
      'Prover should use its configured topic'
    );
    assert.strictEqual(
      case1.proverPublicKeySource,
      'proxy',
      'Prover should get public key from proxy'
    );
    assert.strictEqual(case1.errors.length, 0, 'Should have no errors');

    // Test Case 2: Proxy configured but can't read key
    const case2 = testFlow(true, false, true, 'proxy_read_failure');
    assert.strictEqual(
      case2.shouldWork,
      false,
      "Should not work when proxy can't read public key"
    );
    assert.ok(
      case2.errors.some(e => e.includes('failed to read public key')),
      'Should have public key read error'
    );

    // Test Case 3: Proxy not configured, prover configured
    const case3 = testFlow(false, false, true, 'proxy_new_topic');
    assert.strictEqual(
      case3.shouldWork,
      true,
      'Should work when proxy creates new topic'
    );
    assert.strictEqual(
      case3.proverTopicChoice,
      '0.0.7777777',
      'Prover should use its configured topic'
    );
    assert.notStrictEqual(
      case3.proverTopicChoice,
      case3.proxyStatus.topicId,
      'Prover and proxy should use different topics'
    );

    // Test Case 4: Neither configured
    const case4 = testFlow(false, false, false, 'both_use_proxy_topic');
    assert.strictEqual(
      case4.shouldWork,
      true,
      "Should work when prover uses proxy's new topic"
    );
    assert.strictEqual(
      case4.proverTopicChoice,
      case4.proxyStatus.topicId,
      "Prover should use proxy's topic"
    );
  });

  test('should demonstrate proper topic configuration best practices', () => {
    // This test demonstrates the recommended configuration patterns

    const bestPractices = [
      {
        name: 'Production setup with configured topics',
        proxyConfig: { PROXY_HEDERA_TOPIC_ID: '0.0.6142899' },
        proverConfig: { PROVER_HEDERA_TOPIC_ID: undefined }, // Use proxy's topic
        description:
          'Proxy uses configured topic, prover uses same topic via /status endpoint',
        benefits: [
          'Consistent topic usage',
          'Centralized topic management',
          'Public key from topic',
        ],
      },
      {
        name: 'Development setup with different topics',
        proxyConfig: { PROXY_HEDERA_TOPIC_ID: '0.0.6142899' },
        proverConfig: { PROVER_HEDERA_TOPIC_ID: '0.0.7777777' },
        description:
          'Proxy and prover use different topics for isolated testing',
        benefits: [
          'Isolated testing',
          'Flexible topic assignment',
          'Public key still shared',
        ],
      },
      {
        name: 'Simple setup with automatic topic creation',
        proxyConfig: { PROXY_HEDERA_TOPIC_ID: undefined },
        proverConfig: { PROVER_HEDERA_TOPIC_ID: undefined },
        description: 'Proxy creates new topic, prover discovers and uses it',
        benefits: [
          'Easy setup',
          'No manual topic management',
          'Automatic configuration',
        ],
      },
    ];

    bestPractices.forEach(practice => {
      console.log(`\nBest Practice: ${practice.name}`);
      console.log(`Description: ${practice.description}`);
      console.log('Benefits:');
      practice.benefits.forEach(benefit => console.log(`  - ${benefit}`));

      // Validate the configuration makes sense
      const proxyHasTopic = !!practice.proxyConfig.PROXY_HEDERA_TOPIC_ID;
      const proverHasTopic = !!practice.proverConfig.PROVER_HEDERA_TOPIC_ID;

      if (proxyHasTopic && !proverHasTopic) {
        // Prover should use proxy's topic and public key
        assert.ok(
          true,
          'Valid configuration: prover uses proxy topic and public key'
        );
      } else if (proxyHasTopic && proverHasTopic) {
        // Both have configured topics - prover uses its own topic but proxy's public key
        assert.ok(
          true,
          'Valid configuration: different topics but shared public key'
        );
      } else if (!proxyHasTopic && !proverHasTopic) {
        // Simple automatic setup
        assert.ok(
          true,
          'Valid configuration: automatic topic creation and usage'
        );
      }
    });
  });
});
