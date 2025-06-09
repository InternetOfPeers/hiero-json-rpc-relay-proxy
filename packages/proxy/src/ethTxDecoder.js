// Browser-compatible RLP decoding for Ethereum transactions
function rlpDecode(data) {
  function hexToBytes(hex) {
    const bytes = [];
    const cleanHex = hex.replace("0x", "");
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
        if (encoding === "hex") {
          return this.data.map((b) => b.toString(16).padStart(2, "0")).join("");
        }
        return this.data;
      },
    };
  }

  const bytes = hexToBytes(data);
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
      const endOffset = offset + 1 + length;
      while (currentOffset < endOffset) {
        const [item, newOffset] = decode(buf, currentOffset);
        if (item !== null) result.push(item);
        currentOffset = newOffset;
      }
      return [result, endOffset];
    }
    if (firstByte <= 0xff) {
      const lengthOfLength = firstByte - 0xf7;
      let length = 0;
      for (let i = 0; i < lengthOfLength; i++) {
        length = (length << 8) + buf.data[offset + 1 + i];
      }
      const result = [];
      let currentOffset = offset + 1 + lengthOfLength;
      const endOffset = offset + 1 + lengthOfLength + length;
      while (currentOffset < endOffset) {
        const [item, newOffset] = decode(buf, currentOffset);
        if (item !== null) result.push(item);
        currentOffset = newOffset;
      }
      return [result, endOffset];
    }
    throw new Error("Invalid RLP encoding");
  }
  const [result] = decode(buffer);
  return result;
}

function extractToFromTransaction(rawTx) {
  try {
    let cleanTx = rawTx.replace(/^0x/, "");
    let decoded;
    if (cleanTx.startsWith("02")) {
      cleanTx = cleanTx.slice(2);
      decoded = rlpDecode("0x" + cleanTx);
      if (!Array.isArray(decoded) || decoded.length < 6) {
        throw new Error("Invalid EIP-1559 transaction format");
      }
      var toField = decoded[5];
    } else {
      decoded = rlpDecode("0x" + cleanTx);
      if (!Array.isArray(decoded) || decoded.length < 6) {
        throw new Error("Invalid legacy transaction format");
      }
      var toField = decoded[3];
    }
    if (!toField || toField.length === 0) {
      return null;
    }
    const toAddress = "0x" + toField.toString("hex");
    return toAddress.toLowerCase();
  } catch (error) {
    return null;
  }
}

module.exports = { rlpDecode, extractToFromTransaction };
