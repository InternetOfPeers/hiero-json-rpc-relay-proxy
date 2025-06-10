const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { ethers } = require('ethers');

// Import the crypto utilities to test
const {
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
} = require('../src/cryptoUtils');

describe('cryptoUtils', function () {
  let keyPair;

  beforeEach(function () {
    // Generate a fresh RSA key pair for each test
    keyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });
  });

  describe('encryptHybridMessage', function () {
    test('should encrypt and return JSON payload', function () {
      const testData = 'Hello, World!';
      const encrypted = encryptHybridMessage(keyPair.publicKey, testData);

      // Should return a string
      assert.strictEqual(typeof encrypted, 'string');

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

    test('should handle empty string', function () {
      const testData = '';
      const encrypted = encryptHybridMessage(keyPair.publicKey, testData);

      assert.strictEqual(typeof encrypted, 'string');
      // Should be valid JSON
      const parsed = JSON.parse(encrypted);
      assert.ok(parsed.key);
      assert.ok(parsed.iv);
      assert.ok(parsed.data);
    });

    test('should handle large data', function () {
      const testData = 'A'.repeat(10000);
      const encrypted = encryptHybridMessage(keyPair.publicKey, testData);

      assert.strictEqual(typeof encrypted, 'string');
      const parsed = JSON.parse(encrypted);
      assert.ok(parsed.key);
      assert.ok(parsed.iv);
      assert.ok(parsed.data);
    });

    test('should handle verbose logging', function () {
      const testData = 'Test with verbose logging';
      const encrypted = encryptHybridMessage(keyPair.publicKey, testData, true);

      assert.strictEqual(typeof encrypted, 'string');
    });

    test('should throw error with invalid public key', function () {
      const testData = 'Hello, World!';
      const invalidKey = 'invalid-key';

      assert.throws(() => {
        encryptHybridMessage(invalidKey, testData);
      }, /Encryption failed/);
    });

    test('should produce different outputs for same input (due to random IV)', function () {
      const testData = 'Same input data';
      const encrypted1 = encryptHybridMessage(keyPair.publicKey, testData);
      const encrypted2 = encryptHybridMessage(keyPair.publicKey, testData);

      assert.notStrictEqual(encrypted1, encrypted2);
    });
  });

  describe('decryptHybridMessage', function () {
    test('should decrypt encrypted message successfully', function () {
      const testData = 'Hello, World!';
      const encrypted = encryptHybridMessage(keyPair.publicKey, testData);
      const result = decryptHybridMessage(encrypted, keyPair.privateKey);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.decryptedData, testData);
      assert.ok(result.originalLength > 0);
    });

    test('should handle empty string encryption/decryption', function () {
      const testData = '';
      const encrypted = encryptHybridMessage(keyPair.publicKey, testData);
      const result = decryptHybridMessage(encrypted, keyPair.privateKey);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.decryptedData, testData);
    });

    test('should handle large data encryption/decryption', function () {
      const testData = 'Large data test: ' + 'X'.repeat(5000);
      const encrypted = encryptHybridMessage(keyPair.publicKey, testData);
      const result = decryptHybridMessage(encrypted, keyPair.privateKey);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.decryptedData, testData);
    });

    test('should handle double-base64 encoded payload', function () {
      const testData = 'Double encoded test';
      const encrypted = encryptHybridMessage(keyPair.publicKey, testData);
      // Double encode by treating JSON as string and base64 encoding it
      const doubleEncoded = Buffer.from(encrypted, 'utf8').toString('base64');

      const result = decryptHybridMessage(doubleEncoded, keyPair.privateKey);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.decryptedData, testData);
    });

    test('should return error for invalid base64', function () {
      const invalidBase64 = 'invalid-base64-string!@#';
      const result = decryptHybridMessage(invalidBase64, keyPair.privateKey);

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });

    test('should return error for invalid JSON', function () {
      const invalidJson = Buffer.from('not json', 'utf8').toString('base64');
      const result = decryptHybridMessage(invalidJson, keyPair.privateKey);

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });

    test('should return error for missing payload fields', function () {
      const incompletePayload = JSON.stringify({ key: 'test' });
      const encoded = Buffer.from(incompletePayload, 'utf8').toString('base64');
      const result = decryptHybridMessage(encoded, keyPair.privateKey);

      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('Invalid hybrid payload structure'));
    });

    test('should return error for unsupported algorithm', function () {
      const unsupportedPayload = JSON.stringify({
        key: 'dGVzdA==',
        iv: 'dGVzdA==',
        data: 'dGVzdA==',
        algorithm: 'UNSUPPORTED',
      });
      const encoded = Buffer.from(unsupportedPayload, 'utf8').toString(
        'base64'
      );
      const result = decryptHybridMessage(encoded, keyPair.privateKey);

      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('Unsupported encryption algorithm'));
    });

    test('should return error with wrong private key', function () {
      const wrongKeyPair = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      const testData = 'Test data';
      const encrypted = encryptHybridMessage(keyPair.publicKey, testData);
      const result = decryptHybridMessage(encrypted, wrongKeyPair.privateKey);

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });

    test('should handle special characters and unicode', function () {
      const testData = 'Special chars: 🚀 ñáéíóú @#$%^&*()';
      const encrypted = encryptHybridMessage(keyPair.publicKey, testData);
      const result = decryptHybridMessage(encrypted, keyPair.privateKey);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.decryptedData, testData);
    });
  });

  describe('isEncryptedMessage', function () {
    test('should return false for JSON encrypted message (not base64)', function () {
      const testData = 'Test message';
      const encrypted = encryptHybridMessage(keyPair.publicKey, testData);
      const result = isEncryptedMessage(encrypted);

      // Since encryptHybridMessage returns JSON (not base64), isEncryptedMessage should return false
      assert.strictEqual(result, false);
    });

    test('should return false for short strings', function () {
      assert.strictEqual(isEncryptedMessage('short'), false);
      assert.strictEqual(isEncryptedMessage(''), false);
      assert.strictEqual(isEncryptedMessage('a'.repeat(50)), false);
    });

    test('should return false for non-base64 strings', function () {
      const longNonBase64 =
        'This is a long string that is not base64 encoded and contains special characters like @#$%^&*()';
      assert.strictEqual(isEncryptedMessage(longNonBase64), false);
    });

    test('should return true for long base64 strings', function () {
      const longBase64 = Buffer.from('A'.repeat(200), 'utf8').toString(
        'base64'
      );
      assert.strictEqual(isEncryptedMessage(longBase64), true);
    });

    test('should return false for non-string inputs', function () {
      assert.strictEqual(isEncryptedMessage(null), false);
      assert.strictEqual(isEncryptedMessage(undefined), false);
      assert.strictEqual(isEncryptedMessage(123), false);
      assert.strictEqual(isEncryptedMessage({}), false);
      assert.strictEqual(isEncryptedMessage([]), false);
    });

    test('should handle edge case base64 patterns', function () {
      const validBase64Pattern = 'A'.repeat(150) + '==';
      assert.strictEqual(isEncryptedMessage(validBase64Pattern), true);

      const invalidBase64Pattern = 'A'.repeat(150) + '!@#';
      assert.strictEqual(isEncryptedMessage(invalidBase64Pattern), false);
    });
  });

  describe('verifyECDSASignature', function () {
    test('should verify correct ECDSA signature using ethers.js', function () {
      const url = 'https://example.com/api';
      // Create a random wallet
      const wallet = ethers.Wallet.createRandom();
      const signature = wallet.signMessageSync(url);
      const address = wallet.address;

      const result = verifyECDSASignature(url, signature, address);
      assert.strictEqual(result, true);
    });

    test('should handle address with and without 0x prefix', function () {
      const url = 'https://example.com/api';
      const wallet = ethers.Wallet.createRandom();
      const signature = wallet.signMessageSync(url);

      // Test with 0x prefix
      const addressWithPrefix = wallet.address;
      const resultWithPrefix = verifyECDSASignature(
        url,
        signature,
        addressWithPrefix
      );
      assert.strictEqual(resultWithPrefix, true);

      // Test without 0x prefix
      const addressWithoutPrefix = wallet.address.slice(2);
      const resultWithoutPrefix = verifyECDSASignature(
        url,
        signature,
        addressWithoutPrefix
      );
      assert.strictEqual(resultWithoutPrefix, true);
    });

    test('should be case insensitive for address comparison', function () {
      const url = 'https://example.com/api';
      const wallet = ethers.Wallet.createRandom();
      const signature = wallet.signMessageSync(url);

      // Test with uppercase address
      const uppercaseAddress = wallet.address.toUpperCase();
      const result = verifyECDSASignature(url, signature, uppercaseAddress);
      assert.strictEqual(result, true);
    });

    test('should return false for incorrect signature', function () {
      const url = 'https://example.com/api';
      const wallet = ethers.Wallet.createRandom();
      const wrongSignature = '0x1234567890abcdef'.repeat(8); // Invalid signature format
      const address = wallet.address;

      const result = verifyECDSASignature(url, wrongSignature, address);
      assert.strictEqual(result, false);
    });

    test('should return false for different URL', function () {
      const url1 = 'https://example.com/api';
      const url2 = 'https://different.com/api';
      const wallet = ethers.Wallet.createRandom();

      // Create signature for url1
      const signature = wallet.signMessageSync(url1);
      const address = wallet.address;

      // Try to verify with url2 - should fail
      const result = verifyECDSASignature(url2, signature, address);
      assert.strictEqual(result, false);
    });

    test('should return false for wrong address', function () {
      const url = 'https://example.com/api';
      const wallet1 = ethers.Wallet.createRandom();
      const wallet2 = ethers.Wallet.createRandom();

      // Create signature with wallet1
      const signature = wallet1.signMessageSync(url);
      // Try to verify with wallet2's address
      const wrongAddress = wallet2.address;

      const result = verifyECDSASignature(url, signature, wrongAddress);
      assert.strictEqual(result, false);
    });

    test('should handle invalid address gracefully', function () {
      const url = 'https://example.com/api';
      const wallet = ethers.Wallet.createRandom();
      const signature = wallet.signMessageSync(url);
      const invalidAddress = 'invalid-address';

      const result = verifyECDSASignature(url, signature, invalidAddress);
      assert.strictEqual(result, false);
    });

    test('should handle empty inputs gracefully', function () {
      assert.strictEqual(verifyECDSASignature('', '', ''), false);
      assert.strictEqual(
        verifyECDSASignature(
          'url',
          '',
          '0x1234567890123456789012345678901234567890'
        ),
        false
      );
      assert.strictEqual(
        verifyECDSASignature(
          '',
          '0x123',
          '0x1234567890123456789012345678901234567890'
        ),
        false
      );
      assert.strictEqual(verifyECDSASignature('url', '0x123', ''), false);
    });

    test('should handle testnet and mainnet URLs correctly', function () {
      const testnetUrl = 'https://api.testnet.hashio.io/api';
      const mainnetUrl = 'https://api.mainnet.hashio.io/api';
      const wallet = ethers.Wallet.createRandom();

      // Create signature for testnet URL
      const testnetSignature = wallet.signMessageSync(testnetUrl);
      const address = wallet.address;

      // Should verify correctly with testnet URL
      assert.strictEqual(
        verifyECDSASignature(testnetUrl, testnetSignature, address),
        true
      );

      // Should fail with mainnet URL using testnet signature
      assert.strictEqual(
        verifyECDSASignature(mainnetUrl, testnetSignature, address),
        false
      );

      // Create signature for mainnet URL and verify it works
      const mainnetSignature = wallet.signMessageSync(mainnetUrl);
      assert.strictEqual(
        verifyECDSASignature(mainnetUrl, mainnetSignature, address),
        true
      );
    });
  });

  describe('getContractAddressFromCreate', function () {
    test('should compute correct contract address for CREATE deployment', function () {
      // Test the exact case from the error
      const deployer = '0xe0b73f64b0de6032b193648c08899f20b5a6141d';
      const nonce = 33;
      const expected = '0x3ed660420aa9bc674e8f80f744f8062603da385e';

      const computed = getContractAddressFromCreate(deployer, nonce);

      assert.strictEqual(computed, expected);
    });

    test('should handle deployer addresses without 0x prefix', function () {
      const deployerWithPrefix = '0xe0b73f64b0de6032b193648c08899f20b5a6141d';
      const deployerWithoutPrefix = 'e0b73f64b0de6032b193648c08899f20b5a6141d';
      const nonce = 33;

      const result1 = getContractAddressFromCreate(deployerWithPrefix, nonce);
      const result2 = getContractAddressFromCreate(
        deployerWithoutPrefix,
        nonce
      );

      assert.strictEqual(result1, result2);
      assert.strictEqual(result1, '0x3ed660420aa9bc674e8f80f744f8062603da385e');
    });

    test('should handle different nonces correctly', function () {
      const deployer = '0xe0b73f64b0de6032b193648c08899f20b5a6141d';

      const addr1 = getContractAddressFromCreate(deployer, 33);
      const addr2 = getContractAddressFromCreate(deployer, 34);
      const addr3 = getContractAddressFromCreate(deployer, 0);

      // Different nonces should produce different addresses
      assert.notStrictEqual(addr1, addr2);
      assert.notStrictEqual(addr1, addr3);
      assert.notStrictEqual(addr2, addr3);

      // Addresses should be valid Ethereum addresses
      assert.ok(addr1.startsWith('0x'));
      assert.ok(addr2.startsWith('0x'));
      assert.ok(addr3.startsWith('0x'));
      assert.strictEqual(addr1.length, 42);
      assert.strictEqual(addr2.length, 42);
      assert.strictEqual(addr3.length, 42);
    });

    test('should return null for invalid inputs', function () {
      // Invalid deployer address
      const result1 = getContractAddressFromCreate('invalid-address', 33);
      assert.strictEqual(result1, null);

      // Negative nonce should also work (edge case)
      const result2 = getContractAddressFromCreate(
        '0xe0b73f64b0de6032b193648c08899f20b5a6141d',
        -1
      );
      // This should actually work as ethers can handle negative nonces
      assert.ok(result2 === null || typeof result2 === 'string');
    });
  });

  describe('getContractAddressFromCreate2', function () {
    test('should compute correct contract address for CREATE2 deployment', function () {
      // Known test case for CREATE2
      const deployer = '0x0000000000000000000000000000000000000000';
      const salt =
        '0x0000000000000000000000000000000000000000000000000000000000000000';
      const initCodeHash =
        '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470';
      const expected = '0xe33c0c7f7df4809055c3eba6c09cfe4baf1bd9e0';

      const computed = getContractAddressFromCreate2(
        deployer,
        salt,
        initCodeHash
      );

      assert.strictEqual(computed, expected);
    });

    test('should handle different deployer addresses', function () {
      const deployer1 = '0x1234567890123456789012345678901234567890';
      const deployer2 = '0x0987654321098765432109876543210987654321';
      const salt =
        '0x1111111111111111111111111111111111111111111111111111111111111111';
      const initCodeHash =
        '0x2222222222222222222222222222222222222222222222222222222222222222';

      const addr1 = getContractAddressFromCreate2(
        deployer1,
        salt,
        initCodeHash
      );
      const addr2 = getContractAddressFromCreate2(
        deployer2,
        salt,
        initCodeHash
      );

      // Different deployers should produce different addresses
      assert.notStrictEqual(addr1, addr2);

      // Both should be valid Ethereum addresses
      assert.ok(addr1.startsWith('0x'));
      assert.ok(addr2.startsWith('0x'));
      assert.strictEqual(addr1.length, 42);
      assert.strictEqual(addr2.length, 42);
    });

    test('should handle different salts', function () {
      const deployer = '0x1234567890123456789012345678901234567890';
      const salt1 =
        '0x1111111111111111111111111111111111111111111111111111111111111111';
      const salt2 =
        '0x2222222222222222222222222222222222222222222222222222222222222222';
      const initCodeHash =
        '0x3333333333333333333333333333333333333333333333333333333333333333';

      const addr1 = getContractAddressFromCreate2(
        deployer,
        salt1,
        initCodeHash
      );
      const addr2 = getContractAddressFromCreate2(
        deployer,
        salt2,
        initCodeHash
      );

      // Different salts should produce different addresses
      assert.notStrictEqual(addr1, addr2);
    });

    test('should handle different init code hashes', function () {
      const deployer = '0x1234567890123456789012345678901234567890';
      const salt =
        '0x1111111111111111111111111111111111111111111111111111111111111111';
      const initCodeHash1 =
        '0x3333333333333333333333333333333333333333333333333333333333333333';
      const initCodeHash2 =
        '0x4444444444444444444444444444444444444444444444444444444444444444';

      const addr1 = getContractAddressFromCreate2(
        deployer,
        salt,
        initCodeHash1
      );
      const addr2 = getContractAddressFromCreate2(
        deployer,
        salt,
        initCodeHash2
      );

      // Different init code hashes should produce different addresses
      assert.notStrictEqual(addr1, addr2);
    });

    test('should handle addresses and hashes without 0x prefix', function () {
      const deployerWithPrefix = '0x1234567890123456789012345678901234567890';
      const deployerWithoutPrefix = '1234567890123456789012345678901234567890';
      const saltWithPrefix =
        '0x1111111111111111111111111111111111111111111111111111111111111111';
      const saltWithoutPrefix =
        '1111111111111111111111111111111111111111111111111111111111111111';
      const hashWithPrefix =
        '0x3333333333333333333333333333333333333333333333333333333333333333';
      const hashWithoutPrefix =
        '3333333333333333333333333333333333333333333333333333333333333333';

      const result1 = getContractAddressFromCreate2(
        deployerWithPrefix,
        saltWithPrefix,
        hashWithPrefix
      );
      const result2 = getContractAddressFromCreate2(
        deployerWithoutPrefix,
        saltWithoutPrefix,
        hashWithoutPrefix
      );

      assert.strictEqual(result1, result2);
    });

    test('should handle short salts by padding', function () {
      const deployer = '0x1234567890123456789012345678901234567890';
      const shortSalt = '0x1234'; // Will be padded to 32 bytes
      const initCodeHash =
        '0x3333333333333333333333333333333333333333333333333333333333333333';

      const result = getContractAddressFromCreate2(
        deployer,
        shortSalt,
        initCodeHash
      );

      // Should work and return a valid address
      assert.ok(result);
      assert.ok(result.startsWith('0x'));
      assert.strictEqual(result.length, 42);
    });

    test('should return null for invalid inputs', function () {
      const validDeployer = '0x1234567890123456789012345678901234567890';
      const validSalt =
        '0x1111111111111111111111111111111111111111111111111111111111111111';
      const validHash =
        '0x3333333333333333333333333333333333333333333333333333333333333333';

      // Invalid deployer address
      const result1 = getContractAddressFromCreate2(
        'invalid-address',
        validSalt,
        validHash
      );
      assert.strictEqual(result1, null);

      // Invalid salt (too long)
      const invalidSalt =
        '0x11111111111111111111111111111111111111111111111111111111111111111'; // 65 chars
      const result2 = getContractAddressFromCreate2(
        validDeployer,
        invalidSalt,
        validHash
      );
      assert.strictEqual(result2, null);

      // Invalid init code hash (not hex)
      const invalidHash = '0xnothex';
      const result3 = getContractAddressFromCreate2(
        validDeployer,
        validSalt,
        invalidHash
      );
      assert.strictEqual(result3, null);

      // Invalid init code hash (wrong length)
      const shortHash = '0x1234';
      const result4 = getContractAddressFromCreate2(
        validDeployer,
        validSalt,
        shortHash
      );
      assert.strictEqual(result4, null);
    });

    test('should be deterministic', function () {
      const deployer = '0x1234567890123456789012345678901234567890';
      const salt =
        '0x1111111111111111111111111111111111111111111111111111111111111111';
      const initCodeHash =
        '0x3333333333333333333333333333333333333333333333333333333333333333';

      const result1 = getContractAddressFromCreate2(
        deployer,
        salt,
        initCodeHash
      );
      const result2 = getContractAddressFromCreate2(
        deployer,
        salt,
        initCodeHash
      );

      // Should always produce the same result for same inputs
      assert.strictEqual(result1, result2);
    });
  });

  describe('Integration tests', function () {
    test('should encrypt and decrypt complex JSON data', function () {
      const complexData = {
        routes: {
          '0x1234567890abcdef': {
            url: 'https://api.example.com',
            sig: 'signature123',
          },
        },
        timestamp: Date.now(),
        metadata: {
          version: '1.0.0',
          author: 'test',
        },
      };

      const jsonString = JSON.stringify(complexData);
      const encrypted = encryptHybridMessage(keyPair.publicKey, jsonString);
      const result = decryptHybridMessage(encrypted, keyPair.privateKey);

      assert.strictEqual(result.success, true);
      const decryptedData = JSON.parse(result.decryptedData);
      assert.deepStrictEqual(decryptedData, complexData);
    });

    test('should handle multiple encrypt/decrypt cycles', function () {
      let data = 'Initial data';

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

  describe('Challenge-Response Functions', function () {
    let testPrivateKey;
    let testWallet;
    let testAddress;

    beforeEach(function () {
      // Generate a test ECDSA wallet for challenge responses
      testPrivateKey =
        '0x1234567890123456789012345678901234567890123456789012345678901234';
      testWallet = new ethers.Wallet(testPrivateKey);
      testAddress = testWallet.address;
    });

    describe('generateChallenge', function () {
      test('should generate a valid challenge with RSA signature', function () {
        const targetUrl = 'http://localhost:7546';
        const contractAddress = '0x1234567890123456789012345678901234567890';

        const challengeObj = generateChallenge(
          keyPair.privateKey,
          targetUrl,
          contractAddress
        );

        // Should return an object with challenge and signature
        assert.ok(challengeObj.challenge);
        assert.ok(challengeObj.signature);

        // Challenge should have required fields
        assert.ok(challengeObj.challenge.challengeId);
        assert.ok(challengeObj.challenge.timestamp);
        assert.strictEqual(challengeObj.challenge.url, targetUrl);
        assert.strictEqual(
          challengeObj.challenge.contractAddress,
          contractAddress.toLowerCase()
        );
        assert.strictEqual(challengeObj.challenge.action, 'url-verification');

        // Challenge ID should be a 64-character hex string
        assert.strictEqual(challengeObj.challenge.challengeId.length, 64);
        assert.ok(/^[a-f0-9]+$/.test(challengeObj.challenge.challengeId));

        // Timestamp should be a number close to now
        assert.strictEqual(typeof challengeObj.challenge.timestamp, 'number');
        assert.ok(
          Math.abs(challengeObj.challenge.timestamp - Date.now()) < 1000
        );

        // Signature should be base64 encoded
        assert.ok(typeof challengeObj.signature === 'string');
        assert.ok(challengeObj.signature.length > 0);
      });

      test('should throw error with invalid private key', function () {
        assert.throws(() => {
          generateChallenge('invalid-key', 'http://test.com', '0x123');
        }, /Challenge generation failed/);
      });

      test('should generate different challenge IDs for same inputs', function () {
        const targetUrl = 'http://localhost:7546';
        const contractAddress = '0x1234567890123456789012345678901234567890';

        const challenge1 = generateChallenge(
          keyPair.privateKey,
          targetUrl,
          contractAddress
        );
        const challenge2 = generateChallenge(
          keyPair.privateKey,
          targetUrl,
          contractAddress
        );

        // Should have different challenge IDs
        assert.notStrictEqual(
          challenge1.challenge.challengeId,
          challenge2.challenge.challengeId
        );

        // But same other fields
        assert.strictEqual(challenge1.challenge.url, challenge2.challenge.url);
        assert.strictEqual(
          challenge1.challenge.contractAddress,
          challenge2.challenge.contractAddress
        );
        assert.strictEqual(
          challenge1.challenge.action,
          challenge2.challenge.action
        );
      });
    });

    describe('verifyChallenge', function () {
      test('should verify a valid challenge signature', function () {
        const targetUrl = 'http://localhost:7546';
        const contractAddress = '0x1234567890123456789012345678901234567890';

        const challengeObj = generateChallenge(
          keyPair.privateKey,
          targetUrl,
          contractAddress
        );

        // Should verify successfully with correct public key
        const isValid = verifyChallenge(
          challengeObj.challenge,
          challengeObj.signature,
          keyPair.publicKey
        );
        assert.strictEqual(isValid, true);
      });

      test('should reject challenge with wrong public key', function () {
        const targetUrl = 'http://localhost:7546';
        const contractAddress = '0x1234567890123456789012345678901234567890';

        const challengeObj = generateChallenge(
          keyPair.privateKey,
          targetUrl,
          contractAddress
        );

        // Generate a different key pair
        const wrongKeyPair = crypto.generateKeyPairSync('rsa', {
          modulusLength: 2048,
          publicKeyEncoding: { type: 'spki', format: 'pem' },
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        });

        // Should fail verification with wrong public key
        const isValid = verifyChallenge(
          challengeObj.challenge,
          challengeObj.signature,
          wrongKeyPair.publicKey
        );
        assert.strictEqual(isValid, false);
      });

      test('should reject modified challenge data', function () {
        const targetUrl = 'http://localhost:7546';
        const contractAddress = '0x1234567890123456789012345678901234567890';

        const challengeObj = generateChallenge(
          keyPair.privateKey,
          targetUrl,
          contractAddress
        );

        // Modify the challenge data
        const modifiedChallenge = {
          ...challengeObj.challenge,
          url: 'http://different.com',
        };

        // Should fail verification with modified data
        const isValid = verifyChallenge(
          modifiedChallenge,
          challengeObj.signature,
          keyPair.publicKey
        );
        assert.strictEqual(isValid, false);
      });

      test('should handle invalid signature gracefully', function () {
        const challengeData = {
          challengeId: '1234567890abcdef',
          timestamp: Date.now(),
          url: 'http://localhost:7546',
          contractAddress: '0x1234567890123456789012345678901234567890',
          action: 'url-verification',
        };

        // Should return false for invalid signature
        const isValid = verifyChallenge(
          challengeData,
          'invalid-signature',
          keyPair.publicKey
        );
        assert.strictEqual(isValid, false);
      });
    });

    describe('signChallengeResponse', function () {
      test('should sign challenge data with ECDSA', function () {
        const challengeData = {
          challengeId: '1234567890abcdef',
          timestamp: Date.now(),
          url: 'http://localhost:7546',
          contractAddress: '0x1234567890123456789012345678901234567890',
          action: 'url-verification',
        };

        const signature = signChallengeResponse(challengeData, testPrivateKey);

        // Should return a valid ECDSA signature
        assert.ok(typeof signature === 'string');
        assert.ok(signature.startsWith('0x'));
        assert.strictEqual(signature.length, 132); // 0x + 130 hex chars for ECDSA signature
      });

      test('should throw error with invalid private key', function () {
        const challengeData = {
          challengeId: '1234567890abcdef',
          timestamp: Date.now(),
          url: 'http://localhost:7546',
          contractAddress: '0x1234567890123456789012345678901234567890',
          action: 'url-verification',
        };

        assert.throws(() => {
          signChallengeResponse(challengeData, 'invalid-key');
        }, /Challenge response signing failed/);
      });

      test('should produce different signatures for different data', function () {
        const challengeData1 = {
          challengeId: '1234567890abcdef',
          timestamp: Date.now(),
          url: 'http://localhost:7546',
          contractAddress: '0x1234567890123456789012345678901234567890',
          action: 'url-verification',
        };

        const challengeData2 = {
          ...challengeData1,
          challengeId: 'fedcba0987654321',
        };

        const sig1 = signChallengeResponse(challengeData1, testPrivateKey);
        const sig2 = signChallengeResponse(challengeData2, testPrivateKey);

        assert.notStrictEqual(sig1, sig2);
      });
    });

    describe('verifyChallengeResponse', function () {
      test('should verify a valid challenge response signature', function () {
        const challengeData = {
          challengeId: '1234567890abcdef',
          timestamp: Date.now(),
          url: 'http://localhost:7546',
          contractAddress: '0x1234567890123456789012345678901234567890',
          action: 'url-verification',
        };

        const signature = signChallengeResponse(challengeData, testPrivateKey);
        const isValid = verifyChallengeResponse(
          challengeData,
          signature,
          testAddress
        );

        assert.strictEqual(isValid, true);
      });

      test('should reject signature from wrong address', function () {
        const challengeData = {
          challengeId: '1234567890abcdef',
          timestamp: Date.now(),
          url: 'http://localhost:7546',
          contractAddress: '0x1234567890123456789012345678901234567890',
          action: 'url-verification',
        };

        const signature = signChallengeResponse(challengeData, testPrivateKey);
        const wrongAddress = '0x9876543210987654321098765432109876543210';
        const isValid = verifyChallengeResponse(
          challengeData,
          signature,
          wrongAddress
        );

        assert.strictEqual(isValid, false);
      });

      test('should handle address with and without 0x prefix', function () {
        const challengeData = {
          challengeId: '1234567890abcdef',
          timestamp: Date.now(),
          url: 'http://localhost:7546',
          contractAddress: '0x1234567890123456789012345678901234567890',
          action: 'url-verification',
        };

        const signature = signChallengeResponse(challengeData, testPrivateKey);

        // Test with 0x prefix
        const isValid1 = verifyChallengeResponse(
          challengeData,
          signature,
          testAddress
        );

        // Test without 0x prefix
        const addressWithoutPrefix = testAddress.substring(2);
        const isValid2 = verifyChallengeResponse(
          challengeData,
          signature,
          addressWithoutPrefix
        );

        assert.strictEqual(isValid1, true);
        assert.strictEqual(isValid2, true);
      });

      test('should be case insensitive for address comparison', function () {
        const challengeData = {
          challengeId: '1234567890abcdef',
          timestamp: Date.now(),
          url: 'http://localhost:7546',
          contractAddress: '0x1234567890123456789012345678901234567890',
          action: 'url-verification',
        };

        const signature = signChallengeResponse(challengeData, testPrivateKey);

        // Test with uppercase address
        const isValid = verifyChallengeResponse(
          challengeData,
          signature,
          testAddress.toUpperCase()
        );

        assert.strictEqual(isValid, true);
      });

      test('should reject modified challenge data', function () {
        const challengeData = {
          challengeId: '1234567890abcdef',
          timestamp: Date.now(),
          url: 'http://localhost:7546',
          contractAddress: '0x1234567890123456789012345678901234567890',
          action: 'url-verification',
        };

        const signature = signChallengeResponse(challengeData, testPrivateKey);

        // Modify the challenge data
        const modifiedData = { ...challengeData, url: 'http://different.com' };
        const isValid = verifyChallengeResponse(
          modifiedData,
          signature,
          testAddress
        );

        assert.strictEqual(isValid, false);
      });

      test('should handle invalid signature gracefully', function () {
        const challengeData = {
          challengeId: '1234567890abcdef',
          timestamp: Date.now(),
          url: 'http://localhost:7546',
          contractAddress: '0x1234567890123456789012345678901234567890',
          action: 'url-verification',
        };

        const isValid = verifyChallengeResponse(
          challengeData,
          'invalid-signature',
          testAddress
        );
        assert.strictEqual(isValid, false);
      });
    });

    describe('Full Challenge-Response Flow', function () {
      test('should complete full challenge-response cycle', function () {
        const targetUrl = 'http://localhost:7546';
        const contractAddress = '0x1234567890123456789012345678901234567890';

        // 1. Proxy generates challenge
        const challengeObj = generateChallenge(
          keyPair.privateKey,
          targetUrl,
          contractAddress
        );

        // 2. Prover verifies challenge signature
        const challengeValid = verifyChallenge(
          challengeObj.challenge,
          challengeObj.signature,
          keyPair.publicKey
        );
        assert.strictEqual(challengeValid, true);

        // 3. Prover signs challenge response
        const responseSignature = signChallengeResponse(
          challengeObj.challenge,
          testPrivateKey
        );

        // 4. Proxy verifies challenge response
        const responseValid = verifyChallengeResponse(
          challengeObj.challenge,
          responseSignature,
          testAddress
        );
        assert.strictEqual(responseValid, true);
      });

      test('should fail if prover uses wrong private key for response', function () {
        const targetUrl = 'http://localhost:7546';
        const contractAddress = '0x1234567890123456789012345678901234567890';

        // Different valid private key (but wrong one)
        const wrongPrivateKey =
          '0x1111111111111111111111111111111111111111111111111111111111111111';

        // 1. Proxy generates challenge
        const challengeObj = generateChallenge(
          keyPair.privateKey,
          targetUrl,
          contractAddress
        );

        // 2. Prover verifies challenge signature (should pass)
        const challengeValid = verifyChallenge(
          challengeObj.challenge,
          challengeObj.signature,
          keyPair.publicKey
        );
        assert.strictEqual(challengeValid, true);

        // 3. Prover signs with wrong key
        const responseSignature = signChallengeResponse(
          challengeObj.challenge,
          wrongPrivateKey
        );

        // 4. Proxy verifies challenge response (should fail because wrong signer)
        const responseValid = verifyChallengeResponse(
          challengeObj.challenge,
          responseSignature,
          testAddress
        );
        assert.strictEqual(responseValid, false);
      });
    });
  });
});
