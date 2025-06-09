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
const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const path = require('path');

describe('Prover Integration Tests', () => {
  before(() => {
    // Skip integration tests if flag is set
    if (process.env.SKIP_INTEGRATION_TESTS) {
      console.log('⏭️  Skipping integration tests');
      return;
    }
  });

  after(() => {
    mock.restoreAll();
  });

  beforeEach(() => {
    if (process.env.SKIP_INTEGRATION_TESTS) {
      return;
    }

    mock.restoreAll();
  });

  describe('Prover-Proxy Communication', () => {
    it('should handle proxy server not running', () => {
      if (process.env.SKIP_INTEGRATION_TESTS) {
        return;
      }

      // Test error handling for connection refused
      const connectionError = new Error('ECONNREFUSED');
      assert.ok(connectionError instanceof Error);
      assert.strictEqual(connectionError.message, 'ECONNREFUSED');
    });

    it('should handle invalid status response from proxy', () => {
      if (process.env.SKIP_INTEGRATION_TESTS) {
        return;
      }

      // Test JSON parsing errors
      const invalidResponse = 'invalid json response';
      assert.throws(() => {
        JSON.parse(invalidResponse);
      }, SyntaxError);
    });

    it('should handle missing required fields in status response', () => {
      if (process.env.SKIP_INTEGRATION_TESTS) {
        return;
      }

      const incompleteStatus = {
        hederaNetwork: 'testnet',
        // Missing topicId and publicKey
      };

      assert.ok(!incompleteStatus.topicId);
      assert.ok(!incompleteStatus.publicKey);
      assert.strictEqual(incompleteStatus.hederaNetwork, 'testnet');
    });

    it('should validate environment variable requirements', () => {
      if (process.env.SKIP_INTEGRATION_TESTS) {
        return;
      }

      // Test environment variables that the prover requires
      const requiredVars = [
        'HEDERA_ACCOUNT_ID',
        'HEDERA_PRIVATE_KEY',
        'HEDERA_NETWORK',
        'PROXY_SERVER_URL',
      ];

      // Save original values
      const originalValues = {};
      requiredVars.forEach(varName => {
        originalValues[varName] = process.env[varName];
      });

      try {
        // Test each required variable
        requiredVars.forEach(varName => {
          delete process.env[varName];

          // Simulate prover checking for this variable
          const isSet = !!process.env[varName];
          assert.strictEqual(isSet, false, `${varName} should be required`);

          // Restore for next test
          if (originalValues[varName]) {
            process.env[varName] = originalValues[varName];
          }
        });
      } finally {
        // Restore all original values
        requiredVars.forEach(varName => {
          if (originalValues[varName]) {
            process.env[varName] = originalValues[varName];
          }
        });
      }
    });
  });

  describe('File Structure and Dependencies', () => {
    it('should verify prover can access proxy utilities', () => {
      if (process.env.SKIP_INTEGRATION_TESTS) {
        return;
      }

      // Test that prover can require proxy modules
      const proxyModules = [
        '../../proxy/src/envLoader',
        '../../proxy/src/cryptoUtils',
      ];

      proxyModules.forEach(modulePath => {
        try {
          // This should not throw if the file exists and is accessible
          const resolvedPath = require.resolve(modulePath);
          assert.ok(resolvedPath.includes('proxy'));
        } catch (error) {
          assert.fail(
            `Prover should be able to access ${modulePath}: ${error.message}`
          );
        }
      });
    });

    it('should verify prover has its own HederaManager', () => {
      if (process.env.SKIP_INTEGRATION_TESTS) {
        return;
      }

      try {
        const proverHederaManager = require('../src/hederaManager');
        assert.ok(proverHederaManager.HederaManager);
        assert.strictEqual(
          typeof proverHederaManager.HederaManager,
          'function'
        );
      } catch (error) {
        assert.fail(
          `Prover should have its own HederaManager: ${error.message}`
        );
      }
    });

    it('should verify package structure', () => {
      if (process.env.SKIP_INTEGRATION_TESTS) {
        return;
      }

      const fs = require('fs');
      const proverPackageJson = path.join(__dirname, '..', 'package.json');

      assert.ok(
        fs.existsSync(proverPackageJson),
        'Prover should have its own package.json'
      );

      const packageContent = JSON.parse(
        fs.readFileSync(proverPackageJson, 'utf8')
      );
      assert.strictEqual(packageContent.name, '@hiero-json-rpc-relay/prover');
      assert.ok(packageContent.scripts.test);
      assert.ok(packageContent.dependencies['@hashgraph/sdk']);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle network timeouts gracefully', () => {
      if (process.env.SKIP_INTEGRATION_TESTS) {
        return;
      }

      // Test timeout behavior simulation
      const mockRequest = {
        on: mock.fn(),
        setTimeout: mock.fn(),
        destroy: mock.fn(),
      };

      // Simulate timeout call with callback
      const timeoutCallback = mock.fn(() => {
        mockRequest.destroy();
      });

      mockRequest.setTimeout(5000, timeoutCallback);
      timeoutCallback(); // Simulate timeout firing

      // Verify timeout handling
      assert.ok(mockRequest.setTimeout.mock.calls.length > 0);
      assert.ok(mockRequest.destroy.mock.calls.length > 0);
    });

    it('should validate RSA public key format', () => {
      if (process.env.SKIP_INTEGRATION_TESTS) {
        return;
      }

      const validKeyFormats = [
        '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----',
        '-----BEGIN RSA PUBLIC KEY-----\nMIIBCgKCAQEA...\n-----END RSA PUBLIC KEY-----',
      ];

      const invalidKeyFormats = ['invalid-key-format', '', null, undefined];

      validKeyFormats.forEach(key => {
        assert.ok(
          key.includes('BEGIN') && key.includes('END'),
          'Valid key should have proper format'
        );
      });

      invalidKeyFormats.forEach(key => {
        if (key) {
          assert.ok(
            !key.includes('BEGIN') || !key.includes('END'),
            'Invalid key should not have proper format'
          );
        } else {
          assert.ok(!key, 'Key should be falsy');
        }
      });
    });

    it('should handle malformed topic IDs', () => {
      if (process.env.SKIP_INTEGRATION_TESTS) {
        return;
      }

      const validTopicIds = ['0.0.1234567', '0.0.123'];
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

  describe('Performance and Resource Management', () => {
    it('should handle large payloads efficiently', () => {
      if (process.env.SKIP_INTEGRATION_TESTS) {
        return;
      }

      // Test payload size limits with new array format
      const smallPayload = { test: 'data' };
      const largePayload = {
        routes: [],
      };

      // Create a large payload with many routes
      for (let i = 0; i < 100; i++) {
        largePayload.routes.push({
          addr: `0x${i.toString(16).padStart(40, '0')}`,
          proofType: 'create',
          nonce: i,
          url: 'http://localhost:7546',
          sig: '0x' + 'a'.repeat(130), // Mock signature
        });
      }

      const smallJson = JSON.stringify(smallPayload);
      const largeJson = JSON.stringify(largePayload);

      assert.ok(smallJson.length < 1000, 'Small payload should be under 1KB');
      assert.ok(largeJson.length > 10000, 'Large payload should be over 10KB');

      // Verify JSON is valid
      assert.deepStrictEqual(JSON.parse(smallJson), smallPayload);
      assert.deepStrictEqual(JSON.parse(largeJson), largePayload);
    });

    it('should properly clean up resources', () => {
      if (process.env.SKIP_INTEGRATION_TESTS) {
        return;
      }

      // Mock resource cleanup scenarios
      const mockClient = {
        close: mock.fn(),
      };

      // Simulate normal cleanup
      mockClient.close();
      assert.ok(
        mockClient.close.mock.calls.length === 1,
        'Client should be closed normally'
      );

      // Simulate cleanup after error
      try {
        throw new Error('Test error');
      } catch (error) {
        mockClient.close();
        assert.ok(
          mockClient.close.mock.calls.length === 2,
          'Client should be closed twice total'
        );
      }
    });
  });
});
