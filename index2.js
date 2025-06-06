const http = require("http");
const https = require("https");
const url = require("url");
const fs = require("fs").promises;
const path = require("path");

// Configuration
const PORT = 3000;
const DB_FILE = "routing_db.json";
const DEFAULT_SERVER = "https://mainnet.hashio.io/api"; // Fallback server

// In-memory database cache
let routingDB = {};

// Initialize database
async function initDatabase() {
  try {
    const dbPath = path.join(__dirname, DB_FILE);
    const data = await fs.readFile(dbPath, "utf8");
    routingDB = JSON.parse(data);
    console.log("Database loaded:", routingDB);
  } catch (error) {
    // Create default database if file doesn't exist
    routingDB = {
      user1: "https://mainnet.hashio.io/api",
      user2: "https://api2.example.com",
      admin: "https://admin-api.example.com",
      test: "http://localhost:8080",
    };

    // Save default database
    await saveDatabase();
    console.log("Created default database:", routingDB);
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

// Get target server based on "to" value
function getTargetServer(toValue) {
  if (!toValue) {
    console.log('No "to" value found, using default server');
    return DEFAULT_SERVER;
  }

  const targetServer = routingDB[toValue];
  if (targetServer) {
    console.log(`Routing "${toValue}" to: ${targetServer}`);
    return targetServer;
  }

  console.log(`No route found for "${toValue}", using default server`);
  return DEFAULT_SERVER;
}

// Parse JSON payload from request
function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      try {
        if (body.trim()) {
          const jsonData = JSON.parse(body);
          resolve({ body, jsonData });
        } else {
          resolve({ body: "", jsonData: null });
        }
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

  // Send the original request body
  if (requestBody) {
    proxyReq.write(requestBody);
  }
  proxyReq.end();
}

const server = http.createServer(async (req, res) => {
  try {
    // Handle special routes for database management
    if (req.url === "/routes" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(routingDB, null, 2));
      return;
    }

    if (req.url === "/routes" && req.method === "POST") {
      const { body, jsonData } = await parseRequestBody(req);
      if (jsonData) {
        Object.assign(routingDB, jsonData);
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

    // Parse request body for routing analysis
    const { body: requestBody, jsonData } = await parseRequestBody(req);

    // Extract "to" value from JSON payload
    const toValue = jsonData && jsonData.to ? jsonData.to : null;

    // Log the routing decision
    console.log(`${req.method} ${req.url} - to: "${toValue}"`);

    // Get target server based on "to" value
    const targetServer = getTargetServer(toValue);

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
    console.log(`Smart routing proxy server running on port ${PORT}`);
    console.log(`Default target server: ${DEFAULT_SERVER}`);
    console.log("\nAvailable routes:");
    Object.entries(routingDB).forEach(([key, value]) => {
      console.log(`  "${key}" -> ${value}`);
    });
    console.log("\nManagement endpoints:");
    console.log(`  GET  http://localhost:${PORT}/routes - View current routes`);
    console.log(`  POST http://localhost:${PORT}/routes - Update routes`);
    console.log("\nExample request:");
    console.log(`  curl -X POST http://localhost:${PORT}/api/data \\`);
    console.log(`    -H "Content-Type: application/json" \\`);
    console.log(`    -d '{"to": "user1", "message": "Hello"}'`);
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
