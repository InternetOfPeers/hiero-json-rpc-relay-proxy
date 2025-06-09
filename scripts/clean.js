#!/usr/bin/env node

/**
 * Clean script for the monorepo
 * Removes all generated files, databases, and temporary data
 */

const fs = require("fs").promises;
const path = require("path");

const PACKAGES = ["packages/proxy", "packages/prover"];
const ROOT_DIRS = ["test/data", "data"];

async function deleteFilesSafely(dirPath, pattern) {
  try {
    const files = await fs.readdir(dirPath);
    const promises = files
      .filter((file) => pattern.test(file))
      .map(async (file) => {
        const filePath = path.join(dirPath, file);
        try {
          await fs.unlink(filePath);
          console.log(`🗑️  Deleted: ${filePath}`);
        } catch (error) {
          console.log(`⚠️  Could not delete ${filePath}: ${error.message}`);
        }
      });

    await Promise.all(promises);
  } catch (error) {
    // Directory doesn't exist, that's fine
    console.log(`📁 Directory ${dirPath} doesn't exist, skipping...`);
  }
}

async function cleanPackage(packagePath) {
  console.log(`\n🧹 Cleaning ${packagePath}...`);

  // Clean data directories
  const dataDir = path.join(packagePath, "data");
  await deleteFilesSafely(dataDir, /\.json$/);
  await deleteFilesSafely(dataDir, /\.db$/);
  await deleteFilesSafely(dataDir, /\.sqlite$/);

  // Clean test data directories
  const testDataDir = path.join(packagePath, "test", "data");
  await deleteFilesSafely(testDataDir, /\.json$/);
  await deleteFilesSafely(testDataDir, /\.db$/);

  // Clean logs
  await deleteFilesSafely(packagePath, /\.log$/);

  // Clean temporary files
  await deleteFilesSafely(packagePath, /\.tmp$/);
  await deleteFilesSafely(packagePath, /~$/);
}

async function cleanRoot() {
  console.log("\n🧹 Cleaning root directories...");

  for (const dir of ROOT_DIRS) {
    await deleteFilesSafely(dir, /\.json$/);
    await deleteFilesSafely(dir, /\.db$/);
    await deleteFilesSafely(dir, /\.log$/);
  }
}

async function main() {
  console.log("🧹 Starting monorepo cleanup...");

  try {
    // Clean each package
    for (const pkg of PACKAGES) {
      await cleanPackage(pkg);
    }

    // Clean root directories
    await cleanRoot();

    console.log("\n✅ Cleanup completed successfully!");
    console.log(
      "\n📝 Note: .gitkeep files and example files have been preserved"
    );
  } catch (error) {
    console.error("\n❌ Cleanup failed:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { cleanPackage, cleanRoot };
