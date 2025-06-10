const { test, describe } = require('node:test');
const assert = require('node:assert');

// Import Hedera utilities to test
const {
  getMirrorNodeUrl,
  isValidAccountId,
  isValidTopicId,
  validatePrivateKey,
  hederaTimestampToDate,
  parseTopicMessage,
  HederaErrorTypes,
} = require('../src/hederaUtils');

describe('hederaUtils', function () {
  describe('getMirrorNodeUrl', function () {
    test('should return mainnet mirror node URL', function () {
      const url = getMirrorNodeUrl('mainnet');
      assert.strictEqual(url, 'https://mainnet-public.mirrornode.hedera.com');
    });

    test('should return testnet mirror node URL', function () {
      const url = getMirrorNodeUrl('testnet');
      assert.strictEqual(url, 'https://testnet.mirrornode.hedera.com');
    });

    test('should default to testnet for unknown network', function () {
      const url = getMirrorNodeUrl('unknown');
      assert.strictEqual(url, 'https://testnet.mirrornode.hedera.com');
    });

    test('should handle case insensitive network names', function () {
      const url1 = getMirrorNodeUrl('MAINNET');
      const url2 = getMirrorNodeUrl('Testnet');

      assert.strictEqual(url1, 'https://mainnet-public.mirrornode.hedera.com');
      assert.strictEqual(url2, 'https://testnet.mirrornode.hedera.com');
    });
  });

  describe('isValidAccountId', function () {
    test('should validate correct account ID format', function () {
      assert.strictEqual(isValidAccountId('0.0.123456'), true);
      assert.strictEqual(isValidAccountId('0.0.1'), true);
      assert.strictEqual(isValidAccountId('0.0.999999999'), true);
    });

    test('should reject invalid account ID formats', function () {
      assert.strictEqual(isValidAccountId('123456'), false);
      assert.strictEqual(isValidAccountId('0.123456'), false);
      assert.strictEqual(isValidAccountId('0.0'), false);
      assert.strictEqual(isValidAccountId('0.0.'), false);
      assert.strictEqual(isValidAccountId('0.0.abc'), false);
      assert.strictEqual(isValidAccountId('1.0.123456'), false);
      assert.strictEqual(isValidAccountId(''), false);
      assert.strictEqual(isValidAccountId(null), false);
      assert.strictEqual(isValidAccountId(undefined), false);
    });
  });

  describe('isValidTopicId', function () {
    test('should validate correct topic ID format', function () {
      assert.strictEqual(isValidTopicId('0.0.123456'), true);
      assert.strictEqual(isValidTopicId('0.0.1'), true);
      assert.strictEqual(isValidTopicId('0.0.999999999'), true);
    });

    test('should reject invalid topic ID formats', function () {
      assert.strictEqual(isValidTopicId('123456'), false);
      assert.strictEqual(isValidTopicId('0.123456'), false);
      assert.strictEqual(isValidTopicId('0.0'), false);
      assert.strictEqual(isValidTopicId('0.0.'), false);
      assert.strictEqual(isValidTopicId('0.0.abc'), false);
      assert.strictEqual(isValidTopicId('1.0.123456'), false);
      assert.strictEqual(isValidTopicId(''), false);
      assert.strictEqual(isValidTopicId(null), false);
      assert.strictEqual(isValidTopicId(undefined), false);
    });
  });

  describe('validatePrivateKey', function () {
    test('should validate ECDSA private key format', function () {
      const validEcdsaKey =
        '0x48b52aba58f4b8dd4cd0e527e28b0eb5f89e2540785b6fcd3c418cc16b640569';
      const result = validatePrivateKey(validEcdsaKey, 'ECDSA');

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.error, undefined);
    });

    test('should reject invalid ECDSA private key format', function () {
      const invalidKeys = [
        '48b52aba58f4b8dd4cd0e527e28b0eb5f89e2540785b6fcd3c418cc16b640569', // Missing 0x
        '0x48b52aba58f4b8dd4cd0e527e28b0eb5f89e254078', // Too short
        '0x48b52aba58f4b8dd4cd0e527e28b0eb5f89e2540785b6fcd3c418cc16b640569abc', // Too long
        '0xgg48b52aba58f4b8dd4cd0e527e28b0eb5f89e2540785b6fcd3c418cc16b6405', // Invalid hex
      ];

      invalidKeys.forEach(key => {
        const result = validatePrivateKey(key, 'ECDSA');
        assert.strictEqual(result.valid, false);
        assert.ok(result.error);
      });
    });

    test('should handle missing or invalid input', function () {
      const invalidInputs = [null, undefined, '', 123, {}];

      invalidInputs.forEach(input => {
        const result = validatePrivateKey(input);
        assert.strictEqual(result.valid, false);
        assert.ok(result.error);
      });
    });
  });

  describe('hederaTimestampToDate', function () {
    test('should convert Hedera timestamp to Date', function () {
      const hederaTimestamp = {
        seconds: 1623456789,
        nanos: 123456789,
      };

      const date = hederaTimestampToDate(hederaTimestamp);

      assert.ok(date instanceof Date);
      // Check if the conversion is approximately correct (within 1 second)
      const expectedMs = 1623456789 * 1000 + Math.floor(123456789 / 1000000);
      assert.ok(Math.abs(date.getTime() - expectedMs) < 1000);
    });

    test('should handle timestamp with only seconds', function () {
      const hederaTimestamp = {
        seconds: 1623456789,
      };

      const date = hederaTimestampToDate(hederaTimestamp);

      assert.ok(date instanceof Date);
      assert.strictEqual(date.getTime(), 1623456789 * 1000);
    });

    test('should handle null timestamp', function () {
      const date = hederaTimestampToDate(null);
      assert.strictEqual(date, null);
    });

    test('should handle undefined timestamp', function () {
      const date = hederaTimestampToDate(undefined);
      assert.strictEqual(date, null);
    });
  });

  describe('parseTopicMessage', function () {
    test('should parse valid topic message', function () {
      const rawMessage = {
        consensusTimestamp: {
          seconds: 1623456789,
          nanos: 123456789,
        },
        sequenceNumber: 1,
        runningHash: 'abc123',
        contents: Buffer.from('Hello World').toString('base64'),
        topicId: '0.0.123456',
        payer: '0.0.654321',
      };

      const parsed = parseTopicMessage(rawMessage);

      assert.ok(parsed.consensusTimestamp instanceof Date);
      assert.strictEqual(parsed.sequenceNumber, 1);
      assert.strictEqual(parsed.runningHash, 'abc123');
      assert.strictEqual(parsed.contents, 'Hello World');
      assert.strictEqual(parsed.topicId, '0.0.123456');
      assert.strictEqual(parsed.payer, '0.0.654321');
    });

    test('should handle message with JSON content', function () {
      const jsonContent = { test: 'data', number: 42 };
      const rawMessage = {
        consensusTimestamp: {
          seconds: 1623456789,
          nanos: 0,
        },
        sequenceNumber: 1,
        runningHash: 'abc123',
        contents: Buffer.from(JSON.stringify(jsonContent)).toString('base64'),
        topicId: '0.0.123456',
        payer: '0.0.654321',
      };

      const parsed = parseTopicMessage(rawMessage);

      assert.strictEqual(parsed.contents, JSON.stringify(jsonContent));

      // Verify we can parse the JSON content
      const parsedJson = JSON.parse(parsed.contents);
      assert.deepStrictEqual(parsedJson, jsonContent);
    });

    test('should handle message parsing errors', function () {
      const invalidMessage = {
        // Missing required fields
        sequenceNumber: 1,
      };

      try {
        parseTopicMessage(invalidMessage);
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error.message.includes('Failed to parse topic message'));
      }
    });
  });

  describe('HederaErrorTypes', function () {
    test('should export all expected error types', function () {
      assert.ok(HederaErrorTypes.INVALID_ACCOUNT_ID);
      assert.ok(HederaErrorTypes.INVALID_TOPIC_ID);
      assert.ok(HederaErrorTypes.INVALID_PRIVATE_KEY);
      assert.ok(HederaErrorTypes.CLIENT_INIT_FAILED);
      assert.ok(HederaErrorTypes.TOPIC_NOT_FOUND);
      assert.ok(HederaErrorTypes.INSUFFICIENT_BALANCE);
      assert.ok(HederaErrorTypes.NETWORK_ERROR);
    });

    test('should have string values for error types', function () {
      Object.values(HederaErrorTypes).forEach(errorType => {
        assert.strictEqual(typeof errorType, 'string');
        assert.ok(errorType.length > 0);
      });
    });
  });
});
