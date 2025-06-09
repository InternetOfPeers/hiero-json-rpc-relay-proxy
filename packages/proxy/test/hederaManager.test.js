const { test, describe, beforeEach } = require("node:test");
const assert = require("node:assert");
const { HederaManager } = require("../src/hederaManager");

test("HederaManager - should initialize with correct configuration", () => {
  const hederaManager = new HederaManager({
    accountId: "0.0.123456",
    privateKey: "test-private-key",
    network: "testnet",
    topicId: "0.0.789012",
  });

  assert.strictEqual(hederaManager.accountId, "0.0.123456");
  assert.strictEqual(hederaManager.privateKey, "test-private-key");
  assert.strictEqual(hederaManager.network, "testnet");
  assert.strictEqual(hederaManager.topicId, "0.0.789012");
  assert.strictEqual(hederaManager.client, null);
  assert.strictEqual(hederaManager.currentTopicId, null);
});

test("HederaManager - should return topic info correctly", () => {
  const hederaManager = new HederaManager({
    accountId: "0.0.123456",
    privateKey: "test-private-key",
    network: "testnet",
  });

  hederaManager.currentTopicId = "0.0.999999";
  hederaManager.client = {}; // Mock client

  const topicInfo = hederaManager.getTopicInfo();

  assert.deepStrictEqual(topicInfo, {
    topicId: "0.0.999999",
    hederaNetwork: "testnet",
    accountId: "0.0.123456",
    clientInitialized: true,
  });
});

test("HederaManager - should return null topic ID when not initialized", () => {
  const hederaManager = new HederaManager({});
  assert.strictEqual(hederaManager.getTopicId(), null);
});

test("HederaManager - should return current topic ID when set", () => {
  const hederaManager = new HederaManager({});
  hederaManager.currentTopicId = "0.0.888888";
  assert.strictEqual(hederaManager.getTopicId(), "0.0.888888");
});

test("HederaManager - should return null client when not initialized", () => {
  const hederaManager = new HederaManager({});
  assert.strictEqual(hederaManager.getClient(), null);
});

test("HederaManager - should return client when initialized", () => {
  const hederaManager = new HederaManager({});
  const mockClient = { operator: "test" };
  hederaManager.client = mockClient;
  assert.strictEqual(hederaManager.getClient(), mockClient);
});

test("HederaManager - should detect if Hedera is enabled", () => {
  // With credentials
  const hederaManager = new HederaManager({
    accountId: "0.0.123456",
    privateKey: "test-private-key",
  });
  assert.strictEqual(hederaManager.isEnabled(), true);

  // Without credentials
  const noCredsManager = new HederaManager({});
  assert.strictEqual(noCredsManager.isEnabled(), false);

  // With partial credentials
  const partialCredsManager = new HederaManager({
    accountId: "0.0.123456",
  });
  assert.strictEqual(partialCredsManager.isEnabled(), false);
});

test("HederaManager - should not initialize client without credentials", () => {
  const noCredsManager = new HederaManager({});
  const client = noCredsManager.initClient();
  assert.strictEqual(client, null);
});

test("HederaManager - should handle mainnet network configuration", () => {
  const mainnetManager = new HederaManager({
    accountId: "0.0.123456",
    privateKey: "test-private-key",
    network: "mainnet",
  });
  assert.strictEqual(mainnetManager.network, "mainnet");
});

test("HederaManager - should return topic info with null values when not initialized", () => {
  const uninitializedManager = new HederaManager({ network: "testnet" });
  const topicInfo = uninitializedManager.getTopicInfo();

  assert.deepStrictEqual(topicInfo, {
    topicId: null,
    hederaNetwork: "testnet",
    accountId: undefined,
    clientInitialized: false,
  });
});
