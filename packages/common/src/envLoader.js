const fs = require('fs');
const path = require('path');

// Track loaded files to prevent duplicates
const loadedFiles = new Set();

/**
 * Simple .env file parser (no external dependencies)
 * Loads environment variables from .env files with proper precedence.
 * First loaded values win (cannot be overridden by subsequent loads).
 * Supports loading multiple .env files in order:
 * 1. Root workspace .env (if exists)
 * 2. Package-specific .env (if exists)
 *
 * @param {string|string[]} envPaths - Path(s) to .env file(s) (default: auto-detects based on process.cwd())
 * @param {boolean} force - Force reload even if already loaded (default: false)
 */
function loadEnvFile(envPaths, force = false) {
  try {
    let pathsToLoad = [];

    if (envPaths) {
      // Handle both single path and array of paths
      pathsToLoad = Array.isArray(envPaths) ? envPaths : [envPaths];
    } else {
      // Auto-detect .env files based on current working directory
      const cwd = process.cwd();
      const pathParts = cwd.split(path.sep);
      const isInPackageSubdir =
        pathParts.length >= 2 && pathParts[pathParts.length - 2] === 'packages';

      if (isInPackageSubdir) {
        // We're in a package directory
        const workspaceRoot = path.join(cwd, '..', '..');
        const rootEnvPath = path.join(workspaceRoot, '.env');
        const packageEnvPath = path.join(cwd, '.env');

        // Load root .env first (highest precedence), then package-specific .env
        pathsToLoad = [rootEnvPath, packageEnvPath];
      } else {
        // We're in the workspace root
        const rootEnvPath = path.join(cwd, '.env');
        const proxyEnvPath = path.join(cwd, 'packages', 'proxy', '.env');

        // Load root .env first (highest precedence), then proxy .env as fallback
        pathsToLoad = [rootEnvPath, proxyEnvPath];
      }
    }

    // Load each .env file in order
    for (const envPath of pathsToLoad) {
      loadSingleEnvFile(envPath, force);
    }
  } catch (error) {
    // Silently fail if .env files don't exist or can't be read
    // This maintains the same behavior as dotenv
  }
}

/**
 * Load a single .env file
 * @param {string} envPath - Path to the .env file
 * @param {boolean} force - Force reload even if already loaded
 */
function loadSingleEnvFile(envPath, force = false) {
  try {
    const fullPath = path.resolve(envPath);

    // Skip if already loaded (unless forced)
    if (!force && loadedFiles.has(fullPath)) {
      return;
    }

    if (fs.existsSync(fullPath)) {
      const envContent = fs.readFileSync(fullPath, 'utf8');
      console.log(`Loaded environment variables from ${fullPath}`);

      // Mark as loaded to prevent duplicates
      loadedFiles.add(fullPath);

      const lines = envContent.split('\n');

      for (const line of lines) {
        const trimmedLine = line.trim();

        // Skip empty lines and comments
        if (!trimmedLine || trimmedLine.startsWith('#')) {
          continue;
        }

        // Parse key=value pairs
        const equalIndex = trimmedLine.indexOf('=');
        if (equalIndex > 0) {
          const key = trimmedLine.substring(0, equalIndex).trim();
          let value = trimmedLine.substring(equalIndex + 1).trim();

          // Remove quotes if present
          if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
          ) {
            value = value.slice(1, -1);
          }

          // FIRST LOADED VALUE WINS - do not override existing environment variables
          if (process.env[key] === undefined) {
            process.env[key] = value;
          }
        }
      }
    }
  } catch (error) {
    // Silently fail if .env file doesn't exist or can't be read
  }
}

/**
 * Reset the loaded files tracking (useful for testing)
 */
function resetLoadedFiles() {
  loadedFiles.clear();
}

module.exports = {
  loadEnvFile,
  resetLoadedFiles, // Export for testing
};
