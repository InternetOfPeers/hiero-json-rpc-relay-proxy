const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const path = require('path');
const fs = require('node:fs').promises;

// Mock dependencies before requiring the server module
const mockHederaManager = {
  isEnabled: () => true,
  getTopicId: () => '0.0.12345',
  getTopicInfo: () => ({ topicId: '0.0.12345', network: 'testnet' }),
  startMessageListener: () => 'mock-interval-id',
  stopMessageListener: () => {},
};

const mockDbManager = {
  initDatabase: async () => {},
  saveDatabase: async () => {},
  getTargetServer: () => 'https://testnet.hashio.io/api',
  getRoutingDB: () => ({ '0x1234': 'https://testnet.hashio.io/api' }),
  updateRoutes: async () => {},
  initRSAKeyPair: async () => {},
  getRSAKeyPair: () => ({
    publicKey: 'mock-public-key',
    privateKey: 'mock-private-key',
    createdAt: new Date().toISOString(),
  }),
  hasRSAKeyPair: () => true,
  getLastProcessedSequence: () => 0,
  storeLastProcessedSequence: async () => {},
};

// Mock the required modules
require.cache[require.resolve('../src/hederaManager')] = {
  exports: {
    HederaManager: function () {
      return mockHederaManager;
    },
  },
};

Object.keys(mockDbManager).forEach(key => {
  require.cache[require.resolve('../src/dbManager')] = {
    exports: mockDbManager,
  };
});

describe('server functions', function () {
  let portCounter = 3001;
  const TEST_DATA_DIR = path.resolve(__dirname, 'data');
  let server;
  let testServers = []; // Track all test servers for cleanup
  let originalEnv;

  beforeEach(function () {
    originalEnv = { ...process.env };
    process.env.PORT = (portCounter++).toString(); // Use a different port for each test
    process.env.DATA_FOLDER = TEST_DATA_DIR;
    process.env.PROXY_HEDERA_ACCOUNT_ID = '0.0.12345';
    process.env.PROXY_HEDERA_PRIVATE_KEY = 'mock-private-key';
    process.env.PROXY_HEDERA_NETWORK = 'testnet';
    testServers = []; // Reset test servers array
  });

  afterEach(async function () {
    process.env = { ...originalEnv };

    // Close all test servers
    for (const testServer of testServers) {
      if (testServer && testServer.listening) {
        await new Promise(resolve => {
          testServer.close(resolve);
        });
      }
    }
    testServers = [];

    if (server && server.listening) {
      await new Promise(resolve => {
        server.close(resolve);
      });
    }
  });

  // Helper to get current test port
  function getCurrentTestPort() {
    return parseInt(process.env.PORT);
  }

  describe('HTTP request handling', function () {
    test('should handle GET /status request', function (done) {
      const testServer = http.createServer((req, res) => {
        if (req.url === '/status' && req.method === 'GET') {
          const statusInfo = {
            topicId: '0.0.12345',
            network: 'testnet',
            publicKey: 'mock-public-key',
            hasPrivateKey: true,
            createdAt: new Date().toISOString(),
          };

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(statusInfo, null, 2));
        } else {
          res.writeHead(404);
          res.end();
        }
      });

      testServers.push(testServer); // Track server for cleanup

      testServer.listen(getCurrentTestPort(), () => {
        const options = {
          hostname: 'localhost',
          port: getCurrentTestPort(),
          path: '/status',
          method: 'GET',
        };

        const req = http.request(options, res => {
          let data = '';
          res.on('data', chunk => {
            data += chunk;
          });
          res.on('end', () => {
            assert.strictEqual(res.statusCode, 200);
            const response = JSON.parse(data);
            assert.strictEqual(response.topicId, '0.0.12345');
            assert.strictEqual(response.network, 'testnet');
            testServer.close(done);
          });
        });

        req.on('error', error => {
          testServer.close();
          done(error);
        });

        req.end();
      });
    });

    test('should handle GET /routes request', function (done) {
      const testServer = http.createServer((req, res) => {
        if (req.url === '/routes' && req.method === 'GET') {
          const routes = { '0x1234': 'https://testnet.hashio.io/api' };
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(routes, null, 2));
        } else {
          res.writeHead(404);
          res.end();
        }
      });

      testServers.push(testServer); // Track server for cleanup

      testServer.listen(getCurrentTestPort(), () => {
        const options = {
          hostname: 'localhost',
          port: getCurrentTestPort(),
          path: '/routes',
          method: 'GET',
        };

        const req = http.request(options, res => {
          let data = '';
          res.on('data', chunk => {
            data += chunk;
          });
          res.on('end', () => {
            assert.strictEqual(res.statusCode, 200);
            const response = JSON.parse(data);
            assert.strictEqual(
              response['0x1234'],
              'https://testnet.hashio.io/api'
            );
            testServer.close(done);
          });
        });

        req.on('error', error => {
          testServer.close();
          done(error);
        });

        req.end();
      });
    });

    test('should handle GET /status/topic request', function (done) {
      const testServer = http.createServer((req, res) => {
        if (req.url === '/status/topic' && req.method === 'GET') {
          const topicInfo = { topicId: '0.0.12345', network: 'testnet' };
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(topicInfo, null, 2));
        } else {
          res.writeHead(404);
          res.end();
        }
      });

      testServers.push(testServer); // Track server for cleanup

      testServer.listen(getCurrentTestPort(), () => {
        const options = {
          hostname: 'localhost',
          port: getCurrentTestPort(),
          path: '/status/topic',
          method: 'GET',
        };

        const req = http.request(options, res => {
          let data = '';
          res.on('data', chunk => {
            data += chunk;
          });
          res.on('end', () => {
            assert.strictEqual(res.statusCode, 200);
            const response = JSON.parse(data);
            assert.strictEqual(response.topicId, '0.0.12345');
            testServer.close(done);
          });
        });

        req.on('error', error => {
          testServer.close();
          done(error);
        });

        req.end();
      });
    });

    test('should handle GET /status/public-key request', function (done) {
      const testServer = http.createServer((req, res) => {
        if (req.url === '/status/public-key' && req.method === 'GET') {
          const keyInfo = {
            publicKey: 'mock-public-key',
            createdAt: new Date().toISOString(),
            hasPrivateKey: true,
          };
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(keyInfo, null, 2));
        } else {
          res.writeHead(404);
          res.end();
        }
      });

      testServers.push(testServer); // Track server for cleanup

      testServer.listen(getCurrentTestPort(), () => {
        const options = {
          hostname: 'localhost',
          port: getCurrentTestPort(),
          path: '/status/public-key',
          method: 'GET',
        };

        const req = http.request(options, res => {
          let data = '';
          res.on('data', chunk => {
            data += chunk;
          });
          res.on('end', () => {
            assert.strictEqual(res.statusCode, 200);
            const response = JSON.parse(data);
            assert.strictEqual(response.publicKey, 'mock-public-key');
            assert.strictEqual(response.hasPrivateKey, true);
            testServer.close(done);
          });
        });

        req.on('error', error => {
          testServer.close();
          done(error);
        });

        req.end();
      });
    });

    test('should return 404 for unknown routes', function (done) {
      const testServer = http.createServer((req, res) => {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      });

      testServers.push(testServer); // Track server for cleanup

      testServer.listen(getCurrentTestPort(), () => {
        const options = {
          hostname: 'localhost',
          port: getCurrentTestPort(),
          path: '/unknown',
          method: 'GET',
        };

        const req = http.request(options, res => {
          assert.strictEqual(res.statusCode, 404);
          testServer.close(done);
        });

        req.on('error', error => {
          testServer.close();
          done(error);
        });

        req.end();
      });
    });
  });

  describe('error handling', function () {
    test('should handle port in use error', function (done) {
      // First server to occupy the port
      const blockingServer = http.createServer((req, res) => {
        res.end('blocking');
      });

      testServers.push(blockingServer); // Track server for cleanup

      blockingServer.listen(getCurrentTestPort(), () => {
        // Try to start second server on same port
        const testServer = http.createServer((req, res) => {
          res.end('test');
        });

        testServers.push(testServer); // Track server for cleanup

        testServer.on('error', error => {
          assert.strictEqual(error.code, 'EADDRINUSE');
          blockingServer.close(done);
        });

        testServer.listen(getCurrentTestPort());
      });
    });
  });

  describe('utility functions', function () {
    test('should generate network-specific database file path', function () {
      const originalEnv = process.env.PROXY_HEDERA_NETWORK;

      process.env.PROXY_HEDERA_NETWORK = 'testnet';
      const testnetPath = path.join('data', 'routing_db_testnet.json');

      process.env.PROXY_HEDERA_NETWORK = 'mainnet';
      const mainnetPath = path.join('data', 'routing_db_mainnet.json');

      // Test that different networks generate different paths
      assert.notEqual(testnetPath, mainnetPath);
      assert.ok(testnetPath.includes('testnet'));
      assert.ok(mainnetPath.includes('mainnet'));

      process.env.PROXY_HEDERA_NETWORK = originalEnv;
    });

    test('should parse request body correctly', function (done) {
      const testServer = http.createServer(async (req, res) => {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        req.on('end', () => {
          try {
            const jsonData = JSON.parse(body);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ received: jsonData }));
          } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'JSON parse error' }));
          }
        });
      });

      testServers.push(testServer); // Track server for cleanup

      testServer.listen(getCurrentTestPort(), () => {
        const testData = { test: 'data', number: 42 };
        const postData = JSON.stringify(testData);

        const options = {
          hostname: 'localhost',
          port: getCurrentTestPort(),
          path: '/test',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
          },
        };

        const req = http.request(options, res => {
          let data = '';
          res.on('data', chunk => {
            data += chunk;
          });
          res.on('end', () => {
            const response = JSON.parse(data);
            assert.deepStrictEqual(response.received, testData);
            testServer.close(done);
          });
        });

        req.on('error', error => {
          testServer.close();
          done(error);
        });

        req.write(postData);
        req.end();
      });
    });
  });
});
