const crypto = require('crypto');

// Crypto Utilities Module
// Handles hybrid RSA+AES encryption and decryption functionality
// Used for encrypting/decrypting messages sent to Hedera topics

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

// Note: CREATE2 support will be added in the future
// TODO: Add getContractAddressFromCreate2(deployerAddress, salt, initCodeHash)

module.exports = {
  encryptHybridMessage,
  decryptHybridMessage,
  isEncryptedMessage,
  verifyECDSASignature,
  getContractAddressFromCreate,
  generateChallenge,
  verifyChallenge,
  signChallengeResponse,
  verifyChallengeResponse,
};
