const {
  Client,
  PrivateKey,
  AccountId,
  TopicCreateTransaction,
  TopicInfoQuery,
  TopicMessageSubmitTransaction,
  Hbar,
} = require("@hashgraph/sdk");

// Demo Hedera Manager Module
// Dedicated manager for demo scripts with ECDSA key support
// This is separate from the main HederaManager to avoid dependencies
// and to provide demo-specific functionality

class DemoHederaManager {
  constructor(config = {}) {
    this.accountId = config.accountId;
    this.privateKey = config.privateKey;
    this.network = config.network || "testnet";
    this.topicId = config.topicId;
    this.client = null;
    this.keyType = config.keyType || "ECDSA"; // Default to ECDSA for demos
  }

  // Initialize Hedera client with ECDSA support
  initClient() {
    if (!this.accountId || !this.privateKey) {
      console.log(
        "❌ Hedera credentials not provided. Please set HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY"
      );
      return null;
    }

    try {
      const accountId = AccountId.fromString(this.accountId);

      // Support both ECDSA and Ed25519 private keys
      let privateKey;
      if (this.keyType === "ECDSA" || this.privateKey.startsWith("0x")) {
        // ECDSA private key (hex format)
        privateKey = PrivateKey.fromStringECDSA(this.privateKey);
        console.log("🔐 Using ECDSA private key");
      } else {
        // Ed25519 private key (original format)
        privateKey = PrivateKey.fromString(this.privateKey);
        console.log("🔐 Using Ed25519 private key");
      }

      // Create client for the appropriate network
      const client =
        this.network === "mainnet" ? Client.forMainnet() : Client.forTestnet();

      client.setOperator(accountId, privateKey);

      console.log(`✅ Demo Hedera client initialized for ${this.network}`);
      console.log(`   Using account: ${this.accountId}`);
      console.log(`   Key type: ${this.keyType}`);

      this.client = client;
      return client;
    } catch (error) {
      console.error(
        "❌ Failed to initialize demo Hedera client:",
        error.message
      );
      console.error("   Make sure your private key format is correct:");
      console.error("   - ECDSA keys should start with '0x' (hex format)");
      console.error("   - Ed25519 keys use the standard Hedera format");
      return null;
    }
  }

  // Check if topic exists and is accessible
  async checkTopicExists(topicIdString) {
    if (!this.client || !topicIdString) {
      return false;
    }

    try {
      console.log(`🔍 Checking if topic ${topicIdString} exists...`);
      const topicInfoQuery = new TopicInfoQuery().setTopicId(topicIdString);

      const topicInfo = await topicInfoQuery.execute(this.client);
      console.log(`✅ Topic ${topicIdString} exists and is accessible`);
      console.log(`   Topic memo: ${topicInfo.topicMemo}`);
      return true;
    } catch (error) {
      console.log(
        `❌ Topic ${topicIdString} does not exist or is not accessible:`,
        error.message
      );
      return false;
    }
  }

  // Create a new Hedera topic
  async createTopic(memo = "Demo Topic for Encrypted Messages") {
    if (!this.client) {
      throw new Error("Hedera client not initialized");
    }

    try {
      console.log("🏗️ Creating new demo Hedera topic...");

      const transaction = new TopicCreateTransaction()
        .setTopicMemo(memo)
        .setMaxTransactionFee(new Hbar(2)); // Set max fee to 2 HBAR

      const txResponse = await transaction.execute(this.client);
      const receipt = await txResponse.getReceipt(this.client);
      const newTopicId = receipt.topicId;

      console.log(`✅ Demo Hedera topic created successfully: ${newTopicId}`);
      console.log(`   Topic memo: ${memo}`);
      console.log(`   💡 You can use this topic ID: ${newTopicId}`);

      return newTopicId.toString();
    } catch (error) {
      console.error("❌ Failed to create demo Hedera topic:", error.message);
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
      console.log(`📤 Submitting message to topic ${topicIdString}...`);

      const transaction = new TopicMessageSubmitTransaction()
        .setTopicId(topicIdString)
        .setMessage(message)
        .setMaxTransactionFee(new Hbar(1)); // Set max fee to 1 HBAR

      const txResponse = await transaction.execute(this.client);
      const receipt = await txResponse.getReceipt(this.client);

      console.log(
        `✅ Message submitted to topic ${topicIdString} successfully`
      );
      console.log(`   Transaction ID: ${txResponse.transactionId}`);
      console.log(`   Sequence Number: ${receipt.topicSequenceNumber}`);
      return receipt;
    } catch (error) {
      console.error(
        `❌ Failed to submit message to topic ${topicIdString}:`,
        error.message
      );
      throw error;
    }
  }

  // Get topic info for demos
  getTopicInfo() {
    return {
      topicId: this.topicId,
      hederaNetwork: this.network,
      accountId: this.accountId,
      clientInitialized: this.client !== null,
      keyType: this.keyType,
    };
  }

  // Check if Hedera is enabled for demos
  isEnabled() {
    return !!(this.accountId && this.privateKey);
  }

  // Get Hedera client
  getClient() {
    return this.client;
  }

  // Initialize topic for demo (simplified version)
  async initTopicForDemo(topicIdString) {
    if (!topicIdString) {
      throw new Error("Topic ID is required for demo");
    }

    this.topicId = topicIdString;

    // Initialize client
    const client = this.initClient();
    if (!client) {
      throw new Error("Failed to initialize Hedera client");
    }

    // Verify topic exists
    const exists = await this.checkTopicExists(topicIdString);
    if (!exists) {
      throw new Error(
        `Topic ${topicIdString} does not exist or is not accessible`
      );
    }

    console.log(`✅ Demo topic initialized: ${topicIdString}`);
    return topicIdString;
  }

  // Close client connection
  close() {
    if (this.client) {
      this.client.close();
      console.log("🔌 Demo Hedera client connection closed");
    }
  }
}

module.exports = { DemoHederaManager };
