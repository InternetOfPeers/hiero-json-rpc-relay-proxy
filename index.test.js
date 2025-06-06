const assert = require("assert");
const http = require("http");
const { spawn } = require("child_process");
const fetch = require("node-fetch");
const fs = require("fs").promises;
const path = require("path");

describe("index.js integration", function () {
  let serverProcess;
  const TEST_DB_FILE = "test_routing_db.json";
  const PORT = 3999;
  const BASE_URL = `http://localhost:${PORT}`;
  const DB_PATH = path.join(__dirname, TEST_DB_FILE);

  before(async function () {
    // Remove test db file if exists
    try {
      await fs.unlink(DB_PATH);
    } catch {}
    // Start the server with env overrides
    serverProcess = spawn(process.execPath, ["index.js"], {
      env: { ...process.env, PORT: PORT.toString(), DB_FILE: TEST_DB_FILE },
      stdio: ["ignore", "pipe", "pipe"],
    });
    // Wait for server to be ready
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  after(async function () {
    if (serverProcess) serverProcess.kill();
    try {
      await fs.unlink(DB_PATH);
    } catch {}
  });

  it("should return routes on GET /routes", async function () {
    const res = await fetch(`${BASE_URL}/routes`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data["0x742d35cc6634c0532925a3b8d0c0f3e5c5c07c20"]);
  });

  it("should update routes on POST /routes", async function () {
    const res = await fetch(`${BASE_URL}/routes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ "0xabc": "https://new.example.com" }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.routes["0xabc"], "https://new.example.com");
  });
});
