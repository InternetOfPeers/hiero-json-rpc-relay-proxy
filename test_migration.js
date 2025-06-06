#!/usr/bin/env node

// Test script to verify database migration functionality
const {
  initDatabase,
  getRoutingDB,
  getRSAKeyPair,
  getLastProcessedSequence,
} = require("./src/dbManager");
const fs = require("fs").promises;

async function testMigration() {
  try {
    console.log("🧪 Testing database migration...\n");

    // Create old format database
    const oldFormat = {
      "0x4f1a953df9df8d1c6073ce57f7493e50515fa73f":
        "https://testnet.hashio.io/api",
      "0x0000000000000000000000000000000000000000":
        "https://testnet.hashio.io/api",
      rsaKeys: {
        publicKey:
          "-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----\n",
        privateKey:
          "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n",
        createdAt: "2025-06-06T23:33:28.587Z",
      },
      "lastSequence_0.0.6126497": 2,
    };

    const testFile = "test/data/migration_test.json";
    await fs.writeFile(testFile, JSON.stringify(oldFormat, null, 2));
    console.log("📝 Created old-format database file");

    // Initialize database (should trigger migration)
    await initDatabase(testFile);

    // Test that data was migrated correctly
    const routes = getRoutingDB();
    const rsaKeys = getRSAKeyPair();
    const sequence = getLastProcessedSequence("0.0.6126497");

    console.log("📊 Migration results:");
    console.log("Routes:", Object.keys(routes).length, "found");
    console.log("RSA Keys:", rsaKeys ? "Found" : "Missing");
    console.log("Sequence:", sequence);

    // Check the migrated file structure
    const migratedData = JSON.parse(await fs.readFile(testFile, "utf8"));
    console.log("\n📁 New database structure:");
    console.log("- routes:", Object.keys(migratedData.routes || {}).length);
    console.log(
      "- metadata.rsaKeys:",
      migratedData.metadata?.rsaKeys ? "Present" : "Missing"
    );
    console.log(
      "- metadata.sequences:",
      Object.keys(migratedData.metadata?.sequences || {}).length
    );

    // Clean up
    await fs.unlink(testFile);
    console.log("\n✅ Migration test completed successfully!");
  } catch (error) {
    console.error("❌ Migration test failed:", error.message);
    console.error(error.stack);
  }
}

testMigration().catch(console.error);
