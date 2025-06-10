const { test, describe } = require('node:test');
const assert = require('node:assert');
const {
  rlpDecode,
  extractToFromTransaction,
  isValidEthereumAddress,
  normalizeEthereumAddress,
  isContractCreation,
} = require('../src/ethUtils');

describe('Ethereum Utils', () => {
  describe('rlpDecode', () => {
    test('should decode hex string input', () => {
      const hexString = '0x8568656c6c6f'; // "hello" in RLP-encoded hex
      const decoded = rlpDecode(hexString);
      assert.strictEqual(decoded.toString(), 'hello');
    });

    test('should handle empty input', () => {
      const decoded = rlpDecode('0x');
      assert.deepStrictEqual(decoded, Buffer.from([]));
    });
  });

  describe('extractToFromTransaction', () => {
    test('should extract to address from transaction', () => {
      const mockTransaction = [
        '0x1',
        '0x2710',
        '0x5208',
        '0x742d35Cc3127C8B0f8B8b5E0E9e2e5e7b8a8c8c1',
        '0x0',
        '0x',
        '0x1b',
        '0x123',
        '0x456',
      ];

      const result = extractToFromTransaction(mockTransaction);
      assert.strictEqual(result, '0x742d35cc3127c8b0f8b8b5e0e9e2e5e7b8a8c8c1');
    });

    test('should handle contract creation transaction', () => {
      const mockTransaction = [
        '0x1',
        '0x2710',
        '0x5208',
        '',
        '0x0',
        '0x608060',
        '0x1b',
        '0x123',
        '0x456',
      ];

      const result = extractToFromTransaction(mockTransaction);
      assert.strictEqual(result, null);
    });

    test('should handle invalid input', () => {
      assert.strictEqual(extractToFromTransaction(null), null);
      assert.strictEqual(extractToFromTransaction([]), null);
    });
  });

  describe('isValidEthereumAddress', () => {
    test('should validate correct addresses', () => {
      assert.strictEqual(
        isValidEthereumAddress('0x742d35Cc3127C8B0f8B8b5E0E9e2e5e7b8a8c8c1'),
        true
      );
      assert.strictEqual(
        isValidEthereumAddress('0x0000000000000000000000000000000000000000'),
        true
      );
    });

    test('should reject invalid addresses', () => {
      assert.strictEqual(isValidEthereumAddress('invalid'), false);
      assert.strictEqual(isValidEthereumAddress('0x123'), false);
      assert.strictEqual(isValidEthereumAddress(null), false);
    });
  });

  describe('normalizeEthereumAddress', () => {
    test('should normalize to lowercase', () => {
      const result = normalizeEthereumAddress(
        '0x742D35CC3127C8B0f8B8b5E0E9e2e5e7b8a8c8c1'
      );
      assert.strictEqual(result, '0x742d35cc3127c8b0f8b8b5e0e9e2e5e7b8a8c8c1');
    });

    test('should handle addresses without 0x prefix', () => {
      const result = normalizeEthereumAddress(
        '742d35CC3127C8B0f8B8b5E0E9e2e5e7b8a8c8c1'
      );
      assert.strictEqual(result, '0x742d35cc3127c8b0f8b8b5e0e9e2e5e7b8a8c8c1');
    });
  });

  describe('isContractCreation', () => {
    test('should identify contract creation', () => {
      assert.strictEqual(
        isContractCreation({ to: null, data: '0x608060' }),
        true
      );
      assert.strictEqual(
        isContractCreation({ to: '', data: '0x608060' }),
        true
      );
    });

    test('should not identify regular transactions', () => {
      assert.strictEqual(
        isContractCreation({
          to: '0x742d35cc3127c8b0f8b8b5e0e9e2e5e7b8a8c8c1',
        }),
        false
      );
      assert.strictEqual(isContractCreation({ to: null }), false);
    });
  });
});
