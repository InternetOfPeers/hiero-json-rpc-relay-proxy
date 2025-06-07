const crypto = require("crypto");

// Crypto Utilities Module
// Handles hybrid RSA+AES encryption and decryption functionality
// Used for encrypting/decrypting messages sent to Hedera topics

/**
 * Encrypt data using hybrid encryption (RSA + AES)
 * @param {string} publicKeyPem - RSA public key in PEM format
 * @param {string} data - Data to encrypt
 * @param {boolean} verbose - Whether to log verbose output (default: false)
 * @returns {string} Base64-encoded encrypted payload
 */
function encryptHybridMessage(publicKeyPem, data, verbose = false) {
  try {
    if (verbose) {
      console.log(
        "🔐 Encrypting payload with hybrid encryption (RSA + AES)..."
      );
    }

    // Generate a random AES key (256-bit) and IV
    const aesKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);

    // Encrypt the data with AES-256-CBC
    const aesCipher = crypto.createCipheriv("aes-256-cbc", aesKey, iv);
    let encryptedData = aesCipher.update(data, "utf8", "base64");
    encryptedData += aesCipher.final("base64");

    // Encrypt the AES key with RSA
    const encryptedAesKey = crypto.publicEncrypt(
      {
        key: publicKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      aesKey
    );

    // Combine everything into a single payload
    const hybridPayload = {
      encryptedAesKey: encryptedAesKey.toString("base64"),
      iv: iv.toString("base64"),
      encryptedData: encryptedData,
      algorithm: "hybrid-rsa-aes256",
    };

    const finalPayload = JSON.stringify(hybridPayload);
    const encryptedBase64 = Buffer.from(finalPayload).toString("base64");

    if (verbose) {
      console.log(
        `✅ Payload encrypted successfully with hybrid encryption (${encryptedBase64.length} characters)`
      );
    }

    return encryptedBase64;
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

/**
 * Decrypt hybrid RSA+AES encrypted messages
 * @param {string} encryptedBase64 - Base64-encoded encrypted payload
 * @param {string} privateKeyPem - RSA private key in PEM format
 * @returns {object} Decryption result with success flag and data or error
 */
function decryptHybridMessage(encryptedBase64, privateKeyPem) {
  try {
    // First decode from base64 to get the actual payload
    let decodedPayload = Buffer.from(encryptedBase64, "base64").toString(
      "utf8"
    );

    // Check if the result is still base64 (double-encoded)
    if (decodedPayload.match(/^[A-Za-z0-9+/]+=*$/)) {
      decodedPayload = Buffer.from(decodedPayload, "base64").toString("utf8");
    }

    const hybridPayload = JSON.parse(decodedPayload);

    // Validate payload structure
    if (
      !hybridPayload.encryptedAesKey ||
      !hybridPayload.iv ||
      !hybridPayload.encryptedData
    ) {
      throw new Error("Invalid hybrid payload structure");
    }

    if (hybridPayload.algorithm !== "hybrid-rsa-aes256") {
      throw new Error(
        `Unsupported encryption algorithm: ${hybridPayload.algorithm}`
      );
    }

    // Decrypt the AES key using RSA private key
    const encryptedAesKey = Buffer.from(
      hybridPayload.encryptedAesKey,
      "base64"
    );
    const aesKey = crypto.privateDecrypt(
      {
        key: privateKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      encryptedAesKey
    );

    // Decrypt the data using AES
    const iv = Buffer.from(hybridPayload.iv, "base64");
    const aesDecipher = crypto.createDecipheriv("aes-256-cbc", aesKey, iv);
    let decryptedData = aesDecipher.update(
      hybridPayload.encryptedData,
      "base64",
      "utf8"
    );
    decryptedData += aesDecipher.final("utf8");

    return {
      success: true,
      decryptedData: decryptedData,
      originalLength: encryptedBase64.length,
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
    typeof message === "string" &&
    message.length > 100 && // Encrypted messages should be reasonably long
    message.match(/^[A-Za-z0-9+/]+=*$/) // Base64 pattern
  );
}

module.exports = {
  encryptHybridMessage,
  decryptHybridMessage,
  isEncryptedMessage,
};
