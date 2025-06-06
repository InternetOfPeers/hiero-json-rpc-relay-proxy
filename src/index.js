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
  Hbar,
} = require("@hashgraph/sdk");
const { rlpDecode, extractToFromTransaction } = require("./ethTxDecoder");
const {
  initDatabase,
  saveDatabase,
  getTargetServer,
  getRoutingDB,
  updateRoutes,
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
const DB_FILE = process.env.DB_FILE || "routing_db.json";
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
  } catch (error) {
    console.error("Failed to initialize Hedera topic:", error.message);
    console.log("Server will continue without Hedera topic functionality");
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
  await initHederaTopic();

  server.listen(PORT, () => {
    console.log(`Ethereum transaction routing proxy running on port ${PORT}`);
    console.log(`Default target server: ${DEFAULT_SERVER}`);

    if (topicId) {
      console.log(`Hedera topic: ${topicId}`);
    }

    console.log("\nAvailable routes:");
    Object.entries(getRoutingDB()).forEach(([address, server]) => {
      console.log(`  ${address} -> ${server}`);
    });
    console.log("\nManagement endpoints:");
    console.log(`  GET  http://localhost:${PORT}/routes - View current routes`);
    console.log(`  POST http://localhost:${PORT}/routes - Update routes`);
    console.log(
      `  GET  http://localhost:${PORT}/hedera/topic - Get Hedera topic info`
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
