#!/usr/bin/env node

// Demo script to test the message listener functionality
// This script will submit a test message to the Hedera topic to demonstrate
// the message listener detecting new messages

const { DemoHederaManager } = require("./demoHederaManager");
const { loadEnvFile } = require("../src/envLoader");
const path = require("path");

// Load environment variables from the demo folder first, then fallback to project root
const demoEnvPath = path.join(__dirname, ".env");
const projectEnvPath = path.join(__dirname, "../.env");

try {
  loadEnvFile(demoEnvPath);
  console.log("📁 Using demo-specific .env file");
} catch (error) {
  console.log("📁 Demo .env not found, falling back to project .env");
  loadEnvFile(projectEnvPath);
}

async function demonstrateMessageListener() {
  console.log("🚀 Hedera Message Listener Demo");
  console.log("===============================\n");

  // Initialize demo database location (keep demo data separate)
  const HEDERA_NETWORK = process.env.HEDERA_NETWORK || "testnet";

  // Initialize Demo Hedera Manager with ECDSA support (simplified demo version)
  const demoHederaManager = new DemoHederaManager({
    accountId: process.env.HEDERA_ACCOUNT_ID,
    privateKey: process.env.HEDERA_PRIVATE_KEY,
    network: HEDERA_NETWORK,
    keyType: process.env.HEDERA_KEY_TYPE || "ECDSA",
  });

  if (!demoHederaManager.isEnabled()) {
    console.log("❌ Hedera credentials not configured. Please set:");
    console.log("   - HEDERA_ACCOUNT_ID");
    console.log("   - HEDERA_PRIVATE_KEY");
    console.log("   - HEDERA_TOPIC_ID");
    console.log("   - HEDERA_KEY_TYPE (optional, defaults to ECDSA)");
    process.exit(1);
  }

  const topicId = process.env.HEDERA_TOPIC_ID;
  if (!topicId) {
    console.log("❌ HEDERA_TOPIC_ID is required for this demo");
    console.log("   Please set HEDERA_TOPIC_ID in your demo/.env file");
    console.log("   You can get a topic ID by running the main server first");
    process.exit(1);
  }

  try {
    console.log("1️⃣  Initializing demo Hedera client and topic...");
    await demoHederaManager.initTopicForDemo(topicId);

    console.log(`✅ Using topic: ${topicId}\n`);

    console.log("2️⃣  This demo uses a simplified approach without persistent message listening.");
    console.log("   For full message listening functionality, use the main server.\n");

    console.log("3️⃣  Submitting test message...");
    const testMessage = `Hello from demo script! Timestamp: ${new Date().toISOString()}`;
    const receipt = await demoHederaManager.submitMessageToTopic(topicId, testMessage);

    console.log("✅ Test message submitted!");
    console.log(`   Sequence Number: ${receipt.topicSequenceNumber}`);
    console.log(
      "⏳ Message submitted to Hedera network successfully!"
    );
    console.log(
      "   The message will be available via mirror node within a few seconds.\n"
    );

    console.log("✅ Demo completed successfully!");
    console.log("💡 To see full message listening functionality, run the main server:");
    console.log("   npm start");
    console.log("   The server will automatically detect and log new messages.\n");

    // Close the client connection
    demoHederaManager.close();
    
  } catch (error) {
    console.error("❌ Demo failed:", error.message);
    demoHederaManager.close();
    process.exit(1);
  }
}

// Run the demo
demonstrateMessageListener().catch(console.error);
