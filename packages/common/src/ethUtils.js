/**
 * Common Ethereum transaction decoding utilities
 * Browser-compatible RLP decoding for Ethereum transactions
 */

const { Transaction } = require('ethers');

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

    // If input is already an array, we'll fall back to the legacy parsing
    // as ethers.js expects a raw hex string
    if (Array.isArray(rawTx)) {
      // Legacy fallback for pre-decoded transactions
      return extractToFromLegacyArray(rawTx);
    }

    if (typeof rawTx !== 'string') {
      return null;
    }

    // Ensure proper hex format
    const cleanTx = rawTx.startsWith('0x') ? rawTx : '0x' + rawTx;

    try {
      // Use ethers.js to parse the transaction - handles all types automatically
      const parsedTx = Transaction.from(cleanTx);
      // Return the 'to' address, or null for contract creation transactions
      return parsedTx.to ? parsedTx.to.toLowerCase() : null;
    } catch (ethersError) {
      // If ethers.js fails (e.g., invalid signatures), fall back to manual RLP parsing
      // to extract just the 'to' field, which is useful for testing invalid transactions
      console.error(
        'Error extracting to address from transaction:',
        ethersError.message
      );

      // Try to manually decode the RLP to extract the 'to' field
      return extractToFromRawTransaction(cleanTx);
    }
  } catch (error) {
    console.error(
      'Error extracting to address from transaction:',
      error.message
    );
    return null;
  }
}

/**
 * Legacy fallback for extracting 'to' address from pre-decoded transaction arrays
 * @param {Array} decoded - Pre-decoded transaction array
 * @returns {string|null} Extracted "to" address or null if extraction fails
 */
function extractToFromLegacyArray(decoded) {
  try {
    if (!Array.isArray(decoded) || decoded.length === 0) {
      return null;
    }

    // For legacy transactions: [nonce, gasPrice, gasLimit, to, value, data, v, r, s]
    // The 'to' field is typically at index 3
    if (decoded.length >= 4) {
      const toField = decoded[3];

      if (!toField || toField === '' || toField.length === 0) {
        // Contract creation transaction (to field is empty)
        return null;
      }

      // Convert to proper hex address format
      let toAddress;
      if (typeof toField === 'string') {
        toAddress = toField.startsWith('0x') ? toField : '0x' + toField;
      } else if (toField.toString) {
        toAddress = '0x' + toField.toString('hex');
      } else {
        return null;
      }

      // Ensure proper address format (40 hex characters + 0x prefix)
      if (toAddress.length !== 42) {
        return null;
      }

      return toAddress.toLowerCase();
    }

    return null;
  } catch (error) {
    console.error(
      'Error extracting to address from legacy transaction array:',
      error.message
    );
    return null;
  }
}

/**
 * Extract 'to' address from raw transaction using manual RLP parsing
 * Used as fallback when ethers.js validation fails but we still want to extract the 'to' field
 * @param {string} rawTx - Raw transaction hex string
 * @returns {string|null} Extracted "to" address or null if extraction fails
 */
function extractToFromRawTransaction(rawTx) {
  try {
    // Decode the RLP
    const decoded = rlpDecode(rawTx);

    if (!Array.isArray(decoded)) {
      return null;
    }

    // Handle different transaction types
    let toField;

    // Check if it's a typed transaction (EIP-2718)
    if (
      decoded.length > 0 &&
      typeof decoded[0] === 'object' &&
      decoded[0].data
    ) {
      const firstByte = decoded[0].data[0];

      if (firstByte === 1 || firstByte === 2) {
        // EIP-2930 (Type 1) or EIP-1559 (Type 2) transaction
        // Format: [chainId, nonce, gasPrice/maxPriorityFeePerGas, gasLimit/maxFeePerGas, to, value, data, accessList?, v, r, s]
        // For EIP-1559: [chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, to, value, data, accessList, v, r, s]
        const txFields = decoded.slice(1); // Remove type prefix
        if (txFields.length >= 6) {
          toField = firstByte === 2 ? txFields[5] : txFields[4]; // EIP-1559 vs EIP-2930
        }
      } else {
        // Legacy transaction: [nonce, gasPrice, gasLimit, to, value, data, v, r, s]
        // Even with malformed signatures that get split into multiple items,
        // the core transaction fields should still be at the expected positions
        if (decoded.length >= 4) {
          toField = decoded[3];
        }
      }
    } else {
      // Legacy transaction: [nonce, gasPrice, gasLimit, to, value, data, v, r, s]
      // Even with malformed signatures that get split into multiple items,
      // the core transaction fields should still be at the expected positions
      if (decoded.length >= 4) {
        toField = decoded[3];
      }
    }

    if (!toField || toField === '' || toField.length === 0) {
      // Contract creation transaction (to field is empty)
      return null;
    }

    // Convert to proper hex address format
    let toAddress;
    if (typeof toField === 'string') {
      toAddress = toField.startsWith('0x') ? toField : '0x' + toField;
    } else if (toField.toString) {
      const hexString = toField.toString('hex');
      toAddress = '0x' + hexString;
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
      'Error extracting to address from raw transaction:',
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
