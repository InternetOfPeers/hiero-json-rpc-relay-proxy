const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const {
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
