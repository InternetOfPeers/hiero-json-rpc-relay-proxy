require("dotenv").config();
const http = require("http");
const https = require("https");
const fs = require("fs").promises;
const path = require("path");
const { rlpDecode, extractToFromTransaction } = require("./ethTxDecoder");

// Configuration
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const DB_FILE = process.env.DB_FILE || "routing_db.json";
const DEFAULT_SERVER =
  process.env.DEFAULT_SERVER || "https://mainnet.hashio.io/api"; // Fallback server

// In-memory database cache
let routingDB = {};

// Initialize database
async function initDatabase() {
  try {
    const dbPath = path.join(__dirname, DB_FILE);
    const data = await fs.readFile(dbPath, "utf8");
    routingDB = JSON.parse(data);
    console.log("Database loaded:", Object.keys(routingDB).length, "routes");
  } catch (error) {
    // Create default database with Ethereum addresses
    routingDB = {
      "0x742d35Cc6634C0532925a3b8D0c0f3e5C5C07c20": "https://api1.example.com",
      "0x8ba1f109551bD432803012645Hac136c8eb0Ff6": "https://api2.example.com",
      "0xd8dA6BF26964af9D7eEd9e03E53415D37aA96045":
        "https://admin-api.example.com",
      "0x4f1a953df9df8d1c6073ce57f7493e50515fa73f":
        "https://mainnet.hashio.io/api",
      "0x0000000000000000000000000000000000000000": "http://localhost:8080",
    };

    await saveDatabase();
    console.log(
      "Created default database with",
      Object.keys(routingDB).length,
      "routes"
    );
  }
}

// Save database to file
async function saveDatabase() {
  try {
    const dbPath = path.join(__dirname, DB_FILE);
    await fs.writeFile(dbPath, JSON.stringify(routingDB, null, 2));
  } catch (error) {
    console.error("Error saving database:", error.message);
  }
}

// Get target server based on Ethereum address
function getTargetServer(address) {
  if (!address) {
    console.log("No address found, using default server");
    return DEFAULT_SERVER;
  }

  const normalizedAddress = address.toLowerCase();
  const targetServer = routingDB[normalizedAddress];

  if (targetServer) {
    console.log(`Routing ${normalizedAddress} to: ${targetServer}`);
    return targetServer;
  }

  console.log(`No route found for ${normalizedAddress}, using default server`);
  return DEFAULT_SERVER;
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
      res.end(JSON.stringify(routingDB, null, 2));
      return;
    }

    if (req.url === "/routes" && req.method === "POST") {
      const { body, jsonData } = await parseRequestBody(req);
      if (jsonData) {
        // Normalize addresses to lowercase
        const normalizedRoutes = {};
        for (const [key, value] of Object.entries(jsonData)) {
          normalizedRoutes[key.toLowerCase()] = value;
        }
        Object.assign(routingDB, normalizedRoutes);
        await saveDatabase();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({ message: "Routes updated", routes: routingDB })
        );
      } else {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON payload" }));
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
    const targetServer = getTargetServer(toAddress);

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
  await initDatabase();

  server.listen(PORT, () => {
    console.log(`Ethereum transaction routing proxy running on port ${PORT}`);
    console.log(`Default target server: ${DEFAULT_SERVER}`);
    console.log("\nAvailable routes:");
    Object.entries(routingDB).forEach(([address, server]) => {
      console.log(`  ${address} -> ${server}`);
    });
    console.log("\nManagement endpoints:");
    console.log(`  GET  http://localhost:${PORT}/routes - View current routes`);
    console.log(`  POST http://localhost:${PORT}/routes - Update routes`);
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
