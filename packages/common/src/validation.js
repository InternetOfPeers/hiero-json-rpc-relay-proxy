const { ethers } = require('ethers');
const {
  verifyECDSASignature,
  getContractAddressFromCreate,
  getContractAddressFromCreate2,
} = require('./cryptoUtils');

/**
 * Common validation utilities shared between prover and proxy
 */

/**
 * Validate route signatures for an array of routes
 * @param {Array} routes - Array of route objects with addr, proofType, nonce, url, sig
 * @param {string} privateKey - Private key for validation (optional, used in prover)
 * @returns {Object} Validation result with success flag and details
 */
function validateRouteSignatures(routes, privateKey = null) {
  const result = {
    success: true,
    validCount: 0,
    invalidCount: 0,
    validRoutes: [],
    invalidRoutes: [],
    derivedSignerAddress: null,
    errors: [],
  };

  if (!routes || !Array.isArray(routes)) {
    result.success = false;
    result.errors.push('Routes must be a valid array');
    return result;
  }

  for (const route of routes) {
    try {
      // Check basic required fields
      if (!route.addr || !route.proofType || !route.url) {
        result.invalidCount++;
        result.invalidRoutes.push({
          route,
          error: 'Missing required fields (addr, proofType, url)',
        });
        continue;
      }

      // Check proof type specific fields
      if (route.proofType === 'create') {
        if (route.nonce === undefined) {
          result.invalidCount++;
          result.invalidRoutes.push({
            route,
            error: 'CREATE proof type requires nonce field',
          });
          continue;
        }
      } else if (route.proofType === 'create2') {
        if (!route.salt || !route.initCodeHash) {
          result.invalidCount++;
          result.invalidRoutes.push({
            route,
            error: 'CREATE2 proof type requires salt and initCodeHash fields',
          });
          continue;
        }
      }

      // Check signature
      if (!route.sig) {
        result.invalidCount++;
        result.invalidRoutes.push({
          route,
          error: 'Missing signature',
        });
        continue;
      }

      // Verify signature - message format depends on proof type
      let message;
      if (route.proofType === 'create') {
        message = route.addr + route.proofType + route.nonce + route.url;
      } else if (route.proofType === 'create2') {
        message = route.addr + route.proofType + route.salt + route.url;
      } else {
        message =
          route.addr +
          route.proofType +
          (route.nonce || route.salt || '') +
          route.url;
      }

      let signerAddress;
      if (privateKey) {
        // Prover mode - use provided private key
        const wallet = new ethers.Wallet(privateKey);
        const expectedSigner = wallet.address.toLowerCase();
        signerAddress = ethers.verifyMessage(message, route.sig).toLowerCase();

        if (signerAddress !== expectedSigner) {
          result.invalidCount++;
          result.invalidRoutes.push({
            route,
            error: `Invalid signature - expected signer ${expectedSigner}, got ${signerAddress}`,
          });
          continue;
        }
      } else {
        // Proxy mode - derive signer from signature
        signerAddress = ethers.verifyMessage(message, route.sig).toLowerCase();

        // For first signature, establish expected signer
        if (!result.derivedSignerAddress) {
          result.derivedSignerAddress = signerAddress;
        }

        // Check if this signature matches the established signer
        if (signerAddress !== result.derivedSignerAddress) {
          result.invalidCount++;
          result.invalidRoutes.push({
            route,
            error: `Inconsistent signer - expected ${result.derivedSignerAddress}, got ${signerAddress}`,
          });
          continue;
        }
      }

      // Verify contract ownership
      if (route.proofType === 'create') {
        const computedAddress = getContractAddressFromCreate(
          result.derivedSignerAddress || signerAddress,
          route.nonce
        );

        if (
          !computedAddress ||
          computedAddress.toLowerCase() !== route.addr.toLowerCase()
        ) {
          result.invalidCount++;
          result.invalidRoutes.push({
            route,
            error: `Invalid contract ownership - computed ${computedAddress}, expected ${route.addr}`,
          });
          continue;
        }
      } else if (route.proofType === 'create2') {
        // Validate required fields for CREATE2
        if (!route.salt || !route.initCodeHash) {
          result.invalidCount++;
          result.invalidRoutes.push({
            route,
            error: `CREATE2 proof type requires 'salt' and 'initCodeHash' fields`,
          });
          continue;
        }

        const computedAddress = getContractAddressFromCreate2(
          result.derivedSignerAddress || signerAddress,
          route.salt,
          route.initCodeHash
        );

        if (
          !computedAddress ||
          computedAddress.toLowerCase() !== route.addr.toLowerCase()
        ) {
          result.invalidCount++;
          result.invalidRoutes.push({
            route,
            error: `Invalid CREATE2 contract ownership - computed ${computedAddress}, expected ${route.addr}`,
          });
          continue;
        }
      } else if (route.proofType) {
        // Unknown proof type
        result.invalidCount++;
        result.invalidRoutes.push({
          route,
          error: `Unsupported proof type: ${route.proofType}. Supported types: 'create', 'create2'`,
        });
        continue;
      }

      result.validCount++;
      result.validRoutes.push(route);
    } catch (error) {
      result.invalidCount++;
      result.invalidRoutes.push({
        route,
        error: `Signature verification error: ${error.message}`,
      });
    }
  }

  result.success = result.invalidCount === 0;
  return result;
}

/**
 * Create a standardized route signature
 * @param {string} addr - Contract address
 * @param {string} proofType - Proof type (create, create2)
 * @param {number|string} nonceOrSalt - Nonce value for CREATE or salt for CREATE2
 * @param {string} url - URL endpoint
 * @param {string} privateKey - Private key for signing
 * @returns {Promise<string>} Signature
 */
async function signRouteData(addr, proofType, nonceOrSalt, url, privateKey) {
  try {
    const wallet = new ethers.Wallet(privateKey);
    const message = addr + proofType + nonceOrSalt + url;
    return await wallet.signMessage(message);
  } catch (error) {
    throw new Error(`Failed to sign route data: ${error.message}`);
  }
}

/**
 * Common error types used across the system
 */
const ErrorTypes = {
  INVALID_SIGNATURE: 'invalid_signature',
  MISSING_SIGNATURE: 'missing_signature',
  INVALID_OWNERSHIP: 'invalid_ownership',
  MISSING_FIELDS: 'missing_fields',
  VERIFICATION_ERROR: 'verification_error',
  ENCRYPTION_ERROR: 'encryption_error',
  NETWORK_ERROR: 'network_error',
  TIMEOUT_ERROR: 'timeout_error',
};

/**
 * Create a standardized error object
 * @param {string} type - Error type from ErrorTypes
 * @param {string} message - Error message
 * @param {Object} details - Additional error details
 * @returns {Object} Standardized error object
 */
function createError(type, message, details = {}) {
  return {
    type,
    message,
    timestamp: new Date().toISOString(),
    ...details,
  };
}

/**
 * Common configuration validation
 * @param {Object} config - Configuration object
 * @param {Array} requiredFields - Array of required field names
 * @returns {Object} Validation result
 */
function validateConfig(config, requiredFields) {
  const missing = requiredFields.filter(field => !config[field]);
  return {
    valid: missing.length === 0,
    missing,
    errors: missing.map(field => `Missing required configuration: ${field}`),
  };
}

module.exports = {
  validateRouteSignatures,
  signRouteData,
  ErrorTypes,
  createError,
  validateConfig,
};
