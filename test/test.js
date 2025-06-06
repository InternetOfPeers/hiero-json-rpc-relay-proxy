const {
  test,
  describe,
  beforeEach,
  afterEach,
  before,
  after,
} = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const https = require("node:https");
const { spawn } = require("node:child_process");
const fs = require("node:fs").promises;
const path = require("node:path");

// Import modules to test
const { rlpDecode, extractToFromTransaction } = require("../src/ethTxDecoder");
const {
  initDatabase,
  saveDatabase,
  getTargetServer,
  getRoutingDB,
  updateRoutes,
  initRSAKeyPair,
  getRSAKeyPair,
  hasRSAKeyPair,
} = require("../src/dbManager");

// Utility function to make HTTP requests without node-fetch
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const httpModule = urlObj.protocol === "https:" ? https : http;

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || "GET",
      headers: options.headers || {},
    };

    const req = httpModule.request(reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve({
          status: res.statusCode,
          json: () => Promise.resolve(JSON.parse(data)),
          text: () => Promise.resolve(data),
        });
      });
    });

    req.on("error", reject);

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

// ethTxDecoder tests
describe("ethTxDecoder", () => {
  test("should decode a legacy Ethereum transaction and extract the to address", () => {
    const rawTx =
      "0xf86b808504a817c800825208943535353535353535353535353535353535353535880de0b6b3a76400008025a0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0a05b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b";
    const to = extractToFromTransaction(rawTx);
    assert.strictEqual(to, "0x3535353535353535353535353535353535353535");
  });

  test("should return null for contract creation transaction", () => {
    const rawTx =
      "0xf880808504a817c80082520880880de0b6b3a764000080b8646060604052341561000f57600080fd5b61017e8061001e6000396000f3006060604052600436106100565763ffffffff60e060020a60003504166360fe47b1811461005b5780636d4ce63c14610080575b600080fd5b341561006657600080fd5b61006e6100a3565b6040518082815260200191505060405180910390f35b341561008b57600080fd5b6100936100c9565b6040518082815260200191505060405180910390f35b600060078202905060005490505b90565b600054815600a165627a7a72305820b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0029";
    const to = extractToFromTransaction(rawTx);
    assert.strictEqual(to, null);
  });

  test("should decode a simple RLP string", () => {
    // RLP encoding of 'dog' is 0x83646f67
    const rlp = "0x83646f67";
    const decoded = rlpDecode(rlp);
    // Should decode to a buffer-like object with 'dog' in hex
    assert.strictEqual(decoded.toString("hex"), "646f67");
  });

  test("should decode a simple RLP list", () => {
    // RLP encoding of ['cat', 'dog'] is 0xc88363617483646f67
    const rlp = "0xc88363617483646f67";
    const decoded = rlpDecode(rlp);
    // Should decode to an array of buffer-like objects
    assert.strictEqual(Array.isArray(decoded), true);
    assert.strictEqual(decoded[0].toString("hex"), "636174");
    assert.strictEqual(decoded[1].toString("hex"), "646f67");
  });

  test("should return null for invalid transaction", () => {
    const rawTx = "0xdeadbeef";
    const to = extractToFromTransaction(rawTx);
    assert.strictEqual(to, null);
  });
});

// dbManager tests
describe("dbManager", function () {
  const TEST_DATA_FOLDER = "data";
  const TEST_NETWORK = "testnet";
  const TEST_DB_FILE = path.join(
    TEST_DATA_FOLDER,
    `test_routing_db_${TEST_NETWORK}.json`
  );
  const defaultRoutes = {
    "0x4f1a953df9df8d1c6073ce57f7493e50515fa73f":
      "https://testnet.hashio.io/api",
    "0x0000000000000000000000000000000000000000":
      "https://testnet.hashio.io/api",
  };

  beforeEach(async function () {
    // Remove test db file if exists - look in data directory since files are now in data/
    try {
      await fs.unlink(path.join(__dirname, "..", TEST_DB_FILE));
    } catch {}
    await initDatabase(TEST_DB_FILE);
  });

  afterEach(async function () {
    try {
      await fs.unlink(path.join(__dirname, "..", TEST_DB_FILE));
    } catch {}
  });

  test("should load default routes if file does not exist", function () {
    const db = getRoutingDB();
    assert.deepStrictEqual(db, defaultRoutes);
  });

  test("should update and persist new routes", async function () {
    const newRoutes = { "0xabc": "https://new.example.com" };
    await updateRoutes(newRoutes, saveDatabase, TEST_DB_FILE);
    await initDatabase(TEST_DB_FILE);
    const db = getRoutingDB();
    assert.strictEqual(db["0xabc"], "https://new.example.com");
  });

  test("should return the correct target server for known and unknown addresses", function () {
    assert.strictEqual(
      getTargetServer("0x4f1a953df9df8d1c6073ce57f7493e50515fa73f", "default"),
      "https://testnet.hashio.io/api"
    );
    assert.strictEqual(getTargetServer("0xnotfound", "default"), "default");
  });

  test("should initialize RSA key pair if not exists", async function () {
    // Initially should not have RSA keys
    assert.strictEqual(hasRSAKeyPair(), false);

    // Initialize RSA key pair
    const keyPair = await initRSAKeyPair(TEST_DB_FILE);

    // Should now have RSA keys
    assert.strictEqual(hasRSAKeyPair(), true);
    assert.ok(keyPair.publicKey);
    assert.ok(keyPair.privateKey);
    assert.ok(keyPair.createdAt);

    // Keys should be in PEM format
    assert.ok(keyPair.publicKey.includes("-----BEGIN PUBLIC KEY-----"));
    assert.ok(keyPair.privateKey.includes("-----BEGIN PRIVATE KEY-----"));
  });

  test("should reuse existing RSA key pair", async function () {
    // Initialize RSA key pair first time
    const firstKeyPair = await initRSAKeyPair(TEST_DB_FILE);

    // Initialize again - should reuse existing
    const secondKeyPair = await initRSAKeyPair(TEST_DB_FILE);

    // Should be the same key pair
    assert.strictEqual(firstKeyPair.publicKey, secondKeyPair.publicKey);
    assert.strictEqual(firstKeyPair.privateKey, secondKeyPair.privateKey);
    assert.strictEqual(firstKeyPair.createdAt, secondKeyPair.createdAt);
  });
});

// Integration tests
describe("server.js integration", function () {
  // Skip integration tests if SKIP_INTEGRATION_TESTS environment variable is set
  if (process.env.SKIP_INTEGRATION_TESTS) {
    console.log("⏭️  Skipping integration tests (SKIP_INTEGRATION_TESTS=true)");
    return;
  }

  let serverProcess;
  const TEST_DATA_FOLDER = "data";
  const TEST_NETWORK = "testnet";
  const TEST_DB_FILE = path.join(
    TEST_DATA_FOLDER,
    `test_routing_db_${TEST_NETWORK}.json`
  );
  const PORT = 3999;
  const BASE_URL = `http://localhost:${PORT}`;
  const DB_PATH = path.join(__dirname, "..", TEST_DB_FILE);

  before(async function () {
    // Remove test db file if exists
    try {
      await fs.unlink(DB_PATH);
    } catch {}

    // Start the server with env overrides
    // Include existing Hedera credentials if available
    const testEnv = {
      ...process.env,
      PORT: PORT.toString(),
      DATA_FOLDER: TEST_DATA_FOLDER,
      HEDERA_NETWORK: TEST_NETWORK,
      // Use existing Hedera credentials from process.env if they exist
    };

    serverProcess = spawn(process.execPath, ["src/server.js"], {
      env: testEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });

    // Log server output for debugging
    serverProcess.stdout.on("data", (data) => {
      console.log("Server stdout:", data.toString());
    });

    serverProcess.stderr.on("data", (data) => {
      console.error("Server stderr:", data.toString());
    });

    serverProcess.on("error", (err) => {
      console.error("Server process error:", err);
    });

    serverProcess.on("exit", (code, signal) => {
      console.log(`Server process exited with code ${code}, signal ${signal}`);
    });

    // Wait for server to be ready (increased timeout for Hedera initialization)
    // Also check if server is actually responding
    console.log("Waiting for server to start...");
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Test if server is responding
    try {
      const healthCheck = await makeRequest(`${BASE_URL}/routes`);
      console.log("Server health check passed, status:", healthCheck.status);
    } catch (error) {
      console.error("Server health check failed:", error.message);
      throw new Error("Server failed to start properly");
    }
  });

  after(async function () {
    if (serverProcess) serverProcess.kill();
    try {
      await fs.unlink(DB_PATH);
    } catch {}
  });

  test("should return routes on GET /routes", async function () {
    const res = await makeRequest(`${BASE_URL}/routes`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data["0x4f1a953df9df8d1c6073ce57f7493e50515fa73f"]);
  });

  test("should update routes on POST /routes", async function () {
    const res = await makeRequest(`${BASE_URL}/routes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ "0xabc": "https://new.example.com" }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.routes["0xabc"], "https://new.example.com");
  });

  test("should return Hedera topic info on GET /hedera/topic", async function () {
    const res = await makeRequest(`${BASE_URL}/hedera/topic`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    // Should have expected properties
    assert.ok(data.hasOwnProperty("topicId"));
    assert.ok(data.hasOwnProperty("hederaNetwork"));
    assert.ok(data.hasOwnProperty("clientInitialized"));
    // Network should be testnet or mainnet
    assert.ok(
      data.hederaNetwork === "testnet" || data.hederaNetwork === "mainnet"
    );
    // Client should be initialized if valid credentials are provided
    assert.strictEqual(data.clientInitialized, true);
    // Topic ID should be a valid topic ID format (e.g., "0.0.123456")
    assert.ok(typeof data.topicId === "string");
    assert.ok(/^0\.0\.\d+$/.test(data.topicId));
    // Should also have accountId when client is initialized
    assert.ok(data.hasOwnProperty("accountId"));
    assert.ok(/^0\.0\.\d+$/.test(data.accountId));
  });

  test("should return RSA public key on GET /rsa/public-key", async function () {
    const res = await makeRequest(`${BASE_URL}/rsa/public-key`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();

    // Should have expected properties
    assert.ok(data.hasOwnProperty("publicKey"));
    assert.ok(data.hasOwnProperty("createdAt"));
    assert.ok(data.hasOwnProperty("hasPrivateKey"));

    // Public key should be in PEM format
    assert.ok(typeof data.publicKey === "string");
    assert.ok(data.publicKey.includes("-----BEGIN PUBLIC KEY-----"));
    assert.ok(data.publicKey.includes("-----END PUBLIC KEY-----"));

    // Should have private key available
    assert.strictEqual(data.hasPrivateKey, true);

    // Created date should be a valid ISO string
    assert.ok(typeof data.createdAt === "string");
    assert.ok(!isNaN(Date.parse(data.createdAt)));
  });
});
