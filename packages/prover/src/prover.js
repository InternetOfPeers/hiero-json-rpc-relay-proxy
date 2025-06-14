#!/usr/bin/env node
const { HederaManager } = require('./hederaManager');
const {
  loadEnvFile,
  verifyChallenge,
  signChallengeResponse,
  encryptAES,
  decryptAES,
  generateAESKey,
  validateRouteSignatures,
} = require('@hiero-json-rpc-relay/common');
const { ethers } = require('ethers');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Global results tracking
let proverResults = {
  session: {
    startTime: new Date().toISOString(),
    endTime: null,
    duration: null,
    status: 'started',
    proxyUrl: null,
    hederaNetwork: null,
    topicId: null,
  },
  payload: {
    created: false,
    routes: [],
    originalSize: 0,
    encryptedSize: 0,
  },
  hedera: {
    submitted: false,
    sequenceNumber: null,
    error: null,
  },
  challenges: {
    serverStarted: false,
    serverPort: null,
    received: [],
    totalCount: 0,
    successCount: 0,
    failureCount: 0,
  },
  confirmation: {
    received: false,
    timestamp: null,
    status: null,
    message: null,
    expectedCount: 0,
    receivedCount: 0,
    confirmations: [],
  },
  errors: [],
};

// Load environment variables from the prover's .env file
const proverEnvPath = path.join(__dirname, '..', '.env');

// Check if prover .env exists before loading
if (!require('fs').existsSync(proverEnvPath)) {
  console.log('📁 Prover .env not found, trying to load root .env');
  // Try loading root .env as fallback
  const rootEnvPath = path.join(__dirname, '..', '..', '..', '.env');
  if (require('fs').existsSync(rootEnvPath)) {
    loadEnvFile(rootEnvPath);
    console.log('📁 Using root .env file');
  } else {
    console.log(
      '📁 No .env file found, using system environment variables only'
    );
  }
} else {
  loadEnvFile(proverEnvPath);
  console.log('📁 Using prover-specific .env file');
}

// Configuration
const PROVER_PROXY_SERVER_URL =
  process.env.PROVER_PROXY_SERVER_URL || 'http://localhost:3000';
const PROVER_HEDERA_NETWORK = process.env.PROVER_HEDERA_NETWORK || 'testnet';
const PROVER_PORT = process.env.PROVER_PORT
  ? parseInt(process.env.PROVER_PORT, 10)
  : 7546;

// AES key storage for encrypted communications with proxy
let proverAESKeys = new Map(); // contractAddress -> aesKey

/**
 * Custom hybrid encryption function that uses a specific AES key
 * @param {string} publicKeyPem - RSA public key for encrypting the AES key
 * @param {string} data - Data to encrypt
 * @param {Buffer} aesKey - Specific AES key to use
 * @param {boolean} verbose - Verbose logging
 * @returns {string} JSON string containing encrypted payload
 */
function encryptHybridMessageWithKey(
  publicKeyPem,
  data,
  aesKey,
  verbose = false
) {
  const crypto = require('crypto');

  try {
    if (verbose) {
      console.log(
        '🔐 Encrypting payload with hybrid encryption using specific AES key...'
      );
    }

    // Generate IV for AES encryption
    const iv = crypto.randomBytes(16);

    // Encrypt the data with AES-256-CBC
    const aesCipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
    let encryptedData = aesCipher.update(data, 'utf8', 'base64');
    encryptedData += aesCipher.final('base64');

    // Encrypt the AES key with RSA
    const encryptedAesKey = crypto.publicEncrypt(
      {
        key: publicKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      aesKey
    );

    // Combine everything into a single payload
    const hybridPayload = {
      key: encryptedAesKey.toString('base64'),
      iv: iv.toString('base64'),
      data: encryptedData,
    };

    const jsonPayload = JSON.stringify(hybridPayload);

    if (verbose) {
      console.log(
        `✅ Payload encrypted successfully with specific AES key (${data.length} characters)`
      );
    }

    return jsonPayload;
  } catch (error) {
    throw new Error(`Custom hybrid encryption failed: ${error.message}`);
  }
}

/**
 * Save prover results to a file
 * @param {string} status - Final status: 'completed', 'failed', 'timeout'
 * @param {string} reason - Reason for completion/failure
 */
function saveResults(
  status = 'completed',
  reason = 'Flow completed successfully'
) {
  try {
    proverResults.session.endTime = new Date().toISOString();
    proverResults.session.status = status;
    proverResults.session.reason = reason;

    // Calculate duration
    const startTime = new Date(proverResults.session.startTime);
    const endTime = new Date(proverResults.session.endTime);
    proverResults.session.duration = endTime - startTime; // milliseconds

    // Ensure results directory exists
    const resultsDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `prover-results-${timestamp}.json`;
    const filepath = path.join(resultsDir, filename);

    // Write results to file
    fs.writeFileSync(filepath, JSON.stringify(proverResults, null, 2));

    console.log(`💾 Results saved to: ${filepath}`);
    console.log(`📊 Session Summary:`);
    console.log(`   Status: ${status}`);
    console.log(`   Duration: ${proverResults.session.duration}ms`);
    console.log(
      `   Challenges: ${proverResults.challenges.successCount}/${proverResults.challenges.totalCount} successful`
    );
    console.log(
      `   Hedera submission: ${proverResults.hedera.submitted ? 'Success' : 'Failed'}`
    );

    return filepath;
  } catch (error) {
    console.error(`❌ Failed to save results: ${error.message}`);
    proverResults.errors.push({
      type: 'save_error',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
    return null;
  }
}

// Function to fetch status from the proxy server
function fetchStatus() {
  return new Promise((resolve, reject) => {
    const url = `${PROVER_PROXY_SERVER_URL}/status`;
    console.log(`📡 Fetching status from: ${url}`);

    // Track proxy URL
    proverResults.session.proxyUrl = PROVER_PROXY_SERVER_URL;

    const request = http.get(url, response => {
      let data = '';

      response.on('data', chunk => {
        data += chunk;
      });

      response.on('end', () => {
        try {
          if (response.statusCode === 200) {
            const status = JSON.parse(data);
            // Track status info
            proverResults.session.hederaNetwork = status.hederaNetwork;
            proverResults.session.topicId = status.topicId;
            resolve(status);
          } else {
            const error = new Error(`HTTP ${response.statusCode}: ${data}`);
            proverResults.errors.push({
              type: 'fetch_status_error',
              message: error.message,
              timestamp: new Date().toISOString(),
            });
            reject(error);
          }
        } catch (error) {
          const err = new Error(`Failed to parse JSON: ${error.message}`);
          proverResults.errors.push({
            type: 'parse_status_error',
            message: err.message,
            timestamp: new Date().toISOString(),
          });
          reject(err);
        }
      });
    });

    request.on('error', error => {
      const err = new Error(`Request failed: ${error.message}`);
      proverResults.errors.push({
        type: 'request_error',
        message: err.message,
        timestamp: new Date().toISOString(),
      });
      reject(err);
    });

    request.setTimeout(5000, () => {
      request.destroy();
      const err = new Error('Request timeout');
      proverResults.errors.push({
        type: 'timeout_error',
        message: err.message,
        timestamp: new Date().toISOString(),
      });
      reject(err);
    });
  });
}

// Function to send encrypted message to Hedera topic
async function sendEncryptedMessage(topicId, encryptedPayload) {
  console.log(`📤 Sending encrypted message to topic: ${topicId}`);

  // Initialize Prover Hedera Manager with ECDSA support
  const hederaManager = new HederaManager({
    accountId: process.env.PROVER_HEDERA_ACCOUNT_ID,
    privateKey: process.env.PROVER_HEDERA_PRIVATE_KEY,
    network: PROVER_HEDERA_NETWORK,
    keyType: process.env.PROVER_HEDERA_KEY_TYPE || 'ECDSA',
  });

  if (!hederaManager.isEnabled()) {
    throw new Error(
      'Hedera credentials not configured. Please set PROVER_HEDERA_ACCOUNT_ID and PROVER_HEDERA_PRIVATE_KEY'
    );
  }

  // Initialize topic for prover
  await hederaManager.configureTopicForProver(topicId);

  try {
    // Submit the message to the topic
    const receipt = await hederaManager.submitMessageToTopic(
      topicId,
      encryptedPayload
    );

    console.log('✅ Encrypted message sent successfully!');
    console.log(`   Sequence Number: ${receipt.topicSequenceNumber}`);

    // Track Hedera submission
    proverResults.hedera.submitted = true;
    proverResults.hedera.sequenceNumber =
      receipt.topicSequenceNumber.toString();

    // Close the client connection
    hederaManager.close();
  } catch (error) {
    // Track Hedera error
    proverResults.hedera.submitted = false;
    proverResults.hedera.error = error.message;
    proverResults.errors.push({
      type: 'hedera_submission_error',
      message: error.message,
      timestamp: new Date().toISOString(),
    });

    hederaManager.close();
    throw error;
  }
}

/**
 * Start HTTP server to handle challenge requests and confirmation from proxy
 * @param {string} proxyPublicKey - RSA public key from proxy for challenge verification
 * @param {string} privateKey - ECDSA private key for signing responses
 * @returns {Promise<http.Server>} HTTP server instance
 */
function startChallengeServer(proxyPublicKey, privateKey) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      // Set CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      if (req.url === '/challenge' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => (body += chunk));
        req.on('end', () => {
          handleChallenge(req, res, body, proxyPublicKey, privateKey);
        });
      } else if (req.url === '/confirmation' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => (body += chunk));
        req.on('end', () => {
          handleConfirmation(req, res, body, server);
        });
      } else if (req.url === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ready', timestamp: Date.now() }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    });

    server.listen(PROVER_PORT, err => {
      if (err) {
        proverResults.errors.push({
          type: 'server_start_error',
          message: err.message,
          timestamp: new Date().toISOString(),
        });
        reject(err);
      } else {
        console.log(`🌐 Challenge server listening on port ${PROVER_PORT}`);
        // Track challenge server
        proverResults.challenges.serverStarted = true;
        proverResults.challenges.serverPort = PROVER_PORT;
        resolve(server);
      }
    });
  });
}

/**
 * Handle incoming challenge from proxy
 * @param {http.IncomingMessage} req - HTTP request
 * @param {http.ServerResponse} res - HTTP response
 * @param {string} body - Request body
 * @param {string} proxyPublicKey - RSA public key from proxy
 * @param {string} privateKey - ECDSA private key for signing
 */
function handleChallenge(req, res, body, proxyPublicKey, privateKey) {
  let challengeRecord = {
    timestamp: new Date().toISOString(),
    success: false,
    challengeId: null,
    url: null,
    contractAddress: null,
    error: null,
  };

  try {
    console.log('🎯 Received challenge from proxy');

    // Track challenge received
    proverResults.challenges.totalCount++;

    // Try to parse challenge - could be AES encrypted or plain JSON
    let challengeObj;
    try {
      // Parse body as JSON first
      const parsedBody = JSON.parse(body);

      // Check if it looks like an unencrypted challenge (has challenge and signature)
      if (parsedBody.challenge && parsedBody.signature) {
        challengeObj = parsedBody;
        console.log('   📄 Received unencrypted challenge');
      }
      // Check if it looks like an encrypted challenge (has iv and data)
      else if (parsedBody.iv && parsedBody.data) {
        console.log('   🔓 Attempting to decrypt AES-encrypted challenge...');

        // Try to decrypt with each stored AES key
        let decrypted = false;
        for (const [contractAddress, aesKey] of proverAESKeys.entries()) {
          try {
            const decryptedData = decryptAES(parsedBody, aesKey);
            challengeObj = JSON.parse(decryptedData);
            console.log(
              `   🔓 Challenge decrypted with AES key for contract: ${contractAddress}`
            );
            decrypted = true;
            break;
          } catch (decryptError) {
            // Try next key
            continue;
          }
        }

        if (!decrypted) {
          throw new Error(
            'Could not decrypt challenge with any available AES key'
          );
        }
      } else {
        throw new Error(
          'Unknown challenge format - not unencrypted or AES encrypted'
        );
      }
    } catch (jsonError) {
      throw new Error(`Invalid JSON in challenge body: ${jsonError.message}`);
    }

    if (!challengeObj.challenge || !challengeObj.signature) {
      throw new Error('Invalid challenge format');
    }

    challengeRecord.challengeId = challengeObj.challenge.challengeId;
    challengeRecord.url = challengeObj.challenge.url;
    challengeRecord.contractAddress = challengeObj.challenge.contractAddress;

    console.log(
      `   Challenge ID: ${challengeObj.challenge.challengeId?.substring(0, 16)}...`
    );
    console.log(`   URL: ${challengeObj.challenge.url}`);
    console.log(`   Contract: ${challengeObj.challenge.contractAddress}`);

    // Verify the challenge signature using RSA public key
    const challengeValid = verifyChallenge(
      challengeObj.challenge,
      challengeObj.signature,
      proxyPublicKey
    );

    if (!challengeValid) {
      throw new Error('Challenge signature verification failed');
    }

    console.log('   ✅ Challenge signature verified');

    // Sign the challenge with ECDSA private key
    const responseSignature = signChallengeResponse(
      challengeObj.challenge,
      privateKey
    );

    const response = {
      challengeId: challengeObj.challenge.challengeId,
      signature: responseSignature,
      timestamp: Date.now(),
      status: 'verified',
    };

    console.log('   📝 Signed challenge response');
    console.log(
      `   Response signature: ${responseSignature.substring(0, 20)}...`
    );

    // Try to encrypt response with AES if key is available for this contract
    let responseData;
    const contractAddress = challengeObj.challenge.contractAddress;
    const aesKey = proverAESKeys.get(contractAddress?.toLowerCase());

    if (aesKey) {
      try {
        const encrypted = encryptAES(JSON.stringify(response), aesKey);
        responseData = JSON.stringify(encrypted);
        console.log('   🔐 Challenge response encrypted with AES key');
      } catch (aesError) {
        console.log(
          `   ⚠️  AES encryption failed: ${aesError.message}, sending unencrypted`
        );
        responseData = JSON.stringify(response);
      }
    } else {
      console.log('   📄 No AES key available, sending unencrypted response');
      responseData = JSON.stringify(response);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(responseData);

    console.log('   ✅ Challenge response sent');

    // Mark challenge as successful
    challengeRecord.success = true;
    proverResults.challenges.successCount++;
  } catch (error) {
    console.log(`   ❌ Challenge handling error: ${error.message}`);

    // Track challenge error
    challengeRecord.error = error.message;
    proverResults.challenges.failureCount++;
    proverResults.errors.push({
      type: 'challenge_error',
      message: error.message,
      challengeId: challengeRecord.challengeId,
      timestamp: new Date().toISOString(),
    });

    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: error.message,
        challengeId: challengeRecord.challengeId,
        status: 'failed',
      })
    );
  } finally {
    // Record challenge attempt
    proverResults.challenges.received.push(challengeRecord);
  }
}

// validateRouteSignatures function is now imported from common package

/**
 * Handle incoming confirmation from proxy
 * @param {http.IncomingMessage} req - HTTP request
 * @param {http.ServerResponse} res - HTTP response
 * @param {string} body - Request body
 * @param {http.Server} server - HTTP server instance for shutdown
 */
function handleConfirmation(req, res, body, server) {
  try {
    console.log('\n📨 Received message from proxy'); // Try to parse confirmation - could be AES encrypted or plain JSON
    let confirmation;
    let parsedBody;

    try {
      parsedBody = JSON.parse(body);
    } catch (jsonError) {
      throw new Error('Invalid JSON in confirmation message');
    }

    // Check if this is an AES-encrypted message (has iv and data properties)
    if (parsedBody.iv && parsedBody.data) {
      console.log('   🔓 Attempting to decrypt AES-encrypted message...');

      // Try to decrypt with each stored AES key
      let decrypted = false;
      for (const [contractAddress, aesKey] of proverAESKeys.entries()) {
        try {
          const decryptedData = decryptAES(parsedBody, aesKey);
          confirmation = JSON.parse(decryptedData);
          console.log(
            `   🔓 Message decrypted with AES key for contract: ${contractAddress}`
          );

          decrypted = true;
          break;
        } catch (decryptError) {
          // Try next key
          continue;
        }
      }

      if (!decrypted) {
        throw new Error('Could not decrypt message with any available AES key');
      }
    } else {
      // This is an unencrypted message
      confirmation = parsedBody;
      console.log('   📄 Received unencrypted message');
    }

    // Check if this is a failure message
    if (
      confirmation.status === 'failed' ||
      confirmation.type === 'route-verification-failure'
    ) {
      console.log('   ❌ Received verification failure notification');
      console.log(`   📋 Reason: ${confirmation.reason || 'unknown'}`);
      console.log(
        `   📝 Message: ${confirmation.message || 'No details provided'}`
      );

      if (confirmation.routeSpecificError) {
        console.log(
          `   🔍 Route-specific error: ${confirmation.routeSpecificError}`
        );
      }

      if (confirmation.errors && confirmation.errors.length > 0) {
        console.log('   📋 Detailed errors:');
        confirmation.errors.forEach((error, index) => {
          console.log(`      ${index + 1}. ${error}`);
        });
      }

      if (confirmation.invalidRoutes && confirmation.invalidRoutes.length > 0) {
        console.log('   📋 Invalid routes:');
        confirmation.invalidRoutes.forEach((invalid, index) => {
          console.log(
            `      ${index + 1}. ${invalid.route?.addr || 'unknown'}: ${invalid.error}`
          );
        });
      }

      // Track failure confirmation
      proverResults.confirmation.receivedCount++;
      proverResults.confirmation.confirmations.push({
        timestamp: new Date().toISOString(),
        status: 'failed',
        message: confirmation.message || 'Verification failed',
        addr: confirmation.addr || 'unknown',
        verifiedRoutes: 0,
        totalRoutes: confirmation.invalidCount || 0,
        reason: confirmation.reason || 'unknown',
        errors: confirmation.errors || [],
      });

      // Update error tracking
      proverResults.errors.push({
        type: 'verification_failure',
        message: confirmation.message || 'Route verification failed',
        reason: confirmation.reason || 'unknown',
        routeErrors: confirmation.errors || [],
        timestamp: new Date().toISOString(),
      });

      // Send response
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'failure_acknowledged' }));

      console.log('   ❌ Failure notification acknowledged');
      console.log(
        `   📨 Message ${proverResults.confirmation.receivedCount}/${proverResults.confirmation.expectedCount} received`
      );

      // Check if we have received all expected messages (both successes and failures)
      if (
        proverResults.confirmation.receivedCount >=
        proverResults.confirmation.expectedCount
      ) {
        console.log(
          `\n📋 All ${proverResults.confirmation.expectedCount} messages received!`
        );

        // Calculate summary statistics
        const totalSuccesses = proverResults.confirmation.confirmations.filter(
          c => c.status === 'completed'
        ).length;
        const totalFailures = proverResults.confirmation.confirmations.filter(
          c => c.status === 'failed'
        ).length;

        console.log(`   ✅ Successful routes: ${totalSuccesses}`);
        console.log(`   ❌ Failed routes: ${totalFailures}`);

        // Mark overall session based on results
        const sessionStatus = totalFailures > 0 ? 'mixed' : 'completed';
        const sessionMessage = `${totalSuccesses} successful, ${totalFailures} failed routes`;

        proverResults.confirmation.received = true;
        proverResults.confirmation.timestamp = new Date().toISOString();
        proverResults.confirmation.status = sessionStatus;
        proverResults.confirmation.message = sessionMessage;

        // Clean up AES keys from memory for security
        console.log('   🧹 Cleaning up AES keys from memory...');
        const keyCount = proverAESKeys.size;
        proverAESKeys.clear();
        console.log(`   🗑️  Removed ${keyCount} AES keys from memory`);

        // Save results and shutdown gracefully
        console.log('\n✅ Verification flow completed!');
        server.close(() => {
          console.log('🛑 Challenge server stopped');
          saveResults(sessionStatus, sessionMessage);
          console.log(`🎯 Prover session completed: ${sessionMessage}`);
          process.exit(totalFailures > 0 ? 1 : 0); // Exit with error code if any failures
        });
      } else {
        console.log(
          `   ⏳ Waiting for ${proverResults.confirmation.expectedCount - proverResults.confirmation.receivedCount} more message(s)...`
        );
      }

      return;
    }

    // Handle success message (existing logic)
    console.log('   ✅ Received verification success confirmation');

    // Validate route signatures if routes are present
    if (confirmation.routes && Array.isArray(confirmation.routes)) {
      const validationResult = validateRouteSignatures(confirmation.routes);
      if (!validationResult.success) {
        throw new Error(
          `Route signature validation failed: ${validationResult.errors.join(', ')}`
        );
      }
      console.log(
        `   ✅ ${validationResult.validCount} route signatures validated`
      );
    }

    // Track confirmation received
    proverResults.confirmation.receivedCount++;
    proverResults.confirmation.confirmations.push({
      timestamp: new Date().toISOString(),
      status: confirmation.status || 'completed',
      message: confirmation.message || 'Verification completed successfully',
      addr: confirmation.addr || 'unknown',
      verifiedRoutes: confirmation.verifiedRoutes || 0,
      totalRoutes: confirmation.totalRoutes || 0,
    });

    const latestConfirmation =
      proverResults.confirmation.confirmations[
        proverResults.confirmation.confirmations.length - 1
      ];

    console.log(
      `   📨 Confirmation ${proverResults.confirmation.receivedCount}/${proverResults.confirmation.expectedCount} received`
    );
    console.log(`   Contract: ${latestConfirmation.addr}`);
    console.log(`   Status: ${latestConfirmation.status}`);
    console.log(`   Message: ${latestConfirmation.message}`);
    console.log(
      `   Verified Routes: ${latestConfirmation.verifiedRoutes}/${latestConfirmation.totalRoutes}`
    );

    // Send successful response
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'received',
        timestamp: Date.now(),
        message: 'Confirmation processed successfully',
      })
    );

    console.log('   ✅ Confirmation acknowledged');

    // Check if we have received all expected confirmations
    if (
      proverResults.confirmation.receivedCount >=
      proverResults.confirmation.expectedCount
    ) {
      console.log(
        `\n🎯 All ${proverResults.confirmation.expectedCount} confirmations received!`
      );

      // Mark overall confirmation as received
      proverResults.confirmation.received = true;
      proverResults.confirmation.timestamp = new Date().toISOString();
      proverResults.confirmation.status = 'completed';
      proverResults.confirmation.message = `All ${proverResults.confirmation.expectedCount} routes analyzed by the proxy`;

      // Clean up AES keys from memory for security
      console.log('   🧹 Cleaning up AES keys from memory...');
      const keyCount = proverAESKeys.size;
      proverAESKeys.clear();
      console.log(`   🗑️  Removed ${keyCount} AES keys from memory`);

      // Save results and shutdown
      console.log('\n✅ Verification flow completed successfully!');
      server.close(() => {
        console.log('🛑 Challenge server stopped');
        saveResults(
          'completed',
          'Verification flow completed with confirmation from proxy'
        );
        console.log('🎯 Prover session completed successfully');
        process.exit(0);
      });
    } else if (proverResults.confirmation.expectedCount === 0) {
      // Fallback for backwards compatibility - if expectedCount was never set,
      // behave like the old version and shutdown after first confirmation
      console.log(
        `\n⚠️  Expected count not set - using legacy single confirmation mode`
      );

      // Mark overall confirmation as received
      proverResults.confirmation.received = true;
      proverResults.confirmation.timestamp = new Date().toISOString();
      proverResults.confirmation.status = 'completed';
      proverResults.confirmation.message =
        'Verification completed successfully (legacy mode)';

      // Clean up AES keys from memory for security
      console.log('   🧹 Cleaning up AES keys from memory...');
      const keyCount = proverAESKeys.size;
      proverAESKeys.clear();
      console.log(`   🗑️  Removed ${keyCount} AES keys from memory`);

      // Save results and shutdown
      console.log('\n✅ Verification flow completed successfully!');
      server.close(() => {
        console.log('🛑 Challenge server stopped');
        saveResults(
          'completed',
          'Verification flow completed with confirmation from proxy'
        );
        console.log('🎯 Prover session completed successfully');
        process.exit(0);
      });
    } else {
      console.log(
        `   ⏳ Waiting for ${proverResults.confirmation.expectedCount - proverResults.confirmation.receivedCount} more confirmation(s)...`
      );
    }
  } catch (error) {
    console.log(`   ❌ Confirmation handling error: ${error.message}`);

    // Track confirmation error
    proverResults.confirmation.confirmations.push({
      timestamp: new Date().toISOString(),
      status: 'error',
      message: error.message,
      addr: 'unknown',
      verifiedRoutes: 0,
      totalRoutes: 0,
    });

    proverResults.errors.push({
      type: 'confirmation_error',
      message: error.message,
      timestamp: new Date().toISOString(),
    });

    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: error.message,
        status: 'failed',
      })
    );
  }
}

async function initPairingWithProxy() {
  console.log('🔐 Encrypted Message Sender Prover');
  console.log('=================================\n');

  try {
    // Get configured topic ID if available
    const configuredTopicId = process.env.PROVER_HEDERA_TOPIC_ID;

    let topicId, publicKey, hederaNetwork;

    if (configuredTopicId) {
      console.log(
        '1️⃣  Using configured topic ID, fetching public key from HCS topic...'
      );
      console.log(`   📋 Configured Topic ID: ${configuredTopicId}`);

      try {
        // Fetch status to get the public key (we'll use our configured topic instead of the one from status)
        // Use HederaManager to fetch the public key from the first message in the topic
        publicKey = await HederaManager.fetchPublicKeyFromTopicFirstMessage(
          configuredTopicId,
          PROVER_HEDERA_NETWORK
        );
        topicId = configuredTopicId; // Use our configured topic ID
        hederaNetwork = PROVER_HEDERA_NETWORK; // Use configured network

        console.log(
          '✅ Successfully retrieved status with configured topic override'
        );
        console.log(`   🔑 Public Key: ${publicKey.substring(0, 50)}...`);
        console.log(`   📋 Using Topic ID: ${topicId} (configured)`);
        console.log(`   🌐 Network: ${hederaNetwork}`);

        // Track status info for configured topic scenario
        proverResults.session.proxyUrl = PROVER_PROXY_SERVER_URL;
        proverResults.session.hederaNetwork = hederaNetwork;
        proverResults.session.topicId = topicId;
      } catch (configError) {
        console.log(
          `⚠️  Failed to get status with configured topic (${configError.message})`
        );
        console.log('   📡 This means the proxy server is not reachable');
        throw new Error(
          `Cannot reach proxy server to get public key: ${configError.message}`
        );
      }
    } else {
      console.log(
        '1️⃣  No configured topic ID - fetching status from proxy server...'
      );
      const status = await fetchStatus();
      topicId = status.topicId;
      publicKey = status.publicKey;
      hederaNetwork = status.hederaNetwork;

      console.log('📊 Status received:');
      console.log(`   📋 Topic ID: ${topicId}`);
      console.log(`   🌐 Network: ${hederaNetwork}`);
      console.log(`   🔑 Has Public Key: ${!!publicKey}`);
    }

    // Validate required data
    if (!topicId) {
      throw new Error(
        'Topic ID not available. Make sure the proxy server is running and has initialized a topic.'
      );
    }

    if (!publicKey) {
      throw new Error(
        'Public key not available. Make sure the proxy server has initialized RSA keys.'
      );
    }

    // Step 2: Create a test payload
    console.log('2️⃣  Creating test payload...');

    // Create a test payload for the prover with a single route and signature

    const privateKey =
      process.env.PROVER_HEDERA_PRIVATE_KEY ||
      process.env.PROVER_HEDERA_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error(
        'PROVER_HEDERA_PRIVATE_KEY (or PROVER_HEDERA_PRIVATE_KEY) not set in environment'
      );
    }

    // Create wallet and get address for logging
    const wallet = new ethers.Wallet(privateKey);
    const signerAddress = wallet.address;
    console.log(`🔑 Signer address: ${signerAddress}`);

    // Function to sign the route data (addr+proofType+nonce+url)
    const signRouteData = async (addr, proofType, nonce, url) => {
      try {
        // Create wallet from private key
        const wallet = new ethers.Wallet(privateKey);

        // Create the message to sign by concatenating addr+proofType+nonce+url
        const message = addr + proofType + nonce + url;

        // Sign the message using ethers signMessage (EIP-191 standard)
        const signature = await wallet.signMessage(message);

        console.log(`🔑 Signed data: ${addr}+${proofType}+${nonce}+${url}`);
        console.log(`📝 Signature: ${signature.slice(0, 20)}...`);

        return signature;
      } catch (error) {
        console.error('Error signing route data:', error.message);
        throw error;
      }
    };

    // Create test routes from environment configuration or use defaults
    const routeConfigs = [];

    // Parse routes from environment variables
    let routeIndex = 1;
    // example format for create: PROVER_ROUTE_1="0x1234567890abcdef,http://example.com,create,42"
    // example format for create2: PROVER_ROUTE_2="0x1234567890abcdef,http://example.com,create2,0x0000000000000000000000000000000000000000000000000000000000000001,0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"
    while (process.env[`PROVER_ROUTE_${routeIndex}`]) {
      const routeString = process.env[`PROVER_ROUTE_${routeIndex}`];
      const parts = routeString.split(',').map(part => part.trim());

      if (parts.length < 2) {
        console.warn(
          `⚠️  Skipping invalid route ${routeIndex}: expected at least addr,proofType`
        );
        routeIndex++;
        continue;
      }

      const routeConfig = {
        addr: parts[0],
        url: parts[1],
        proofType: parts[2],
      };

      // Handle CREATE2-specific fields
      if (routeConfig.proofType === 'create2') {
        routeConfig.salt =
          parts[3] ||
          '0x0000000000000000000000000000000000000000000000000000000000000001';
        routeConfig.initCodeHash =
          parts[4] ||
          '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470';
      } else {
        // For non-CREATE2 routes, use nonce
        routeConfig.nonce = parts[3];
      }

      routeConfigs.push(routeConfig);
      routeIndex++;
    }

    // If no routes configured in environment, stop the process
    if (routeConfigs.length === 0) {
      console.log('📋 No routes configured in environment, exiting process');
      process.exit(0);
    }

    // Sign all routes and create the final routes array
    const routes = [];
    for (let i = 0; i < routeConfigs.length; i++) {
      const config = routeConfigs[i];
      const route = { ...config };

      if (config.proofType === 'create2') {
        route.sig = await signRouteData(
          config.addr,
          config.proofType,
          config.salt,
          config.url
        );
      } else {
        route.sig = await signRouteData(
          config.addr,
          config.proofType,
          config.nonce,
          config.url
        );
      }

      console.log(
        `🔑 Signed route ${i + 1}: ${config.addr} (${config.proofType})`
      );
      routes.push(route);
    }

    const payload = {
      routes: routes,
    };

    // Generate and store AES keys for each contract address
    console.log('🔑 Generating AES key for encrypted communications...');
    const aesKey = generateAESKey();

    // Store the AES key for all contract addresses in this message
    for (const route of payload.routes) {
      proverAESKeys.set(route.addr.toLowerCase(), aesKey);
      console.log(`   🔐 Stored AES key for contract: ${route.addr}`);
    }

    // Track payload creation
    proverResults.payload.created = true;

    // Set expected confirmation count based on number of routes submitted
    proverResults.confirmation.expectedCount = payload.routes.length;
    console.log(
      `📊 Expecting ${proverResults.confirmation.expectedCount} confirmations (one per route)`
    );

    const payloadJson = JSON.stringify(payload);
    proverResults.payload.originalSize = payloadJson.length;

    console.log('📦 Test payload created:');
    console.log(payloadJson);
    console.log('');

    // Step 3: Encrypt the payload using the generated AES key
    console.log('3️⃣  Encrypting payload with specific AES key...');
    const encryptedPayload = encryptHybridMessageWithKey(
      publicKey,
      payloadJson,
      aesKey,
      true // verbose logging
    );

    // Track encryption
    proverResults.payload.encryptedSize = encryptedPayload.length;

    // Step 4: Start challenge server before sending message
    console.log('4️⃣  Starting challenge server...');
    const challengeServer = await startChallengeServer(publicKey, privateKey);

    // Step 5: Send encrypted message to topic
    console.log('5️⃣  Sending encrypted message to Hedera topic...');
    await sendEncryptedMessage(topicId, encryptedPayload);

    console.log('\n🎉 Message sent successfully!');
    console.log('📝 Summary:');
    console.log(`   - Topic ID: ${topicId}`);
    console.log(`   - Original payload size: ${payloadJson.length} bytes`);
    console.log(
      `   - Encrypted payload size: ${encryptedPayload.length} bytes`
    );
    console.log(`   - Challenge server: http://localhost:${PROVER_PORT}`);

    console.log('\n⏳ Waiting for challenge-response verification...');
    console.log(
      '   The proxy will now send challenges to verify URL reachability.'
    );
    console.log('   This prover will respond to challenges automatically.');
    console.log(
      '   When verification is complete, the proxy will send confirmation.'
    );

    // Set up timeout protection (fallback in case confirmation never arrives)
    const maxWaitTime = 300000; // 5 minutes maximum wait
    const timeoutId = setTimeout(() => {
      console.log('\n⏰ Maximum wait time reached (5 minutes)');
      console.log('   No confirmation received from proxy');
      challengeServer.close(() => {
        console.log('🛑 Challenge server stopped');
        saveResults(
          'timeout',
          'Maximum wait time reached without receiving confirmation from proxy'
        );
        console.log('⚠️  Prover session timed out');
        process.exit(0);
      });
    }, maxWaitTime);

    // Remove the function since we no longer use activity-based completion
    global.updateLastChallengeTime = null;

    console.log('\n🔄 Waiting for confirmation from proxy...');
    console.log(
      `   Expected challenges: ${payload.routes.length} for ${payload.routes.length} route(s)`
    );
    console.log(
      '   Will complete when proxy sends confirmation to /confirmation endpoint'
    );

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n\n🛑 Received shutdown signal...');
      clearTimeout(timeoutId);
      challengeServer.close(() => {
        console.log('🛑 Challenge server stopped');
        saveResults('interrupted', 'Process interrupted by user');
        console.log('⚠️  Prover session interrupted');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('❌ Prover failed:', error.message);

    // Save error results
    proverResults.errors.push({
      type: 'main_error',
      message: error.message,
      timestamp: new Date().toISOString(),
    });

    saveResults('failed', `Prover failed: ${error.message}`);

    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Make sure the proxy server is running (npm start)');
    console.error('   2. Verify Hedera credentials are configured');
    console.error('   3. Check that RSA keys have been generated');
    console.error('   4. Ensure the topic has been initialized');
    console.error('   5. Check that the prover port is available');
    process.exit(1);
  }
}

// Run the prover
initPairingWithProxy().catch(console.error);
