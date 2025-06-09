const fs = require("fs");
const path = require("path");

/**
 * Simple .env file parser (no external dependencies)
 * Loads environment variables from a .env file and sets them in process.env.
 * Values from the .env file override any existing environment variables.
 *
 * @param {string} envPath - Path to the .env file (default: ".env")
 */
function loadEnvFile(envPath = ".env") {
  try {
    const fullPath = path.resolve(envPath);
    if (fs.existsSync(fullPath)) {
      const envContent = fs.readFileSync(fullPath, "utf8");
      const lines = envContent.split("\n");

      for (const line of lines) {
        const trimmedLine = line.trim();

        // Skip empty lines and comments
        if (!trimmedLine || trimmedLine.startsWith("#")) {
          continue;
        }

        // Parse key=value pairs
        const equalIndex = trimmedLine.indexOf("=");
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
      console.log(`Loaded environment variables from ${envPath}`);
    }
  } catch (error) {
    // Silently fail if .env file doesn't exist or can't be read
    // This maintains the same behavior as dotenv
  }
}

module.exports = {
  loadEnvFile,
};
