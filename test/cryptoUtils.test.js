const { test, describe, beforeEach } = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");

// Import the crypto utilities to test
const {
  encryptHybridMessage,
  decryptHybridMessage,
  isEncryptedMessage,
  verifyECDSASignature,
} = require("../src/cryptoUtils");

describe("cryptoUtils", function () {
  let keyPair;

  beforeEach(function () {
    // Generate a fresh RSA key pair for each test
    keyPair = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: "spki",
        format: "pem",
      },
      privateKeyEncoding: {
        type: "pkcs8",
        format: "pem",
      },
    });
  });

  describe("encryptHybridMessage", function () {
    test("should encrypt and return JSON payload", function () {
      const testData = "Hello, World!";
      const encrypted = encryptHybridMessage(keyPair.publicKey, testData);

      // Should return a string
      assert.strictEqual(typeof encrypted, "string");

      // Should be valid JSON (not base64 encoded)
      const parsed = JSON.parse(encrypted);
      assert.ok(parsed.key);
      assert.ok(parsed.iv);
      assert.ok(parsed.data);

      // All components should be base64 encoded
      assert.ok(/^[A-Za-z0-9+/]+=*$/.test(parsed.key));
      assert.ok(/^[A-Za-z0-9+/]+=*$/.test(parsed.iv));
      assert.ok(/^[A-Za-z0-9+/]+=*$/.test(parsed.data));
    });

    test("should handle empty string", function () {
      const testData = "";
      const encrypted = encryptHybridMessage(keyPair.publicKey, testData);

      assert.strictEqual(typeof encrypted, "string");
      // Should be valid JSON
      const parsed = JSON.parse(encrypted);
      assert.ok(parsed.key);
      assert.ok(parsed.iv);
      assert.ok(parsed.data);
    });

    test("should handle large data", function () {
      const testData = "A".repeat(10000);
      const encrypted = encryptHybridMessage(keyPair.publicKey, testData);

      assert.strictEqual(typeof encrypted, "string");
      const parsed = JSON.parse(encrypted);
      assert.ok(parsed.key);
      assert.ok(parsed.iv);
      assert.ok(parsed.data);
    });

    test("should handle verbose logging", function () {
      const testData = "Test with verbose logging";
      const encrypted = encryptHybridMessage(keyPair.publicKey, testData, true);

      assert.strictEqual(typeof encrypted, "string");
    });

    test("should throw error with invalid public key", function () {
      const testData = "Hello, World!";
      const invalidKey = "invalid-key";

      assert.throws(() => {
        encryptHybridMessage(invalidKey, testData);
      }, /Encryption failed/);
    });

    test("should produce different outputs for same input (due to random IV)", function () {
      const testData = "Same input data";
      const encrypted1 = encryptHybridMessage(keyPair.publicKey, testData);
      const encrypted2 = encryptHybridMessage(keyPair.publicKey, testData);

      assert.notStrictEqual(encrypted1, encrypted2);
    });
  });

  describe("decryptHybridMessage", function () {
    test("should decrypt encrypted message successfully", function () {
      const testData = "Hello, World!";
      const encrypted = encryptHybridMessage(keyPair.publicKey, testData);
      const result = decryptHybridMessage(encrypted, keyPair.privateKey);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.decryptedData, testData);
      assert.ok(result.originalLength > 0);
    });

    test("should handle empty string encryption/decryption", function () {
      const testData = "";
      const encrypted = encryptHybridMessage(keyPair.publicKey, testData);
      const result = decryptHybridMessage(encrypted, keyPair.privateKey);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.decryptedData, testData);
    });

    test("should handle large data encryption/decryption", function () {
      const testData = "Large data test: " + "X".repeat(5000);
      const encrypted = encryptHybridMessage(keyPair.publicKey, testData);
      const result = decryptHybridMessage(encrypted, keyPair.privateKey);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.decryptedData, testData);
    });

    test("should handle double-base64 encoded payload", function () {
      const testData = "Double encoded test";
      const encrypted = encryptHybridMessage(keyPair.publicKey, testData);
      // Double encode by treating JSON as string and base64 encoding it
      const doubleEncoded = Buffer.from(encrypted, "utf8").toString("base64");

      const result = decryptHybridMessage(doubleEncoded, keyPair.privateKey);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.decryptedData, testData);
    });

    test("should return error for invalid base64", function () {
      const invalidBase64 = "invalid-base64-string!@#";
      const result = decryptHybridMessage(invalidBase64, keyPair.privateKey);

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });

    test("should return error for invalid JSON", function () {
      const invalidJson = Buffer.from("not json", "utf8").toString("base64");
      const result = decryptHybridMessage(invalidJson, keyPair.privateKey);

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });

    test("should return error for missing payload fields", function () {
      const incompletePayload = JSON.stringify({ key: "test" });
      const encoded = Buffer.from(incompletePayload, "utf8").toString("base64");
      const result = decryptHybridMessage(encoded, keyPair.privateKey);

      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes("Invalid hybrid payload structure"));
    });

    test("should return error for unsupported algorithm", function () {
      const unsupportedPayload = JSON.stringify({
        key: "dGVzdA==",
        iv: "dGVzdA==",
        data: "dGVzdA==",
        algorithm: "UNSUPPORTED",
      });
      const encoded = Buffer.from(unsupportedPayload, "utf8").toString(
        "base64"
      );
      const result = decryptHybridMessage(encoded, keyPair.privateKey);

      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes("Unsupported encryption algorithm"));
    });

    test("should return error with wrong private key", function () {
      const wrongKeyPair = crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });

      const testData = "Test data";
      const encrypted = encryptHybridMessage(keyPair.publicKey, testData);
      const result = decryptHybridMessage(encrypted, wrongKeyPair.privateKey);

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });

    test("should handle special characters and unicode", function () {
      const testData = "Special chars: 🚀 ñáéíóú @#$%^&*()";
      const encrypted = encryptHybridMessage(keyPair.publicKey, testData);
      const result = decryptHybridMessage(encrypted, keyPair.privateKey);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.decryptedData, testData);
    });
  });

  describe("isEncryptedMessage", function () {
    test("should return false for JSON encrypted message (not base64)", function () {
      const testData = "Test message";
      const encrypted = encryptHybridMessage(keyPair.publicKey, testData);
      const result = isEncryptedMessage(encrypted);

      // Since encryptHybridMessage returns JSON (not base64), isEncryptedMessage should return false
      assert.strictEqual(result, false);
    });

    test("should return false for short strings", function () {
      assert.strictEqual(isEncryptedMessage("short"), false);
      assert.strictEqual(isEncryptedMessage(""), false);
      assert.strictEqual(isEncryptedMessage("a".repeat(50)), false);
    });

    test("should return false for non-base64 strings", function () {
      const longNonBase64 =
        "This is a long string that is not base64 encoded and contains special characters like @#$%^&*()";
      assert.strictEqual(isEncryptedMessage(longNonBase64), false);
    });

    test("should return true for long base64 strings", function () {
      const longBase64 = Buffer.from("A".repeat(200), "utf8").toString(
        "base64"
      );
      assert.strictEqual(isEncryptedMessage(longBase64), true);
    });

    test("should return false for non-string inputs", function () {
      assert.strictEqual(isEncryptedMessage(null), false);
      assert.strictEqual(isEncryptedMessage(undefined), false);
      assert.strictEqual(isEncryptedMessage(123), false);
      assert.strictEqual(isEncryptedMessage({}), false);
      assert.strictEqual(isEncryptedMessage([]), false);
    });

    test("should handle edge case base64 patterns", function () {
      const validBase64Pattern = "A".repeat(150) + "==";
      assert.strictEqual(isEncryptedMessage(validBase64Pattern), true);

      const invalidBase64Pattern = "A".repeat(150) + "!@#";
      assert.strictEqual(isEncryptedMessage(invalidBase64Pattern), false);
    });
  });

  describe("verifyECDSASignature", function () {
    test("should verify correct ECDSA signature", function () {
      const url = "https://example.com/api";
      const publicKeyHex = "1234567890abcdef".repeat(4); // 64 hex chars (32 bytes)

      // Create expected signature using the same algorithm
      const hash = crypto.createHash("sha256").update(url).digest();
      const publicKeyBuffer = Buffer.from(publicKeyHex, "hex");
      const combined = Buffer.concat([
        publicKeyBuffer.slice(0, 16),
        hash.slice(0, 16),
      ]);
      const expectedSignature = combined.toString("hex");

      const result = verifyECDSASignature(url, expectedSignature, publicKeyHex);
      assert.strictEqual(result, true);
    });

    test("should handle public key with 0x prefix", function () {
      const url = "https://example.com/api";
      const publicKeyHex = "1234567890abcdef".repeat(4);
      const publicKeyWithPrefix = "0x" + publicKeyHex;

      // Create expected signature
      const hash = crypto.createHash("sha256").update(url).digest();
      const publicKeyBuffer = Buffer.from(publicKeyHex, "hex");
      const combined = Buffer.concat([
        publicKeyBuffer.slice(0, 16),
        hash.slice(0, 16),
      ]);
      const expectedSignature = combined.toString("hex");

      const result = verifyECDSASignature(
        url,
        expectedSignature,
        publicKeyWithPrefix
      );
      assert.strictEqual(result, true);
    });

    test("should be case insensitive for signature comparison", function () {
      const url = "https://example.com/api";
      const publicKeyHex = "1234567890abcdef".repeat(4);

      // Create expected signature
      const hash = crypto.createHash("sha256").update(url).digest();
      const publicKeyBuffer = Buffer.from(publicKeyHex, "hex");
      const combined = Buffer.concat([
        publicKeyBuffer.slice(0, 16),
        hash.slice(0, 16),
      ]);
      const expectedSignature = combined.toString("hex").toUpperCase();

      const result = verifyECDSASignature(url, expectedSignature, publicKeyHex);
      assert.strictEqual(result, true);
    });

    test("should return false for incorrect signature", function () {
      const url = "https://example.com/api";
      const publicKeyHex = "1234567890abcdef".repeat(4);
      const wrongSignature = "wrongsignature".repeat(4);

      const result = verifyECDSASignature(url, wrongSignature, publicKeyHex);
      assert.strictEqual(result, false);
    });

    test("should return false for different URL", function () {
      const url1 = "https://example.com/api";
      const url2 = "https://different.com/api";
      const publicKeyHex = "1234567890abcdef".repeat(4);

      // Create signature for url1
      const hash = crypto.createHash("sha256").update(url1).digest();
      const publicKeyBuffer = Buffer.from(publicKeyHex, "hex");
      const combined = Buffer.concat([
        publicKeyBuffer.slice(0, 16),
        hash.slice(0, 16),
      ]);
      const signature = combined.toString("hex");

      // Try to verify with url2
      const result = verifyECDSASignature(url2, signature, publicKeyHex);
      assert.strictEqual(result, false);
    });

    test("should handle invalid public key gracefully", function () {
      const url = "https://example.com/api";
      const invalidPublicKey = "invalid-hex-key";
      const signature = "somesignature";

      const result = verifyECDSASignature(url, signature, invalidPublicKey);
      assert.strictEqual(result, false);
    });

    test("should handle empty inputs gracefully", function () {
      assert.strictEqual(verifyECDSASignature("", "", ""), false);
      assert.strictEqual(verifyECDSASignature("url", "", "key"), false);
      assert.strictEqual(verifyECDSASignature("", "sig", "key"), false);
      assert.strictEqual(verifyECDSASignature("url", "sig", ""), false);
    });

    test("should handle different URLs with same signature", function () {
      const url = "https://api.testnet.hashio.io/api";
      const publicKeyHex = "fedcba0987654321".repeat(4);

      // Create signature for this URL
      const hash = crypto.createHash("sha256").update(url).digest();
      const publicKeyBuffer = Buffer.from(publicKeyHex, "hex");
      const combined = Buffer.concat([
        publicKeyBuffer.slice(0, 16),
        hash.slice(0, 16),
      ]);
      const correctSignature = combined.toString("hex");

      // Should verify correctly
      assert.strictEqual(
        verifyECDSASignature(url, correctSignature, publicKeyHex),
        true
      );

      // Should fail with different URL
      const differentUrl = "https://api.mainnet.hashio.io/api";
      assert.strictEqual(
        verifyECDSASignature(differentUrl, correctSignature, publicKeyHex),
        false
      );
    });
  });

  describe("Integration tests", function () {
    test("should encrypt and decrypt complex JSON data", function () {
      const complexData = {
        routes: {
          "0x1234567890abcdef": {
            url: "https://api.example.com",
            sig: "signature123",
          },
        },
        timestamp: Date.now(),
        metadata: {
          version: "1.0.0",
          author: "test",
        },
      };

      const jsonString = JSON.stringify(complexData);
      const encrypted = encryptHybridMessage(keyPair.publicKey, jsonString);
      const result = decryptHybridMessage(encrypted, keyPair.privateKey);

      assert.strictEqual(result.success, true);
      const decryptedData = JSON.parse(result.decryptedData);
      assert.deepStrictEqual(decryptedData, complexData);
    });

    test("should handle multiple encrypt/decrypt cycles", function () {
      let data = "Initial data";

      for (let i = 0; i < 5; i++) {
        const encrypted = encryptHybridMessage(keyPair.publicKey, data);
        const result = decryptHybridMessage(encrypted, keyPair.privateKey);

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.decryptedData, data);

        // Use decrypted data for next iteration
        data = result.decryptedData + ` (cycle ${i + 1})`;
      }
    });
  });
});
