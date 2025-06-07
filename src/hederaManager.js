const http = require("http");
const https = require("https");
const {
  Client,
  PrivateKey,
  AccountId,
  TopicCreateTransaction,
  TopicInfoQuery,
  TopicMessageSubmitTransaction,
  Hbar,
} = require("@hashgraph/sdk");

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
    this.network = config.network || "testnet";
    this.topicId = config.topicId;
    this.client = null;
    this.currentTopicId = null;
    // Database persistence functions
    this.getLastProcessedSequence = config.getLastProcessedSequence;
    this.storeLastProcessedSequence = config.storeLastProcessedSequence;
    this.dbFile = config.dbFile;
  }

  // Initialize Hedera client
  initClient() {
    if (!this.accountId || !this.privateKey) {
      console.log(
        "Hedera credentials not provided. Skipping Hedera topic setup."
      );
      return null;
    }

    try {
      const accountId = AccountId.fromString(this.accountId);
      const privateKey = PrivateKey.fromString(this.privateKey);

      // Create client for the appropriate network
      const client =
        this.network === "mainnet" ? Client.forMainnet() : Client.forTestnet();

      client.setOperator(accountId, privateKey);

      console.log(`Hedera client initialized for ${this.network}`);
      console.log(`Using account: ${this.accountId}`);

      this.client = client;
      return client;
    } catch (error) {
      console.error("Failed to initialize Hedera client:", error.message);
      return null;
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
      throw new Error("Hedera client not initialized");
    }

    try {
      console.log("Creating new Hedera topic...");

      const transaction = new TopicCreateTransaction()
        .setTopicMemo("Hiero JSON-RPC Relay Proxy Topic")
        .setMaxTransactionFee(new Hbar(2)); // Set max fee to 2 HBAR

      const txResponse = await transaction.execute(this.client);
      const receipt = await txResponse.getReceipt(this.client);
      const newTopicId = receipt.topicId;

      console.log(`✅ Hedera topic created successfully: ${newTopicId}`);
      this.currentTopicId = newTopicId.toString();
      return this.currentTopicId;
    } catch (error) {
      console.error("Failed to create Hedera topic:", error.message);
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

      // Determine the mirror node URL based on network
      const mirrorNodeUrl =
        this.network === "mainnet"
          ? "https://mainnet.mirrornode.hedera.com"
          : "https://testnet.mirrornode.hedera.com";

      // Try to get the first message (sequence number 1)
      const url = `${mirrorNodeUrl}/api/v1/topics/${topicIdString}/messages/1`;

      console.log(`Fetching: ${url}`);

      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          console.log(
            `Timeout: Failed to check topic messages within 5 seconds`
          );
          reject(
            new Error(
              `Timeout: Failed to check topic messages within 5 seconds`
            )
          );
        }, 5000);

        const httpModule = mirrorNodeUrl.startsWith("https:") ? https : http;

        const req = httpModule.get(url, (res) => {
          clearTimeout(timeoutId);

          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
          });

          res.on("end", () => {
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
                `Error parsing mirror node response:`,
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

        req.on("error", (error) => {
          clearTimeout(timeoutId);
          console.error(`Error calling mirror node API:`, error.message);
          reject(new Error(`Failed to call mirror node API: ${error.message}`));
        });

        req.setTimeout(5000, () => {
          req.destroy();
          reject(
            new Error(`Mirror node API request timed out after 5 seconds`)
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
        "Missing required parameters for topic message submission"
      );
    }

    try {
      console.log(`Submitting public key to topic ${topicIdString}...`);

      const transaction = new TopicMessageSubmitTransaction()
        .setTopicId(topicIdString)
        .setMessage(message)
        .setMaxTransactionFee(new Hbar(1)); // Set max fee to 1 HBAR

      const txResponse = await transaction.execute(this.client);
      const receipt = await txResponse.getReceipt(this.client);

      console.log(
        `✅ Public key submitted to topic ${topicIdString} successfully`
      );
      console.log(`Transaction ID: ${txResponse.transactionId}`);
      return receipt;
    } catch (error) {
      console.error(
        `Failed to submit public key to topic ${topicIdString}:`,
        error.message
      );
      throw error;
    }
  }

  // Check topic for messages and submit public key if needed
  async checkAndSubmitPublicKey(isNewTopic = false, getRSAKeyPair) {
    if (!this.client || !this.currentTopicId) {
      console.log(
        "Hedera client or topic not initialized, skipping public key submission"
      );
      return;
    }

    // Get the RSA public key
    const keyPair = getRSAKeyPair();
    if (!keyPair || !keyPair.publicKey) {
      console.log("RSA key pair not available, skipping public key submission");
      return;
    }

    // For newly created topics, always submit public key without checking
    // For existing topics, check for messages first
    let shouldSubmitKey = isNewTopic;

    if (!isNewTopic) {
      console.log("Checking if topic has existing messages...");
      // Add timeout wrapper that throws error on timeout (server MUST stop)
      try {
        const hasMessages = await Promise.race([
          this.checkTopicHasMessages(this.currentTopicId),
          new Promise((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    "Timeout: Failed to check topic messages within 5 seconds"
                  )
                ),
              5000
            )
          ),
        ]);
        shouldSubmitKey = !hasMessages;
        console.log(`Topic message check result: hasMessages=${hasMessages}`);
      } catch (error) {
        console.error("Critical error checking topic messages:", error.message);
        console.error("Server must stop - cannot verify topic state");
        process.exit(1);
      }
    }

    if (shouldSubmitKey) {
      console.log(
        isNewTopic
          ? "Sending public key as first message to new topic..."
          : "Topic has no messages, sending public key as first message..."
      );
      // Add timeout wrapper for public key submission (server MUST stop on timeout)
      await Promise.race([
        this.submitMessageToTopic(this.currentTopicId, keyPair.publicKey),
        new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  "Timeout: Failed to submit public key within 10 seconds"
                )
              ),
            10000
          )
        ),
      ]);
    } else {
      console.log("Topic already has messages, skipping public key submission");
    }
  }

  // Initialize Hedera topic management
  async initTopic(getRSAKeyPair) {
    this.client = this.initClient();

    if (!this.client) {
      console.log("Hedera functionality disabled - no credentials provided");
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
      console.error("Failed to initialize Hedera topic:", error.message);
      console.error("Server MUST stop - Hedera topic initialization failed");
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
      console.log("No topic ID available, cannot start message listener");
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
              (msg) => msg.sequence_number > 1
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
                  `Failed to save initial sequence to database:`,
                  error.message
                );
              }
            }
          } else {
            // Check for new messages since last check (excluding message #1)
            const newMessages = sortedMessages.filter(
              (msg) =>
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
                const content = Buffer.from(message.message, "base64").toString(
                  "utf8"
                );

                console.log(
                  `   📝 Message #${message.sequence_number} (${timestamp}):`
                );
                console.log(
                  `      Content: ${content.substring(0, 200)}${
                    content.length > 200 ? "..." : ""
                  }`
                );
                console.log(`      Payer: ${message.payer_account_id}`);
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
                    `Failed to save sequence to database:`,
                    error.message
                  );
                }
              }
            }
          }
        } else if (isFirstCheck) {
          console.log("📊 No existing messages found in topic");
          isFirstCheck = false;
        }
      } catch (error) {
        console.error(`❌ Error checking for new messages:`, error.message);
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
      // Determine the mirror node URL based on network
      const mirrorNodeUrl =
        this.network === "mainnet"
          ? "https://mainnet.mirrornode.hedera.com"
          : "https://testnet.mirrornode.hedera.com";

      // Get messages from the topic (ordered by sequence number)
      const url = `${mirrorNodeUrl}/api/v1/topics/${topicIdString}/messages?limit=${limit}&order=asc`;

      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(
            new Error(`Mirror node API request timed out after 5 seconds`)
          );
        }, 5000);

        const httpModule = mirrorNodeUrl.startsWith("https:") ? https : http;

        const req = httpModule.get(url, (res) => {
          clearTimeout(timeoutId);

          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
          });

          res.on("end", () => {
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

        req.on("error", (error) => {
          clearTimeout(timeoutId);
          reject(new Error(`Failed to call mirror node API: ${error.message}`));
        });

        req.setTimeout(5000, () => {
          req.destroy();
          reject(new Error(`Mirror node API request timed out`));
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
      console.log("🛑 Message listener stopped");
    }
  }
}

module.exports = { HederaManager };
