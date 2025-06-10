const fs = require('fs');
const path = require('path');

/**
 * Simple .env file parser (no external dependencies)
 * Loads environment variables from a .env file and sets them in process.env.
 * Values from the .env file override any existing environment variables.
 *
 * @param {string} envPath - Path to the .env file (default: auto-detects based on process.cwd())
 */
function loadEnvFile(envPath) {
  try {
    let defaultPath;
    if (envPath) {
      defaultPath = envPath;
    } else {
      // Auto-detect .env file based on current working directory
      const cwd = process.cwd();

      // Check if we're currently inside a packages subdirectory (e.g., packages/proxy, packages/prover)
      // by checking if the parent directory is named 'packages'
      const pathParts = cwd.split(path.sep);
      const isInPackageSubdir =
        pathParts.length >= 2 && pathParts[pathParts.length - 2] === 'packages';

      if (isInPackageSubdir) {
        // We're in a package directory, look for .env in the current directory
        defaultPath = path.join(cwd, '.env');
      } else {
        // We're in the workspace root, look for .env in packages/proxy as default
        defaultPath = path.join(cwd, 'packages', 'proxy', '.env');
      }
    }

    const fullPath = path.resolve(defaultPath);
    if (fs.existsSync(fullPath)) {
      const envContent = fs.readFileSync(fullPath, 'utf8');
      console.log(`Loaded environment variables from ${fullPath}`);
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

          // Override environment variable (last loaded value wins)
          process.env[key] = value;
        }
      }
      console.log(`Loaded environment variables from ${defaultPath}`);
    }
  } catch (error) {
    // Silently fail if .env file doesn't exist or can't be read
    // This maintains the same behavior as dotenv
  }
}

module.exports = {
  loadEnvFile,
};
