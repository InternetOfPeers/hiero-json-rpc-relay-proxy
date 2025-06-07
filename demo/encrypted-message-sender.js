#!/usr/bin/env node

// Demo script to send encrypted messages to Hedera topic
// This script will:
// 1. Fetch the status from the /status endpoint
// 2. Extract the topic ID and public key
// 3. Encrypt a payload using the RSA public key
// 4. Send the encrypted message to the Hedera topic

const { HederaManager } = require("../src/hederaManager");
const { loadEnvFile } = require("../src/envLoader");
const http = require("http");
const crypto = require("crypto");
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

// Configuration
const PROXY_SERVER_URL =
  process.env.PROXY_SERVER_URL || "http://localhost:3000";
const HEDERA_NETWORK = process.env.HEDERA_NETWORK || "testnet";
const DEMO_MESSAGE_INTERVAL =
  parseInt(process.env.DEMO_MESSAGE_INTERVAL) || 5000;
const DEMO_PAYLOAD_SIZE = process.env.DEMO_PAYLOAD_SIZE || "small";

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

// Function to encrypt data using hybrid encryption (RSA + AES)
function encryptWithPublicKey(publicKeyPem, data) {
  try {
    console.log("🔐 Encrypting payload with hybrid encryption (RSA + AES)...");

    // Generate a random AES key (256-bit) and IV
    const aesKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);

    // Encrypt the data with AES-256-CBC
    const aesCipher = crypto.createCipheriv("aes-256-cbc", aesKey, iv);
    let encryptedData = aesCipher.update(data, "utf8", "base64");
    encryptedData += aesCipher.final("base64");

    // Encrypt the AES key with RSA
    const encryptedAesKey = crypto.publicEncrypt(
      {
        key: publicKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      aesKey
    );

    // Combine everything into a single payload
    const hybridPayload = {
      encryptedAesKey: encryptedAesKey.toString("base64"),
      iv: iv.toString("base64"),
      encryptedData: encryptedData,
      algorithm: "hybrid-rsa-aes256",
    };

    const finalPayload = JSON.stringify(hybridPayload);
    const encryptedBase64 = Buffer.from(finalPayload).toString("base64");

    console.log(
      `✅ Payload encrypted successfully with hybrid encryption (${encryptedBase64.length} characters)`
    );

    return encryptedBase64;
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

// Function to send encrypted message to Hedera topic
async function sendEncryptedMessage(topicId, encryptedPayload) {
  console.log(`📤 Sending encrypted message to topic: ${topicId}`);

  // Initialize Hedera Manager
  const hederaManager = new HederaManager({
    accountId: process.env.HEDERA_ACCOUNT_ID,
    privateKey: process.env.HEDERA_PRIVATE_KEY,
    network: HEDERA_NETWORK,
    topicId: topicId,
  });

  if (!hederaManager.isEnabled()) {
    throw new Error(
      "Hedera credentials not configured. Please set HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY"
    );
  }

  // Initialize the client
  hederaManager.initClient();

  if (!hederaManager.getClient()) {
    throw new Error("Failed to initialize Hedera client");
  }

  // Create a message with metadata
  const messageWithMetadata = {
    type: "encrypted",
    timestamp: new Date().toISOString(),
    encryptedPayload: encryptedPayload,
    algorithm: "hybrid-rsa-aes256",
    encoding: "base64",
    description:
      "Hybrid encryption: RSA-OAEP-SHA256 for AES key, AES-256-CBC for data",
  };

  // Submit the message to the topic
  await hederaManager.submitMessageToTopic(
    topicId,
    JSON.stringify(messageWithMetadata)
  );

  console.log("✅ Encrypted message sent successfully!");
  return messageWithMetadata;
}

async function demonstrateEncryptedMessaging() {
  console.log("🔐 Encrypted Message Sender Demo");
  console.log("=================================\n");

  try {
    // Step 1: Fetch status from proxy server
    console.log("1️⃣  Fetching status from proxy server...");
    const status = await fetchStatus();

    console.log("📊 Status received:");
    console.log(`   Topic ID: ${status.topicId || "Not available"}`);
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

    // Create payload based on configured size
    let testPayload = {
      message: "Hello from encrypted message sender!",
      timestamp: new Date().toISOString(),
      sender: "demo-script",
      config: {
        payloadSize: DEMO_PAYLOAD_SIZE,
        messageInterval: DEMO_MESSAGE_INTERVAL,
      },
    };

    if (DEMO_PAYLOAD_SIZE === "large") {
      testPayload.data = {
        temperature: 25.5,
        humidity: 60,
        status: "active",
        sensors: Array.from({ length: 10 }, (_, i) => ({
          id: `sensor_${i}`,
          value: Math.random() * 100,
          timestamp: new Date().toISOString(),
        })),
        metadata: {
          location: "Demo Location",
          description:
            "Large payload demonstration with multiple sensor readings",
          tags: ["demo", "test", "encrypted", "large-payload"],
        },
      };
    } else {
      testPayload.data = {
        temperature: 25.5,
        humidity: 60,
        status: "active",
      };
    }

    const payloadJson = JSON.stringify(testPayload, null, 2);
    console.log("📦 Test payload created:");
    console.log(payloadJson);
    console.log("");

    // Step 3: Encrypt the payload
    console.log("3️⃣  Encrypting payload...");
    const encryptedPayload = encryptWithPublicKey(
      status.publicKey,
      payloadJson
    );

    // Step 4: Send encrypted message to topic
    console.log("4️⃣  Sending encrypted message to Hedera topic...");
    const sentMessage = await sendEncryptedMessage(
      status.topicId,
      encryptedPayload
    );

    console.log("\n🎉 Demo completed successfully!");
    console.log("📝 Summary:");
    console.log(`   - Topic ID: ${status.topicId}`);
    console.log(`   - Original payload size: ${payloadJson.length} bytes`);
    console.log(
      `   - Encrypted payload size: ${encryptedPayload.length} bytes`
    );
    console.log(`   - Message sent at: ${sentMessage.timestamp}`);
    console.log(
      "\n💡 The encrypted message has been sent to the Hedera topic."
    );
    console.log(
      "   You can verify it was received by checking the topic messages in the mirror node."
    );
  } catch (error) {
    console.error("❌ Demo failed:", error.message);
    console.error("\n🔧 Troubleshooting:");
    console.error("   1. Make sure the proxy server is running (npm start)");
    console.error("   2. Verify Hedera credentials are configured");
    console.error("   3. Check that RSA keys have been generated");
    console.error("   4. Ensure the topic has been initialized");
    process.exit(1);
  }
}

// Run the demo
demonstrateEncryptedMessaging().catch(console.error);
