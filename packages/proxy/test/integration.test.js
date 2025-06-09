const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const https = require('node:https');
const { spawn } = require('node:child_process');
const fs = require('node:fs').promises;
const path = require('node:path');

// Utility function to make HTTP requests without node-fetch
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const httpModule = urlObj.protocol === 'https:' ? https : http;

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: 5000, // 5 second timeout
    };

    const req = httpModule.request(reqOptions, res => {
      let data = '';
      res.on('data', chunk => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          json: () => Promise.resolve(JSON.parse(data)),
          text: () => Promise.resolve(data),
        });
      });
    });

    req.on('error', error => {
      reject(new Error(`Request failed: ${error.message} (${error.code})`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout after 5000ms'));
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

// Integration tests
describe('proxy.js integration', function () {
  // Skip integration tests if SKIP_INTEGRATION_TESTS environment variable is set
  if (process.env.SKIP_INTEGRATION_TESTS) {
    console.log('⏭️  Skipping integration tests (SKIP_INTEGRATION_TESTS=true)');
    return;
  }

  let serverProcess;
  const TEST_DATA_FOLDER = path.resolve(__dirname, 'data');
  const TEST_NETWORK = 'testnet';
  const PORT = 3999;
  const BASE_URL = `http://localhost:${PORT}`;
  // The server will create routing_db_testnet.json in test/data/ folder

  before(async function () {
    // Ensure test directory exists
    await fs.mkdir(TEST_DATA_FOLDER, { recursive: true });

    console.log(
      `Starting server on port ${PORT} with data folder ${TEST_DATA_FOLDER}`
    );

    // Start the server with explicit environment variables to override any .env file
    const env = {
      PORT: PORT.toString(),
      DATA_FOLDER: TEST_DATA_FOLDER,
      HEDERA_NETWORK: TEST_NETWORK,
      // Skip loading .env file to prevent override of test environment variables
      SKIP_ENV_FILE: 'true',
      // Inherit only specific environment variables
      PATH: process.env.PATH,
      NODE_ENV: process.env.NODE_ENV,
    };

    serverProcess = spawn(process.execPath, ['packages/proxy/src/proxy.js'], {
      env: env,
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: path.resolve(__dirname, '../../../'), // Set working directory to project root
    });

    // Log server output for debugging
    serverProcess.stdout.on('data', data => {
      console.log('Server stdout:', data.toString());
    });

    serverProcess.stderr.on('data', data => {
      console.error('Server stderr:', data.toString());
    });

    serverProcess.on('error', err => {
      console.error('Server process error:', err);
    });

    serverProcess.on('exit', (code, signal) => {
      console.log(`Server process exited with code ${code}, signal ${signal}`);
    });

    // Wait for server to be ready (increased timeout for Hedera initialization)
    // Also check if server is actually responding
    console.log('Waiting for server to start...');

    // More robust health check with multiple retries
    let healthCheckPassed = false;
    let lastError = null;

    for (let i = 0; i < 20; i++) {
      // Try for up to 20 seconds
      try {
        console.log(`Health check attempt ${i + 1}/20...`);
        const healthCheck = await makeRequest(`${BASE_URL}/routes`);
        if (healthCheck.status === 200) {
          console.log(
            'Server health check passed, status:',
            healthCheck.status
          );
          healthCheckPassed = true;
          break;
        } else {
          console.log('Server responded but with status:', healthCheck.status);
        }
      } catch (error) {
        lastError = error;
        console.log(`Health check failed (attempt ${i + 1}):`, error.message);
      }

      // Wait 1 second between attempts
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (!healthCheckPassed) {
      console.error(
        'Server health check failed after 20 attempts. Last error:',
        lastError?.message
      );
      throw new Error('Server failed to start properly');
    }
  });

  after(async function () {
    if (serverProcess) serverProcess.kill();
  });

  test('should return routes on GET /routes', async function () {
    const res = await makeRequest(`${BASE_URL}/routes`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    // Check for the default route that should always exist
    assert.ok(
      data['0x0000000000000000000000000000000000000000'] ||
        data['0x742d35cc6634c0532925a3b8d0c0f3e5c5c07c20']
    );
  });

  test('should update routes on POST /routes', async function () {
    const res = await makeRequest(`${BASE_URL}/routes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ '0xabc': 'https://new.example.com' }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.routes['0xabc'], 'https://new.example.com');
  });

  test('should return Hedera topic info on GET /status/topic', async function () {
    const res = await makeRequest(`${BASE_URL}/status/topic`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    // Should have expected properties
    assert.ok(data.hasOwnProperty('topicId'));
    assert.ok(data.hasOwnProperty('hederaNetwork'));
    assert.ok(data.hasOwnProperty('clientInitialized'));
    // Network should be testnet or mainnet
    assert.ok(
      data.hederaNetwork === 'testnet' || data.hederaNetwork === 'mainnet'
    );

    // In integration tests without credentials, client should not be initialized
    if (
      process.env.HEDERA_ACCOUNT_ID &&
      process.env.HEDERA_PRIVATE_KEY &&
      process.env.HEDERA_TOPIC_ID
    ) {
      // If credentials are provided, client should be initialized
      assert.strictEqual(data.clientInitialized, true);
      // Topic ID should be a valid topic ID format (e.g., "0.0.123456")
      assert.ok(typeof data.topicId === 'string');
      assert.ok(/^0\.0\.\d+$/.test(data.topicId));
      // Should also have accountId when client is initialized
      assert.ok(data.hasOwnProperty('accountId'));
      assert.ok(/^0\.0\.\d+$/.test(data.accountId));
    } else {
      // Without credentials, client should not be initialized
      assert.strictEqual(data.clientInitialized, false);
      assert.strictEqual(data.topicId, null);
      assert.strictEqual(data.accountId, undefined);
    }
  });

  test('should return RSA public key on GET /status/public-key', async function () {
    const res = await makeRequest(`${BASE_URL}/status/public-key`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();

    // Should have expected properties
    assert.ok(data.hasOwnProperty('publicKey'));
    assert.ok(data.hasOwnProperty('createdAt'));
    assert.ok(data.hasOwnProperty('hasPrivateKey'));

    // Public key should be in PEM format
    assert.ok(typeof data.publicKey === 'string');
    assert.ok(data.publicKey.includes('-----BEGIN PUBLIC KEY-----'));
    assert.ok(data.publicKey.includes('-----END PUBLIC KEY-----'));

    // Should have private key available
    assert.strictEqual(data.hasPrivateKey, true);

    // Created date should be a valid ISO string
    assert.ok(typeof data.createdAt === 'string');
    assert.ok(!isNaN(Date.parse(data.createdAt)));
  });

  test('should forward eth_blockNumber JSON-RPC request to default server', async function () {
    const jsonRpcRequest = {
      jsonrpc: '2.0',
      method: 'eth_blockNumber',
      params: [],
      id: 1,
    };

    const res = await makeRequest(`${BASE_URL}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jsonRpcRequest),
    });

    // Should successfully forward the request
    assert.strictEqual(res.status, 200);
    const data = await res.json();

    // Should have valid JSON-RPC response structure
    assert.ok(data.hasOwnProperty('jsonrpc'));
    assert.strictEqual(data.jsonrpc, '2.0');
    assert.ok(data.hasOwnProperty('id'));
    assert.strictEqual(data.id, 1);

    // Should either have result or error (depending on target server availability)
    assert.ok(data.hasOwnProperty('result') || data.hasOwnProperty('error'));

    // If successful, result should be a hex string representing block number
    if (data.result) {
      assert.ok(typeof data.result === 'string');
      assert.ok(data.result.startsWith('0x'));
    }

    // If error, should have proper error structure
    if (data.error) {
      assert.ok(data.error.hasOwnProperty('code'));
      assert.ok(data.error.hasOwnProperty('message'));
    }
  });
});
