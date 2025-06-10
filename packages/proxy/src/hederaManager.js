const http = require('http');
const https = require('https');
const {
  Client,
  PrivateKey,
  AccountId,
  TopicCreateTransaction,
  TopicInfoQuery,
  TopicMessageSubmitTransaction,
  Hbar,
} = require('@hashgraph/sdk');
const {
  decryptHybridMessage,
  generateChallenge,
  verifyChallengeResponse,
} = require('./cryptoUtils');
const { updateRoutes, saveDatabase } = require('./dbManager');

// Hedera Manager Module
// Handles all Hedera Consensus Service functionality including:
// - Client initialization
// - Topic creation and verification
// - Public key submission to topics
// - Mirror node integration

class HederaManager {
  constructor(config = {}) {
    this.accountId = config.accountId;
    this.privateKey = config.privateKey;
    this.network = config.network;
    this.topicId = config.topicId;
    this.client = null;
    this.mirrorNodeUrl = null;
    this.currentTopicId = null;
    // Database persistence functions
    this.getLastProcessedSequence = config.getLastProcessedSequence;
    this.storeLastProcessedSequence = config.storeLastProcessedSequence;
    this.dbFile = config.dbFile;
    // RSA key pair getter for decryption
    this.getRSAKeyPair = config.getRSAKeyPair;
  }

  // Initialize Hedera client
  initClient() {
    if (!this.accountId || !this.privateKey) {
      console.log(
        'Hedera credentials not provided. Skipping Hedera topic setup.'
      );
      return null;
    }

    try {
      const accountId = AccountId.fromString(this.accountId);
      const privateKey = PrivateKey.fromStringED25519(this.privateKey);

      let client;
      if (this.network === 'local') client = Client.forLocalNode();
      else client = Client.forName(this.network);

      client.setOperator(accountId, privateKey);

      switch (this.network) {
        case 'local':
          this.mirrorNodeUrl = 'http://localhost:5551';
          break;
        default:
          this.mirrorNodeUrl =
            'https://' + this.network + '.mirrornode.hedera.com';
          break;
      }

      console.log(
        `Hedera client initialized for ${this.network} with mirror node ${this.mirrorNodeUrl}`
      );
      console.log(`Using account: ${this.accountId}`);

      this.client = client;
      return client;
    } catch (error) {
      console.error('Failed to initialize Hedera client:', error.message);
      process.exit(1);
    }
  }

  // Check if topic exists and is accessible
  async checkTopicExists(topicIdString) {
    if (!this.client || !topicIdString) {
      return false;
    }

    try {
      const topicInfoQuery = new TopicInfoQuery().setTopicId(topicIdString);

      const topicInfo = await topicInfoQuery.execute(this.client);
      console.log(`Topic ${topicIdString} exists and is accessible`);
      console.log(`Topic memo: ${topicInfo.topicMemo}`);
      return true;
    } catch (error) {
      console.log(
        `Topic ${topicIdString} does not exist or is not accessible:`,
        error.message
      );
      return false;
    }
  }

  // Create a new Hedera topic
  async createTopic() {
    if (!this.client) {
      throw new Error('Hedera client not initialized');
    }

    try {
      console.log('Creating new Hedera topic...');

      const transaction = new TopicCreateTransaction()
        .setTopicMemo('Hiero JSON-RPC Relay Proxy Topic')
        .setMaxTransactionFee(new Hbar(2)); // Set max fee to 2 HBAR

      const txResponse = await transaction.execute(this.client);
      const receipt = await txResponse.getReceipt(this.client);
      const newTopicId = receipt.topicId;

      console.log(`✅ Hedera topic created successfully: ${newTopicId}`);
      this.currentTopicId = newTopicId.toString();
      return this.currentTopicId;
    } catch (error) {
      console.error('Failed to create Hedera topic:', error.message);
      throw error;
    }
  }

  // Check if topic has any messages using mirror node API
  async checkTopicHasMessages(topicIdString) {
    if (!topicIdString) {
      return false;
    }

    try {
      console.log(
        `Checking for messages in topic ${topicIdString} via mirror node...`
      );

      // Try to get the first message (sequence number 1)
      const url = `${this.mirrorNodeUrl}/api/v1/topics/${topicIdString}/messages/1`;

      console.log(`Fetching: ${url}`);

      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          console.log(
            'Timeout: Failed to check topic messages within 5 seconds'
          );
          reject(
            new Error(
              'Timeout: Failed to check topic messages within 5 seconds'
            )
          );
        }, 5000);

        const httpModule = this.mirrorNodeUrl.startsWith('https:')
          ? https
          : http;

        const req = httpModule.get(url, res => {
          clearTimeout(timeoutId);

          let data = '';
          res.on('data', chunk => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              if (res.statusCode === 200) {
                const response = JSON.parse(data);
                console.log(
                  `Found existing message in topic ${topicIdString} (sequence: ${response.sequence_number})`
                );
                resolve(true);
              } else if (res.statusCode === 404) {
                console.log(
                  `No messages found in topic ${topicIdString} (404 response)`
                );
                resolve(false);
              } else {
                console.log(
                  `Mirror node returned status ${res.statusCode} for topic ${topicIdString}`
                );
                reject(
                  new Error(
                    `Mirror node returned status ${res.statusCode}: ${data}`
                  )
                );
              }
            } catch (parseError) {
              console.error(
                'Error parsing mirror node response:',
                parseError.message
              );
              reject(
                new Error(
                  `Failed to parse mirror node response: ${parseError.message}`
                )
              );
            }
          });
        });

        req.on('error', error => {
          clearTimeout(timeoutId);
          console.error('Error calling mirror node API:', error.message);
          reject(new Error(`Failed to call mirror node API: ${error.message}`));
        });

        req.setTimeout(5000, () => {
          req.destroy();
          reject(
            new Error('Mirror node API request timed out after 5 seconds')
          );
        });
      });
    } catch (error) {
      console.log(
        `Error checking messages in topic ${topicIdString}:`,
        error.message
      );
      throw error;
    }
  }

  // Submit message to topic
  async submitMessageToTopic(topicIdString, message) {
    if (!this.client || !topicIdString || !message) {
      throw new Error(
        'Missing required parameters for topic message submission'
      );
    }

    try {
      console.log(`Submitting message to topic ${topicIdString}...`);

      const transaction = new TopicMessageSubmitTransaction()
        .setTopicId(topicIdString)
        .setMessage(message)
        .setMaxTransactionFee(new Hbar(1)); // Set max fee to 1 HBAR

      const txResponse = await transaction.execute(this.client);
      const receipt = await txResponse.getReceipt(this.client);

      console.log(
        `✅ Message submitted to topic ${topicIdString} successfully`
      );
      console.log(`Transaction ID: ${txResponse.transactionId}`);
      return receipt;
    } catch (error) {
      console.error(
        `Failed to submit message to topic ${topicIdString}:`,
        error.message
      );
      throw error;
    }
  }

  // Check topic for messages and submit public key if needed
  async checkAndSubmitPublicKey(isNewTopic = false, getRSAKeyPair) {
    if (!this.client || !this.currentTopicId) {
      console.log(
        'Hedera client or topic not initialized, skipping public key submission'
      );
      return;
    }

    // Get the RSA public key
    const keyPair = getRSAKeyPair();
    if (!keyPair || !keyPair.publicKey) {
      console.log('RSA key pair not available, skipping public key submission');
      return;
    }

    // For newly created topics, always submit public key without checking
    // For existing topics, check for messages first
    let shouldSubmitKey = isNewTopic;

    if (!isNewTopic) {
      console.log('Checking if topic has existing messages...');
      // Add timeout wrapper that throws error on timeout (server MUST stop)
      try {
        const hasMessages = await Promise.race([
          this.checkTopicHasMessages(this.currentTopicId),
          new Promise((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    'Timeout: Failed to check topic messages within 5 seconds'
                  )
                ),
              5000
            )
          ),
        ]);
        shouldSubmitKey = !hasMessages;
        console.log(`Topic message check result: hasMessages=${hasMessages}`);
      } catch (error) {
        console.error('Critical error checking topic messages:', error.message);
        console.error('Server must stop - cannot verify topic state');
        process.exit(1);
      }
    }

    if (shouldSubmitKey) {
      console.log(
        isNewTopic
          ? 'Sending public key as first message to new topic...'
          : 'Topic has no messages, sending public key as first message...'
      );
      // Add timeout wrapper for public key submission (server MUST stop on timeout)
      await Promise.race([
        this.submitMessageToTopic(this.currentTopicId, keyPair.publicKey),
        new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  'Timeout: Failed to submit public key within 10 seconds'
                )
              ),
            10000
          )
        ),
      ]);
    } else {
      console.log('Topic already has messages, skipping public key submission');
    }
  }

  // Initialize Hedera topic management
  async initTopic(getRSAKeyPair) {
    this.client = this.initClient();

    if (!this.client) {
      console.log('Hedera functionality disabled - no credentials provided');
      return;
    }

    try {
      // Check if a topic ID was provided in environment variables
      if (this.topicId) {
        const exists = await this.checkTopicExists(this.topicId);
        if (exists) {
          this.currentTopicId = this.topicId;
          console.log(`Using existing Hedera topic: ${this.currentTopicId}`);

          // Check if topic has messages and send public key if empty
          // Server MUST stop if this operation times out
          await this.checkAndSubmitPublicKey(false, getRSAKeyPair); // Pass false to indicate this is an existing topic
          return;
        } else {
          console.log(
            `Provided topic ID ${this.topicId} is not accessible, creating new topic...`
          );
        }
      }

      // Create a new topic
      this.currentTopicId = await this.createTopic();
      console.log(`Hedera topic initialized: ${this.currentTopicId}`);
      console.log(
        `💡 Add this to your .env file: HEDERA_TOPIC_ID=${this.currentTopicId}`
      );

      // For new topics, always send the public key as the first message
      // Server MUST stop if this operation fails or times out
      await this.checkAndSubmitPublicKey(true, getRSAKeyPair);
    } catch (error) {
      console.error('Failed to initialize Hedera topic:', error.message);
      console.error('Server MUST stop - Hedera topic initialization failed');
      process.exit(1);
    }
  }

  // Get current topic ID
  getTopicId() {
    return this.currentTopicId;
  }

  // Get Hedera client
  getClient() {
    return this.client;
  }

  // Get topic info for API endpoints
  getTopicInfo() {
    return {
      topicId: this.currentTopicId,
      hederaNetwork: this.network,
      accountId: this.accountId,
      clientInitialized: this.client !== null,
    };
  }

  // Check if Hedera is enabled
  isEnabled() {
    return !!(this.accountId && this.privateKey);
  }

  // Start listening for new messages on the topic
  startMessageListener(intervalMs = 5000) {
    if (!this.currentTopicId) {
      console.log('No topic ID available, cannot start message listener');
      return null;
    }

    console.log(
      `🔗 Starting message listener for topic ${this.currentTopicId}`
    );
    console.log(
      `   Checking for new messages every ${intervalMs / 1000} seconds`
    );

    // Initialize lastSequenceNumber from database if persistence is available
    // Always start from sequence 1 to skip message #1 (which typically contains the public key)
    let lastSequenceNumber = 1;
    if (this.getLastProcessedSequence) {
      const storedSequence = this.getLastProcessedSequence(this.currentTopicId);
      if (storedSequence > 1) {
        lastSequenceNumber = storedSequence;
        console.log(
          `📚 Restored last processed sequence: ${lastSequenceNumber} for topic ${this.currentTopicId}`
        );
      } else {
        console.log(
          `📚 Starting from sequence 2 (skipping message #1) for topic ${this.currentTopicId}`
        );
      }
    } else {
      console.log(
        `📚 Starting from sequence 2 (skipping message #1) for topic ${this.currentTopicId}`
      );
    }

    let isFirstCheck = true;

    const checkForNewMessages = async () => {
      try {
        // Get all messages from the topic
        const messages = await this.getTopicMessages(this.currentTopicId);

        if (messages && messages.length > 0) {
          // Sort messages by sequence number to ensure proper order
          const sortedMessages = messages.sort(
            (a, b) => a.sequence_number - b.sequence_number
          );

          if (isFirstCheck) {
            // On first check, filter out message #1 and set the last sequence number
            const filteredMessages = sortedMessages.filter(
              msg => msg.sequence_number > 1
            );

            if (filteredMessages.length > 0) {
              lastSequenceNumber =
                filteredMessages[filteredMessages.length - 1].sequence_number;
              console.log(
                `📊 Found ${messages.length} existing messages in topic (skipped message #1, processed sequence 2 to ${lastSequenceNumber})`
              );
            } else if (sortedMessages.length > 0) {
              // Only message #1 exists, so we start from sequence 1 but haven't processed anything yet
              lastSequenceNumber = 1;
              console.log(
                `📊 Found ${messages.length} existing messages in topic (skipped message #1, ready to process from sequence 2)`
              );
            }
            isFirstCheck = false;

            // Save to database if persistence is available (initial state)
            if (this.storeLastProcessedSequence && this.dbFile) {
              try {
                await this.storeLastProcessedSequence(
                  this.currentTopicId,
                  lastSequenceNumber,
                  this.dbFile
                );
              } catch (error) {
                console.error(
                  'Failed to save initial sequence to database:',
                  error.message
                );
              }
            }
          } else {
            // Check for new messages since last check (excluding message #1)
            const newMessages = sortedMessages.filter(
              msg =>
                msg.sequence_number > lastSequenceNumber &&
                msg.sequence_number > 1
            );

            if (newMessages.length > 0) {
              console.log(
                `\n🆕 Found ${newMessages.length} new message(s) in topic ${this.currentTopicId}:`
              );

              for (const message of newMessages) {
                const timestamp = new Date(
                  message.consensus_timestamp * 1000
                ).toISOString();
                const content = Buffer.from(message.message, 'base64').toString(
                  'utf8'
                );

                console.log(
                  `   📝 Message #${message.sequence_number} (${timestamp}):`
                );

                console.log(
                  '      🔐 Encrypted message detected, attempting decryption...'
                );

                // Get RSA private key for decryption
                const keyPair = this.getRSAKeyPair
                  ? this.getRSAKeyPair()
                  : null;
                if (keyPair && keyPair.privateKey) {
                  const decryptionResult = decryptHybridMessage(
                    message.message,
                    keyPair.privateKey
                  );

                  if (decryptionResult.success) {
                    console.log('      ✅ Message decrypted successfully!');
                    console.log(
                      `      📄 Decrypted Content: ${decryptionResult.decryptedData}`
                    );
                    console.log(
                      `      📊 Compression: ${decryptionResult.originalLength} → ${decryptionResult.decryptedData.length} bytes`
                    );

                    // Verify ECDSA signatures if message contains routes
                    await this.verifyMessageSignatures(
                      decryptionResult.decryptedData
                    );
                  } else {
                    console.log(
                      '      ❌ Decryption failed:',
                      decryptionResult.error
                    );
                    console.log(
                      `      📄 Raw Content: ${content.substring(0, 200)}${
                        content.length > 200 ? '...' : ''
                      }`
                    );
                  }
                } else {
                  console.log(
                    '      ⚠️  No RSA private key available for decryption'
                  );
                  console.log(
                    `      📄 Raw Content: ${content.substring(0, 200)}${
                      content.length > 200 ? '...' : ''
                    }`
                  );
                }

                console.log(`      💳 Payer: ${message.payer_account_id}`);
              }

              // Update last sequence number
              const newLastSequence =
                newMessages[newMessages.length - 1].sequence_number;
              lastSequenceNumber = newLastSequence;

              // Save to database if persistence is available
              if (this.storeLastProcessedSequence && this.dbFile) {
                try {
                  await this.storeLastProcessedSequence(
                    this.currentTopicId,
                    newLastSequence,
                    this.dbFile
                  );
                } catch (error) {
                  console.error(
                    'Failed to save sequence to database:',
                    error.message
                  );
                }
              }
            }
          }
        } else if (isFirstCheck) {
          console.log('📊 No existing messages found in topic');
          isFirstCheck = false;
        }
      } catch (error) {
        console.error('❌ Error checking for new messages:', error.message);
      }
    };

    // Initial check
    checkForNewMessages();

    // Set up interval for periodic checks
    const intervalId = setInterval(checkForNewMessages, intervalMs);

    return intervalId;
  }

  // Get all messages from a topic using mirror node API
  async getTopicMessages(topicIdString, limit = 100) {
    if (!topicIdString) {
      return [];
    }

    try {
      // Get messages from the topic (ordered by sequence number)
      const url = `${this.mirrorNodeUrl}/api/v1/topics/${topicIdString}/messages?limit=${limit}&order=asc`;

      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(
            new Error('Mirror node API request timed out after 5 seconds')
          );
        }, 5000);

        const httpModule = this.mirrorNodeUrl.startsWith('https:')
          ? https
          : http;

        const req = httpModule.get(url, res => {
          clearTimeout(timeoutId);

          let data = '';
          res.on('data', chunk => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              if (res.statusCode === 200) {
                const response = JSON.parse(data);
                resolve(response.messages || []);
              } else if (res.statusCode === 404) {
                // No messages found
                resolve([]);
              } else {
                reject(
                  new Error(
                    `Mirror node returned status ${res.statusCode}: ${data}`
                  )
                );
              }
            } catch (parseError) {
              reject(
                new Error(
                  `Failed to parse mirror node response: ${parseError.message}`
                )
              );
            }
          });
        });

        req.on('error', error => {
          clearTimeout(timeoutId);
          reject(new Error(`Failed to call mirror node API: ${error.message}`));
        });

        req.setTimeout(5000, () => {
          req.destroy();
          reject(new Error('Mirror node API request timed out'));
        });
      });
    } catch (error) {
      console.log(
        `Error getting messages from topic ${topicIdString}:`,
        error.message
      );
      throw error;
    }
  }

  // Stop the message listener
  stopMessageListener(intervalId) {
    if (intervalId) {
      clearInterval(intervalId);
      console.log('🛑 Message listener stopped');
    }
  }

  // Verify ECDSA signatures and contract ownership in decrypted message
  async verifyMessageSignatures(decryptedData) {
    try {
      // Parse the decrypted data as JSON
      const messageData = JSON.parse(decryptedData);

      // Check if the message contains routes with signatures
      if (!messageData.routes || !Array.isArray(messageData.routes)) {
        console.log(
          '      📝 No routes array found in message - skipping signature verification'
        );
        return;
      }
      console.log(
        '      🔍 Verifying ECDSA signatures and contract ownership...'
      );

      let totalSignatures = 0;
      let validSignatures = 0;
      let derivedSignerAddress = null;

      const { getContractAddressFromCreate } = require('./cryptoUtils');

      // Verify each route's signature and contract ownership
      for (const route of messageData.routes) {
        if (
          route.addr &&
          route.proofType &&
          route.nonce !== undefined &&
          route.url &&
          route.sig
        ) {
          totalSignatures++;

          try {
            const { ethers } = require('ethers');

            // Create the message that was signed (addr+proofType+nonce+url)
            const signedMessage =
              route.addr + route.proofType + route.nonce + route.url;

            // Derive the signer address from the signature
            const signerFromThisSignature = ethers.verifyMessage(
              signedMessage,
              route.sig
            );

            // For the first signature, establish the expected signer
            if (!derivedSignerAddress) {
              derivedSignerAddress = signerFromThisSignature.toLowerCase();
              console.log(
                `      🔑 Derived signer address: ${derivedSignerAddress}`
              );
            }

            // Check if this signature matches the established signer
            const isValidSigner =
              signerFromThisSignature.toLowerCase() === derivedSignerAddress;

            if (isValidSigner) {
              // Additional check: verify that the signer is the owner of the contract at the specified address
              let isValidOwnership = false;

              if (route.proofType === 'create') {
                // For CREATE, compute the deterministic contract address
                const computedAddress = getContractAddressFromCreate(
                  derivedSignerAddress,
                  route.nonce
                );
                isValidOwnership =
                  computedAddress &&
                  computedAddress.toLowerCase() === route.addr.toLowerCase();

                console.log(
                  `      🏗️ Contract address verification (CREATE): computed=${computedAddress}, expected=${route.addr}, valid=${isValidOwnership}`
                );
              } else if (route.proofType === 'create2') {
                // TODO: Implement CREATE2 verification when added
                console.log(
                  `      ⚠️ CREATE2 verification not yet implemented - skipping ownership check`
                );
                isValidOwnership = true; // Temporary - allow CREATE2 for now
              } else {
                console.log(`      ❌ Unknown proof type: ${route.proofType}`);
                isValidOwnership = false;
              }

              if (isValidOwnership) {
                validSignatures++;
                console.log(
                  `      ✅ Valid signature and ownership for ${route.addr} (${route.proofType}, nonce ${route.nonce}) from ${signerFromThisSignature.slice(0, 10)}...`
                );
              } else {
                console.log(
                  `      ❌ Valid signature but invalid ownership for ${route.addr} (${route.proofType}, nonce ${route.nonce})`
                );
                console.log(
                  `         Signer ${derivedSignerAddress.slice(0, 10)}... is not the owner of contract at ${route.addr}`
                );
              }
            } else {
              console.log(
                `      ❌ Invalid signature for ${route.addr} (${route.proofType}, nonce ${route.nonce})`
              );
              console.log(
                `         Expected signer: ${derivedSignerAddress.slice(
                  0,
                  10
                )}...`
              );
              console.log(
                `         Actual signer: ${signerFromThisSignature.slice(
                  0,
                  10
                )}...`
              );
            }
          } catch (error) {
            console.log(
              `      ❌ Failed to verify signature for ${
                route.addr
              } (${route.proofType}, nonce ${route.nonce}): ${error.message}`
            );
          }
        }
      }

      if (totalSignatures > 0) {
        const success = validSignatures === totalSignatures;
        console.log(
          `      🎯 Signature and ownership verification: ${validSignatures}/${totalSignatures} routes valid ${
            success ? '✅' : '❌'
          }`
        );

        if (!success) {
          console.log(
            '      ⚠️  Message contains invalid signatures or ownership proofs - potential security risk!'
          );
          return; // Don't proceed with challenge-response if signatures are invalid
        }

        // If all signatures are valid, initiate challenge-response flow
        if (success && derivedSignerAddress) {
          console.log('      🚀 Starting challenge-response verification...');
          await this.processChallengeResponseFlow(
            messageData,
            derivedSignerAddress
          );
        }
      } else {
        console.log(
          '      📝 No signatures found in routes - skipping verification'
        );
      }
    } catch (error) {
      console.log('      ❌ Signature verification failed:', error.message);
      console.log(
        '      📝 Message may not be in expected format or contain valid JSON'
      );
    }
  }

  /**
   * Send a challenge to a URL for verification
   * @param {string} targetUrl - URL to send challenge to
   * @param {string} contractAddress - Contract address being verified
   * @returns {Promise<object>} Challenge data and response
   */
  async sendChallenge(targetUrl, contractAddress) {
    try {
      // Get RSA key pair for signing challenge
      const keyPair = this.getRSAKeyPair ? this.getRSAKeyPair() : null;
      if (!keyPair) {
        throw new Error('No RSA key pair available for challenge generation');
      }

      // Generate challenge
      const challengeObj = generateChallenge(
        keyPair.privateKey,
        targetUrl,
        contractAddress
      );
      console.log(
        `      🎯 Sending challenge to ${targetUrl} for contract ${contractAddress}`
      );
      console.log(
        `         Challenge ID: ${challengeObj.challenge.challengeId.substring(0, 16)}...`
      );

      // Send challenge to the URL
      const challengeUrl = new URL('/challenge', targetUrl);
      const postData = JSON.stringify(challengeObj);

      return new Promise((resolve, reject) => {
        const client = challengeUrl.protocol === 'https:' ? https : http;
        const req = client.request(
          challengeUrl,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData),
            },
            timeout: 10000, // 10 second timeout
          },
          res => {
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () => {
              try {
                if (res.statusCode === 200) {
                  const response = JSON.parse(data);
                  resolve({
                    success: true,
                    challenge: challengeObj.challenge,
                    response: response,
                  });
                } else {
                  reject(
                    new Error(
                      `Challenge failed with status ${res.statusCode}: ${data}`
                    )
                  );
                }
              } catch (error) {
                reject(new Error(`Invalid response format: ${error.message}`));
              }
            });
          }
        );

        req.on('error', error => {
          reject(new Error(`Challenge request failed: ${error.message}`));
        });

        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Challenge request timed out'));
        });

        req.write(postData);
        req.end();
      });
    } catch (error) {
      throw new Error(`Challenge generation failed: ${error.message}`);
    }
  }

  /**
   * Verify challenge response from prover
   * @param {object} challengeData - Original challenge data
   * @param {object} response - Response from prover
   * @param {string} expectedAddress - Expected signer address
   * @returns {boolean} True if response is valid
   */
  verifyChallengeResponseSignature(challengeData, response, expectedAddress) {
    try {
      if (!response.signature || !response.challengeId) {
        console.log(
          '      ❌ Invalid response format - missing signature or challengeId'
        );
        return false;
      }

      if (response.challengeId !== challengeData.challengeId) {
        console.log('      ❌ Challenge ID mismatch');
        return false;
      }

      // Verify the ECDSA signature on the challenge
      const isValid = verifyChallengeResponse(
        challengeData,
        response.signature,
        expectedAddress
      );

      if (isValid) {
        console.log(
          `      ✅ Challenge response verified for ${challengeData.url}`
        );
      } else {
        console.log(
          `      ❌ Challenge response verification failed for ${challengeData.url}`
        );
      }

      return isValid;
    } catch (error) {
      console.log(
        `      ❌ Challenge response verification error: ${error.message}`
      );
      return false;
    }
  }

  /**
   * Process the complete challenge-response flow for route verification
   * @param {object} messageData - Parsed message data containing routes
   * @param {string} signerAddress - Verified signer address
   */
  async processChallengeResponseFlow(messageData, signerAddress) {
    try {
      const challengeResults = [];
      let allChallengesSuccessful = true;

      // Send challenges to all URLs
      for (const route of messageData.routes) {
        if (route.url && route.addr) {
          try {
            console.log(
              `      📤 Challenging URL: ${route.url} for contract ${route.addr}`
            );

            const challengeResult = await this.sendChallenge(
              route.url,
              route.addr
            );

            if (challengeResult.success) {
              // Verify the challenge response
              const responseValid = this.verifyChallengeResponseSignature(
                challengeResult.challenge,
                challengeResult.response,
                signerAddress
              );

              challengeResults.push({
                url: route.url,
                addr: route.addr,
                challengeSuccess: true,
                responseValid: responseValid,
              });

              if (!responseValid) {
                allChallengesSuccessful = false;
                console.log(
                  `      ❌ Challenge response verification failed for ${route.url}`
                );
              }
            } else {
              challengeResults.push({
                url: route.url,
                addr: route.addr,
                challengeSuccess: false,
                responseValid: false,
                error: challengeResult.error || 'Challenge failed',
              });
              allChallengesSuccessful = false;
              console.log(`      ❌ Challenge failed for ${route.url}`);
            }
          } catch (error) {
            challengeResults.push({
              url: route.url,
              addr: route.addr,
              challengeSuccess: false,
              responseValid: false,
              error: error.message,
            });
            allChallengesSuccessful = false;
            console.log(
              `      ❌ Challenge error for ${route.url}: ${error.message}`
            );
          }
        }
      }

      // Summary of challenge results
      const successfulChallenges = challengeResults.filter(
        r => r.challengeSuccess && r.responseValid
      ).length;
      console.log(
        `      🎯 Challenge-response results: ${successfulChallenges}/${challengeResults.length} successful`
      );

      // Update routes if all challenges were successful
      if (allChallengesSuccessful && challengeResults.length > 0) {
        console.log('      ✅ All challenges successful - updating routes...');
        await this.updateRoutesFromMessage(messageData);

        // Send confirmation message directly to prover
        await this.sendConfirmationToProver(
          messageData,
          challengeResults,
          signerAddress
        );
      } else {
        console.log('      ❌ Some challenges failed - routes not updated');

        // Optionally send failure notification
        await this.sendFailureNotification(
          messageData,
          challengeResults,
          signerAddress
        );
      }
    } catch (error) {
      console.log(`      ❌ Challenge-response flow error: ${error.message}`);
    }
  }

  /**
   * Update routes in database from verified message
   * @param {object} messageData - Message data containing routes
   */
  async updateRoutesFromMessage(messageData) {
    try {
      const routesToUpdate = {};

      for (const route of messageData.routes) {
        if (route.addr && route.url) {
          routesToUpdate[route.addr.toLowerCase()] = route.url;
        }
      }

      if (Object.keys(routesToUpdate).length > 0) {
        await updateRoutes(routesToUpdate, saveDatabase, this.dbFile);
        console.log(
          `      📝 Updated ${Object.keys(routesToUpdate).length} routes in database`
        );
      }
    } catch (error) {
      console.log(`      ❌ Route update error: ${error.message}`);
    }
  }

  /**
   * Send confirmation message directly to prover
   * @param {object} originalMessage - Original message data
   * @param {array} challengeResults - Results of challenge verification
   * @param {string} signerAddress - Signer address
   */
  async sendConfirmationToProver(
    originalMessage,
    challengeResults,
    signerAddress
  ) {
    try {
      // Send confirmation to each URL that was successfully verified
      const successfulRoutes = challengeResults.filter(r => r.responseValid);

      if (successfulRoutes.length === 0) {
        console.log('      ⚠️  No successful routes to send confirmation to');
        return;
      }

      console.log(
        `      📤 Sending confirmation to ${successfulRoutes.length} prover(s)...`
      );

      for (const route of successfulRoutes) {
        try {
          const confirmationUrl = new URL('/confirmation', route.url);
          const confirmation = {
            status: 'completed',
            message: 'Route verification completed successfully',
            verifiedRoutes: successfulRoutes.length,
            totalRoutes: challengeResults.length,
            timestamp: Date.now(),
            originalSigner: signerAddress,
            addr: route.addr,
          };

          const postData = JSON.stringify(confirmation);

          await new Promise((resolve, reject) => {
            const client = confirmationUrl.protocol === 'https:' ? https : http;
            const req = client.request(
              confirmationUrl,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Content-Length': Buffer.byteLength(postData),
                },
                timeout: 10000, // 10 second timeout
              },
              res => {
                let data = '';
                res.on('data', chunk => (data += chunk));
                res.on('end', () => {
                  if (res.statusCode === 200) {
                    console.log(`      ✅ Confirmation sent to ${route.url}`);
                    resolve();
                  } else {
                    console.log(
                      `      ⚠️  Confirmation to ${route.url} returned status ${res.statusCode}`
                    );
                    resolve(); // Don't fail the whole process for confirmation issues
                  }
                });
              }
            );

            req.on('error', error => {
              console.log(
                `      ⚠️  Failed to send confirmation to ${route.url}: ${error.message}`
              );
              resolve(); // Don't fail the whole process for confirmation issues
            });

            req.on('timeout', () => {
              req.destroy();
              console.log(`      ⚠️  Confirmation to ${route.url} timed out`);
              resolve(); // Don't fail the whole process for confirmation issues
            });

            req.write(postData);
            req.end();
          });
        } catch (error) {
          console.log(
            `      ⚠️  Error sending confirmation to ${route.url}: ${error.message}`
          );
        }
      }
    } catch (error) {
      console.log(
        `      ⚠️  Failed to send confirmation to prover(s): ${error.message}`
      );
    }
  }

  /**
   * Send confirmation message to Hedera topic
   * @param {object} originalMessage - Original message data
   * @param {array} challengeResults - Results of challenge verification
   * @param {string} signerAddress - Signer address
   */
  async sendConfirmationMessage(
    originalMessage,
    challengeResults,
    signerAddress
  ) {
    try {
      if (!this.client || !this.currentTopicId) {
        console.log(
          '      ⚠️  No Hedera client or topic - skipping confirmation message'
        );
        return;
      }

      const confirmation = {
        type: 'route-verification-success',
        timestamp: Date.now(),
        originalSigner: signerAddress,
        verifiedRoutes: challengeResults
          .filter(r => r.responseValid)
          .map(r => ({
            addr: r.addr,
            url: r.url,
          })),
        totalRoutes: challengeResults.length,
        successfulRoutes: challengeResults.filter(r => r.responseValid).length,
      };

      const message = JSON.stringify(confirmation);
      const transaction = new TopicMessageSubmitTransaction({
        topicId: this.currentTopicId,
        message: message,
      });

      await transaction.execute(this.client);
      console.log('      📤 Confirmation message sent to Hedera topic');
    } catch (error) {
      console.log(
        `      ⚠️  Failed to send confirmation message: ${error.message}`
      );
    }
  }

  /**
   * Send failure notification to Hedera topic
   * @param {object} originalMessage - Original message data
   * @param {array} challengeResults - Results of challenge verification
   * @param {string} signerAddress - Signer address
   */
  async sendFailureNotification(
    originalMessage,
    challengeResults,
    signerAddress
  ) {
    try {
      if (!this.client || !this.currentTopicId) {
        console.log(
          '      ⚠️  No Hedera client or topic - skipping failure notification'
        );
        return;
      }

      const notification = {
        type: 'route-verification-failure',
        timestamp: Date.now(),
        originalSigner: signerAddress,
        failedRoutes: challengeResults
          .filter(r => !r.responseValid)
          .map(r => ({
            addr: r.addr,
            url: r.url,
            error: r.error || 'Challenge or response verification failed',
          })),
        totalRoutes: challengeResults.length,
        failedCount: challengeResults.filter(r => !r.responseValid).length,
      };

      const message = JSON.stringify(notification);
      const transaction = new TopicMessageSubmitTransaction({
        topicId: this.currentTopicId,
        message: message,
      });

      await transaction.execute(this.client);
      console.log('      📤 Failure notification sent to Hedera topic');
    } catch (error) {
      console.log(
        `      ⚠️  Failed to send failure notification: ${error.message}`
      );
    }
  }
}

module.exports = { HederaManager };
