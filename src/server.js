const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
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
  getLastProcessedSequence,
  storeLastProcessedSequence,
} = require("./dbManager");
const { HederaManager } = require("./hederaManager");
const { loadEnvFile } = require("./envLoader");

// Load .env file before accessing environment variables (unless explicitly disabled)
if (!process.env.SKIP_ENV_FILE) {
  loadEnvFile();
}

// Configuration
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const DATA_FOLDER = process.env.DATA_FOLDER || "data";
const DEFAULT_SERVER =
  process.env.DEFAULT_SERVER || "https://testnet.hashio.io/api"; // Fallback server

// Hedera configuration
const HEDERA_ACCOUNT_ID = process.env.HEDERA_ACCOUNT_ID;
const HEDERA_PRIVATE_KEY = process.env.HEDERA_PRIVATE_KEY;
const HEDERA_NETWORK = process.env.HEDERA_NETWORK || "testnet"; // testnet or mainnet
const HEDERA_TOPIC_ID = process.env.HEDERA_TOPIC_ID; // Optional: existing topic ID

// Generate network-specific database file path
function getDBFilePath() {
  return path.join(DATA_FOLDER, `routing_db_${HEDERA_NETWORK}.json`);
}

// Initialize Hedera manager
const hederaManager = new HederaManager({
  accountId: HEDERA_ACCOUNT_ID,
  privateKey: HEDERA_PRIVATE_KEY,
  network: HEDERA_NETWORK,
  topicId: HEDERA_TOPIC_ID,
  getLastProcessedSequence,
  storeLastProcessedSequence,
  dbFile: getDBFilePath(),
  getRSAKeyPair,
});

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
  const targetUrl = new URL(targetServer);
  const httpModule = targetUrl.protocol === "https:" ? https : http;

  // For JSON-RPC requests, we want to forward to the exact target server path
  // Don't append the original request path since we're proxying to a specific API endpoint

  // Filter headers to avoid conflicts with the target server
  const allowedHeaders = {};
  if (req.headers["content-type"]) {
    allowedHeaders["content-type"] = req.headers["content-type"];
  }
  if (req.headers["user-agent"]) {
    allowedHeaders["user-agent"] = req.headers["user-agent"];
  }
  if (req.headers["accept"]) {
    allowedHeaders["accept"] = req.headers["accept"];
  }

  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port,
    path: targetUrl.pathname + targetUrl.search,
    method: req.method,
    headers: {
      ...allowedHeaders,
      host: targetUrl.host,
      "content-length": Buffer.byteLength(requestBody || ""),
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

    // Handle combined status endpoint - shows both topic and public key info
    if (req.url === "/status" && req.method === "GET") {
      const topicInfo = hederaManager.getTopicInfo();
      const keyPair = getRSAKeyPair();

      const statusInfo = {
        hederaNetwork: topicInfo.hederaNetwork,
        topicId: topicInfo.topicId,
        publicKey: keyPair ? keyPair.publicKey : null,
      };

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(statusInfo, null, 2));
      return;
    }

    if (req.url === "/routes" && req.method === "POST") {
      const { body, jsonData } = await parseRequestBody(req);
      if (jsonData) {
        await updateRoutes(jsonData, saveDatabase, getDBFilePath());
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
    if (req.url === "/status/topic" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(hederaManager.getTopicInfo(), null, 2));
      return;
    }

    // Handle RSA public key endpoint
    if (req.url === "/status/public-key" && req.method === "GET") {
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
    let targetServer = DEFAULT_SERVER;

    // Only analyze transactions for eth_sendRawTransaction method
    if (jsonData && jsonData.method === "eth_sendRawTransaction") {
      const rawTx = jsonData.params;

      if (rawTx && rawTx.length > 0) {
        toAddress = extractToFromTransaction(rawTx[0]);
        // Get target server based on "to" address only for eth_sendRawTransaction
        targetServer = getTargetServer(toAddress, DEFAULT_SERVER);
        console.log(
          `${req.method} ${req.url} - method: ${jsonData.method}, to address: "${toAddress}" -> ${targetServer}`
        );
      } else {
        console.log(
          `${req.method} ${req.url} - method: ${jsonData.method}, no raw transaction found -> ${DEFAULT_SERVER}`
        );
      }
    } else {
      // For all other methods, use default server
      const method = jsonData ? jsonData.method : "unknown";
      console.log(
        `${req.method} ${req.url} - method: ${method} -> ${DEFAULT_SERVER} (default)`
      );
    }

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
  try {
    await initDatabase(getDBFilePath());
    await initRSAKeyPair(getDBFilePath());
    await hederaManager.initTopic(getRSAKeyPair);
  } catch (error) {
    console.error("Failed to initialize server:", error.message);
    process.exit(1);
  }

  server.listen(PORT, () => {
    console.log(`Hiero JSON-RPC Relay Proxy running on port ${PORT}`);
    console.log(`Default target server: ${DEFAULT_SERVER}`);

    const topicId = hederaManager.getTopicId();
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
    console.log(
      `  GET  http://localhost:${PORT}/status - Topic id & public key`
    );
    console.log(
      `  GET  http://localhost:${PORT}/status/topic - Get Hedera topic info`
    );
    console.log(
      `  GET  http://localhost:${PORT}/status/public-key - Get RSA public key`
    );
    console.log(`  GET  http://localhost:${PORT}/routes - View current routes`);
    console.log(`  POST http://localhost:${PORT}/routes - Update routes`);
    console.log("\nExample request:");
    console.log(`  curl -X POST http://localhost:${PORT} \\`);
    console.log(`    -H "Content-Type: application/json" \\`);
    console.log(
      `    -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'`
    );

    // Start listening for new Hedera topic messages if topic is available
    if (hederaManager.isEnabled() && topicId) {
      console.log("\n" + "=".repeat(60));
      console.log("🎯 STARTING HEDERA MESSAGE LISTENER");
      console.log("=".repeat(60));

      // Start message listener with 5-second intervals
      global.messageListenerInterval = hederaManager.startMessageListener(5000);
    }
  });

  // Handle server listen errors (e.g., port already in use)
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`❌ Error: Port ${PORT} is already in use`);
      console.error(
        "Please choose a different port or stop the process using this port."
      );
      console.error(`You can use: lsof -ti:${PORT} | xargs kill -9`);
    } else if (error.code === "EACCES") {
      console.error(`❌ Error: Permission denied to bind to port ${PORT}`);
      console.error(
        "Please try using a port number above 1024 or run with appropriate permissions."
      );
    } else {
      console.error(`❌ Error binding to port ${PORT}:`, error.message);
    }

    console.error("Server startup failed. Exiting...");
    process.exit(1);
  });
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down server...");

  // Stop message listener if running
  if (global.messageListenerInterval) {
    hederaManager.stopMessageListener(global.messageListenerInterval);
  }

  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

// Start the server
startServer().catch(console.error);
