const fs = require("fs").promises;
const path = require("path");

let routingDB = {};

async function initDatabase(DB_FILE) {
  try {
    const dbPath = path.join(__dirname, DB_FILE);
    const data = await fs.readFile(dbPath, "utf8");
    routingDB = JSON.parse(data);
    console.log("Database loaded:", Object.keys(routingDB).length, "routes");
  } catch (error) {
    // Create default database with Ethereum addresses (all lowercased)
    routingDB = {
      "0x742d35cc6634c0532925a3b8d0c0f3e5c5c07c20": "https://api1.example.com",
      "0x8ba1f109551bd432803012645hac136c8eb0ff6": "https://api2.example.com",
      "0xd8da6bf26964af9d7eed9e03e53415d37aa96045":
        "https://admin-api.example.com",
      "0x4f1a953df9df8d1c6073ce57f7493e50515fa73f":
        "https://mainnet.hashio.io/api",
      "0x0000000000000000000000000000000000000000": "http://localhost:8080",
    };
    await saveDatabase(DB_FILE);
    console.log(
      "Created default database with",
      Object.keys(routingDB).length,
      "routes"
    );
  }
}

async function saveDatabase(DB_FILE) {
  try {
    const dbPath = path.join(__dirname, DB_FILE);
    await fs.writeFile(dbPath, JSON.stringify(routingDB, null, 2));
  } catch (error) {
    console.error("Error saving database:", error.message);
  }
}

function getTargetServer(address, DEFAULT_SERVER) {
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

function getRoutingDB() {
  return routingDB;
}

function updateRoutes(newRoutes, save = null, DB_FILE = null) {
  // Normalize addresses to lowercase
  const normalizedRoutes = {};
  for (const [key, value] of Object.entries(newRoutes)) {
    normalizedRoutes[key.toLowerCase()] = value;
  }
  Object.assign(routingDB, normalizedRoutes);
  if (save && DB_FILE) {
    return save(DB_FILE);
  }
  return Promise.resolve();
}

module.exports = {
  initDatabase,
  saveDatabase,
  getTargetServer,
  getRoutingDB,
  updateRoutes,
};
