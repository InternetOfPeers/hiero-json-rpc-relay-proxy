/**
 * Common Ethereum transaction decoding utilities
 * Browser-compatible RLP decoding for Ethereum transactions
 */

/**
 * Decode RLP encoded data
 * @param {string} data - Hex string to decode
 * @returns {Object} Decoded RLP data
 */
function rlpDecode(data) {
  function hexToBytes(hex) {
    const bytes = [];
    const cleanHex = hex.replace('0x', '');
    if (cleanHex.length === 0) {
      return [];
    }
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes.push(parseInt(cleanHex.substr(i, 2), 16));
    }
    return bytes;
  }

  function createBuffer(bytes) {
    return {
      data: bytes,
      length: bytes.length,
      slice: function (start, end) {
        return createBuffer(this.data.slice(start, end));
      },
      toString: function (encoding) {
        if (encoding === 'hex') {
          return this.data.map(b => b.toString(16).padStart(2, '0')).join('');
        }
        // Default toString behavior - convert bytes to string
        return String.fromCharCode(...this.data);
      },
    };
  }

  const bytes = hexToBytes(data);

  // Handle empty input
  if (bytes.length === 0) {
    return Buffer.from([]);
  }

  const buffer = createBuffer(bytes);

  function decode(buf, offset = 0) {
    if (offset >= buf.length) return [null, offset];
    const firstByte = buf.data[offset];
    if (firstByte < 0x80) {
      return [createBuffer([firstByte]), offset + 1];
    }
    if (firstByte <= 0xb7) {
      const length = firstByte - 0x80;
      if (length === 0) {
        return [createBuffer([]), offset + 1];
      }
      const data = buf.data.slice(offset + 1, offset + 1 + length);
      return [createBuffer(data), offset + 1 + length];
    }
    if (firstByte <= 0xbf) {
      const lengthOfLength = firstByte - 0xb7;
      let length = 0;
      for (let i = 0; i < lengthOfLength; i++) {
        length = (length << 8) + buf.data[offset + 1 + i];
      }
      const data = buf.data.slice(
        offset + 1 + lengthOfLength,
        offset + 1 + lengthOfLength + length
      );
      return [createBuffer(data), offset + 1 + lengthOfLength + length];
    }
    if (firstByte <= 0xf7) {
      const length = firstByte - 0xc0;
      const result = [];
      let currentOffset = offset + 1;
      while (currentOffset < offset + 1 + length) {
        const [item, newOffset] = decode(buf, currentOffset);
        result.push(item);
        currentOffset = newOffset;
      }
      return [result, offset + 1 + length];
    }
    if (firstByte <= 0xff) {
      const lengthOfLength = firstByte - 0xf7;
      let length = 0;
      for (let i = 0; i < lengthOfLength; i++) {
        length = (length << 8) + buf.data[offset + 1 + i];
      }
      const result = [];
      let currentOffset = offset + 1 + lengthOfLength;
      while (currentOffset < offset + 1 + lengthOfLength + length) {
        const [item, newOffset] = decode(buf, currentOffset);
        result.push(item);
        currentOffset = newOffset;
      }
      return [result, offset + 1 + lengthOfLength + length];
    }
  }

  const [result] = decode(buffer);
  return result;
}

/**
 * Extract the "to" address from a raw Ethereum transaction or transaction array
 * @param {string|Array} rawTx - Raw transaction hex string or decoded transaction array
 * @returns {string|null} Extracted "to" address or null if extraction fails
 */
function extractToFromTransaction(rawTx) {
  try {
    if (!rawTx) {
      return null;
    }

    let decoded;

    // If input is already an array (pre-decoded transaction)
    if (Array.isArray(rawTx)) {
      decoded = rawTx;
    } else if (typeof rawTx === 'string') {
      // Remove 0x prefix if present
      const cleanTx = rawTx.startsWith('0x') ? rawTx.slice(2) : rawTx;

      // Decode the RLP-encoded transaction
      decoded = rlpDecode('0x' + cleanTx);

      if (!decoded || !Array.isArray(decoded)) {
        return null;
      }
    } else {
      return null;
    }

    if (!Array.isArray(decoded) || decoded.length === 0) {
      return null;
    }

    // For different transaction types, the "to" field is at different positions
    // Legacy transactions: [nonce, gasPrice, gasLimit, to, value, data, v, r, s]
    // EIP-1559 transactions: [chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, to, value, data, accessList, v, r, s]

    let toField = null;

    // Check if this is a typed transaction (first byte indicates type)
    if (decoded.length >= 6) {
      // Try legacy transaction format first (most common)
      const legacyToField = decoded[3]; // "to" is at index 3 in legacy transactions

      if (legacyToField && legacyToField !== '' && legacyToField.length > 0) {
        toField = legacyToField;
      } else if (decoded.length >= 9) {
        // Try EIP-1559 format - "to" is at index 5
        const eip1559ToField = decoded[5];
        if (
          eip1559ToField &&
          eip1559ToField !== '' &&
          eip1559ToField.length > 0
        ) {
          toField = eip1559ToField;
        }
      }
    }

    if (!toField || toField === '' || toField.length === 0) {
      // This might be a contract creation transaction (to field is empty)
      return null;
    }

    // If it's already a hex string, use it directly
    let toAddress;
    if (typeof toField === 'string') {
      toAddress = toField.startsWith('0x') ? toField : '0x' + toField;
    } else if (toField.toString) {
      // Convert to hex address
      toAddress = '0x' + toField.toString('hex');
    } else {
      return null;
    }

    // Ensure proper address format (40 hex characters + 0x prefix)
    if (toAddress.length !== 42) {
      return null;
    }

    return toAddress.toLowerCase();
  } catch (error) {
    console.error(
      'Error extracting to address from transaction:',
      error.message
    );
    return null;
  }
}

/**
 * Validate Ethereum address format
 * @param {string} address - Address to validate
 * @returns {boolean} True if valid Ethereum address
 */
function isValidEthereumAddress(address) {
  if (!address || typeof address !== 'string') {
    return false;
  }

  // Remove 0x prefix for validation
  const cleanAddress = address.startsWith('0x') ? address.slice(2) : address;

  // Check length (40 hex characters)
  if (cleanAddress.length !== 40) {
    return false;
  }

  // Check if all characters are valid hex
  return /^[0-9a-fA-F]+$/.test(cleanAddress);
}

/**
 * Normalize Ethereum address to lowercase with 0x prefix
 * @param {string} address - Address to normalize
 * @returns {string|null} Normalized address or null if invalid
 */
function normalizeEthereumAddress(address) {
  if (!isValidEthereumAddress(address)) {
    return null;
  }

  const cleanAddress = address.startsWith('0x') ? address.slice(2) : address;
  return '0x' + cleanAddress.toLowerCase();
}

/**
 * Check if transaction is a contract creation (empty "to" field)
 * @param {string|Array|Object} rawTx - Raw transaction hex string, array, or transaction object
 * @returns {boolean} True if contract creation transaction
 */
function isContractCreation(rawTx) {
  // Handle object input (transaction object with to field)
  if (rawTx && typeof rawTx === 'object' && !Array.isArray(rawTx)) {
    const to = rawTx.to;
    const data = rawTx.data;

    // Contract creation requires empty 'to' field AND some data
    const hasEmptyTo = !to || to === '' || to === null;
    const hasData = !!(data && data !== '' && data !== '0x');

    return hasEmptyTo && hasData;
  }

  // Handle other inputs via extractToFromTransaction
  const toAddress = extractToFromTransaction(rawTx);
  return toAddress === null;
}

module.exports = {
  rlpDecode,
  extractToFromTransaction,
  isValidEthereumAddress,
  normalizeEthereumAddress,
  isContractCreation,
};
