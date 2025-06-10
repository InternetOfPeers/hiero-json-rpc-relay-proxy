const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const { ethers } = require('ethers');

// Import validation utilities to test
const {
  validateRouteSignatures,
  signRouteData,
  ErrorTypes,
  createError,
  validateConfig,
} = require('../src/validation');

describe('validation', function () {
  let testPrivateKey;
  let testWallet;
  let testAddress;

  beforeEach(function () {
    // Generate test wallet and key
    testPrivateKey =
      '0x48b52aba58f4b8dd4cd0e527e28b0eb5f89e2540785b6fcd3c418cc16b640569';
    testWallet = new ethers.Wallet(testPrivateKey);
    testAddress = testWallet.address.toLowerCase();
  });

  describe('validateRouteSignatures', function () {
    test('should validate routes with valid signatures in proxy mode', async function () {
      const routes = [
        {
          addr: '0x3ed660420aa9bc674e8f80f744f8062603da385e',
          proofType: 'create',
          nonce: 33,
          url: 'http://localhost:7546',
          sig: await signRouteData(
            '0x3ed660420aa9bc674e8f80f744f8062603da385e',
            'create',
            33,
            'http://localhost:7546',
            testPrivateKey
          ),
        },
      ];

      const result = validateRouteSignatures(routes);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.validCount, 1);
      assert.strictEqual(result.invalidCount, 0);
      assert.strictEqual(result.derivedSignerAddress, testAddress);
      assert.strictEqual(result.invalidRoutes.length, 0);
    });

    test('should validate routes with valid signatures in prover mode', async function () {
      const routes = [
        {
          addr: '0x3ed660420aa9bc674e8f80f744f8062603da385e',
          proofType: 'create',
          nonce: 33,
          url: 'http://localhost:7546',
          sig: await signRouteData(
            '0x3ed660420aa9bc674e8f80f744f8062603da385e',
            'create',
            33,
            'http://localhost:7546',
            testPrivateKey
          ),
        },
      ];

      const result = validateRouteSignatures(routes, testPrivateKey);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.validCount, 1);
      assert.strictEqual(result.invalidCount, 0);
      assert.strictEqual(result.invalidRoutes.length, 0);
    });

    test('should reject routes with missing signatures', function () {
      const routes = [
        {
          addr: '0x3ed660420aa9bc674e8f80f744f8062603da385e',
          proofType: 'create',
          nonce: 33,
          url: 'http://localhost:7546',
          // Missing sig field
        },
      ];

      const result = validateRouteSignatures(routes);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.validCount, 0);
      assert.strictEqual(result.invalidCount, 1);
      assert.strictEqual(result.invalidRoutes.length, 1);
      assert.ok(result.invalidRoutes[0].error.includes('Missing signature'));
    });

    test('should reject routes with missing required fields', function () {
      const routes = [
        {
          addr: '0x3ed660420aa9bc674e8f80f744f8062603da385e',
          // Missing proofType, nonce, url, sig
        },
      ];

      const result = validateRouteSignatures(routes);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.validCount, 0);
      assert.strictEqual(result.invalidCount, 1);
      assert.ok(
        result.invalidRoutes[0].error.includes('Missing required fields')
      );
    });

    test('should reject invalid routes array', function () {
      const result = validateRouteSignatures(null);

      assert.strictEqual(result.success, false);
      assert.ok(result.errors[0].includes('Routes must be a valid array'));
    });

    test('should validate CREATE2 routes with valid signatures', async function () {
      // Use the private key 0x01 and compute the correct address for it
      const privateKey =
        '0x0000000000000000000000000000000000000000000000000000000000000001';
      const wallet = new ethers.Wallet(privateKey);
      const deployerAddress = wallet.address;
      const salt =
        '0x0000000000000000000000000000000000000000000000000000000000000000';
      const initCodeHash =
        '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470';

      // Import the function to compute the expected address
      const { getContractAddressFromCreate2 } = require('../src/cryptoUtils');
      const expectedAddress = getContractAddressFromCreate2(
        deployerAddress,
        salt,
        initCodeHash
      );

      const routes = [
        {
          addr: expectedAddress,
          proofType: 'create2',
          salt: salt,
          initCodeHash: initCodeHash,
          url: 'http://localhost:7546',
          sig: await signRouteData(
            expectedAddress,
            'create2',
            salt,
            'http://localhost:7546',
            privateKey
          ),
        },
      ];

      const result = validateRouteSignatures(routes);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.validCount, 1);
      assert.strictEqual(result.invalidCount, 0);
      assert.strictEqual(result.invalidRoutes.length, 0);
    });

    test('should reject CREATE2 routes missing required fields', function () {
      const routes = [
        {
          addr: '0xe33c0c7f7df4809055c3eba6c09cfe4baf1bd9e0',
          proofType: 'create2',
          // Missing salt and initCodeHash
          url: 'http://localhost:7546',
          sig: '0x1234567890abcdef',
        },
      ];

      const result = validateRouteSignatures(routes);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.validCount, 0);
      assert.strictEqual(result.invalidCount, 1);
      assert.strictEqual(result.invalidRoutes.length, 1);
      assert.ok(
        result.invalidRoutes[0].error.includes('CREATE2 proof type requires')
      );
    });

    test('should reject CREATE2 routes with invalid contract ownership', async function () {
      // Use a correct deployer but wrong address
      const privateKey =
        '0x0000000000000000000000000000000000000000000000000000000000000001';
      const salt =
        '0x0000000000000000000000000000000000000000000000000000000000000000';
      const initCodeHash =
        '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470';

      const routes = [
        {
          addr: '0x1234567890123456789012345678901234567890', // Wrong address
          proofType: 'create2',
          salt: salt,
          initCodeHash: initCodeHash,
          url: 'http://localhost:7546',
          sig: await signRouteData(
            '0x1234567890123456789012345678901234567890',
            'create2',
            salt,
            'http://localhost:7546',
            privateKey
          ),
        },
      ];

      const result = validateRouteSignatures(routes);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.validCount, 0);
      assert.strictEqual(result.invalidCount, 1);
      assert.strictEqual(result.invalidRoutes.length, 1);
      assert.ok(
        result.invalidRoutes[0].error.includes(
          'Invalid CREATE2 contract ownership'
        )
      );
    });

    test('should reject routes with unsupported proof types', async function () {
      const routes = [
        {
          addr: '0x3ed660420aa9bc674e8f80f744f8062603da385e',
          proofType: 'unsupported',
          nonce: 33,
          url: 'http://localhost:7546',
          sig: await signRouteData(
            '0x3ed660420aa9bc674e8f80f744f8062603da385e',
            'unsupported',
            33,
            'http://localhost:7546',
            testPrivateKey
          ),
        },
      ];

      const result = validateRouteSignatures(routes);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.validCount, 0);
      assert.strictEqual(result.invalidCount, 1);
      assert.strictEqual(result.invalidRoutes.length, 1);
      assert.ok(
        result.invalidRoutes[0].error.includes('Unsupported proof type')
      );
    });
  });

  describe('signRouteData', function () {
    test('should create valid signature for route data', async function () {
      const addr = '0x3ed660420aa9bc674e8f80f744f8062603da385e';
      const proofType = 'create';
      const nonce = 33;
      const url = 'http://localhost:7546';

      const signature = await signRouteData(
        addr,
        proofType,
        nonce,
        url,
        testPrivateKey
      );

      assert.ok(signature);
      assert.ok(signature.startsWith('0x'));
      assert.strictEqual(signature.length, 132); // 0x + 130 hex chars

      // Verify the signature
      const message = addr + proofType + nonce + url;
      const recoveredAddress = ethers.verifyMessage(message, signature);
      assert.strictEqual(recoveredAddress.toLowerCase(), testAddress);
    });

    test('should handle invalid private key', async function () {
      const addr = '0x3ed660420aa9bc674e8f80f744f8062603da385e';
      const proofType = 'create';
      const nonce = 33;
      const url = 'http://localhost:7546';

      try {
        await signRouteData(addr, proofType, nonce, url, 'invalid-key');
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error.message.includes('Failed to sign route data'));
      }
    });
  });

  describe('createError', function () {
    test('should create standardized error object', function () {
      const error = createError(
        ErrorTypes.INVALID_SIGNATURE,
        'Test error message',
        { additionalInfo: 'test' }
      );

      assert.strictEqual(error.type, ErrorTypes.INVALID_SIGNATURE);
      assert.strictEqual(error.message, 'Test error message');
      assert.strictEqual(error.additionalInfo, 'test');
      assert.ok(error.timestamp);
      assert.ok(new Date(error.timestamp).getTime() > 0);
    });
  });

  describe('validateConfig', function () {
    test('should validate configuration with all required fields', function () {
      const config = {
        field1: 'value1',
        field2: 'value2',
        field3: 'value3',
      };
      const requiredFields = ['field1', 'field2', 'field3'];

      const result = validateConfig(config, requiredFields);

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.missing.length, 0);
      assert.strictEqual(result.errors.length, 0);
    });

    test('should identify missing required fields', function () {
      const config = {
        field1: 'value1',
        // Missing field2 and field3
      };
      const requiredFields = ['field1', 'field2', 'field3'];

      const result = validateConfig(config, requiredFields);

      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.missing.length, 2);
      assert.ok(result.missing.includes('field2'));
      assert.ok(result.missing.includes('field3'));
      assert.strictEqual(result.errors.length, 2);
      assert.ok(result.errors[0].includes('Missing required configuration'));
    });
  });

  describe('ErrorTypes', function () {
    test('should export all expected error types', function () {
      assert.ok(ErrorTypes.INVALID_SIGNATURE);
      assert.ok(ErrorTypes.MISSING_SIGNATURE);
      assert.ok(ErrorTypes.INVALID_OWNERSHIP);
      assert.ok(ErrorTypes.MISSING_FIELDS);
      assert.ok(ErrorTypes.VERIFICATION_ERROR);
      assert.ok(ErrorTypes.ENCRYPTION_ERROR);
      assert.ok(ErrorTypes.NETWORK_ERROR);
      assert.ok(ErrorTypes.TIMEOUT_ERROR);
    });
  });
});
