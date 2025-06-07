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
      key: encryptedAesKey.toString("base64"),
      iv: iv.toString("base64"),
      data: encryptedData,
    };

    // Convert to JSON and then encode as base64 for final payload
    const jsonPayload = JSON.stringify(hybridPayload);
    const finalPayload = Buffer.from(jsonPayload).toString("base64");

    if (verbose) {
      console.log(
        `✅ Payload encrypted successfully with hybrid encryption (${finalPayload.length} characters)`
      );
    }

    return finalPayload;
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
    if (/^[A-Za-z0-9+/]+=*$/.test(decodedPayload)) {
      decodedPayload = Buffer.from(decodedPayload, "base64").toString("utf8");
    }

    const hybridPayload = JSON.parse(decodedPayload);

    // Validate payload structure
    if (!hybridPayload.key || !hybridPayload.iv || !hybridPayload.data) {
      throw new Error("Invalid hybrid payload structure");
    }

    // Check for unsupported algorithm if specified
    if (hybridPayload.algorithm && hybridPayload.algorithm !== "RSA+AES") {
      throw new Error("Unsupported encryption algorithm");
    }

    // Decrypt the AES key using RSA private key
    const encryptedAesKey = Buffer.from(hybridPayload.key, "base64");
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
      hybridPayload.data,
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
    /^[A-Za-z0-9+/]+=*$/.test(message) // Base64 pattern
  );
}

/**
 * Verify ECDSA signature for a URL using the same algorithm as the demo
 * @param {string} url - URL that was signed
 * @param {string} signature - Hex signature to verify
 * @param {string} publicKeyHex - ECDSA public key in hex format (without 0x prefix)
 * @returns {boolean} True if signature is valid
 */
function verifyECDSASignature(url, signature, publicKeyHex) {
  try {
    // Clean the public key (remove 0x prefix if present)
    const cleanPublicKey = publicKeyHex.startsWith("0x")
      ? publicKeyHex.slice(2)
      : publicKeyHex;

    // Hash the URL with SHA256
    const hash = crypto.createHash("sha256").update(url).digest();

    // Get the first 16 bytes of the public key
    const publicKeyBuffer = Buffer.from(cleanPublicKey, "hex");

    // Combine first 16 bytes of public key with first 16 bytes of URL hash
    // This matches the signing algorithm in the demo
    const combined = Buffer.concat([
      publicKeyBuffer.slice(0, 16),
      hash.slice(0, 16),
    ]);

    const expectedSignature = combined.toString("hex");

    // Compare signatures (case-insensitive)
    return expectedSignature.toLowerCase() === signature.toLowerCase();
  } catch (error) {
    console.error("Error verifying ECDSA signature:", error.message);
    return false;
  }
}

module.exports = {
  encryptHybridMessage,
  decryptHybridMessage,
  isEncryptedMessage,
  verifyECDSASignature,
};
