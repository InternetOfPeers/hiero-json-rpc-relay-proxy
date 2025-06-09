#!/usr/bin/env node

// Prover script to send encrypted messages to Hedera topic
// This script will:
// 1. Fetch the status from the /status endpoint
// 2. Extract the topic ID and public key
// 3. Encrypt a payload using the RSA public key
// 4. Send the encrypted message to the Hedera topic

const { ProverHederaManager } = require("./proverHederaManager");
const { loadEnvFile } = require("../../proxy/src/envLoader");
const { encryptHybridMessage } = require("../../proxy/src/cryptoUtils");
const { ethers } = require("ethers");
const http = require("http");
const path = require("path");

// Load environment variables from the prover folder first, then fallback to packages/proxy
const proverEnvPath = path.join(__dirname, "..", ".env");

try {
  loadEnvFile(proverEnvPath);
  console.log("📁 Using prover-specific .env file");
} catch (error) {
  console.log("📁 Prover .env not found, stopping the prover");
  process.exit(0);
}

// Configuration
const PROXY_SERVER_URL =
  process.env.PROXY_SERVER_URL || "http://localhost:3000";
const HEDERA_NETWORK = process.env.HEDERA_NETWORK || "testnet";

// Function to fetch status from the proxy server
function fetchStatus() {
  return new Promise((resolve, reject) => {
    const url = `${PROXY_SERVER_URL}/status`;
    console.log(`📡 Fetching status from: ${url}`);

    const request = http.get(url, (response) => {
      let data = "";

      response.on("data", (chunk) => {
        data += chunk;
      });

      response.on("end", () => {
        try {
          if (response.statusCode === 200) {
            const status = JSON.parse(data);
            resolve(status);
          } else {
            reject(new Error(`HTTP ${response.statusCode}: ${data}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse JSON: ${error.message}`));
        }
      });
    });

    request.on("error", (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    request.setTimeout(5000, () => {
      request.destroy();
      reject(new Error("Request timeout"));
    });
  });
}

// Function to send encrypted message to Hedera topic
async function sendEncryptedMessage(topicId, encryptedPayload) {
  console.log(`📤 Sending encrypted message to topic: ${topicId}`);

  // Initialize Prover Hedera Manager with ECDSA support
  const proverHederaManager = new ProverHederaManager({
    accountId: process.env.HEDERA_ACCOUNT_ID,
    privateKey: process.env.HEDERA_PRIVATE_KEY,
    network: HEDERA_NETWORK,
    keyType: process.env.HEDERA_KEY_TYPE || "ECDSA",
  });

  if (!proverHederaManager.isEnabled()) {
    throw new Error(
      "Hedera credentials not configured. Please set HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY"
    );
  }

  // Initialize topic for prover
  await proverHederaManager.initTopicForProver(topicId);

  try {
    // Submit the message to the topic
    const receipt = await proverHederaManager.submitMessageToTopic(
      topicId,
      encryptedPayload
    );

    console.log("✅ Encrypted message sent successfully!");
    console.log(`   Sequence Number: ${receipt.topicSequenceNumber}`);

    // Close the client connection
    proverHederaManager.close();
  } catch (error) {
    proverHederaManager.close();
    throw error;
  }
}

async function demonstrateEncryptedMessaging() {
  console.log("🔐 Encrypted Message Sender Prover");
  console.log("=================================\n");

  try {
    // Step 1: Fetch status from proxy server
    console.log("1️⃣  Fetching status from proxy server...");
    const status = await fetchStatus();

    console.log("📊 Status received:");
    console.log(`   Topic ID: ${status.topicId}`);
    console.log(`   Network: ${status.hederaNetwork}`);
    console.log(`   Has Public Key: ${!!status.publicKey}`);

    // Validate required data
    if (!status.topicId) {
      throw new Error(
        "Topic ID not available. Make sure the proxy server is running and has initialized a topic."
      );
    }

    if (!status.publicKey) {
      throw new Error(
        "Public key not available. Make sure the proxy server has initialized RSA keys."
      );
    }

    // Step 2: Create a test payload
    console.log("2️⃣  Creating test payload...");

    // Create a test payload for the prover with a single route and signature

    const privateKey = process.env.HEDERA_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("HEDERA_PRIVATE_KEY not set in environment");
    }

    // Create wallet and get address for logging
    const wallet = new ethers.Wallet(privateKey);
    const signerAddress = wallet.address;
    console.log(`🔑 Signer address: ${signerAddress}`);

    // Function to sign the URL using ethers.js signMessage
    const signUrl = async (url) => {
      try {
        // Create wallet from private key
        const wallet = new ethers.Wallet(privateKey);

        // Sign the URL using ethers signMessage (EIP-191 standard)
        const signature = await wallet.signMessage(url);

        console.log(`🔑 Signed URL: ${url}`);
        console.log(`📝 Signature: ${signature.slice(0, 20)}...`);

        return signature;
      } catch (error) {
        console.error("Error signing URL:", error.message);
        throw error;
      }
    };

    const testUrl = "http://localhost:7546";

    // One signature per route - now using async/await for signing
    const testPayload = {
      routes: {
        "0x4f1a953df9df8d1c6073ce57f7493e50515fa73f": {
          url: testUrl,
          sig: await signUrl(testUrl),
        },
        "0x4f1a953df9df8d1c6073ce57f7493e50515fa73a": {
          url: testUrl,
          sig: await signUrl(testUrl),
        },
      },
    };

    console.log("🔑 Signed URLs with ethers.js ECDSA...");
    console.log(
      `   ✅ Signed ${testUrl} -> ${testPayload.routes[
        "0x4f1a953df9df8d1c6073ce57f7493e50515fa73f"
      ].sig.slice(0, 20)}...`
    );

    const payloadJson = JSON.stringify(testPayload);
    console.log("📦 Test payload created:");
    console.log(payloadJson);
    console.log("");

    // Step 3: Encrypt the payload
    console.log("3️⃣  Encrypting payload...");
    const encryptedPayload = encryptHybridMessage(
      status.publicKey,
      payloadJson,
      true // verbose logging
    );

    // Step 4: Send encrypted message to topic
    console.log("4️⃣  Sending encrypted message to Hedera topic...");
    await sendEncryptedMessage(status.topicId, encryptedPayload);

    console.log("\n🎉 Prover completed successfully!");
    console.log("📝 Summary:");
    console.log(`   - Topic ID: ${status.topicId}`);
    console.log(`   - Original payload size: ${payloadJson.length} bytes`);
    console.log(
      `   - Encrypted payload size: ${encryptedPayload.length} bytes`
    );
    console.log(
      "\n💡 The encrypted message has been sent to the Hedera topic."
    );
    process.exit(0);
  } catch (error) {
    console.error("❌ Prover failed:", error.message);
    console.error("\n🔧 Troubleshooting:");
    console.error("   1. Make sure the proxy server is running (npm start)");
    console.error("   2. Verify Hedera credentials are configured");
    console.error("   3. Check that RSA keys have been generated");
    console.error("   4. Ensure the topic has been initialized");
    process.exit(1);
  }
}

// Run the prover
demonstrateEncryptedMessaging().catch(console.error);
