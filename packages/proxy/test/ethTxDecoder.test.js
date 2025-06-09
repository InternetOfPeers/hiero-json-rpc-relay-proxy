const { test, describe } = require("node:test");
const assert = require("node:assert");

// Import modules to test
const { rlpDecode, extractToFromTransaction } = require("../src/ethTxDecoder");

// ethTxDecoder tests
describe("ethTxDecoder", () => {
  test("should decode a legacy Ethereum transaction and extract the to address", () => {
    const rawTx =
      "0xf86b808504a817c800825208943535353535353535353535353535353535353535880de0b6b3a76400008025a0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0a05b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b";
    const to = extractToFromTransaction(rawTx);
    assert.strictEqual(to, "0x3535353535353535353535353535353535353535");
  });

  test("should return null for contract creation transaction", () => {
    const rawTx =
      "0xf880808504a817c80082520880880de0b6b3a764000080b8646060604052341561000f57600080fd5b61017e8061001e6000396000f3006060604052600436106100565763ffffffff60e060020a60003504166360fe47b1811461005b5780636d4ce63c14610080575b600080fd5b341561006657600080fd5b61006e6100a3565b6040518082815260200191505060405180910390f35b341561008b57600080fd5b6100936100c9565b6040518082815260200191505060405180910390f35b600060078202905060005490505b90565b600054815600a165627a7a72305820b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0029";
    const to = extractToFromTransaction(rawTx);
    assert.strictEqual(to, null);
  });

  test("should decode a simple RLP string", () => {
    // RLP encoding of 'dog' is 0x83646f67
    const rlp = "0x83646f67";
    const decoded = rlpDecode(rlp);
    // Should decode to a buffer-like object with 'dog' in hex
    assert.strictEqual(decoded.toString("hex"), "646f67");
  });

  test("should decode a simple RLP list", () => {
    // RLP encoding of ['cat', 'dog'] is 0xc88363617483646f67
    const rlp = "0xc88363617483646f67";
    const decoded = rlpDecode(rlp);
    // Should decode to an array of buffer-like objects
    assert.strictEqual(Array.isArray(decoded), true);
    assert.strictEqual(decoded[0].toString("hex"), "636174");
    assert.strictEqual(decoded[1].toString("hex"), "646f67");
  });

  test("should return null for invalid transaction", () => {
    const rawTx = "0xdeadbeef";
    const to = extractToFromTransaction(rawTx);
    assert.strictEqual(to, null);
  });
});
