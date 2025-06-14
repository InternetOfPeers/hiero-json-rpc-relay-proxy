const {
  TopicInfoQuery,
  TopicMessageSubmitTransaction,
  CustomFeeLimit,
  CustomFixedFee,
  Hbar,
} = require('@hashgraph/sdk');
const {
  hedera: { initHederaClient, getMirrorNodeUrl },
  centsToTinybars,
  centsToHBAR,
} = require('@hiero-json-rpc-relay/common');

// Prover Hedera Manager Module
// Dedicated manager for prover scripts with ECDSA key support
// This is separate from the main HederaManager to avoid dependencies
// and to provide prover-specific functionality

class HederaManager {
  constructor(config = {}) {
    this.accountId = config.accountId;
    this.privateKey = config.privateKey;
    this.network = config.network || 'testnet';
    this.topicId = config.topicId;
    this.client = null;
    this.keyType = config.keyType || 'ECDSA'; // Default to ECDSA
  }

  // Initialize Hedera client with ECDSA support
  initClient() {
    if (!this.accountId || !this.privateKey) {
      console.log(
        '❌ Hedera credentials not provided. Please set PROVER_HEDERA_ACCOUNT_ID and PROVER_HEDERA_PRIVATE_KEY'
      );
      return null;
    }

    try {
      const config = {
        accountId: this.accountId,
        privateKey: this.privateKey,
        network: this.network,
        keyType: this.keyType,
      };

      const result = initHederaClient(config);
      if (!result || !result.client) {
        throw new Error('Failed to initialize Hedera client');
      }

      console.log(`✅ Prover Hedera client initialized for ${this.network}`);
      console.log(`   Using account: ${this.accountId}`);
      console.log(`   Key type: ${result.keyType}`);

      this.client = result.client;
      return result.client;
    } catch (error) {
      console.error(
        '❌ Failed to initialize prover Hedera client:',
        error.message
      );
      console.error('   Make sure your private key format is correct:');
      console.error("   - ECDSA keys should start with '0x' (hex format)");
      console.error('   - Ed25519 keys use the standard Hedera format');
      return null;
    }
  }

  // Check if topic exists using mirror node
  async checkTopicExists(topicIdString) {
    if (!topicIdString) {
      return false;
    }

    try {
      console.log(
        `🔍 Checking if topic ${topicIdString} exists via mirror node...`
      );
      const mirrorNodeUrl = getMirrorNodeUrl(this.network);
      const url = `${mirrorNodeUrl}/api/v1/topics/${topicIdString}`;

      // Use node-fetch for HTTP requests
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const topicData = await response.json();
      console.log(`✅ Topic ${topicIdString} exists and is accessible`);
      console.log(`   Topic memo: ${topicData.memo || 'No memo'}`);
      return true;
    } catch (error) {
      console.log(
        `❌ Topic ${topicIdString} does not exist or is not accessible:`,
        error.message
      );
      return false;
    }
  }

  // Submit message to topic with HIP-991 fee handling
  async submitMessageToTopic(topicIdString, message) {
    if (!this.client || !topicIdString || !message) {
      throw new Error(
        'Missing required parameters for topic message submission'
      );
    }

    try {
      console.log(`📤 Submitting message to HIP-991 topic ${topicIdString}...`);

      // Set custom fee in tinybars for $2 worth of HBAR
      const customFee = new CustomFixedFee().setAmount(
        await centsToTinybars(200)
      );
      const customFeeLimit = new CustomFeeLimit()
        .setAccountId(this.client.operatorAccountId) // Prover account pays the fee
        .setFees([customFee]);

      const transaction = new TopicMessageSubmitTransaction()
        .setTopicId(topicIdString)
        .setMessage(message)
        .addCustomFeeLimit(customFeeLimit) // Set max custom fee limit for HIP-991
        .setMaxTransactionFee(new Hbar(Math.ceil(await centsToHBAR(110))));

      const txResponse = await transaction.execute(this.client);
      const receipt = await txResponse.getReceipt(this.client);

      console.log(
        `✅ Message submitted to HIP-991 topic ${topicIdString} successfully`
      );
      console.log(
        `💰 Prover paid custom fee for HIP-991 topic (max: 0.6 HBAR)`
      );
      console.log(`   Transaction ID: ${txResponse.transactionId}`);
      console.log(`   Sequence Number: ${receipt.topicSequenceNumber}`);
      return receipt;
    } catch (error) {
      console.error(
        `❌ Failed to submit message to HIP-991 topic ${topicIdString}:`,
        error.message
      );
      throw error;
    }
  }

  // Get topic info for prover
  getTopicInfo() {
    return {
      topicId: this.topicId,
      hederaNetwork: this.network,
      accountId: this.accountId,
      clientInitialized: this.client !== null,
      keyType: this.keyType,
    };
  }

  // Check if Hedera is enabled for prover
  isEnabled() {
    return !!(this.accountId && this.privateKey);
  }

  // Get Hedera client
  getClient() {
    return this.client;
  }

  // Initialize topic for prover (simplified version)
  async configureTopicForProver(topicIdString) {
    if (!topicIdString) {
      throw new Error('Topic ID is required for prover');
    }

    this.topicId = topicIdString;

    // Initialize client
    const client = this.initClient();
    if (!client) {
      throw new Error('Failed to initialize Hedera client');
    }

    // Verify topic exists
    const exists = await this.checkTopicExists(topicIdString);
    if (!exists) {
      throw new Error(
        `Topic ${topicIdString} does not exist or is not accessible`
      );
    }

    console.log(`📝 Prover initialized for HIP-991 topic: ${topicIdString}`);
    return topicIdString;
  }

  // Close client connection
  close() {
    if (this.client) {
      this.client.close();
      console.log('🔌 Prover Hedera client connection closed');
    }
  }

  /**
   * Fetch public key from the first message in a Hedera topic using mirror node API
   * @param {string} topicId - The topic ID (e.g., "0.0.6139083")
   * @param {string} network - The Hedera network ("testnet", "mainnet", "previewnet")
   * @returns {Promise<string>} The RSA public key in PEM format
   */
  static async fetchPublicKeyFromTopicFirstMessage(
    topicId,
    network = 'testnet'
  ) {
    const http = require('http');
    const https = require('https');
    const fetch = require('node-fetch');

    try {
      console.log(
        `🔍 Fetching public key from topic ${topicId} on ${network}...`
      );

      // Get mirror node URL using common utility
      const mirrorNodeUrl = getMirrorNodeUrl(network);

      const url = `${mirrorNodeUrl}/api/v1/topics/${topicId}/messages/1`;
      console.log(`📡 Calling mirror node: ${url}`);

      return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;

        const request = client.get(url, response => {
          let data = '';

          response.on('data', chunk => {
            data += chunk;
          });

          response.on('end', () => {
            try {
              if (response.statusCode !== 200) {
                throw new Error(`HTTP ${response.statusCode}: ${data}`);
              }

              const messageData = JSON.parse(data);
              console.log(`📨 Received message data from mirror node`);

              // Extract the message content (base64 encoded)
              if (!messageData.message) {
                throw new Error(
                  'No message content found in mirror node response'
                );
              }

              // Decode the base64 message
              const messageContent = Buffer.from(
                messageData.message,
                'base64'
              ).toString('utf8');
              console.log(
                `📄 Decoded message content (${messageContent.length} chars)`
              );

              // Try to parse as JSON to extract public key
              let publicKey;
              try {
                const messageJson = JSON.parse(messageContent);

                // Look for public key in common fields
                if (messageJson.publicKey) {
                  publicKey = messageJson.publicKey;
                } else if (messageJson.public_key) {
                  publicKey = messageJson.public_key;
                } else if (messageJson.rsaPublicKey) {
                  publicKey = messageJson.rsaPublicKey;
                } else if (messageJson.key) {
                  publicKey = messageJson.key;
                } else {
                  throw new Error('No public key field found in message JSON');
                }
              } catch (jsonError) {
                // If not JSON, assume the entire message content is the public key
                console.log(
                  `⚠️  Message is not JSON, treating entire content as public key`
                );
                publicKey = messageContent.trim();
              }

              // Validate public key format (should start with -----BEGIN and end with -----END)
              if (
                !publicKey.includes('-----BEGIN') ||
                !publicKey.includes('-----END')
              ) {
                throw new Error(
                  'Invalid public key format - missing PEM headers'
                );
              }

              console.log(
                `✅ Successfully extracted public key from topic first message`
              );
              console.log(
                `🔑 Public key preview: ${publicKey.substring(0, 50)}...`
              );

              resolve(publicKey);
            } catch (error) {
              reject(
                new Error(
                  `Failed to parse mirror node response: ${error.message}`
                )
              );
            }
          });
        });

        request.on('error', error => {
          reject(new Error(`Mirror node request failed: ${error.message}`));
        });

        request.setTimeout(10000, () => {
          request.destroy();
          reject(new Error('Mirror node request timeout'));
        });
      });
    } catch (error) {
      throw new Error(
        `Failed to fetch public key from topic: ${error.message}`
      );
    }
  }
}

module.exports = { HederaManager };
