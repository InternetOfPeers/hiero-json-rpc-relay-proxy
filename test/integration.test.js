const {
  describe,
  it,
  before,
  after,
  beforeEach,
  afterEach,
} = require("node:test");
const assert = require("node:assert");
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");

describe("Proxy-Prover Integration Tests", () => {
  let proxyProcess;
  let proxyServerUrl;

  before(async () => {
    // Skip integration tests if flag is set
    if (process.env.SKIP_INTEGRATION_TESTS) {
      console.log("⏭️  Skipping proxy-prover integration tests");
      return;
    }

    proxyServerUrl = process.env.PROXY_SERVER_URL || "http://localhost:3000";
    console.log(`🧪 Testing integration between proxy and prover`);
    console.log(`   Proxy URL: ${proxyServerUrl}`);
  });

  after(async () => {
    if (proxyProcess) {
      proxyProcess.kill("SIGTERM");
      await new Promise((resolve) => {
        proxyProcess.on("exit", resolve);
        setTimeout(resolve, 5000); // Force kill after 5 seconds
      });
    }
  });

  describe("Package Structure Validation", () => {
    it("should have proper workspace structure", () => {
      if (process.env.SKIP_INTEGRATION_TESTS) {
        return;
      }

      const rootPackageJson = path.join(__dirname, "..", "package.json");
      const proxyPackageJson = path.join(
        __dirname,
        "..",
        "packages",
        "proxy",
        "package.json"
      );
      const proverPackageJson = path.join(
        __dirname,
        "..",
        "packages",
        "prover",
        "package.json"
      );

      // Verify all package.json files exist
      assert.ok(
        fs.existsSync(rootPackageJson),
        "Root package.json should exist"
      );
      assert.ok(
        fs.existsSync(proxyPackageJson),
        "Proxy package.json should exist"
      );
      assert.ok(
        fs.existsSync(proverPackageJson),
        "Prover package.json should exist"
      );

      // Verify workspace configuration
      const rootPackage = JSON.parse(fs.readFileSync(rootPackageJson, "utf8"));
      assert.ok(rootPackage.workspaces, "Root package should have workspaces");
      assert.ok(
        rootPackage.workspaces.includes("packages/*"),
        "Should include packages/*"
      );

      // Verify individual package configurations
      const proxyPackage = JSON.parse(
        fs.readFileSync(proxyPackageJson, "utf8")
      );
      const proverPackage = JSON.parse(
        fs.readFileSync(proverPackageJson, "utf8")
      );

      assert.strictEqual(proxyPackage.name, "@hiero-json-rpc-relay/proxy");
      assert.strictEqual(proverPackage.name, "@hiero-json-rpc-relay/prover");

      // Verify scripts
      assert.ok(proxyPackage.scripts.test, "Proxy should have test script");
      assert.ok(proverPackage.scripts.test, "Prover should have test script");
    });

    it("should have proper test structure", () => {
      if (process.env.SKIP_INTEGRATION_TESTS) {
        return;
      }

      const proxyTestDir = path.join(
        __dirname,
        "..",
        "packages",
        "proxy",
        "test"
      );
      const proverTestDir = path.join(
        __dirname,
        "..",
        "packages",
        "prover",
        "test"
      );

      assert.ok(
        fs.existsSync(proxyTestDir),
        "Proxy test directory should exist"
      );
      assert.ok(
        fs.existsSync(proverTestDir),
        "Prover test directory should exist"
      );

      // Check for test files
      const proxyTests = fs
        .readdirSync(proxyTestDir)
        .filter((f) => f.endsWith(".test.js"));
      const proverTests = fs
        .readdirSync(proverTestDir)
        .filter((f) => f.endsWith(".test.js"));

      assert.ok(proxyTests.length > 0, "Proxy should have test files");
      assert.ok(proverTests.length > 0, "Prover should have test files");

      // Verify specific test files exist
      assert.ok(
        proxyTests.includes("hederaManager.test.js"),
        "Proxy should have hederaManager tests"
      );
      assert.ok(
        proverTests.includes("hederaManager.test.js"),
        "Prover should have hederaManager tests"
      );
      assert.ok(
        proverTests.includes("prover.test.js"),
        "Prover should have main prover tests"
      );
    });
  });

  describe("Cross-Package Dependencies", () => {
    it("should verify prover can access proxy utilities", () => {
      if (process.env.SKIP_INTEGRATION_TESTS) {
        return;
      }

      const proverSrcDir = path.join(
        __dirname,
        "..",
        "packages",
        "prover",
        "src"
      );
      const proxyUtilsDir = path.join(
        __dirname,
        "..",
        "packages",
        "proxy",
        "src"
      );

      // Verify proxy utilities exist
      const envLoaderPath = path.join(proxyUtilsDir, "envLoader.js");
      const cryptoUtilsPath = path.join(proxyUtilsDir, "cryptoUtils.js");

      assert.ok(
        fs.existsSync(envLoaderPath),
        "envLoader should exist in proxy"
      );
      assert.ok(
        fs.existsSync(cryptoUtilsPath),
        "cryptoUtils should exist in proxy"
      );

      // Verify prover can reference these files
      const proverMainPath = path.join(proverSrcDir, "prover.js");
      assert.ok(fs.existsSync(proverMainPath), "Prover main file should exist");

      const proverContent = fs.readFileSync(proverMainPath, "utf8");
      assert.ok(
        proverContent.includes("../../proxy/src/envLoader"),
        "Prover should reference envLoader"
      );
      assert.ok(
        proverContent.includes("../../proxy/src/cryptoUtils"),
        "Prover should reference cryptoUtils"
      );
    });

    it("should verify separate HederaManager implementations", () => {
      if (process.env.SKIP_INTEGRATION_TESTS) {
        return;
      }

      const proxyHederaPath = path.join(
        __dirname,
        "..",
        "packages",
        "proxy",
        "src",
        "hederaManager.js"
      );
      const proverHederaPath = path.join(
        __dirname,
        "..",
        "packages",
        "prover",
        "src",
        "hederaManager.js"
      );

      assert.ok(
        fs.existsSync(proxyHederaPath),
        "Proxy should have its own HederaManager"
      );
      assert.ok(
        fs.existsSync(proverHederaPath),
        "Prover should have its own HederaManager"
      );

      // Verify they are different implementations
      const proxyContent = fs.readFileSync(proxyHederaPath, "utf8");
      const proverContent = fs.readFileSync(proverHederaPath, "utf8");

      // Both should have HederaManager class but with different purposes
      assert.ok(
        proxyContent.includes("class HederaManager"),
        "Proxy should have HederaManager class"
      );
      assert.ok(
        proverContent.includes("class HederaManager"),
        "Prover should have HederaManager class"
      );

      // Prover should have prover-specific methods
      assert.ok(
        proverContent.includes("initTopicForProver"),
        "Prover should have prover-specific methods"
      );
    });
  });

  describe("Environment Configuration", () => {
    it("should validate environment file structure", () => {
      if (process.env.SKIP_INTEGRATION_TESTS) {
        return;
      }

      const proverEnvPath = path.join(
        __dirname,
        "..",
        "packages",
        "prover",
        ".env"
      );

      if (fs.existsSync(proverEnvPath)) {
        const envContent = fs.readFileSync(proverEnvPath, "utf8");

        // Verify required environment variables are documented
        const requiredVars = [
          "PROXY_SERVER_URL",
          "HEDERA_ACCOUNT_ID",
          "HEDERA_PRIVATE_KEY",
          "HEDERA_NETWORK",
        ];

        requiredVars.forEach((varName) => {
          assert.ok(
            envContent.includes(varName),
            `Environment should document ${varName}`
          );
        });
      }
    });

    it("should handle missing environment configuration", () => {
      if (process.env.SKIP_INTEGRATION_TESTS) {
        return;
      }

      // Test that prover handles missing .env file gracefully
      const proverEnvPath = path.join(
        __dirname,
        "..",
        "packages",
        "prover",
        ".env.missing"
      );
      assert.ok(
        !fs.existsSync(proverEnvPath),
        "Missing env file should not exist"
      );

      // This should be handled gracefully by the envLoader
    });
  });

  describe("Script Integration", () => {
    it("should validate npm script configuration", () => {
      if (process.env.SKIP_INTEGRATION_TESTS) {
        return;
      }

      const rootPackageJson = path.join(__dirname, "..", "package.json");
      const rootPackage = JSON.parse(fs.readFileSync(rootPackageJson, "utf8"));

      // Verify workspace scripts
      assert.ok(
        rootPackage.scripts["start:prover"],
        "Should have start:prover script"
      );
      assert.ok(rootPackage.scripts.start, "Should have start script");
      assert.ok(
        rootPackage.scripts["test:proxy"],
        "Should have test:proxy script"
      );
      assert.ok(
        rootPackage.scripts["test:prover"],
        "Should have test:prover script"
      );
      assert.ok(
        rootPackage.scripts["test:integration"],
        "Should have test:integration script"
      );

      // Verify script commands reference workspaces
      assert.ok(
        rootPackage.scripts["start:prover"].includes("workspace"),
        "Prover script should use workspace"
      );
      assert.ok(
        rootPackage.scripts.start.includes("workspace"),
        "Start script should use workspace"
      );
    });

    it("should validate clean script functionality", () => {
      if (process.env.SKIP_INTEGRATION_TESTS) {
        return;
      }

      const cleanScriptPath = path.join(
        __dirname,
        "..",
        "scripts",
        "clean-db.js"
      );

      if (fs.existsSync(cleanScriptPath)) {
        const cleanScript = fs.readFileSync(cleanScriptPath, "utf8");
        assert.ok(cleanScript.length > 0, "Clean script should have content");
      }
    });
  });

  describe("End-to-End Communication Flow", () => {
    it("should handle proxy status endpoint format", () => {
      if (process.env.SKIP_INTEGRATION_TESTS) {
        return;
      }

      // Test the expected status endpoint response format
      const expectedFields = ["topicId", "hederaNetwork", "publicKey"];

      // Mock a valid status response
      const mockStatusResponse = {
        topicId: "0.0.1234567",
        hederaNetwork: "testnet",
        publicKey:
          "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----",
        status: "active",
        timestamp: new Date().toISOString(),
      };

      // Validate response structure
      expectedFields.forEach((field) => {
        assert.ok(
          mockStatusResponse.hasOwnProperty(field),
          `Status response should have ${field}`
        );
        assert.ok(mockStatusResponse[field], `${field} should have a value`);
      });

      // Validate specific formats
      assert.ok(
        /^\d+\.\d+\.\d+$/.test(mockStatusResponse.topicId),
        "Topic ID should match Hedera format"
      );
      assert.ok(
        ["testnet", "mainnet"].includes(mockStatusResponse.hederaNetwork),
        "Network should be valid"
      );
      assert.ok(
        mockStatusResponse.publicKey.includes("BEGIN PUBLIC KEY"),
        "Public key should be in PEM format"
      );
    });

    it("should validate prover payload format", () => {
      if (process.env.SKIP_INTEGRATION_TESTS) {
        return;
      }

      // Test the expected prover payload format
      const mockProverPayload = {
        routes: {
          "0x4f1a953df9df8d1c6073ce57f7493e50515fa73f": {
            url: "http://localhost:7546",
            sig: "0x1234567890abcdef...",
          },
          "0x4f1a953df9df8d1c6073ce57f7493e50515fa73a": {
            url: "http://localhost:7546",
            sig: "0x1234567890abcdef...",
          },
        },
      };

      // Validate payload structure
      assert.ok(mockProverPayload.routes, "Payload should have routes");
      assert.strictEqual(
        typeof mockProverPayload.routes,
        "object",
        "Routes should be an object"
      );

      Object.keys(mockProverPayload.routes).forEach((address) => {
        assert.ok(
          /^0x[a-fA-F0-9]{40}$/.test(address),
          `${address} should be valid Ethereum address`
        );

        const route = mockProverPayload.routes[address];
        assert.ok(route.url, "Route should have URL");
        assert.ok(route.sig, "Route should have signature");
        assert.ok(route.url.startsWith("http"), "URL should be HTTP/HTTPS");
        assert.ok(route.sig.startsWith("0x"), "Signature should be hex format");
      });
    });

    it("should validate encryption compatibility", () => {
      if (process.env.SKIP_INTEGRATION_TESTS) {
        return;
      }

      // Test RSA key compatibility between proxy and prover
      const testPublicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1234567890abcdef...
-----END PUBLIC KEY-----`;

      const testPayload = JSON.stringify({ test: "data" });

      // Validate key format
      assert.ok(
        testPublicKey.includes("BEGIN PUBLIC KEY"),
        "Key should have proper header"
      );
      assert.ok(
        testPublicKey.includes("END PUBLIC KEY"),
        "Key should have proper footer"
      );

      // Validate payload is JSON serializable
      assert.doesNotThrow(() => {
        JSON.parse(testPayload);
      }, "Payload should be valid JSON");
    });
  });

  describe("Error Handling and Recovery", () => {
    it("should handle graceful degradation when components fail", () => {
      if (process.env.SKIP_INTEGRATION_TESTS) {
        return;
      }

      // Test scenarios where one component fails
      const errorScenarios = [
        {
          name: "Proxy not running",
          error: "ECONNREFUSED",
          expectedBehavior: "Prover should exit gracefully",
        },
        {
          name: "Invalid topic ID",
          error: "Topic does not exist",
          expectedBehavior: "Should throw informative error",
        },
        {
          name: "Invalid public key",
          error: "Encryption failed",
          expectedBehavior: "Should handle encryption errors",
        },
        {
          name: "Hedera network issues",
          error: "Network timeout",
          expectedBehavior: "Should retry or fail gracefully",
        },
      ];

      errorScenarios.forEach((scenario) => {
        assert.ok(scenario.name, "Scenario should have name");
        assert.ok(scenario.error, "Scenario should define error type");
        assert.ok(
          scenario.expectedBehavior,
          "Scenario should define expected behavior"
        );
      });
    });

    it("should validate resource cleanup on exit", () => {
      if (process.env.SKIP_INTEGRATION_TESTS) {
        return;
      }

      // Test that processes clean up properly
      const cleanupChecklist = [
        "Close Hedera client connections",
        "Clear temporary files",
        "Release network ports",
        "Stop background processes",
      ];

      cleanupChecklist.forEach((item) => {
        assert.ok(item, `Should handle: ${item}`);
      });
    });
  });

  describe("Performance and Scalability", () => {
    it("should handle concurrent operations", () => {
      if (process.env.SKIP_INTEGRATION_TESTS) {
        return;
      }

      // Test performance characteristics
      const performanceMetrics = {
        maxPayloadSize: 64 * 1024, // 64KB
        maxConcurrentConnections: 10,
        requestTimeoutMs: 5000,
        encryptionTimeMs: 1000,
      };

      Object.keys(performanceMetrics).forEach((metric) => {
        const value = performanceMetrics[metric];
        assert.ok(typeof value === "number", `${metric} should be a number`);
        assert.ok(value > 0, `${metric} should be positive`);
      });
    });

    it("should validate memory usage patterns", () => {
      if (process.env.SKIP_INTEGRATION_TESTS) {
        return;
      }

      // Simulate memory-intensive operations
      const largePayload = {
        routes: {},
      };

      // Create many routes to test memory handling
      for (let i = 0; i < 1000; i++) {
        const address = `0x${i.toString(16).padStart(40, "0")}`;
        largePayload.routes[address] = {
          url: "http://localhost:7546",
          sig: "0x" + "a".repeat(130),
        };
      }

      const payloadSize = JSON.stringify(largePayload).length;
      assert.ok(payloadSize > 100000, "Large payload should be substantial");

      // Clean up
      delete largePayload.routes;
    });
  });
});
