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
  // ethTxDecoder tests
  describe('ethTxDecoder', () => {
    test('should decode a legacy Ethereum transaction and extract the to address', () => {
      const rawTx =
        '0xf86b808504a817c800825208943535353535353535353535353535353535353535880de0b6b3a76400008025a0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0a05b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b';
      const to = extractToFromTransaction(rawTx);
      assert.strictEqual(to, '0x3535353535353535353535353535353535353535');
    });

    test('should return null for contract creation transaction', () => {
      const rawTx =
        '0xf880808504a817c80082520880880de0b6b3a764000080b8646060604052341561000f57600080fd5b61017e8061001e6000396000f3006060604052600436106100565763ffffffff60e060020a60003504166360fe47b1811461005b5780636d4ce63c14610080575b600080fd5b341561006657600080fd5b61006e6100a3565b6040518082815260200191505060405180910390f35b341561008b57600080fd5b6100936100c9565b6040518082815260200191505060405180910390f35b600060078202905060005490505b90565b600054815600a165627a7a72305820b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0029';
      const to = extractToFromTransaction(rawTx);
      assert.strictEqual(to, null);
    });

    test('should decode a simple RLP string', () => {
      // RLP encoding of 'dog' is 0x83646f67
      const rlp = '0x83646f67';
      const decoded = rlpDecode(rlp);
      // Should decode to a buffer-like object with 'dog' in hex
      assert.strictEqual(decoded.toString('hex'), '646f67');
    });

    test('should decode a simple RLP list', () => {
      // RLP encoding of ['cat', 'dog'] is 0xc88363617483646f67
      const rlp = '0xc88363617483646f67';
      const decoded = rlpDecode(rlp);
      // Should decode to an array of buffer-like objects
      assert.strictEqual(Array.isArray(decoded), true);
      assert.strictEqual(decoded[0].toString('hex'), '636174');
      assert.strictEqual(decoded[1].toString('hex'), '646f67');
    });

    test('should return null for invalid transaction', () => {
      const rawTx = '0xdeadbeef';
      const to = extractToFromTransaction(rawTx);
      assert.strictEqual(to, null);
    });
  });
});
