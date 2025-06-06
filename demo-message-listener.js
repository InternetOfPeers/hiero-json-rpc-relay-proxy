#!/usr/bin/env node

// Demo script to test the message listener functionality
// This script will submit a test message to the Hedera topic to demonstrate
// the message listener detecting new messages

const { HederaManager } = require("./src/hederaManager");
const { loadEnvFile } = require("./src/envLoader");

// Load environment variables
loadEnvFile();

async function demonstrateMessageListener() {
  console.log("🚀 Hedera Message Listener Demo");
  console.log("===============================\n");

  // Initialize Hedera Manager
  const hederaManager = new HederaManager({
    accountId: process.env.HEDERA_ACCOUNT_ID,
    privateKey: process.env.HEDERA_PRIVATE_KEY,
    network: process.env.HEDERA_NETWORK || "testnet",
    topicId: process.env.HEDERA_TOPIC_ID,
  });

  if (!hederaManager.isEnabled()) {
    console.log("❌ Hedera credentials not configured. Please set:");
    console.log("   - HEDERA_ACCOUNT_ID");
    console.log("   - HEDERA_PRIVATE_KEY");
    console.log("   - HEDERA_TOPIC_ID (optional, will create new topic)");
    process.exit(1);
  }

  try {
    console.log("1️⃣  Initializing Hedera client and topic...");
    await hederaManager.initTopic(() => ({ publicKey: "demo-key" }));

    const topicId = hederaManager.getTopicId();
    console.log(`✅ Using topic: ${topicId}\n`);

    console.log("2️⃣  Starting message listener...");
    const intervalId = hederaManager.startMessageListener(10000); // Check every 10 seconds

    console.log("3️⃣  Submitting test message...");
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds

    const testMessage = `Hello from demo script! Timestamp: ${new Date().toISOString()}`;
    await hederaManager.submitPublicKeyToTopic(topicId, testMessage);

    console.log("✅ Test message submitted!");
    console.log(
      "⏳ Waiting for message to appear in mirror node (this may take 1-2 minutes)..."
    );
    console.log(
      "   The message listener will automatically detect and log the new message.\n"
    );

    console.log("🔍 Monitoring for new messages... (Press Ctrl+C to stop)");

    // Keep the script running to demonstrate the listener
    process.on("SIGINT", () => {
      console.log("\n\n🛑 Stopping message listener...");
      hederaManager.stopMessageListener(intervalId);
      console.log("👋 Demo completed!");
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ Demo failed:", error.message);
    process.exit(1);
  }
}

// Run the demo
demonstrateMessageListener().catch(console.error);
