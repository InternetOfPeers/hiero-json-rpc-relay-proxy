#!/usr/bin/env node

const fs = require("fs").promises;
const path = require("path");

/**
 * Clean Database Files Script
 *
 * Removes database files created by the application:
 * - Prover database files (packages/prover/data/)
 * - Test database files (packages/proxy/test/data/)
 *
 * NOTE: Production database files (packages/proxy/data/) are NOT cleaned
 * to preserve production data and configurations.
 *
 * Preserves .gitkeep files to maintain directory structure in git.
 */

async function cleanDatabaseFiles() {
  console.log("🧹 Cleaning database files...\n");

  const filesToCheck = [
    // Prover database files
    "packages/prover/data/prover_routing_db_testnet.json",
    "packages/prover/data/prover_routing_db_mainnet.json",
    "packages/prover/data/demo_routing_db_testnet.json",
    "packages/prover/data/demo_routing_db_mainnet.json",

    // Test database files
    "packages/proxy/test/data/routing_db_testnet.json",
    "packages/proxy/test/data/routing_db_mainnet.json",
    "packages/proxy/test/data/test_routing_db_testnet.json",
    "packages/proxy/test/data/test_routing_db_mainnet.json",

    // Note: Production database files (packages/proxy/data/) are intentionally
    // NOT included here to preserve production data and configurations
  ];

  let deletedCount = 0;

  for (const filePath of filesToCheck) {
    try {
      await fs.access(filePath);
      await fs.unlink(filePath);
      console.log(`🗑️  Deleted: ${filePath}`);
      deletedCount++;
    } catch (error) {
      // File doesn't exist or can't be deleted - this is okay
      if (error.code !== "ENOENT") {
        console.log(`⚠️  Could not delete ${filePath}: ${error.message}`);
      }
    }
  }

  if (deletedCount === 0) {
    console.log("✅ No database files found to clean");
  } else {
    console.log(
      `\n✅ Successfully cleaned ${deletedCount} database file${
        deletedCount === 1 ? "" : "s"
      }`
    );
  }

  console.log("\n📁 Directory structure preserved (.gitkeep files retained)");
}

// Run the cleanup
cleanDatabaseFiles().catch((error) => {
  console.error("❌ Cleanup failed:", error.message);
  process.exit(1);
});
