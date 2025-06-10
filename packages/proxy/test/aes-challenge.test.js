// Test for AES challenge encryption/decryption functionality
// This test verifies that the Prover can correctly handle AES-encrypted challenges from the Proxy

const { describe, test, beforeEach } = require('node:test');
const assert = require('assert');
const crypto = require('crypto');
const {
  generateChallenge,
  verifyChallenge,
  signChallengeResponse,
  encryptAES,
  decryptAES,
  generateAESKey,
} = require('@hiero-json-rpc-relay/common');
const { ethers } = require('ethers');

describe('AES Challenge Handling', function () {
  let rsaKeyPair;
  let ecdsaWallet;
  let aesKey;
  let contractAddress;
  let targetUrl;

  beforeEach(function () {
    // Generate RSA key pair for challenge signing
    rsaKeyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    // Generate ECDSA wallet for challenge response
    ecdsaWallet = ethers.Wallet.createRandom();

    // Generate AES key for encryption
    aesKey = generateAESKey();

    contractAddress = '0x3ed660420aa9bc674e8f80f744f8062603da385e';
    targetUrl = 'http://localhost:7546';
  });

  test('should correctly encrypt and decrypt challenges with AES', function () {
    // 1. Generate challenge (proxy side)
    const challengeObj = generateChallenge(
      rsaKeyPair.privateKey,
      targetUrl,
      contractAddress
    );

    // Verify challenge structure
    assert.ok(challengeObj.challenge);
    assert.ok(challengeObj.signature);
    assert.strictEqual(challengeObj.challenge.url, targetUrl);
    assert.strictEqual(challengeObj.challenge.contractAddress, contractAddress);

    // 2. Encrypt challenge with AES (proxy side)
    const challengeJson = JSON.stringify(challengeObj);
    const encryptedChallenge = encryptAES(challengeJson, aesKey);
    const encryptedChallengeJson = JSON.stringify(encryptedChallenge);

    // Verify encrypted structure
    const parsedEncrypted = JSON.parse(encryptedChallengeJson);
    assert.ok(parsedEncrypted.iv);
    assert.ok(parsedEncrypted.data);
    assert.strictEqual(typeof parsedEncrypted.iv, 'string');
    assert.strictEqual(typeof parsedEncrypted.data, 'string');

    // 3. Simulate prover receiving and decrypting challenge
    // This simulates the exact logic in prover.js handleChallenge function
    let challengeObj_prover;
    const body = encryptedChallengeJson; // This is what prover gets
    const proverAESKeys = new Map();
    proverAESKeys.set(contractAddress.toLowerCase(), aesKey);

    // Parse body as JSON first
    const parsedBody = JSON.parse(body);

    // Check if it looks like an unencrypted challenge (has challenge and signature)
    if (parsedBody.challenge && parsedBody.signature) {
      challengeObj_prover = parsedBody;
    }
    // Check if it looks like an encrypted challenge (has iv and data)
    else if (parsedBody.iv && parsedBody.data) {
      // Try to decrypt with stored AES key
      let decrypted = false;
      for (const [
        storedContractAddress,
        storedAesKey,
      ] of proverAESKeys.entries()) {
        try {
          const decryptedData = decryptAES(parsedBody, storedAesKey);
          challengeObj_prover = JSON.parse(decryptedData);
          decrypted = true;
          break;
        } catch (decryptError) {
          continue;
        }
      }
      assert.strictEqual(
        decrypted,
        true,
        'Challenge should have been decrypted successfully'
      );
    } else {
      assert.fail(
        'Challenge should have been recognized as encrypted or unencrypted'
      );
    }

    // 4. Verify decrypted challenge structure
    assert.ok(challengeObj_prover.challenge);
    assert.ok(challengeObj_prover.signature);
    assert.strictEqual(
      challengeObj_prover.challenge.challengeId,
      challengeObj.challenge.challengeId
    );
    assert.strictEqual(challengeObj_prover.challenge.url, targetUrl);
    assert.strictEqual(
      challengeObj_prover.challenge.contractAddress,
      contractAddress
    );

    // 5. Verify challenge signature (prover side)
    const challengeValid = verifyChallenge(
      challengeObj_prover.challenge,
      challengeObj_prover.signature,
      rsaKeyPair.publicKey
    );
    assert.strictEqual(challengeValid, true);

    // 6. Sign challenge response (prover side)
    const responseSignature = signChallengeResponse(
      challengeObj_prover.challenge,
      ecdsaWallet.privateKey
    );

    const response = {
      challengeId: challengeObj_prover.challenge.challengeId,
      signature: responseSignature,
      timestamp: Date.now(),
      status: 'verified',
    };

    // 7. Encrypt response with AES (prover side)
    const responseJson = JSON.stringify(response);
    const encryptedResponse = encryptAES(responseJson, aesKey);
    const encryptedResponseJson = JSON.stringify(encryptedResponse);

    // 8. Decrypt response with AES (proxy side)
    const parsedEncryptedResponse = JSON.parse(encryptedResponseJson);
    const decryptedResponseJson = decryptAES(parsedEncryptedResponse, aesKey);
    const decryptedResponse = JSON.parse(decryptedResponseJson);

    // 9. Verify final response
    assert.strictEqual(
      decryptedResponse.challengeId,
      challengeObj.challenge.challengeId
    );
    assert.strictEqual(decryptedResponse.status, 'verified');
    assert.ok(decryptedResponse.signature);
  });

  test('should handle unencrypted challenges correctly', function () {
    // Generate unencrypted challenge
    const challengeObj = generateChallenge(
      rsaKeyPair.privateKey,
      targetUrl,
      contractAddress
    );
    const challengeJson = JSON.stringify(challengeObj);

    // Simulate prover receiving unencrypted challenge
    const body = challengeJson;
    let challengeObj_prover;

    // Parse body as JSON
    const parsedBody = JSON.parse(body);

    // Check if it looks like an unencrypted challenge (has challenge and signature)
    if (parsedBody.challenge && parsedBody.signature) {
      challengeObj_prover = parsedBody;
    }
    // Check if it looks like an encrypted challenge (has iv and data)
    else if (parsedBody.iv && parsedBody.data) {
      assert.fail('Should not have been detected as encrypted');
    } else {
      assert.fail('Should have been detected as unencrypted challenge');
    }

    // Verify structure
    assert.ok(challengeObj_prover.challenge);
    assert.ok(challengeObj_prover.signature);
    assert.strictEqual(challengeObj_prover.challenge.url, targetUrl);
    assert.strictEqual(
      challengeObj_prover.challenge.contractAddress,
      contractAddress
    );
  });

  test('should reject invalid challenge formats', function () {
    // Test with invalid JSON structure
    const invalidChallenge = { someProperty: 'value', otherProperty: 123 };
    const invalidJson = JSON.stringify(invalidChallenge);
    const parsedBody = JSON.parse(invalidJson);

    // Should not match either unencrypted or encrypted format
    const isUnencrypted = !!(parsedBody.challenge && parsedBody.signature);
    const isEncrypted = !!(parsedBody.iv && parsedBody.data);

    assert.strictEqual(isUnencrypted, false);
    assert.strictEqual(isEncrypted, false);
  });

  test('should handle AES decryption failure gracefully', function () {
    // Generate and encrypt challenge
    const challengeObj = generateChallenge(
      rsaKeyPair.privateKey,
      targetUrl,
      contractAddress
    );
    const challengeJson = JSON.stringify(challengeObj);
    const encryptedChallenge = encryptAES(challengeJson, aesKey);
    const encryptedChallengeJson = JSON.stringify(encryptedChallenge);

    // Simulate prover with wrong AES key
    const wrongAesKey = generateAESKey();
    const proverAESKeys = new Map();
    proverAESKeys.set(contractAddress.toLowerCase(), wrongAesKey);

    const body = encryptedChallengeJson;
    const parsedBody = JSON.parse(body);

    // Should detect as encrypted but fail to decrypt
    assert.strictEqual(!!(parsedBody.iv && parsedBody.data), true);

    let decrypted = false;
    for (const [
      storedContractAddress,
      storedAesKey,
    ] of proverAESKeys.entries()) {
      try {
        const decryptedData = decryptAES(parsedBody, storedAesKey);
        JSON.parse(decryptedData);
        decrypted = true;
        break;
      } catch (decryptError) {
        // Expected to fail with wrong key
        continue;
      }
    }

    assert.strictEqual(decrypted, false);
  });
});
