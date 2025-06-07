const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs").promises;
const path = require("node:path");

// Import module to test
const { loadEnvFile } = require("../src/envLoader");

describe("envLoader", function () {
  const TEST_ENV_DIR = "test/data";
  const TEST_ENV_FILE = path.join(TEST_ENV_DIR, "test.env");
  const originalEnv = { ...process.env };

  beforeEach(async function () {
    // Ensure test directory exists
    try {
      await fs.mkdir(TEST_ENV_DIR, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  });

  afterEach(async function () {
    // Clean up test files
    try {
      await fs.unlink(TEST_ENV_FILE);
    } catch (error) {
      // File might not exist
    }

    // Clean up test .env file in test directory
    try {
      await fs.unlink(path.join(TEST_ENV_DIR, ".env"));
    } catch (error) {
      // File might not exist
    }

    // Restore original environment
    process.env = { ...originalEnv };
  });

  describe("loadEnvFile", function () {
    test("should load simple key-value pairs", async function () {
      const envContent = `TEST_KEY1=value1
TEST_KEY2=value2
TEST_KEY3=value3`;

      await fs.writeFile(TEST_ENV_FILE, envContent);

      // Remove keys if they exist
      delete process.env.TEST_KEY1;
      delete process.env.TEST_KEY2;
      delete process.env.TEST_KEY3;

      loadEnvFile(TEST_ENV_FILE);

      assert.strictEqual(process.env.TEST_KEY1, "value1");
      assert.strictEqual(process.env.TEST_KEY2, "value2");
      assert.strictEqual(process.env.TEST_KEY3, "value3");
    });

    test("should handle quoted values", async function () {
      const envContent = `TEST_QUOTED1="double quoted value"
TEST_QUOTED2='single quoted value'
TEST_QUOTED3="value with spaces"
TEST_QUOTED4='another "quoted" value'`;

      await fs.writeFile(TEST_ENV_FILE, envContent);

      delete process.env.TEST_QUOTED1;
      delete process.env.TEST_QUOTED2;
      delete process.env.TEST_QUOTED3;
      delete process.env.TEST_QUOTED4;

      loadEnvFile(TEST_ENV_FILE);

      assert.strictEqual(process.env.TEST_QUOTED1, "double quoted value");
      assert.strictEqual(process.env.TEST_QUOTED2, "single quoted value");
      assert.strictEqual(process.env.TEST_QUOTED3, "value with spaces");
      assert.strictEqual(process.env.TEST_QUOTED4, 'another "quoted" value');
    });

    test("should skip comments and empty lines", async function () {
      const envContent = `# This is a comment
TEST_VALID=valid_value

# Another comment
  # Indented comment
TEST_VALID2=another_value

`;

      await fs.writeFile(TEST_ENV_FILE, envContent);

      delete process.env.TEST_VALID;
      delete process.env.TEST_VALID2;

      loadEnvFile(TEST_ENV_FILE);

      assert.strictEqual(process.env.TEST_VALID, "valid_value");
      assert.strictEqual(process.env.TEST_VALID2, "another_value");
    });

    test("should handle values with equals signs", async function () {
      const envContent = `TEST_URL=https://api.example.com/v1/endpoint?param=value
TEST_EQUATION=2+2=4
TEST_BASE64=dGVzdD1kYXRh`;

      await fs.writeFile(TEST_ENV_FILE, envContent);

      delete process.env.TEST_URL;
      delete process.env.TEST_EQUATION;
      delete process.env.TEST_BASE64;

      loadEnvFile(TEST_ENV_FILE);

      assert.strictEqual(
        process.env.TEST_URL,
        "https://api.example.com/v1/endpoint?param=value"
      );
      assert.strictEqual(process.env.TEST_EQUATION, "2+2=4");
      assert.strictEqual(process.env.TEST_BASE64, "dGVzdD1kYXRh");
    });

    test("should not override existing environment variables", async function () {
      const envContent = `TEST_EXISTING=new_value
TEST_NEW=new_value`;

      await fs.writeFile(TEST_ENV_FILE, envContent);

      // Set existing value
      process.env.TEST_EXISTING = "existing_value";
      delete process.env.TEST_NEW;

      loadEnvFile(TEST_ENV_FILE);

      assert.strictEqual(process.env.TEST_EXISTING, "existing_value"); // Should not change
      assert.strictEqual(process.env.TEST_NEW, "new_value"); // Should be set
    });

    test("should handle whitespace around keys and values", async function () {
      const envContent = `  TEST_SPACES1  =  value1  
TEST_SPACES2=  value2
  TEST_SPACES3=value3  `;

      await fs.writeFile(TEST_ENV_FILE, envContent);

      delete process.env.TEST_SPACES1;
      delete process.env.TEST_SPACES2;
      delete process.env.TEST_SPACES3;

      loadEnvFile(TEST_ENV_FILE);

      assert.strictEqual(process.env.TEST_SPACES1, "value1");
      assert.strictEqual(process.env.TEST_SPACES2, "value2");
      assert.strictEqual(process.env.TEST_SPACES3, "value3");
    });

    test("should handle empty values", async function () {
      const envContent = `TEST_EMPTY1=
TEST_EMPTY2=""
TEST_EMPTY3=''`;

      await fs.writeFile(TEST_ENV_FILE, envContent);

      delete process.env.TEST_EMPTY1;
      delete process.env.TEST_EMPTY2;
      delete process.env.TEST_EMPTY3;

      loadEnvFile(TEST_ENV_FILE);

      assert.strictEqual(process.env.TEST_EMPTY1, "");
      assert.strictEqual(process.env.TEST_EMPTY2, "");
      assert.strictEqual(process.env.TEST_EMPTY3, "");
    });

    test("should ignore malformed lines", async function () {
      const envContent = `TEST_VALID=valid_value
invalid_line_without_equals
=value_without_key
TEST_VALID2=another_valid_value
key_with_no_value_and_no_equals`;

      await fs.writeFile(TEST_ENV_FILE, envContent);

      delete process.env.TEST_VALID;
      delete process.env.TEST_VALID2;

      loadEnvFile(TEST_ENV_FILE);

      assert.strictEqual(process.env.TEST_VALID, "valid_value");
      assert.strictEqual(process.env.TEST_VALID2, "another_valid_value");
    });

    test("should handle file that does not exist", function () {
      const nonExistentFile = path.join(TEST_ENV_DIR, "nonexistent.env");

      // Should not throw an error
      assert.doesNotThrow(() => {
        loadEnvFile(nonExistentFile);
      });
    });

    test("should use default .env file when no path provided", async function () {
      // This test will create a temporary .env file in the test directory
      // and temporarily change the working directory to test default behavior
      const testEnvFile = path.join(TEST_ENV_DIR, ".env");
      const envContent = `TEST_DEFAULT=default_value`;
      const originalCwd = process.cwd();

      try {
        // Create test .env file in test directory
        await fs.writeFile(testEnvFile, envContent);
        delete process.env.TEST_DEFAULT;

        // Change to test directory to test default .env loading
        process.chdir(TEST_ENV_DIR);
        loadEnvFile(); // No path provided, should use default

        assert.strictEqual(process.env.TEST_DEFAULT, "default_value");
      } finally {
        // Restore original working directory
        process.chdir(originalCwd);

        try {
          await fs.unlink(testEnvFile);
        } catch (error) {
          // File might not exist
        }
      }
    });

    test("should handle special characters in values", async function () {
      const envContent = `TEST_SPECIAL1=value with spaces and !@#$%^&*()
TEST_SPECIAL2="value with newline\\nand tab\\t"
TEST_SPECIAL3=value_with_underscores_and-dashes`;

      await fs.writeFile(TEST_ENV_FILE, envContent);

      delete process.env.TEST_SPECIAL1;
      delete process.env.TEST_SPECIAL2;
      delete process.env.TEST_SPECIAL3;

      loadEnvFile(TEST_ENV_FILE);

      assert.strictEqual(
        process.env.TEST_SPECIAL1,
        "value with spaces and !@#$%^&*()"
      );
      assert.strictEqual(
        process.env.TEST_SPECIAL2,
        "value with newline\\nand tab\\t"
      );
      assert.strictEqual(
        process.env.TEST_SPECIAL3,
        "value_with_underscores_and-dashes"
      );
    });

    test("should handle mixed quote styles", async function () {
      const envContent = `TEST_MIXED1="value with 'single quotes'"
TEST_MIXED2='value with "double quotes"'
TEST_MIXED3=unquoted value
TEST_MIXED4="partially quoted value
TEST_MIXED5=value with "quotes in middle"`;

      await fs.writeFile(TEST_ENV_FILE, envContent);

      delete process.env.TEST_MIXED1;
      delete process.env.TEST_MIXED2;
      delete process.env.TEST_MIXED3;
      delete process.env.TEST_MIXED4;
      delete process.env.TEST_MIXED5;

      loadEnvFile(TEST_ENV_FILE);

      assert.strictEqual(process.env.TEST_MIXED1, "value with 'single quotes'");
      assert.strictEqual(process.env.TEST_MIXED2, 'value with "double quotes"');
      assert.strictEqual(process.env.TEST_MIXED3, "unquoted value");
      assert.strictEqual(process.env.TEST_MIXED4, '"partially quoted value'); // Should keep opening quote
      assert.strictEqual(
        process.env.TEST_MIXED5,
        'value with "quotes in middle"'
      );
    });
  });
});
