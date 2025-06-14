const { Client, PrivateKey, AccountId } = require('@hashgraph/sdk');
const { makeHttpRequest } = require('./httpUtils');
/**
 * Common Hedera utilities shared between prover and proxy
 */

/**
 * Initialize Hedera client with support for both ECDSA and Ed25519 keys
 * @param {Object} config - Configuration object
 * @returns {Object} Initialized client and metadata
 */
function initHederaClient(config) {
  const {
    accountId,
    privateKey,
    network = 'testnet',
    keyType = 'ECDSA',
  } = config;

  if (!accountId || !privateKey) {
    throw new Error(
      'Hedera credentials not provided. Please set accountId and privateKey'
    );
  }

  try {
    const hederaAccountId = AccountId.fromString(accountId);

    // Support both ECDSA and Ed25519 private keys
    let hederaPrivateKey;
    if (keyType === 'ECDSA' || privateKey.startsWith('0x')) {
      // ECDSA private key (hex format)
      hederaPrivateKey = PrivateKey.fromStringECDSA(privateKey);
    } else {
      // Ed25519 private key (original format)
      hederaPrivateKey = PrivateKey.fromString(privateKey);
    }

    // Create client for the appropriate network
    const client =
      network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();

    client.setOperator(hederaAccountId, hederaPrivateKey);

    return {
      client,
      accountId: hederaAccountId,
      privateKey: hederaPrivateKey,
      network,
      keyType:
        keyType === 'ECDSA' || privateKey.startsWith('0x')
          ? 'ECDSA'
          : 'Ed25519',
    };
  } catch (error) {
    throw new Error(`Failed to initialize Hedera client: ${error.message}`);
  }
}

/**
 * Get mirror node URL for the specified network
 * @param {string} network - Network name (testnet, mainnet)
 * @returns {string} Mirror node URL
 */
function getMirrorNodeUrl(network) {
  switch (network.toLowerCase()) {
    case 'mainnet':
      return 'https://mainnet.mirrornode.hedera.com';
    case 'testnet':
    default:
      return 'https://testnet.mirrornode.hedera.com';
  }
}

/**
 * Validate Hedera account ID format
 * @param {string} accountId - Account ID to validate
 * @returns {boolean} True if valid
 */
function isValidAccountId(accountId) {
  if (!accountId || typeof accountId !== 'string') {
    return false;
  }

  // Format: 0.0.123456
  const pattern = /^0\.0\.\d+$/;
  return pattern.test(accountId);
}

/**
 * Validate Hedera topic ID format
 * @param {string} topicId - Topic ID to validate
 * @returns {boolean} True if valid
 */
function isValidTopicId(topicId) {
  if (!topicId || typeof topicId !== 'string') {
    return false;
  }

  // Format: 0.0.123456
  const pattern = /^0\.0\.\d+$/;
  return pattern.test(topicId);
}

/**
 * Validate Hedera private key format
 * @param {string} privateKey - Private key to validate
 * @param {string} keyType - Expected key type (ECDSA or Ed25519)
 * @returns {Object} Validation result
 */
function validatePrivateKey(privateKey, keyType = 'ECDSA') {
  if (!privateKey || typeof privateKey !== 'string') {
    return {
      valid: false,
      error: 'Private key is required and must be a string',
    };
  }

  try {
    if (keyType === 'ECDSA' || privateKey.startsWith('0x')) {
      // ECDSA key validation
      if (!privateKey.startsWith('0x') || privateKey.length !== 66) {
        return {
          valid: false,
          error:
            'ECDSA private key must start with 0x and be 64 hex characters (66 total)',
        };
      }
      PrivateKey.fromStringECDSA(privateKey);
    } else {
      // Ed25519 key validation
      PrivateKey.fromString(privateKey);
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Invalid private key format: ${error.message}`,
    };
  }
}

/**
 * Convert Hedera timestamp to JavaScript Date
 * @param {Object} hederaTimestamp - Hedera timestamp object
 * @returns {Date} JavaScript Date object
 */
function hederaTimestampToDate(hederaTimestamp) {
  if (!hederaTimestamp) return null;

  // Hedera timestamp has seconds and nanos
  const seconds = hederaTimestamp.seconds || 0;
  const nanos = hederaTimestamp.nanos || 0;

  return new Date(seconds * 1000 + Math.floor(nanos / 1000000));
}

/**
 * Parse Hedera topic message
 * @param {Object} message - Raw Hedera topic message
 * @returns {Object} Parsed message with metadata
 */
function parseTopicMessage(message) {
  try {
    return {
      consensusTimestamp: hederaTimestampToDate(message.consensusTimestamp),
      sequenceNumber: message.sequenceNumber,
      runningHash: message.runningHash,
      contents: Buffer.from(message.contents, 'base64').toString('utf8'),
      topicId: message.topicId,
      payer: message.payer,
    };
  } catch (error) {
    throw new Error(`Failed to parse topic message: ${error.message}`);
  }
}

// Fetch current HBAR-to-USD exchange rate from Hedera mirror node
async function getExchangeRate(mirrorNodeUrl = 'testnet') {
  try {
    const url = `https://${mirrorNodeUrl}.mirrornode.hedera.com/api/v1/network/exchangerate`;

    const response = await makeHttpRequest(url, {
      method: 'GET',
      timeout: 5000,
    });

    if (response.statusCode === 200) {
      const data = response.json || JSON.parse(response.body);
      if (
        data.current_rate &&
        data.current_rate.cent_equivalent &&
        data.current_rate.hbar_equivalent
      ) {
        return data.current_rate;
      } else {
        throw new Error('Invalid exchange rate response format');
      }
    } else {
      throw new Error(
        `Exchange rate API returned status ${response.statusCode}: ${response.body}`
      );
    }
  } catch (error) {
    throw new Error(`Exchange rate fetch failed: ${error.message}`);
  }
}

/**
 * Convert cents to HBAR based on current exchange rate
 * @param {number} cents - Amount in cents to convert
 * @returns {Promise<number>} Equivalent amount in HBAR
 */
async function centsToHBAR(cents) {
  if (typeof cents !== 'number' || cents < 0) {
    throw new Error('Invalid cents value. Must be a non-negative number.');
  }
  console.log('📊 Fetching current HBAR-to-USD exchange rate...');
  // Fetch current exchange rate
  const exchangeRate = await getExchangeRate();
  const { cent_equivalent, hbar_equivalent } = exchangeRate;
  // Calculate cents per HBAR
  const centsPerHbar = cent_equivalent / hbar_equivalent;
  const hbarFor1Dollar = 100 / centsPerHbar;
  console.log(
    `💰 Exchange rate: ${cent_equivalent} cents = ${hbar_equivalent} HBAR. ~${centsPerHbar.toFixed(2)} cents per HBAR, $1.00 USD = ${hbarFor1Dollar.toFixed(6)} HBAR`
  );
  return cents / centsPerHbar;
}

/**
 * Convert cents to tinybars based on current exchange rate
 * @param {number} cents - Amount in cents to convert
 * @returns {Promise<number>} Equivalent amount in tinybars
 */
async function centsToTinybars(cents) {
  return Math.round((await centsToHBAR(cents)) * 100_000_000);
}

/**
 * Common Hedera error types
 */
const HederaErrorTypes = {
  INVALID_ACCOUNT_ID: 'invalid_account_id',
  INVALID_TOPIC_ID: 'invalid_topic_id',
  INVALID_PRIVATE_KEY: 'invalid_private_key',
  CLIENT_INIT_FAILED: 'client_init_failed',
  TOPIC_NOT_FOUND: 'topic_not_found',
  INSUFFICIENT_BALANCE: 'insufficient_balance',
  NETWORK_ERROR: 'network_error',
};

module.exports = {
  initHederaClient,
  getExchangeRate,
  centsToHBAR,
  centsToTinybars,
  getMirrorNodeUrl,
  isValidAccountId,
  isValidTopicId,
  validatePrivateKey,
  hederaTimestampToDate,
  parseTopicMessage,
  HederaErrorTypes,
};
