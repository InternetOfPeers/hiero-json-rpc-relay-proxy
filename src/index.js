const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const {
  Client,
  PrivateKey,
  AccountId,
  TopicCreateTransaction,
  TopicInfoQuery,
  TopicMessageQuery,
  TopicMessageSubmitTransaction,
  Hbar,
} = require("@hashgraph/sdk");
const { rlpDecode, extractToFromTransaction } = require("./ethTxDecoder");
const {
  initDatabase,
  saveDatabase,
  getTargetServer,
  getRoutingDB,
  updateRoutes,
  initRSAKeyPair,
  getRSAKeyPair,
  hasRSAKeyPair,
} = require("./dbManager");

// Simple .env file parser (no external dependencies)
function loadEnvFile(envPath = ".env") {
  try {
    const fullPath = path.resolve(envPath);
    if (fs.existsSync(fullPath)) {
      const envContent = fs.readFileSync(fullPath, "utf8");
      const lines = envContent.split("\n");

      for (const line of lines) {
        const trimmedLine = line.trim();

        // Skip empty lines and comments
        if (!trimmedLine || trimmedLine.startsWith("#")) {
          continue;
        }

        // Parse key=value pairs
        const equalIndex = trimmedLine.indexOf("=");
        if (equalIndex > 0) {
          const key = trimmedLine.substring(0, equalIndex).trim();
          let value = trimmedLine.substring(equalIndex + 1).trim();

          // Remove quotes if present
          if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
          ) {
            value = value.slice(1, -1);
          }

          // Only set if not already defined in process.env
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
      console.log(`Loaded environment variables from ${envPath}`);
    }
  } catch (error) {
    // Silently fail if .env file doesn't exist or can't be read
    // This maintains the same behavior as dotenv
  }
}

// Load .env file before accessing environment variables
loadEnvFile();

// Configuration
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const DB_FILE = process.env.DB_FILE || "data/routing_db.json";
const DEFAULT_SERVER =
  process.env.DEFAULT_SERVER || "https://mainnet.hashio.io/api"; // Fallback server

// Hedera configuration
const HEDERA_ACCOUNT_ID = process.env.HEDERA_ACCOUNT_ID;
const HEDERA_PRIVATE_KEY = process.env.HEDERA_PRIVATE_KEY;
const HEDERA_NETWORK = process.env.HEDERA_NETWORK || "testnet"; // testnet or mainnet
const HEDERA_TOPIC_ID = process.env.HEDERA_TOPIC_ID; // Optional: existing topic ID

let hederaClient = null;
let topicId = null;

// Initialize Hedera client
function initHederaClient() {
  if (!HEDERA_ACCOUNT_ID || !HEDERA_PRIVATE_KEY) {
    console.log(
      "Hedera credentials not provided. Skipping Hedera topic setup."
    );
    return null;
  }

  try {
    const accountId = AccountId.fromString(HEDERA_ACCOUNT_ID);
    const privateKey = PrivateKey.fromString(HEDERA_PRIVATE_KEY);

    // Create client for the appropriate network
    const client =
      HEDERA_NETWORK === "mainnet" ? Client.forMainnet() : Client.forTestnet();

    client.setOperator(accountId, privateKey);

    console.log(`Hedera client initialized for ${HEDERA_NETWORK}`);
    console.log(`Using account: ${HEDERA_ACCOUNT_ID}`);

    return client;
  } catch (error) {
    console.error("Failed to initialize Hedera client:", error.message);
    return null;
  }
}

// Check if topic exists and is accessible
async function checkTopicExists(client, topicIdString) {
  if (!client || !topicIdString) {
    return false;
  }

  try {
    const topicInfoQuery = new TopicInfoQuery().setTopicId(topicIdString);

    const topicInfo = await topicInfoQuery.execute(client);
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
async function createHederaTopic(client) {
  if (!client) {
    throw new Error("Hedera client not initialized");
  }

  try {
    console.log("Creating new Hedera topic...");

    const transaction = new TopicCreateTransaction()
      .setTopicMemo("Ethereum Relay Proxy Topic")
      .setMaxTransactionFee(new Hbar(2)); // Set max fee to 2 HBAR

    const txResponse = await transaction.execute(client);
    const receipt = await txResponse.getReceipt(client);
    const newTopicId = receipt.topicId;

    console.log(`✅ Hedera topic created successfully: ${newTopicId}`);
    return newTopicId.toString();
  } catch (error) {
    console.error("Failed to create Hedera topic:", error.message);
    throw error;
  }
}

// Initialize Hedera topic management
async function initHederaTopic() {
  hederaClient = initHederaClient();

  if (!hederaClient) {
    console.log("Hedera functionality disabled - no credentials provided");
    return;
  }

  try {
    // Check if a topic ID was provided in environment variables
    if (HEDERA_TOPIC_ID) {
      const exists = await checkTopicExists(hederaClient, HEDERA_TOPIC_ID);
      if (exists) {
        topicId = HEDERA_TOPIC_ID;
        console.log(`Using existing Hedera topic: ${topicId}`);

        // Check if topic has messages and send public key if empty
        await checkAndSubmitPublicKey(false); // Pass false to indicate this is an existing topic
        return;
      } else {
        console.log(
          `Provided topic ID ${HEDERA_TOPIC_ID} is not accessible, creating new topic...`
        );
      }
    }

    // Create a new topic
    topicId = await createHederaTopic(hederaClient);
    console.log(`Hedera topic initialized: ${topicId}`);
    console.log(`💡 Add this to your .env file: HEDERA_TOPIC_ID=${topicId}`);

    // For new topics, always send the public key as the first message
    await checkAndSubmitPublicKey(true); // Pass true to indicate this is a new topic
  } catch (error) {
    console.error("Failed to initialize Hedera topic:", error.message);
    console.log("Server will continue without Hedera topic functionality");
  }
}

// Check topic for messages and submit public key if needed
async function checkAndSubmitPublicKey(isNewTopic = false) {
  if (!hederaClient || !topicId) {
    console.log(
      "Hedera client or topic not initialized, skipping public key submission"
    );
    return;
  }

  try {
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
      const hasMessages = await checkTopicHasMessages(hederaClient, topicId);
      shouldSubmitKey = !hasMessages;
    }

    if (shouldSubmitKey) {
      console.log(
        isNewTopic
          ? "Sending public key as first message to new topic..."
          : "Topic has no messages, sending public key as first message..."
      );
      await submitPublicKeyToTopic(hederaClient, topicId, keyPair.publicKey);
    } else {
      console.log("Topic already has messages, skipping public key submission");
    }
  } catch (error) {
    console.error(
      "Failed to check topic messages or submit public key:",
      error.message
    );
    console.log("Server will continue without public key submission");
  }
}

// Get current topic ID
function getHederaTopicId() {
  return topicId;
}

// Get Hedera client
function getHederaClient() {
  return hederaClient;
}

// Parse request body
function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      try {
        let jsonData = null;
        if (body.trim()) {
          jsonData = JSON.parse(body);
        }
        resolve({ body, jsonData });
      } catch (error) {
        console.error("JSON parse error:", error.message);
        resolve({ body, jsonData: null });
      }
    });

    req.on("error", reject);
  });
}

// Forward request to target server
function forwardRequest(targetServer, req, res, requestBody) {
  const targetUrl = new URL(req.url, targetServer);
  const httpModule = targetUrl.protocol === "https:" ? https : http;

  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port,
    path: targetUrl.pathname + targetUrl.search,
    method: req.method,
    headers: {
      ...req.headers,
      host: targetUrl.host,
      "content-length": Buffer.byteLength(requestBody),
    },
  };

  const proxyReq = httpModule.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on("error", (err) => {
    console.error("Proxy request error:", err.message);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "Proxy Error: Unable to connect to target server",
      })
    );
  });

  if (requestBody) {
    proxyReq.write(requestBody);
  }
  proxyReq.end();
}

// Check if topic has any messages
async function checkTopicHasMessages(client, topicIdString) {
  if (!client || !topicIdString) {
    return false;
  }

  try {
    console.log(`Checking for messages in topic ${topicIdString}...`);

    // For newly created topics, there's often a propagation delay
    // Use a more robust approach with shorter timeout and immediate fallback
    const query = new TopicMessageQuery().setTopicId(topicIdString).setLimit(1);

    return new Promise((resolve) => {
      let hasMessages = false;
      let resolved = false;
      let subscription = null;

      // Very short timeout for new topics
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          if (subscription) {
            try {
              subscription.unsubscribe();
            } catch (e) {
              // Ignore unsubscribe errors
            }
          }
          console.log(
            `No messages found in topic ${topicIdString} after timeout`
          );
          resolve(false);
        }
      }, 3000); // Reduced to 3 seconds

      try {
        subscription = query.subscribe(
          client,
          (message) => {
            if (!resolved) {
              resolved = true;
              hasMessages = true;
              clearTimeout(timeoutId);
              console.log(`Found existing messages in topic ${topicIdString}`);
              resolve(true);
            }
          },
          (error) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeoutId);
              console.log(
                `Error checking messages in topic ${topicIdString}:`,
                error.message
              );
              // For newly created topics, assume no messages on subscription error
              resolve(false);
            }
          }
        );
      } catch (subscribeError) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          console.log(
            `Failed to subscribe to topic ${topicIdString}:`,
            subscribeError.message
          );
          resolve(false);
        }
      }
    });
  } catch (error) {
    console.log(
      `Error checking messages in topic ${topicIdString}:`,
      error.message
    );
    return false;
  }
}

// Submit public key message to topic
async function submitPublicKeyToTopic(client, topicIdString, publicKey) {
  if (!client || !topicIdString || !publicKey) {
    throw new Error("Missing required parameters for topic message submission");
  }

  try {
    console.log(`Submitting public key to topic ${topicIdString}...`);

    // Send the plain text PEM public key directly
    const message = publicKey;

    const transaction = new TopicMessageSubmitTransaction()
      .setTopicId(topicIdString)
      .setMessage(message)
      .setMaxTransactionFee(new Hbar(1)); // Set max fee to 1 HBAR

    const txResponse = await transaction.execute(client);
    const receipt = await txResponse.getReceipt(client);

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

const server = http.createServer(async (req, res) => {
  try {
    // Handle management routes
    if (req.url === "/routes" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(getRoutingDB(), null, 2));
      return;
    }

    if (req.url === "/routes" && req.method === "POST") {
      const { body, jsonData } = await parseRequestBody(req);
      if (jsonData) {
        await updateRoutes(jsonData, saveDatabase, DB_FILE);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({ message: "Routes updated", routes: getRoutingDB() })
        );
      } else {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON payload" }));
      }
      return;
    }

    // Handle Hedera topic info endpoint
    if (req.url === "/hedera/topic" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify(
          {
            topicId: topicId,
            hederaNetwork: HEDERA_NETWORK,
            accountId: HEDERA_ACCOUNT_ID,
            clientInitialized: hederaClient !== null,
          },
          null,
          2
        )
      );
      return;
    }

    // Handle RSA public key endpoint
    if (req.url === "/rsa/public-key" && req.method === "GET") {
      const keyPair = getRSAKeyPair();
      if (keyPair) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify(
            {
              publicKey: keyPair.publicKey,
              createdAt: keyPair.createdAt,
              hasPrivateKey: !!keyPair.privateKey,
            },
            null,
            2
          )
        );
      } else {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "RSA key pair not initialized" }));
      }
      return;
    }

    // Parse request body for transaction analysis
    const { body: requestBody, jsonData } = await parseRequestBody(req);

    let toAddress = null;

    // Look for raw transaction in different possible fields
    if (jsonData) {
      const rawTx =
        jsonData.rawTransaction ||
        jsonData.params ||
        jsonData.data ||
        jsonData.transaction;

      if (rawTx) {
        toAddress = extractToFromTransaction(rawTx[0]);
      } else {
        console.log("No raw transaction found in JSON payload");
      }
    }

    // Log the routing decision
    console.log(`${req.method} ${req.url} - to address: "${toAddress}"`);

    // Get target server based on "to" address
    const targetServer = getTargetServer(toAddress, DEFAULT_SERVER);

    // Forward the request
    forwardRequest(targetServer, req, res, requestBody);
  } catch (error) {
    console.error("Server error:", error.message);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Internal server error" }));
  }
});

server.on("error", (err) => {
  console.error("Server error:", err.message);
});

// Start server
async function startServer() {
  await initDatabase(DB_FILE);
  await initRSAKeyPair(DB_FILE);
  await initHederaTopic();

  server.listen(PORT, () => {
    console.log(`Ethereum transaction routing proxy running on port ${PORT}`);
    console.log(`Default target server: ${DEFAULT_SERVER}`);

    if (topicId) {
      console.log(`Hedera topic: ${topicId}`);
    }

    // Display RSA key pair status
    if (hasRSAKeyPair()) {
      console.log("✅ RSA key pair initialized");
    }

    console.log("\nAvailable routes:");
    Object.entries(getRoutingDB()).forEach(([address, server]) => {
      // Skip displaying RSA keys in routes listing
      if (address !== "rsaKeys") {
        console.log(`  ${address} -> ${server}`);
      }
    });
    console.log("\nManagement endpoints:");
    console.log(`  GET  http://localhost:${PORT}/routes - View current routes`);
    console.log(`  POST http://localhost:${PORT}/routes - Update routes`);
    console.log(
      `  GET  http://localhost:${PORT}/hedera/topic - Get Hedera topic info`
    );
    console.log(
      `  GET  http://localhost:${PORT}/rsa/public-key - Get RSA public key`
    );
    console.log("\nExample request:");
    console.log(`  curl -X POST http://localhost:${PORT}/api/broadcast \\`);
    console.log(`    -H "Content-Type: application/json" \\`);
    console.log(`    -d '{"rawTransaction": "0xf86c..."}'`);
  });
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down server...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

// Start the server
startServer().catch(console.error);
