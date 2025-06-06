#!/usr/bin/env node

const fs = require("fs").promises;
const path = require("path");

/**
 * Clean Database Files Script
 *
 * Removes development database files created by the application:
 * - Demo database files (demo/data/)
 * - Test database files (test/data/)
 *
 * PRESERVES production database files (data/) for safety.
 * Preserves .gitkeep files to maintain directory structure in git.
 */

async function cleanDatabaseFiles() {
  console.log("🧹 Cleaning development database files...\n");
  console.log("ℹ️  Production database files (data/) are preserved for safety\n");

  const filesToCheck = [
    // Demo database files
    "demo/data/demo_routing_db_testnet.json",
    "demo/data/demo_routing_db_mainnet.json",

    // Test database files
    "test/data/routing_db_testnet.json",
    "test/data/routing_db_mainnet.json",
    "test/data/test_routing_db_testnet.json",
    "test/data/test_routing_db_mainnet.json",
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
    console.log("✅ No development database files found to clean");
  } else {
    console.log(
      `\n✅ Successfully cleaned ${deletedCount} development database file${
        deletedCount === 1 ? "" : "s"
      }`
    );
  }

  console.log("\n📁 Directory structure preserved (.gitkeep files retained)");
  console.log("🛡️  Production database files (data/) remain untouched");
}

// Run the cleanup
cleanDatabaseFiles().catch((error) => {
  console.error("❌ Cleanup failed:", error.message);
  process.exit(1);
});
