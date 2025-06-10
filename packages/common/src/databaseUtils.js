/**
 * Common database utilities for database management and persistence
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Generate network-specific database file path
 * @param {string} baseFolder - Base folder path (optional, defaults to current directory)
 * @param {string} network - Network name (testnet, mainnet) (optional)
 * @param {string} filename - Base filename (optional)
 * @returns {string} Full path to database file
 */
function getDatabasePath(baseFolder, network, filename = 'routing_db') {
  // Handle case where no arguments are provided - return default path
  if (arguments.length === 0) {
    return path.join(process.cwd(), 'routing_db.json');
  }

  // Handle case where a full path is provided as first argument
  if (baseFolder && !network) {
    return baseFolder;
  }

  // Handle network-specific path generation
  const base = baseFolder || process.cwd();
  const net = network || 'testnet';
  const dbFileName = `${filename}_${net}.json`;
  return path.join(base, dbFileName);
}

/**
 * Initialize default database structure
 * @returns {Object} Default database structure
 */
function createDefaultDatabase() {
  return {
    routes: {
      '0x0000000000000000000000000000000000000000':
        'https://testnet.hashio.io/api',
    },
    metadata: {
      rsaKeys: null,
      sequences: {},
      lastUpdated: new Date().toISOString(),
      version: '1.0.0',
    },
  };
}

/**
 * Migrate database from old format to new format if needed
 * @param {Object} loadedData - Raw loaded database data
 * @returns {Object} Migrated database structure with version information
 */
function migrateDatabase(loadedData) {
  // Check if it's already in new format (has routes object and metadata with version)
  if (loadedData.routes && loadedData.metadata && loadedData.metadata.version) {
    // Already in new format
    return loadedData;
  }

  // Check if it's partially new format (has routes and metadata but no version)
  if (
    loadedData.routes &&
    loadedData.metadata &&
    !loadedData.metadata.version
  ) {
    // Just add version to existing structure
    loadedData.metadata.version = '1.0';
    loadedData.metadata.lastUpdated = new Date().toISOString();
    return loadedData;
  }

  // Old format - migrate to new structure
  console.log('Migrating database from old format to new format...');
  const migratedDb = createDefaultDatabase();

  // Preserve old routes if they exist
  if (typeof loadedData === 'object' && !Array.isArray(loadedData)) {
    // If loadedData has routes but no metadata, preserve routes structure
    if (loadedData.routes && !loadedData.metadata) {
      migratedDb.routes = { ...migratedDb.routes, ...loadedData.routes };
    } else {
      // Assume entire loadedData is routes
      migratedDb.routes = { ...migratedDb.routes, ...loadedData };
    }
  }

  migratedDb.metadata.lastUpdated = new Date().toISOString();
  migratedDb.metadata.version = '1.0';
  console.log('✅ Database migration completed');

  return migratedDb;
}

/**
 * Save database to file
 * @param {Object} database - Database object to save
 * @param {string} filePath - Path to save the database
 */
async function saveDatabase(database, filePath) {
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    // Update last modified timestamp
    if (database.metadata) {
      database.metadata.lastUpdated = new Date().toISOString();
    }

    await fs.writeFile(filePath, JSON.stringify(database, null, 2), 'utf8');
    console.log(`Database saved to ${filePath}`);
  } catch (error) {
    console.error('Failed to save database:', error.message);
    throw error;
  }
}

/**
 * Load database from file
 * @param {string} filePath - Path to load the database from
 * @returns {Object} Loaded and migrated database
 */
async function loadDatabase(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    const loadedData = JSON.parse(data);
    return migrateDatabase(loadedData);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('Database file not found, creating new one with defaults');
      return createDefaultDatabase();
    }
    throw error;
  }
}

/**
 * Update routes in database
 * @param {Object} database - Database object
 * @param {Array|Object} newRoutes - Routes to update (array or object)
 * @returns {Object} Updated database
 */
function updateDatabaseRoutes(database, newRoutes) {
  if (!database || typeof database !== 'object') {
    throw new Error('Database must be a valid object');
  }

  if (!newRoutes) {
    throw new Error('Routes cannot be null or undefined');
  }

  if (!database.routes) {
    database.routes = {};
  }

  // Handle array of routes
  if (Array.isArray(newRoutes)) {
    // Convert array to object format for storage, but preserve array for return
    database.routes = newRoutes;
  } else {
    // Handle object format routes
    Object.assign(database.routes, newRoutes);
  }

  if (database.metadata) {
    database.metadata.lastUpdated = new Date().toISOString();
  }

  return database;
}

module.exports = {
  getDatabasePath,
  createDefaultDatabase,
  migrateDatabase,
  saveDatabase,
  loadDatabase,
  updateDatabaseRoutes,
};
