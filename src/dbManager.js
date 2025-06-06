const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");

let routingDB = {};

// Generate RSA key pair
function generateRSAKeyPair() {
  try {
    console.log("Generating new RSA key pair...");
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048, // Key size in bits
      publicKeyEncoding: {
        type: "spki", // Subject Public Key Info
        format: "pem",
      },
      privateKeyEncoding: {
        type: "pkcs8", // Public Key Cryptography Standards #8
        format: "pem",
      },
    });

    console.log("✅ RSA key pair generated successfully");
    return { publicKey, privateKey };
  } catch (error) {
    console.error("Failed to generate RSA key pair:", error.message);
    throw error;
  }
}

// Check if RSA key pair exists in database
function hasRSAKeyPair() {
  return !!(
    routingDB.rsaKeys &&
    routingDB.rsaKeys.publicKey &&
    routingDB.rsaKeys.privateKey
  );
}

// Get RSA key pair from database
function getRSAKeyPair() {
  if (!hasRSAKeyPair()) {
    return null;
  }
  return routingDB.rsaKeys;
}

// Store RSA key pair in database
async function storeRSAKeyPair(keyPair, DB_FILE) {
  try {
    if (!routingDB.rsaKeys) {
      routingDB.rsaKeys = {};
    }

    routingDB.rsaKeys.publicKey = keyPair.publicKey;
    routingDB.rsaKeys.privateKey = keyPair.privateKey;
    routingDB.rsaKeys.createdAt = new Date().toISOString();

    await saveDatabase(DB_FILE);
    console.log("RSA key pair stored in database");
  } catch (error) {
    console.error("Failed to store RSA key pair:", error.message);
    throw error;
  }
}

// Initialize RSA key pair (generate if not exists)
async function initRSAKeyPair(DB_FILE) {
  if (hasRSAKeyPair()) {
    console.log("Using existing RSA key pair from database");
    const keyPair = getRSAKeyPair();
    console.log(`RSA key pair created: ${keyPair.createdAt}`);
    return keyPair;
  }

  console.log("No RSA key pair found, generating new one...");
  const keyPair = generateRSAKeyPair();
  await storeRSAKeyPair(keyPair, DB_FILE);

  // Return the stored key pair with createdAt field
  return getRSAKeyPair();
}

async function initDatabase(DB_FILE) {
  try {
    // Handle both absolute and relative paths
    const dbPath = path.isAbsolute(DB_FILE)
      ? DB_FILE
      : path.join(__dirname, "..", DB_FILE);
    const data = await fs.readFile(dbPath, "utf8");
    routingDB = JSON.parse(data);
    console.log("Database loaded:", Object.keys(routingDB).length, "routes");
  } catch (error) {
    // Create default database
    routingDB = {
      "0x4f1a953df9df8d1c6073ce57f7493e50515fa73f":
        "https://testnet.hashio.io/api",
      "0x0000000000000000000000000000000000000000":
        "https://testnet.hashio.io/api",
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
    // Handle both absolute and relative paths
    const dbPath = path.isAbsolute(DB_FILE)
      ? DB_FILE
      : path.join(__dirname, "..", DB_FILE);
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

// Get the last processed message sequence number for a topic
function getLastProcessedSequence(topicId) {
  if (!topicId) {
    return 0;
  }

  const key = `lastSequence_${topicId}`;
  return routingDB[key] || 0;
}

// Store the last processed message sequence number for a topic
async function storeLastProcessedSequence(topicId, sequenceNumber, DB_FILE) {
  if (!topicId || typeof sequenceNumber !== "number") {
    return;
  }

  try {
    const key = `lastSequence_${topicId}`;
    routingDB[key] = sequenceNumber;

    if (DB_FILE) {
      await saveDatabase(DB_FILE);
    }

    console.log(
      `📝 Saved last processed sequence ${sequenceNumber} for topic ${topicId}`
    );
  } catch (error) {
    console.error("Failed to store last processed sequence:", error.message);
    throw error;
  }
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
  initRSAKeyPair,
  getRSAKeyPair,
  hasRSAKeyPair,
  getLastProcessedSequence,
  storeLastProcessedSequence,
};
