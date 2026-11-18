// =============================================================================
// test/db-handler.ts - In-Memory MongoDB Lifecycle Helper for Isolated Testing
// =============================================================================
// Uses `mongodb-memory-server` to provide an isolated, ephemeral MongoDB
// instance for unit and integration testing without requiring an external database.
// =============================================================================

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod: MongoMemoryServer | null = null;

export interface TestDbOptions {
  dbName?: string;
}

export interface SetupTestDbOptions extends TestDbOptions {
  /**
   * Timeout in ms for Jest lifecycle hooks (default: 60000).
   */
  timeout?: number;
  /**
   * Automatically clear all collections after each test (default: true).
   */
  clearAfterEach?: boolean;
  /**
   * Automatically clear all collections before each test (default: false).
   */
  clearBeforeEach?: boolean;
  /**
   * Drop the test database when stopping the server (default: true).
   */
  dropDatabase?: boolean;
}

/**
 * Starts the in-memory MongoDB server (if not already running) and connects Mongoose.
 * Also configures `process.env.MONGODB_URI` and syncs `global.mongooseCache`
 * so application services using `@/lib/mongodb` work seamlessly.
 */
export async function connectTestDB(options: TestDbOptions = {}): Promise<typeof mongoose> {
  const dbName = options.dbName || 'test-db';

  if (!mongod) {
    mongod = await MongoMemoryServer.create();
  }

  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri;
  process.env.MONGODB_DB = dbName;

  // Disconnect existing connection if in unexpected state
  if (mongoose.connection.readyState !== 0 && mongoose.connection.readyState !== 1) {
    await mongoose.disconnect();
  }

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri, {
      dbName,
    });
  }

  // Synchronize global cache used by '@/lib/mongodb'
  global.mongooseCache = {
    conn: mongoose,
    promise: Promise.resolve(mongoose),
  };

  return mongoose;
}

/**
 * Clears all documents from every collection in the current database.
 * Preserves collections and indexes, ensuring fast and isolated tests.
 */
export async function clearTestDB(): Promise<void> {
  if (mongoose.connection.readyState === 0) return;

  const collections = mongoose.connection.collections;
  const clearPromises = Object.values(collections).map((collection) =>
    collection.deleteMany({}),
  );

  await Promise.all(clearPromises);
}

/**
 * Drops the test database, disconnects Mongoose, resets cache, and terminates MongoMemoryServer.
 */
export async function closeTestDB(options: { dropDatabase?: boolean; force?: boolean } = {}): Promise<void> {
  const shouldDrop = options.dropDatabase !== false;

  if (mongoose.connection.readyState !== 0) {
    if (shouldDrop) {
      try {
        await mongoose.connection.dropDatabase();
      } catch {
        // Ignore drop errors if already dropped or disconnected
      }
    }
    await mongoose.disconnect();
  }

  // Clear global mongoose cache
  if (global.mongooseCache) {
    global.mongooseCache = { conn: null, promise: null };
  }

  if (mongod) {
    await mongod.stop({ force: options.force ?? true, doCleanup: true });
    mongod = null;
  }
}

/**
 * Returns the active MongoMemoryServer instance, or null if not running.
 */
export function getMongoServer(): MongoMemoryServer | null {
  return mongod;
}

/**
 * Returns the URI of the active MongoMemoryServer instance, or null if not running.
 */
export function getMongoUri(): string | null {
  return mongod ? mongod.getUri() : null;
}

/**
 * Convenience Jest lifecycle hook setup.
 * Attaches beforeAll, afterEach, and afterAll to isolate database tests.
 *
 * Usage:
 * ```ts
 * describe('My Integration Test', () => {
 *   setupTestDatabase();
 *
 *   it('tests database operations', async () => { ... });
 * });
 * ```
 */
export function setupTestDatabase(options: SetupTestDbOptions = {}): void {
  const timeout = options.timeout ?? 60000;

  beforeAll(async () => {
    await connectTestDB(options);
  }, timeout);

  if (options.clearBeforeEach) {
    beforeEach(async () => {
      await clearTestDB();
    }, timeout);
  }

  if (options.clearAfterEach !== false) {
    afterEach(async () => {
      await clearTestDB();
    }, timeout);
  }

  afterAll(async () => {
    await closeTestDB(options);
  }, timeout);
}

// Aliases for convenience
export const useTestDatabase = setupTestDatabase;
export const setupTestDB = setupTestDatabase;
export const connectDB = connectTestDB;
export const clearDatabase = clearTestDB;
export const closeDatabase = closeTestDB;

export default setupTestDatabase;
