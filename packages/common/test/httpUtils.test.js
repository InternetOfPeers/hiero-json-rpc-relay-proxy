const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const http = require('http');

// Import HTTP utilities to test
const {
  parseRequestBody,
  makeHttpRequest,
  setCorsHeaders,
  sendJsonResponse,
  sendErrorResponse,
  createServer,
} = require('../src/httpUtils');

describe('httpUtils', function () {
  let testServer;
  let testPort;

  beforeEach(function () {
    // Find available port for testing
    testPort = 0; // Let system assign port
  });

  afterEach(function () {
    if (testServer) {
      return new Promise(resolve => {
        testServer.close(() => {
          testServer = null;
          resolve();
        });
      });
    }
  });

  describe('parseRequestBody', function () {
    test('should parse JSON request body', async function () {
      const testData = { test: 'data', number: 123 };
      const jsonString = JSON.stringify(testData);

      // Create mock request
      const req = {
        on: function (event, callback) {
          if (event === 'data') {
            setImmediate(() => callback(jsonString));
          } else if (event === 'end') {
            setImmediate(callback);
          } else if (event === 'error') {
            // Store error callback for potential use
          }
        },
      };

      const result = await parseRequestBody(req);
      assert.strictEqual(result.body, jsonString);
      assert.deepStrictEqual(result.jsonData, testData);
    });

    test('should handle empty request body', async function () {
      // Create mock request with empty body
      const req = {
        on: function (event, callback) {
          if (event === 'data') {
            // No data chunks
          } else if (event === 'end') {
            setImmediate(callback);
          } else if (event === 'error') {
            // Store error callback for potential use
          }
        },
      };

      const result = await parseRequestBody(req);
      assert.strictEqual(result.body, '');
      assert.strictEqual(result.jsonData, null);
    });

    test('should handle invalid JSON gracefully', async function () {
      const invalidJson = '{"invalid": json}';

      // Create mock request
      const req = {
        on: function (event, callback) {
          if (event === 'data') {
            setImmediate(() => callback(invalidJson));
          } else if (event === 'end') {
            setImmediate(callback);
          } else if (event === 'error') {
            // Store error callback for potential use
          }
        },
      };

      const result = await parseRequestBody(req);
      assert.strictEqual(result.body, invalidJson);
      assert.strictEqual(result.jsonData, null);
    });
  });

  describe('makeHttpRequest', function () {
    test('should make successful HTTP request', async function () {
      // Create test server
      testServer = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, method: req.method }));
      });

      testServer.listen(0, async () => {
        const port = testServer.address().port;
        const url = `http://localhost:${port}/test`;

        const result = await makeHttpRequest(url);
        assert.strictEqual(result.statusCode, 200);
        assert.ok(result.json);
        assert.strictEqual(result.json.success, true);
        assert.strictEqual(result.json.method, 'GET');
      });
    });

    test('should handle POST request with body', async function () {
      const requestBody = { test: 'data' };

      // Create test server
      testServer = http.createServer((req, res) => {
        let body = '';
        req.on('data', chunk => (body += chunk));
        req.on('end', () => {
          const parsed = JSON.parse(body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              received: parsed,
              method: req.method,
              contentType: req.headers['content-type'],
            })
          );
        });
      });

      testServer.listen(0, async () => {
        const port = testServer.address().port;
        const url = `http://localhost:${port}/test`;

        const result = await makeHttpRequest(url, {
          method: 'POST',
          body: requestBody,
        });
        assert.strictEqual(result.statusCode, 200);
        assert.ok(result.json);
        assert.deepStrictEqual(result.json.received, requestBody);
        assert.strictEqual(result.json.method, 'POST');
        assert.strictEqual(result.json.contentType, 'application/json');
      });
    });

    test('should handle request timeout', async function () {
      // Create test server that doesn't respond
      testServer = http.createServer((req, res) => {
        // Don't respond, let it timeout
      });

      testServer.listen(0, async () => {
        const port = testServer.address().port;
        const url = `http://localhost:${port}/test`;

        try {
          await makeHttpRequest(url, { timeout: 100 });
          throw new Error('Should have timed out');
        } catch (error) {
          assert.ok(error.message.includes('timeout'));
        }
      });
    });
  });

  describe('setCorsHeaders', function () {
    test('should set default CORS headers', function () {
      const mockRes = {
        headers: {},
        setHeader: function (name, value) {
          this.headers[name] = value;
        },
      };

      setCorsHeaders(mockRes);

      assert.strictEqual(mockRes.headers['Access-Control-Allow-Origin'], '*');
      assert.strictEqual(
        mockRes.headers['Access-Control-Allow-Methods'],
        'GET, POST, OPTIONS'
      );
      assert.strictEqual(
        mockRes.headers['Access-Control-Allow-Headers'],
        'Content-Type, Authorization'
      );
    });

    test('should set custom CORS headers', function () {
      const mockRes = {
        headers: {},
        setHeader: function (name, value) {
          this.headers[name] = value;
        },
      };

      setCorsHeaders(mockRes, {
        origin: 'https://example.com',
        methods: 'GET, POST, PUT',
        headers: 'Content-Type, X-Custom-Header',
      });

      assert.strictEqual(
        mockRes.headers['Access-Control-Allow-Origin'],
        'https://example.com'
      );
      assert.strictEqual(
        mockRes.headers['Access-Control-Allow-Methods'],
        'GET, POST, PUT'
      );
      assert.strictEqual(
        mockRes.headers['Access-Control-Allow-Headers'],
        'Content-Type, X-Custom-Header'
      );
    });
  });

  describe('sendJsonResponse', function () {
    test('should send JSON response with correct headers', function () {
      let responseData = null;
      let statusCode = null;
      let headers = {};

      const mockRes = {
        writeHead: function (code, hdrs) {
          statusCode = code;
          Object.assign(headers, hdrs);
        },
        end: function (data) {
          responseData = data;
        },
      };

      const testData = { message: 'test', number: 42 };
      sendJsonResponse(mockRes, 200, testData);

      assert.strictEqual(statusCode, 200);
      assert.strictEqual(headers['Content-Type'], 'application/json');
      assert.deepStrictEqual(JSON.parse(responseData), testData);
    });
  });

  describe('sendErrorResponse', function () {
    test('should send error response with timestamp', function () {
      let responseData = null;
      let statusCode = null;

      const mockRes = {
        writeHead: function (code, hdrs) {
          statusCode = code;
        },
        end: function (data) {
          responseData = data;
        },
      };

      sendErrorResponse(mockRes, 400, 'Test error message', {
        code: 'TEST_ERROR',
      });

      assert.strictEqual(statusCode, 400);

      const parsed = JSON.parse(responseData);
      assert.strictEqual(parsed.error, 'Test error message');
      assert.strictEqual(parsed.code, 'TEST_ERROR');
      assert.ok(parsed.timestamp);
      assert.ok(new Date(parsed.timestamp).getTime() > 0);
    });
  });

  describe('createServer', function () {
    test('should create server with CORS enabled by default', async function () {
      let corsHeadersSet = false;

      const requestHandler = (req, res) => {
        // Check if CORS headers were set
        const origin = res.getHeader('Access-Control-Allow-Origin');
        corsHeadersSet = origin === '*';

        res.writeHead(200);
        res.end('OK');
      };

      testServer = createServer(requestHandler);
      testServer.listen(0, () => {
        const port = testServer.address().port;

        // Make OPTIONS request to test CORS
        const options = {
          hostname: 'localhost',
          port: port,
          path: '/',
          method: 'OPTIONS',
        };

        const req = http.request(options, res => {
          assert.strictEqual(res.statusCode, 200);
          assert.ok(corsHeadersSet);
        });

        req.on('error', error => {
          throw error;
        });
        req.end();
      });
    });

    test('should handle regular requests through provided handler', async function () {
      const requestHandler = (req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Hello from handler');
      };

      testServer = createServer(requestHandler);
      testServer.listen(0, () => {
        const port = testServer.address().port;

        const options = {
          hostname: 'localhost',
          port: port,
          path: '/',
          method: 'GET',
        };

        const req = http.request(options, res => {
          let data = '';
          res.on('data', chunk => (data += chunk));
          res.on('end', () => {
            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(data, 'Hello from handler');
          });
        });

        req.on('error', error => {
          throw error;
        });
        req.end();
      });
    });
  });
});
