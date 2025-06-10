/**
 * Common message utilities for Hedera topic message handling
 */

/**
 * Check if a message is chunked by looking for chunk_info
 * @param {Object} message - The message object from Hedera
 * @returns {boolean} True if message is chunked
 */
function isChunkedMessage(message) {
  try {
    const content = Buffer.from(message.message, 'base64').toString('utf8');
    const parsed = JSON.parse(content);
    return !!(parsed.chunk_info && parsed.chunk_info.total > 1);
  } catch (error) {
    return false;
  }
}

/**
 * Check if a message is chunked (proxy-style interface)
 * Expects chunk_info to be directly on the message object
 * @param {Object} message - The message object from Hedera
 * @returns {boolean} True if message is chunked
 */
function isChunkedMessageProxy(message) {
  return !!(message && message.chunk_info && message.chunk_info.total > 1);
}

/**
 * Get chunk group key for identifying related chunks
 * @param {Object} message - The message object from Hedera
 * @returns {string} Group key for chunks
 */
function getChunkGroupKey(message) {
  // Use transaction valid start as group identifier
  const validStart = message.transaction_valid_start;
  if (!validStart) {
    throw new Error('Message missing transaction_valid_start');
  }
  return `${validStart.seconds}_${validStart.nanos}`;
}

/**
 * Combine multiple chunked messages into a single message
 * @param {Object[]} chunks - Array of chunk messages sorted by chunk number
 * @returns {Object} Combined message object
 */
function combineChunkedMessages(chunks) {
  if (!chunks || chunks.length === 0) {
    throw new Error('No chunks provided for combining');
  }

  // Use the first chunk as the base message structure
  const baseMessage = { ...chunks[0] };

  // Combine all message content
  let combinedContent = '';
  for (const chunk of chunks) {
    const chunkContent = Buffer.from(chunk.message, 'base64').toString('utf8');
    combinedContent += chunkContent;
  }

  // Encode the combined content back to base64
  baseMessage.message = Buffer.from(combinedContent, 'utf8').toString('base64');

  // Remove chunk_info from the combined message since it's no longer chunked
  delete baseMessage.chunk_info;

  return baseMessage;
}

/**
 * Parse message content from base64
 * @param {Object} message - The message object from Hedera
 * @returns {string} Parsed message content
 */
function parseMessageContent(message) {
  return Buffer.from(message.message, 'base64').toString('utf8');
}

/**
 * Extract chunk info from a chunked message
 * @param {Object} message - The message object from Hedera
 * @returns {Object|null} Chunk info or null if not chunked
 */
function extractChunkInfo(message) {
  try {
    const content = parseMessageContent(message);
    const parsed = JSON.parse(content);
    return parsed.chunk_info || null;
  } catch (error) {
    return null;
  }
}

/**
 * Validate message structure
 * @param {Object} message - The message object to validate
 * @returns {Object} Validation result
 */
function validateMessageStructure(message) {
  const result = {
    valid: true,
    errors: [],
  };

  if (!message) {
    result.valid = false;
    result.errors.push('Message is null or undefined');
    return result;
  }

  if (!message.message) {
    result.valid = false;
    result.errors.push('Message content is missing');
  }

  if (!message.consensus_timestamp) {
    result.valid = false;
    result.errors.push('Consensus timestamp is missing');
  }

  if (!message.sequence_number) {
    result.valid = false;
    result.errors.push('Sequence number is missing');
  }

  return result;
}

module.exports = {
  isChunkedMessage,
  getChunkGroupKey,
  combineChunkedMessages,
  parseMessageContent,
  extractChunkInfo,
  validateMessageStructure,
};
