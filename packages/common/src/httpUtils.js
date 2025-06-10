const http = require('http');
const https = require('https');

/**
 * Common HTTP utilities shared between prover and proxy
 */

/**
 * Parse request body for HTTP requests
 * @param {http.IncomingMessage} req - HTTP request object
 * @returns {Promise<Object>} Parsed body with raw body and JSON data
 */
function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        let jsonData = null;
        if (body.trim()) {
          jsonData = JSON.parse(body);
        }
        resolve({ body, jsonData });
      } catch (error) {
        console.error('JSON parse error:', error.message);
        resolve({ body, jsonData: null });
      }
    });

    req.on('error', reject);
  });
}

/**
 * Make HTTP request with timeout and error handling
 * @param {string} url - Target URL
 * @param {Object} options - Request options
 * @returns {Promise<Object>} Response data
 */
function makeHttpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const {
      method = 'GET',
      headers = {},
      body = null,
      timeout = 5000,
      followRedirects = true,
    } = options;

    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (body && typeof body === 'object') {
      requestOptions.headers['Content-Length'] = Buffer.byteLength(
        JSON.stringify(body)
      );
    } else if (body) {
      requestOptions.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const request = httpModule.request(requestOptions, response => {
      let data = '';

      response.on('data', chunk => {
        data += chunk;
      });

      response.on('end', () => {
        try {
          const result = {
            statusCode: response.statusCode,
            headers: response.headers,
            body: data,
            json: null,
          };

          // Try to parse JSON if content type indicates JSON
          const contentType = response.headers['content-type'];
          if (
            contentType &&
            contentType.includes('application/json') &&
            data.trim()
          ) {
            try {
              result.json = JSON.parse(data);
            } catch (parseError) {
              // Ignore JSON parse errors, just return raw body
            }
          }

          resolve(result);
        } catch (error) {
          reject(new Error(`Response processing failed: ${error.message}`));
        }
      });
    });

    request.on('error', error => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    request.setTimeout(timeout, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });

    // Send body if provided
    if (body) {
      if (typeof body === 'object') {
        request.write(JSON.stringify(body));
      } else {
        request.write(body);
      }
    }

    request.end();
  });
}

/**
 * Set CORS headers for HTTP responses
 * @param {http.ServerResponse} res - HTTP response object
 * @param {Object} options - CORS options
 */
function setCorsHeaders(res, options = {}) {
  const {
    origin = '*',
    methods = 'GET, POST, OPTIONS',
    headers = 'Content-Type, Authorization',
  } = options;

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', headers);
}

/**
 * Send JSON response
 * @param {http.ServerResponse} res - HTTP response object
 * @param {number} statusCode - HTTP status code
 * @param {Object} data - Data to send as JSON
 */
function sendJsonResponse(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data, null, 2));
}

/**
 * Send error response
 * @param {http.ServerResponse} res - HTTP response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {Object} details - Additional error details
 */
function sendErrorResponse(res, statusCode, message, details = {}) {
  sendJsonResponse(res, statusCode, {
    error: message,
    timestamp: new Date().toISOString(),
    ...details,
  });
}

/**
 * Create HTTP server with common middleware
 * @param {Function} requestHandler - Request handler function
 * @param {Object} options - Server options
 * @returns {http.Server} HTTP server instance
 */
function createServer(requestHandler, options = {}) {
  const { cors = true } = options;

  return http.createServer((req, res) => {
    // Set CORS headers if enabled
    if (cors) {
      setCorsHeaders(res);
    }

    // Handle OPTIONS requests
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Call the provided request handler
    requestHandler(req, res);
  });
}

module.exports = {
  parseRequestBody,
  makeHttpRequest,
  setCorsHeaders,
  sendJsonResponse,
  sendErrorResponse,
  createServer,
};
