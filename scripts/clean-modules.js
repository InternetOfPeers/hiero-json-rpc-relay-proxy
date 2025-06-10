const fs = require('fs');
const path = require('path');

// Colors for console output (cross-platform)
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

function printColor(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function removeDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
      printColor('green', `✅ Removed: ${dirPath}`);
      return true;
    } catch (error) {
      printColor('red', `❌ Failed to remove ${dirPath}: ${error.message}`);
      return false;
    }
  } else {
    printColor('yellow', `⚠️  Directory not found: ${dirPath}`);
    return true;
  }
}

printColor('yellow', '🧹 Cleaning node_modules directories...');

// Remove root node_modules
const rootNodeModules = path.join(process.cwd(), 'node_modules');
removeDir(rootNodeModules);

// Remove workspace node_modules
const packagesDir = path.join(process.cwd(), 'packages');
if (fs.existsSync(packagesDir)) {
  try {
    const packages = fs.readdirSync(packagesDir);
    packages.forEach(pkg => {
      const packagePath = path.join(packagesDir, pkg);
      const stats = fs.statSync(packagePath);
      
      if (stats.isDirectory()) {
        const nodeModulesPath = path.join(packagePath, 'node_modules');
        removeDir(nodeModulesPath);
      }
    });
  } catch (error) {
    printColor('red', `❌ Error reading packages directory: ${error.message}`);
    process.exit(1);
  }
} else {
  printColor('yellow', '⚠️  Packages directory not found');
}

printColor('green', '✅ Node modules cleanup completed');
