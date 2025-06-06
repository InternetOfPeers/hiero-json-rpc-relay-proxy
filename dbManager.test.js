const assert = require("assert");
const fs = require("fs").promises;
const path = require("path");
const {
  initDatabase,
  saveDatabase,
  getTargetServer,
  getRoutingDB,
  updateRoutes,
} = require("./dbManager");

describe("dbManager", function () {
  const TEST_DB_FILE = "test_routing_db.json";
  const defaultRoutes = {
    "0x742d35cc6634c0532925a3b8d0c0f3e5c5c07c20": "https://api1.example.com",
    "0x8ba1f109551bd432803012645hac136c8eb0ff6": "https://api2.example.com",
    "0xd8da6bf26964af9d7eed9e03e53415d37aa96045":
      "https://admin-api.example.com",
    "0x4f1a953df9df8d1c6073ce57f7493e50515fa73f":
      "https://mainnet.hashio.io/api",
    "0x0000000000000000000000000000000000000000": "http://localhost:8080",
  };

  beforeEach(async function () {
    // Remove test db file if exists
    try {
      await fs.unlink(path.join(__dirname, TEST_DB_FILE));
    } catch {}
    await initDatabase(TEST_DB_FILE);
  });

  afterEach(async function () {
    try {
      await fs.unlink(path.join(__dirname, TEST_DB_FILE));
    } catch {}
  });

  it("should load default routes if file does not exist", function () {
    const db = getRoutingDB();
    assert.deepStrictEqual(db, defaultRoutes);
  });

  it("should update and persist new routes", async function () {
    const newRoutes = { "0xabc": "https://new.example.com" };
    await updateRoutes(newRoutes, saveDatabase, TEST_DB_FILE);
    await initDatabase(TEST_DB_FILE);
    const db = getRoutingDB();
    assert.strictEqual(db["0xabc"], "https://new.example.com");
  });

  it("should return the correct target server for known and unknown addresses", function () {
    assert.strictEqual(
      getTargetServer("0x742d35cc6634c0532925a3b8d0c0f3e5c5c07c20", "default"),
      "https://api1.example.com"
    );
    assert.strictEqual(getTargetServer("0xnotfound", "default"), "default");
  });
});
