/**
 * @hiero-json-rpc-relay/common
 *
 * Common utilities and shared code for the Hiero JSON-RPC Relay system.
 * This package provides reusable components for cryptography, HTTP handling,
 * validation, environment loading, and Hedera integration.
 */

// Core utilities
const cryptoUtils = require('./cryptoUtils');
const envLoader = require('./envLoader');
const httpUtils = require('./httpUtils');
const validation = require('./validation');
const hederaUtils = require('./hederaUtils');
const messageUtils = require('./messageUtils');
const databaseUtils = require('./databaseUtils');
const ethUtils = require('./ethUtils');

// Re-export all utilities for easy access
module.exports = {
  // Crypto utilities
  ...cryptoUtils,

  // Environment loading
  loadEnvFile: envLoader.loadEnvFile,

  // HTTP utilities
  ...httpUtils,

  // Validation utilities
  ...validation,

  // Hedera utilities
  ...hederaUtils,

  // Message utilities
  ...messageUtils,

  // Database utilities
  ...databaseUtils,

  // Ethereum utilities
  ...ethUtils,

  // Grouped exports for namespace organization
  crypto: cryptoUtils,
  env: envLoader,
  http: httpUtils,
  validation: validation,
  hedera: hederaUtils,
  message: messageUtils,
  database: databaseUtils,
  eth: ethUtils,
};
