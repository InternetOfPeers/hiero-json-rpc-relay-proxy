#!/usr/bin/env node

// Test script for DemoHederaManager ECDSA functionality
// This script tests ECDSA key initialization without making network calls

const { DemoHederaManager } = require("./demoHederaManager");
const { loadEnvFile } = require("../src/envLoader");
const path = require("path");

// Load demo environment
const demoEnvPath = path.join(__dirname, ".env");
try {
  loadEnvFile(demoEnvPath);
  console.log("✅ Demo .env file loaded");
} catch (error) {
  console.log("❌ Demo .env file not found");
  console.log("   Please copy .env.example to .env and configure it");
  process.exit(1);
}

console.log("🧪 Testing DemoHederaManager ECDSA Support");
console.log("==========================================\n");

// Test ECDSA key initialization
console.log("1️⃣ Testing ECDSA Key Initialization...");

const demoManager = new DemoHederaManager({
  accountId: process.env.HEDERA_ACCOUNT_ID,
  privateKey: process.env.HEDERA_PRIVATE_KEY,
  network: process.env.HEDERA_NETWORK || "testnet",
  keyType: process.env.HEDERA_KEY_TYPE || "ECDSA",
});

// Check if credentials are available
if (!demoManager.isEnabled()) {
  console.log("❌ Hedera credentials not configured");
  console.log("   Please set HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY in demo/.env");
  process.exit(1);
}

console.log("✅ Credentials configured:");
console.log(`   Account ID: ${process.env.HEDERA_ACCOUNT_ID}`);
console.log(`   Network: ${process.env.HEDERA_NETWORK || "testnet"}`);
console.log(`   Key Type: ${process.env.HEDERA_KEY_TYPE || "ECDSA"}`);
console.log(`   Private Key: ${process.env.HEDERA_PRIVATE_KEY.substring(0, 10)}...`);

// Test client initialization
console.log("\n2️⃣ Testing Client Initialization...");
try {
  const client = demoManager.initClient();
  if (client) {
    console.log("✅ Hedera client initialized successfully");
    console.log("   Client type:", client.constructor.name);
    
    // Test topic info
    const topicInfo = demoManager.getTopicInfo();
    console.log("\n3️⃣ Topic Info:");
    console.log("   ", JSON.stringify(topicInfo, null, 2));
    
    // Close the client
    demoManager.close();
    console.log("\n✅ Test completed successfully!");
    console.log("   Your ECDSA configuration is working correctly.");
    console.log("\n💡 You can now run the demos:");
    console.log("   npm run demo:encrypted");
    
  } else {
    console.log("❌ Failed to initialize client");
    process.exit(1);
  }
} catch (error) {
  console.log("❌ Client initialization failed:");
  console.log("   ", error.message);
  process.exit(1);
}
