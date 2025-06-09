const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs').promises;
const path = require('node:path');

// Import modules to test
const {
  initDatabase,
  saveDatabase,
  getTargetServer,
  getRoutingDB,
  updateRoutes,
  initRSAKeyPair,
  getRSAKeyPair,
  hasRSAKeyPair,
  getLastProcessedSequence,
  storeLastProcessedSequence,
} = require('../src/dbManager');

// dbManager tests
describe('dbManager', function () {
  const TEST_DATA_FOLDER = path.resolve(__dirname, 'data');
  const TEST_NETWORK = 'testnet';
  const TEST_DB_FILE = path.join(
    TEST_DATA_FOLDER,
    `test_routing_db_${TEST_NETWORK}.json`
  );
  const defaultRoutes = {
    '0x4f1a953df9df8d1c6073ce57f7493e50515fa73f':
      'https://testnet.hashio.io/api',
    '0x0000000000000000000000000000000000000000':
      'https://testnet.hashio.io/api',
  };

  beforeEach(async function () {
    // Remove test db file if exists
    try {
      // The initDatabase function will resolve the path from src/, so we need to clean up the actual resolved path
      const resolvedPath = path.resolve(__dirname, '..', TEST_DB_FILE);
      await fs.unlink(resolvedPath);
    } catch {}
    await initDatabase(TEST_DB_FILE);
  });

  afterEach(async function () {
    try {
      // Clean up the test database file
      const resolvedPath = path.resolve(__dirname, '..', TEST_DB_FILE);
      await fs.unlink(resolvedPath);
    } catch {}
  });

  test('should load default routes if file does not exist', function () {
    const db = getRoutingDB();
    assert.deepStrictEqual(db, defaultRoutes);
  });

  test('should update and persist new routes', async function () {
    const newRoutes = { '0xabc': 'https://new.example.com' };
    await updateRoutes(newRoutes, saveDatabase, TEST_DB_FILE);
    await initDatabase(TEST_DB_FILE);
    const db = getRoutingDB();
    assert.strictEqual(db['0xabc'], 'https://new.example.com');
  });

  test('should return the correct target server for known and unknown addresses', function () {
    assert.strictEqual(
      getTargetServer('0x4f1a953df9df8d1c6073ce57f7493e50515fa73f', 'default'),
      'https://testnet.hashio.io/api'
    );
    assert.strictEqual(getTargetServer('0xnotfound', 'default'), 'default');
  });

  test('should initialize RSA key pair if not exists', async function () {
    // Initially should not have RSA keys
    assert.strictEqual(hasRSAKeyPair(), false);

    // Initialize RSA key pair
    const keyPair = await initRSAKeyPair(TEST_DB_FILE);

    // Should now have RSA keys
    assert.strictEqual(hasRSAKeyPair(), true);
    assert.ok(keyPair.publicKey);
    assert.ok(keyPair.privateKey);
    assert.ok(keyPair.createdAt);

    // Keys should be in PEM format
    assert.ok(keyPair.publicKey.includes('-----BEGIN PUBLIC KEY-----'));
    assert.ok(keyPair.privateKey.includes('-----BEGIN PRIVATE KEY-----'));
  });

  test('should reuse existing RSA key pair', async function () {
    // Initialize RSA key pair first time
    const firstKeyPair = await initRSAKeyPair(TEST_DB_FILE);

    // Initialize again - should reuse existing
    const secondKeyPair = await initRSAKeyPair(TEST_DB_FILE);

    // Should be the same key pair
    assert.strictEqual(firstKeyPair.publicKey, secondKeyPair.publicKey);
    assert.strictEqual(firstKeyPair.privateKey, secondKeyPair.privateKey);
    assert.strictEqual(firstKeyPair.createdAt, secondKeyPair.createdAt);
  });

  test('should store and retrieve last processed sequence number', async function () {
    const topicId = '0.0.123456';
    const sequenceNumber = 42;

    // Initially should return 0 for unknown topic
    assert.strictEqual(getLastProcessedSequence(topicId), 0);

    // Store sequence number
    await storeLastProcessedSequence(topicId, sequenceNumber, TEST_DB_FILE);

    // Should retrieve the stored sequence number
    assert.strictEqual(getLastProcessedSequence(topicId), sequenceNumber);

    // Verify persistence by reloading database
    await initDatabase(TEST_DB_FILE);
    assert.strictEqual(getLastProcessedSequence(topicId), sequenceNumber);
  });

  test('should handle multiple topic sequence numbers', async function () {
    const topic1 = '0.0.111111';
    const topic2 = '0.0.222222';
    const sequence1 = 10;
    const sequence2 = 20;

    // Store sequence numbers for different topics
    await storeLastProcessedSequence(topic1, sequence1, TEST_DB_FILE);
    await storeLastProcessedSequence(topic2, sequence2, TEST_DB_FILE);

    // Should retrieve correct sequence for each topic
    assert.strictEqual(getLastProcessedSequence(topic1), sequence1);
    assert.strictEqual(getLastProcessedSequence(topic2), sequence2);

    // Unknown topic should still return 0
    assert.strictEqual(getLastProcessedSequence('0.0.999999'), 0);
  });

  test('should handle invalid inputs for sequence storage', async function () {
    const topicId = '0.0.123456';

    // Should handle null topic ID gracefully
    await storeLastProcessedSequence(null, 10, TEST_DB_FILE);
    assert.strictEqual(getLastProcessedSequence(null), 0);

    // Should handle invalid sequence number gracefully
    await storeLastProcessedSequence(topicId, 'invalid', TEST_DB_FILE);
    assert.strictEqual(getLastProcessedSequence(topicId), 0);

    // Should handle missing DB file gracefully
    await storeLastProcessedSequence(topicId, 5);
    assert.strictEqual(getLastProcessedSequence(topicId), 5);
  });
});
