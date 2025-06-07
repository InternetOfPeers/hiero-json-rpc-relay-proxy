const { test, describe, beforeEach } = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");

// Import modules to test
const {
  encryptHybridMessage,
  decryptHybridMessage,
  isEncryptedMessage,
} = require("../src/cryptoUtils");

describe("cryptoUtils", function () {
  let publicKeyPem, privateKeyPem;

  beforeEach(function () {
    // Generate a test RSA key pair for each test
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
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
    publicKeyPem = publicKey;
    privateKeyPem = privateKey;
  });

  describe("encryptHybridMessage", function () {
    test("should encrypt data successfully", function () {
      const testData = "Hello, encrypted world!";
      const encrypted = encryptHybridMessage(publicKeyPem, testData);

      assert.ok(typeof encrypted === "string");
      assert.ok(encrypted.length > 0);
      assert.ok(encrypted.match(/^[A-Za-z0-9+/]+=*$/)); // Base64 pattern
    });

    test("should encrypt different data to different ciphertexts", function () {
      const data1 = "Message 1";
      const data2 = "Message 2";

      const encrypted1 = encryptHybridMessage(publicKeyPem, data1);
      const encrypted2 = encryptHybridMessage(publicKeyPem, data2);

      assert.notEqual(encrypted1, encrypted2);
    });

    test("should encrypt same data to different ciphertexts (due to random IV)", function () {
      const testData = "Same message";

      const encrypted1 = encryptHybridMessage(publicKeyPem, testData);
      const encrypted2 = encryptHybridMessage(publicKeyPem, testData);

      assert.notEqual(encrypted1, encrypted2);
    });

    test("should handle empty string", function () {
      const encrypted = encryptHybridMessage(publicKeyPem, "");
      assert.ok(typeof encrypted === "string");
      assert.ok(encrypted.length > 0);
    });

    test("should handle large data", function () {
      const largeData = "A".repeat(10000);
      const encrypted = encryptHybridMessage(publicKeyPem, largeData);
      assert.ok(typeof encrypted === "string");
      assert.ok(encrypted.length > 0);
    });

    test("should throw error with invalid public key", function () {
      assert.throws(() => {
        encryptHybridMessage("invalid-key", "test data");
      });
    });

    test("should support verbose mode", function () {
      const testData = "Test with verbose";
      const encrypted = encryptHybridMessage(publicKeyPem, testData, true);
      assert.ok(typeof encrypted === "string");
    });
  });

  describe("decryptHybridMessage", function () {
    test("should decrypt successfully encrypted data", function () {
      const testData = "Hello, decrypted world!";
      const encrypted = encryptHybridMessage(publicKeyPem, testData);
      const result = decryptHybridMessage(encrypted, privateKeyPem);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.decryptedData, testData);
      assert.ok(typeof result.originalLength === "number");
    });

    test("should handle empty string encryption/decryption", function () {
      const testData = "";
      const encrypted = encryptHybridMessage(publicKeyPem, testData);
      const result = decryptHybridMessage(encrypted, privateKeyPem);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.decryptedData, testData);
    });

    test("should handle large data encryption/decryption", function () {
      const testData = "Large data test: " + "X".repeat(5000);
      const encrypted = encryptHybridMessage(publicKeyPem, testData);
      const result = decryptHybridMessage(encrypted, privateKeyPem);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.decryptedData, testData);
    });

    test("should handle double-encoded base64", function () {
      const testData = "Double encoded test";
      const encrypted = encryptHybridMessage(publicKeyPem, testData);

      // Simulate double encoding (as might happen with mirror node)
      const doubleEncoded = Buffer.from(encrypted, "utf8").toString("base64");

      const result = decryptHybridMessage(doubleEncoded, privateKeyPem);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.decryptedData, testData);
    });

    test("should return error for invalid base64", function () {
      const result = decryptHybridMessage("invalid-base64!", privateKeyPem);
      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });

    test("should return error for invalid JSON payload", function () {
      const invalidPayload = Buffer.from("not-json-data").toString("base64");
      const result = decryptHybridMessage(invalidPayload, privateKeyPem);
      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });

    test("should return error for missing payload fields", function () {
      const incompletePayload = {
        encryptedAesKey: "some-key",
        // missing iv and encryptedData
      };
      const encoded = Buffer.from(JSON.stringify(incompletePayload)).toString(
        "base64"
      );
      const result = decryptHybridMessage(encoded, privateKeyPem);

      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes("Invalid hybrid payload structure"));
    });

    test("should return error for unsupported algorithm", function () {
      const invalidPayload = {
        encryptedAesKey: "some-key",
        iv: "some-iv",
        encryptedData: "some-data",
        algorithm: "unsupported-algorithm",
      };
      const encoded = Buffer.from(JSON.stringify(invalidPayload)).toString(
        "base64"
      );
      const result = decryptHybridMessage(encoded, privateKeyPem);

      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes("Unsupported encryption algorithm"));
    });

    test("should return error with wrong private key", function () {
      const testData = "Test with wrong key";
      const encrypted = encryptHybridMessage(publicKeyPem, testData);

      // Generate different key pair
      const { privateKey: wrongPrivateKey } = crypto.generateKeyPairSync(
        "rsa",
        {
          modulusLength: 2048,
          privateKeyEncoding: { type: "pkcs8", format: "pem" },
        }
      );

      const result = decryptHybridMessage(encrypted, wrongPrivateKey);
      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });

    test("should return error with invalid private key", function () {
      const testData = "Test data";
      const encrypted = encryptHybridMessage(publicKeyPem, testData);
      const result = decryptHybridMessage(encrypted, "invalid-private-key");

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });
  });

  describe("isEncryptedMessage", function () {
    test("should return true for encrypted messages", function () {
      const testData = "Test message for encryption detection";
      const encrypted = encryptHybridMessage(publicKeyPem, testData);

      assert.strictEqual(isEncryptedMessage(encrypted), true);
    });

    test("should return false for short strings", function () {
      assert.strictEqual(isEncryptedMessage("short"), false);
      assert.strictEqual(isEncryptedMessage(""), false);
    });

    test("should return false for non-base64 strings", function () {
      const longNonBase64 =
        "This is a very long string that is not base64 encoded and should not be detected as encrypted message content!";
      assert.strictEqual(isEncryptedMessage(longNonBase64), false);
    });

    test("should return false for non-string input", function () {
      assert.strictEqual(isEncryptedMessage(null), false);
      assert.strictEqual(isEncryptedMessage(undefined), false);
      assert.strictEqual(isEncryptedMessage(123), false);
      assert.strictEqual(isEncryptedMessage({}), false);
      assert.strictEqual(isEncryptedMessage([]), false);
    });

    test("should return true for long base64 strings", function () {
      const longBase64 = Buffer.from("A".repeat(200)).toString("base64");
      assert.strictEqual(isEncryptedMessage(longBase64), true);
    });

    test("should return false for medium length non-base64", function () {
      const mediumString =
        "This string is long enough but contains invalid base64 characters like @ and #";
      assert.strictEqual(isEncryptedMessage(mediumString), false);
    });
  });

  describe("end-to-end encryption/decryption", function () {
    test("should handle multiple rounds of encryption/decryption", function () {
      const testMessages = [
        "Simple message",
        "Message with special chars: !@#$%^&*()",
        "Multi-line\nmessage\nwith\nbreaks",
        JSON.stringify({ test: "object", number: 42 }),
        "Unicode: 🔐 🚀 ✅ 💎",
        "",
      ];

      for (const message of testMessages) {
        const encrypted = encryptHybridMessage(publicKeyPem, message);
        const result = decryptHybridMessage(encrypted, privateKeyPem);

        assert.strictEqual(
          result.success,
          true,
          `Failed for message: ${message}`
        );
        assert.strictEqual(
          result.decryptedData,
          message,
          `Mismatch for message: ${message}`
        );
      }
    });
  });
});
