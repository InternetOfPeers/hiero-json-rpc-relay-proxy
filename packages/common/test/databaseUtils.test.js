const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const {
  generateRSAKeyPair,
  createRSAKeyPairWithMetadata,
  validateRSAKeyPair,
  getDatabasePath,
  createDefaultDatabase,
  migrateDatabase,
  saveDatabase,
  loadDatabase,
  updateDatabaseRoutes,
} = require('../src/databaseUtils');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Database Utils', () => {
  let tempDir;
  let testDbPath;

  beforeEach(() => {
    // Create temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'db-utils-test-'));
    testDbPath = path.join(tempDir, 'test-db.json');
  });

  afterEach(() => {
    // Clean up temporary files
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('RSA Key Pair Management', () => {
    describe('generateRSAKeyPair', () => {
      test('should generate valid RSA key pair', () => {
        const keyPair = generateRSAKeyPair();

        assert(
          keyPair.hasOwnProperty('publicKey'),
          'Should have publicKey property'
        );
        assert(
          keyPair.hasOwnProperty('privateKey'),
          'Should have privateKey property'
        );
        assert.strictEqual(typeof keyPair.publicKey, 'string');
        assert.strictEqual(typeof keyPair.privateKey, 'string');
        assert(
          keyPair.publicKey.includes('-----BEGIN PUBLIC KEY-----'),
          'Public key should contain BEGIN marker'
        );
        assert(
          keyPair.privateKey.includes('-----BEGIN PRIVATE KEY-----'),
          'Private key should contain BEGIN marker'
        );
      });

      test('should generate different key pairs on multiple calls', () => {
        const keyPair1 = generateRSAKeyPair();
        const keyPair2 = generateRSAKeyPair();

        assert.notStrictEqual(
          keyPair1.publicKey,
          keyPair2.publicKey,
          'Public keys should be different'
        );
        assert.notStrictEqual(
          keyPair1.privateKey,
          keyPair2.privateKey,
          'Private keys should be different'
        );
      });
    });

    describe('createRSAKeyPairWithMetadata', () => {
      test('should create RSA key pair with metadata', () => {
        const result = createRSAKeyPairWithMetadata();

        assert(
          result.hasOwnProperty('keyPair'),
          'Should have keyPair property'
        );
        assert(
          result.hasOwnProperty('metadata'),
          'Should have metadata property'
        );
        assert(
          result.keyPair.hasOwnProperty('publicKey'),
          'KeyPair should have publicKey property'
        );
        assert(
          result.keyPair.hasOwnProperty('privateKey'),
          'KeyPair should have privateKey property'
        );
        assert(
          result.metadata.hasOwnProperty('createdAt'),
          'Metadata should have createdAt property'
        );
        assert(
          result.metadata.hasOwnProperty('algorithm'),
          'Metadata should have algorithm property'
        );
        assert.strictEqual(result.metadata.algorithm, 'RSA-2048');
        assert.strictEqual(typeof result.metadata.createdAt, 'string');
      });
    });

    describe('validateRSAKeyPair', () => {
      test('should validate correct RSA key pair', () => {
        const keyPair = generateRSAKeyPair();
        const result = validateRSAKeyPair(keyPair);

        assert.strictEqual(result.valid, true);
        assert.strictEqual(result.errors.length, 0, 'Should have no errors');
      });

      test('should reject invalid key pair structure', () => {
        const result = validateRSAKeyPair({});

        assert.strictEqual(result.valid, false);
        assert(
          result.errors.includes('Missing public key'),
          'Should contain missing public key error'
        );
        assert(
          result.errors.includes('Missing private key'),
          'Should contain missing private key error'
        );
      });

      test('should reject malformed keys', () => {
        const result = validateRSAKeyPair({
          publicKey: 'invalid-key',
          privateKey: 'invalid-key',
        });

        assert.strictEqual(result.valid, false);
        assert(
          result.errors.includes('Invalid public key format'),
          'Should contain invalid public key error'
        );
        assert(
          result.errors.includes('Invalid private key format'),
          'Should contain invalid private key error'
        );
      });

      test('should handle null input', () => {
        const result = validateRSAKeyPair(null);

        assert.strictEqual(result.valid, false);
        assert(
          result.errors.includes('Key pair is null or undefined'),
          'Should contain null/undefined error'
        );
      });
    });
  });

  describe('Database Path Management', () => {
    describe('getDatabasePath', () => {
      test('should return default path when no custom path provided', () => {
        const dbPath = getDatabasePath();
        assert(
          dbPath.includes('routing_db.json'),
          'Should contain routing_db.json'
        );
      });

      test('should return custom path when provided', () => {
        const customPath = '/custom/path/db.json';
        const dbPath = getDatabasePath(customPath);
        assert.strictEqual(dbPath, customPath);
      });

      test('should handle network-specific paths', () => {
        const dbPath = getDatabasePath(null, 'testnet');
        assert(
          dbPath.includes('routing_db_testnet.json'),
          'Should contain routing_db_testnet.json'
        );
      });
    });
  });

  describe('Database Operations', () => {
    describe('createDefaultDatabase', () => {
      test('should create default database structure', () => {
        const db = createDefaultDatabase();

        assert(db.hasOwnProperty('routes'), 'Should have routes property');
        assert(db.hasOwnProperty('metadata'), 'Should have metadata property');
        assert.strictEqual(typeof db.routes, 'object');
        assert.strictEqual(typeof db.metadata, 'object');
        assert(
          db.metadata.hasOwnProperty('lastUpdated'),
          'Should have lastUpdated property'
        );
      });
    });

    describe('saveDatabase and loadDatabase', () => {
      test('should save and load database correctly', async () => {
        const testData = {
          routes: { test: '/test' },
          metadata: { lastUpdated: new Date().toISOString() },
        };

        await saveDatabase(testData, testDbPath);
        assert(fs.existsSync(testDbPath), 'Database file should exist');

        const loadedData = await loadDatabase(testDbPath);
        assert.deepStrictEqual(loadedData.routes.test, testData.routes.test);
      });

      test('should handle missing database file', async () => {
        const nonExistentPath = path.join(tempDir, 'missing.json');
        const result = await loadDatabase(nonExistentPath);
        assert(
          result.hasOwnProperty('routes'),
          'Should return default database structure'
        );
      });

      test('should handle corrupted database file', async () => {
        const fs = require('fs').promises;
        await fs.writeFile(testDbPath, 'invalid json content', 'utf8');
        try {
          await loadDatabase(testDbPath);
          assert.fail('Should have thrown an error');
        } catch (error) {
          assert(
            error instanceof SyntaxError,
            'Should throw SyntaxError for invalid JSON'
          );
        }
      });

      test('should create directory if it does not exist', async () => {
        const nestedPath = path.join(tempDir, 'nested', 'dir', 'db.json');
        const testData = {
          routes: { test: 'data' },
          metadata: { lastUpdated: new Date().toISOString() },
        };

        await saveDatabase(testData, nestedPath);
        assert(fs.existsSync(nestedPath), 'Nested database file should exist');

        const loadedData = await loadDatabase(nestedPath);
        assert.deepStrictEqual(loadedData.routes.test, testData.routes.test);
      });
    });

    describe('migrateDatabase', () => {
      test('should migrate database to latest version', () => {
        const oldDb = {
          routes: { old: '/old' },
        };

        const migratedDb = migrateDatabase(oldDb);
        assert.strictEqual(migratedDb.metadata.version, '1.0');
        assert(
          migratedDb.hasOwnProperty('metadata'),
          'Should have metadata property'
        );
        assert(
          migratedDb.hasOwnProperty('routes'),
          'Should have routes property'
        );
      });

      test('should not modify already current database', () => {
        const currentDb = {
          routes: { current: '/current' },
          metadata: {
            version: '1.0',
            lastUpdated: '2025-01-01T00:00:00.000Z',
          },
        };

        const result = migrateDatabase(currentDb);
        assert.deepStrictEqual(result, currentDb);
      });

      test('should handle missing version', () => {
        const dbWithoutVersion = {
          routes: { test: '/test' },
        };

        const migratedDb = migrateDatabase(dbWithoutVersion);
        assert.strictEqual(migratedDb.metadata.version, '1.0');
        assert(
          migratedDb.hasOwnProperty('metadata'),
          'Should have metadata property'
        );
      });
    });

    describe('updateDatabaseRoutes', () => {
      test('should update routes in database', () => {
        const db = createDefaultDatabase();
        const newRoutes = [
          { id: 'route1', path: '/api/v1' },
          { id: 'route2', path: '/api/v2' },
        ];

        const updatedDb = updateDatabaseRoutes(db, newRoutes);
        assert.deepStrictEqual(updatedDb.routes, newRoutes);
        assert(
          updatedDb.metadata.lastUpdated,
          'Should have lastUpdated timestamp'
        );
      });

      test('should preserve other database properties', () => {
        const db = {
          routes: {},
          metadata: {
            lastUpdated: '2025-01-01T00:00:00.000Z',
            version: '1.0',
          },
          customProperty: 'test',
        };

        const newRoutes = [{ id: 'new', path: '/new' }];
        const updatedDb = updateDatabaseRoutes(db, newRoutes);

        assert.strictEqual(updatedDb.customProperty, 'test');
        assert.strictEqual(updatedDb.metadata.version, '1.0');
        assert.deepStrictEqual(updatedDb.routes, newRoutes);
      });

      test('should handle invalid input gracefully', () => {
        assert.throws(
          () => updateDatabaseRoutes(null, []),
          'Should throw for null database'
        );
        assert.throws(
          () => updateDatabaseRoutes({}, null),
          'Should throw for null routes'
        );
      });
    });
  });
});
