const crypto = require('crypto');

// Crypto Utilities Module
// Handles RSA key management, hybrid RSA+AES encryption and decryption functionality
// Used for encrypting/decrypting messages sent to Hedera topics

/**
 * Generate RSA key pair
 * @returns {Object} Object with publicKey and privateKey in PEM format
 */
function generateRSAKeyPair() {
  try {
    console.log('Generating new RSA key pair...');
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048, // Key size in bits
      publicKeyEncoding: {
        type: 'spki', // Subject Public Key Info
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8', // Public Key Cryptography Standards #8
        format: 'pem',
      },
    });

    console.log('✅ RSA key pair generated successfully');
    return { publicKey, privateKey };
  } catch (error) {
    console.error('Failed to generate RSA key pair:', error.message);
    throw error;
  }
}

/**
 * Store RSA key pair with metadata
 * @param {Object} keyPair - Object with publicKey and privateKey (optional, will generate if not provided)
 * @returns {Object} Object with keyPair and metadata
 */
function createRSAKeyPairWithMetadata(keyPair) {
  const keys = keyPair || generateRSAKeyPair();
  return {
    keyPair: {
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
    },
    metadata: {
      algorithm: 'RSA-2048',
      createdAt: new Date().toISOString(),
    },
  };
}

/**
 * Validate RSA key pair structure
 * @param {Object} keyPair - Key pair object to validate
 * @returns {Object} Validation result with valid boolean and errors array
 */
function validateRSAKeyPair(keyPair) {
  const errors = [];

  if (!keyPair) {
    errors.push('Key pair is null or undefined');
    return { valid: false, errors };
  }

  if (!keyPair.publicKey) {
    errors.push('Missing public key');
  } else if (!keyPair.publicKey.includes('BEGIN PUBLIC KEY')) {
    errors.push('Invalid public key format');
  }

  if (!keyPair.privateKey) {
    errors.push('Missing private key');
  } else if (!keyPair.privateKey.includes('BEGIN PRIVATE KEY')) {
    errors.push('Invalid private key format');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Encrypt data using hybrid encryption (RSA + AES)
 * @param {string} publicKeyPem - RSA public key in PEM format
 * @param {string} data - Data to encrypt
 * @param {boolean} verbose - Whether to log verbose output (default: false)
 * @returns {string} JSON string containing encrypted payload
 */
function encryptHybridMessage(publicKeyPem, data, verbose = false) {
  try {
    if (verbose) {
      console.log(
        '🔐 Encrypting payload with hybrid encryption (RSA + AES)...'
      );
    }

    // Generate a random AES key (256-bit) and IV
    const aesKey = crypto.randomBytes(32);
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

    // Return the JSON payload directly (not base64 encoded)
    const jsonPayload = JSON.stringify(hybridPayload);

    if (verbose) {
      console.log(
        `✅ Payload encrypted successfully with hybrid encryption (${jsonPayload.length} characters)`
      );
    }

    return jsonPayload;
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

/**
 * Decrypt hybrid RSA+AES encrypted messages
 * @param {string} encryptedBase64 - JSON string containing encrypted payload
 * @param {string} privateKeyPem - RSA private key in PEM format
 * @returns {object} Decryption result with success flag and data or error
 */
function decryptHybridMessage(encryptedData, privateKeyPem) {
  try {
    let decodedPayload;

    // Try to parse as JSON first (direct JSON input)
    try {
      const testPayload = JSON.parse(encryptedData);
      // Check if it has the expected structure for encrypted data
      if (testPayload.key && testPayload.iv && testPayload.data) {
        decodedPayload = encryptedData;
      } else {
        throw new Error('Not a valid hybrid payload');
      }
    } catch (jsonError) {
      // If JSON parsing fails, try base64 decoding
      try {
        decodedPayload = Buffer.from(encryptedData, 'base64').toString('utf8');

        // Check if the result is still base64 (double-encoded)
        if (/^[A-Za-z0-9+/]+=*$/.test(decodedPayload)) {
          decodedPayload = Buffer.from(decodedPayload, 'base64').toString(
            'utf8'
          );
        }
      } catch (base64Error) {
        throw new Error('Invalid input: not valid JSON or base64');
      }
    }

    const hybridPayload = JSON.parse(decodedPayload);

    // Validate payload structure
    if (!hybridPayload.key || !hybridPayload.iv || !hybridPayload.data) {
      throw new Error('Invalid hybrid payload structure');
    }

    // Check for unsupported algorithm if specified
    if (hybridPayload.algorithm && hybridPayload.algorithm !== 'RSA+AES') {
      throw new Error('Unsupported encryption algorithm');
    }

    // Decrypt the AES key using RSA private key
    const encryptedAesKey = Buffer.from(hybridPayload.key, 'base64');
    const aesKey = crypto.privateDecrypt(
      {
        key: privateKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      encryptedAesKey
    );

    // Decrypt the data using AES
    const iv = Buffer.from(hybridPayload.iv, 'base64');
    const aesDecipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
    let decryptedData = aesDecipher.update(
      hybridPayload.data,
      'base64',
      'utf8'
    );
    decryptedData += aesDecipher.final('utf8');

    return {
      success: true,
      decryptedData: decryptedData,
      originalLength: encryptedData.length,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Encrypt data using AES-256-CBC with a shared key
 * @param {string} data - Data to encrypt
 * @param {Buffer} aesKey - 32-byte AES key
 * @returns {object} Encrypted payload with IV and data
 */
function encryptAES(data, aesKey) {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);

    let encrypted = cipher.update(data, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    return {
      iv: iv.toString('base64'),
      data: encrypted,
    };
  } catch (error) {
    throw new Error(`AES encryption failed: ${error.message}`);
  }
}

/**
 * Decrypt AES-256-CBC encrypted data
 * @param {object} encryptedPayload - Object with iv and data properties
 * @param {Buffer} aesKey - 32-byte AES key
 * @returns {string} Decrypted data
 */
function decryptAES(encryptedPayload, aesKey) {
  try {
    const iv = Buffer.from(encryptedPayload.iv, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);

    let decrypted = decipher.update(encryptedPayload.data, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    throw new Error(`AES decryption failed: ${error.message}`);
  }
}

/**
 * Generate a random AES key for session encryption
 * @returns {Buffer} 32-byte AES key
 */
function generateAESKey() {
  return crypto.randomBytes(32);
}

/**
 * Extract AES key from hybrid decryption result and return both the data and key
 * @param {string} encryptedData - JSON string containing encrypted payload
 * @param {string} privateKeyPem - RSA private key in PEM format
 * @returns {object} Decryption result with success flag, data, and extracted AES key
 */
function decryptHybridMessageWithKey(encryptedData, privateKeyPem) {
  try {
    let decodedPayload;

    // Try to parse as JSON first (direct JSON input)
    try {
      const testPayload = JSON.parse(encryptedData);
      // Check if it has the expected structure for encrypted data
      if (testPayload.key && testPayload.iv && testPayload.data) {
        decodedPayload = encryptedData;
      } else {
        throw new Error('Not a valid hybrid payload');
      }
    } catch (jsonError) {
      // If JSON parsing fails, try base64 decoding
      try {
        decodedPayload = Buffer.from(encryptedData, 'base64').toString('utf8');

        // Check if the result is still base64 (double-encoded)
        if (/^[A-Za-z0-9+/]+=*$/.test(decodedPayload)) {
          decodedPayload = Buffer.from(decodedPayload, 'base64').toString(
            'utf8'
          );
        }
      } catch (base64Error) {
        throw new Error('Invalid input: not valid JSON or base64');
      }
    }

    const hybridPayload = JSON.parse(decodedPayload);

    // Validate payload structure
    if (!hybridPayload.key || !hybridPayload.iv || !hybridPayload.data) {
      throw new Error('Invalid hybrid payload structure');
    }

    // Check for unsupported algorithm if specified
    if (hybridPayload.algorithm && hybridPayload.algorithm !== 'RSA+AES') {
      throw new Error('Unsupported encryption algorithm');
    }

    // Decrypt the AES key using RSA private key
    const encryptedAesKey = Buffer.from(hybridPayload.key, 'base64');
    const aesKey = crypto.privateDecrypt(
      {
        key: privateKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      encryptedAesKey
    );

    // Decrypt the data using AES
    const iv = Buffer.from(hybridPayload.iv, 'base64');
    const aesDecipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
    let decryptedData = aesDecipher.update(
      hybridPayload.data,
      'base64',
      'utf8'
    );
    decryptedData += aesDecipher.final('utf8');

    return {
      success: true,
      decryptedData: decryptedData,
      aesKey: aesKey, // Return the extracted AES key
      originalLength: encryptedData.length,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Check if a message appears to be encrypted (base64 encoded)
 * @param {string} message - Message to check
 * @returns {boolean} True if message appears to be encrypted
 */
function isEncryptedMessage(message) {
  // Check if the message is base64 encoded and has reasonable length for encrypted data
  return (
    typeof message === 'string' &&
    message.length > 100 && // Encrypted messages should be reasonably long
    /^[A-Za-z0-9+/]+=*$/.test(message) // Base64 pattern
  );
}

/**
 * Verify ECDSA signature for a URL using ethers.js verifyMessage
 * @param {string} url - URL that was signed
 * @param {string} signature - Hex signature to verify (0x prefixed)
 * @param {string} expectedAddress - Expected Ethereum address that should have signed the message
 * @returns {boolean} True if signature is valid
 */
function verifyECDSASignature(url, signature, expectedAddress) {
  try {
    const { ethers } = require('ethers');

    // Verify the message signature using ethers.js
    const recoveredAddress = ethers.verifyMessage(url, signature);

    // Clean addresses for comparison (ensure both are lowercase and properly formatted)
    const cleanExpected = expectedAddress.toLowerCase().startsWith('0x')
      ? expectedAddress.toLowerCase()
      : `0x${expectedAddress.toLowerCase()}`;
    const cleanRecovered = recoveredAddress.toLowerCase();

    console.log('🔐 Signature verification:');
    console.log(`   Message: ${url}`);
    console.log(`   Expected: ${cleanExpected}`);
    console.log(`   Recovered: ${cleanRecovered}`);
    console.log(`   Valid: ${cleanRecovered === cleanExpected}`);

    return cleanRecovered === cleanExpected;
  } catch (error) {
    console.error('Error verifying ECDSA signature:', error.message);
    return false;
  }
}

/**
 * Compute the deterministic contract address for a CREATE deployment
 * @param {string} deployerAddress - Address of the deployer account
 * @param {number} nonce - Nonce of the deployer account
 * @returns {string} The computed contract address (lowercase, 0x prefixed)
 */
function getContractAddressFromCreate(deployerAddress, nonce) {
  try {
    const { ethers } = require('ethers');

    // Clean the deployer address
    const cleanAddress = deployerAddress.toLowerCase().startsWith('0x')
      ? deployerAddress.toLowerCase()
      : `0x${deployerAddress.toLowerCase()}`;

    // Use ethers.js getCreateAddress to compute the deterministic address
    // In ethers v6, it's ethers.getCreateAddress, not ethers.getContractAddress
    const contractAddress = ethers.getCreateAddress({
      from: cleanAddress,
      nonce: nonce,
    });

    return contractAddress.toLowerCase();
  } catch (error) {
    console.error('Error computing contract address:', error.message);
    return null;
  }
}

/**
 * Generate a challenge for URL reachability verification
 * @param {string} privateKeyPem - RSA private key for signing the challenge
 * @param {string} targetUrl - URL being challenged
 * @param {string} contractAddress - Contract address for this challenge
 * @returns {object} Challenge object with challenge data and signature
 */
function generateChallenge(privateKeyPem, targetUrl, contractAddress) {
  try {
    // Generate a random challenge ID and timestamp
    const challengeId = crypto.randomBytes(32).toString('hex');
    const timestamp = Date.now();

    // Create challenge data
    const challengeData = {
      challengeId,
      timestamp,
      url: targetUrl,
      contractAddress: contractAddress.toLowerCase(),
      action: 'url-verification',
    };

    // Sign the challenge with RSA private key
    const challengeString = JSON.stringify(challengeData);
    const signer = crypto.createSign('sha256');
    signer.update(challengeString);
    const signature = signer.sign(privateKeyPem, 'base64');

    return {
      challenge: challengeData,
      signature: signature,
    };
  } catch (error) {
    throw new Error(`Challenge generation failed: ${error.message}`);
  }
}

/**
 * Verify a challenge signature using RSA public key
 * @param {object} challengeData - Challenge data object
 * @param {string} signature - Base64 encoded RSA signature
 * @param {string} publicKeyPem - RSA public key for verification
 * @returns {boolean} True if challenge signature is valid
 */
function verifyChallenge(challengeData, signature, publicKeyPem) {
  try {
    const challengeString = JSON.stringify(challengeData);

    const verifier = crypto.createVerify('sha256');
    verifier.update(challengeString);

    return verifier.verify(publicKeyPem, signature, 'base64');
  } catch (error) {
    console.error('Error verifying challenge:', error.message);
    return false;
  }
}

/**
 * Sign a challenge response using ECDSA
 * @param {object} challengeData - Original challenge data
 * @param {string} ecdsaPrivateKey - ECDSA private key (hex string)
 * @returns {string} ECDSA signature of the challenge
 */
function signChallengeResponse(challengeData, ecdsaPrivateKey) {
  try {
    const { ethers } = require('ethers');

    // Create wallet from private key
    const wallet = new ethers.Wallet(ecdsaPrivateKey);

    // Sign the stringified challenge data
    const challengeString = JSON.stringify(challengeData);
    const signature = wallet.signMessageSync(challengeString);

    return signature;
  } catch (error) {
    throw new Error(`Challenge response signing failed: ${error.message}`);
  }
}

/**
 * Verify a challenge response signature
 * @param {object} challengeData - Original challenge data
 * @param {string} signature - ECDSA signature from prover
 * @param {string} expectedAddress - Expected Ethereum address
 * @returns {boolean} True if signature is valid and from expected address
 */
function verifyChallengeResponse(challengeData, signature, expectedAddress) {
  try {
    const { ethers } = require('ethers');

    const challengeString = JSON.stringify(challengeData);
    const recoveredAddress = ethers.verifyMessage(challengeString, signature);

    const cleanExpected = expectedAddress.toLowerCase().startsWith('0x')
      ? expectedAddress.toLowerCase()
      : `0x${expectedAddress.toLowerCase()}`;
    const cleanRecovered = recoveredAddress.toLowerCase();

    console.log('🔐 Challenge response verification:');
    console.log(
      `   Challenge: ${challengeData.challengeId?.substring(0, 16)}...`
    );
    console.log(`   Expected: ${cleanExpected}`);
    console.log(`   Recovered: ${cleanRecovered}`);
    console.log(`   Valid: ${cleanRecovered === cleanExpected}`);

    return cleanRecovered === cleanExpected;
  } catch (error) {
    console.error('Error verifying challenge response:', error.message);
    return false;
  }
}

/**
 * Compute the deterministic contract address for a CREATE2 deployment
 * @param {string} deployerAddress - Address of the deployer account (factory contract)
 * @param {string} salt - Salt value (32 bytes as hex string)
 * @param {string} initCodeHash - Keccak256 hash of the contract's initialization code
 * @returns {string|null} The computed contract address (lowercase, 0x prefixed) or null if error
 */
function getContractAddressFromCreate2(deployerAddress, salt, initCodeHash) {
  try {
    const { ethers } = require('ethers');

    // Clean the deployer address
    const cleanAddress = deployerAddress.toLowerCase().startsWith('0x')
      ? deployerAddress.toLowerCase()
      : `0x${deployerAddress.toLowerCase()}`;

    // Clean the salt (ensure it's 32 bytes / 64 hex chars)
    let cleanSalt = salt.toLowerCase().startsWith('0x')
      ? salt.slice(2)
      : salt.toLowerCase();

    // Pad salt to 64 hex characters (32 bytes) if needed
    cleanSalt = cleanSalt.padStart(64, '0');

    // Clean the init code hash
    let cleanInitCodeHash = initCodeHash.toLowerCase().startsWith('0x')
      ? initCodeHash.slice(2)
      : initCodeHash.toLowerCase();

    // Validate inputs
    if (!ethers.isAddress(cleanAddress)) {
      throw new Error('Invalid deployer address');
    }

    if (cleanSalt.length !== 64 || !/^[0-9a-f]+$/.test(cleanSalt)) {
      throw new Error('Invalid salt: must be 32 bytes hex string');
    }

    if (
      cleanInitCodeHash.length !== 64 ||
      !/^[0-9a-f]+$/.test(cleanInitCodeHash)
    ) {
      throw new Error('Invalid init code hash: must be 32 bytes hex string');
    }

    // Use ethers.js getCreate2Address to compute the deterministic address
    const contractAddress = ethers.getCreate2Address(
      cleanAddress,
      '0x' + cleanSalt,
      '0x' + cleanInitCodeHash
    );

    return contractAddress.toLowerCase();
  } catch (error) {
    console.error('Error computing CREATE2 contract address:', error.message);
    return null;
  }
}

module.exports = {
  encryptHybridMessage,
  decryptHybridMessage,
  isEncryptedMessage,
  verifyECDSASignature,
  getContractAddressFromCreate,
  getContractAddressFromCreate2,
  generateChallenge,
  verifyChallenge,
  signChallengeResponse,
  verifyChallengeResponse,
  encryptAES,
  decryptAES,
  generateAESKey,
  decryptHybridMessageWithKey,
  generateRSAKeyPair,
  createRSAKeyPairWithMetadata,
  validateRSAKeyPair,
};
