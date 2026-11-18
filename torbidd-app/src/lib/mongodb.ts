// =============================================================================
// lib/mongodb.ts - MongoDB Atlas Connection Singleton (ASVS V13.1.2 & V13.2.3)
// =============================================================================
// ASVS V13.1.2 Requirement:
// "Verify that for each service the application uses, the documentation defines
// the maximum number of concurrent connections (e.g., connection pool limits)
// and how the application behaves when that limit is reached, including any
// fallback or recovery mechanisms, to prevent denial of service conditions."
//
// ASVS V13.2.3 Requirement:
// "Verify that if a credential has to be used for service authentication, the
// credential being used by the consumer is not a default credential."
// =============================================================================

import mongoose from 'mongoose';

export const MONGO_DEFAULT_POOL_SIZE = 10;
export const MONGO_DEFAULT_TIMEOUT_MS = 5000;

export interface MongoConnectionOptions extends mongoose.ConnectOptions {
  maxPoolSize: number;
  serverSelectionTimeoutMS: number;
}

/**
 * Validates that connection string does not use default credentials (ASVS V13.2.3).
 */
export function validateMongoUri(uri: string): void {
  const lower = uri.toLowerCase();
  if (
    lower.includes('://root:root@') ||
    lower.includes('://admin:admin@') ||
    lower.includes('://root:password@') ||
    lower.includes('://admin:password@')
  ) {
    throw new Error('[Security Error] Default credentials are not permitted in MONGODB_URI (ASVS V13.2.3)');
  }
}

/**
 * Returns connection options enforcing connection pool limits and timeouts (ASVS V13.1.2).
 */
export function getMongoConnectionOptions(): MongoConnectionOptions {
  return {
    dbName: process.env.MONGODB_DB || 'torbidd',
    bufferCommands: false,
    maxPoolSize: process.env.MONGODB_MAX_POOL_SIZE
      ? parseInt(process.env.MONGODB_MAX_POOL_SIZE, 10)
      : MONGO_DEFAULT_POOL_SIZE,
    serverSelectionTimeoutMS: process.env.MONGODB_TIMEOUT_MS
      ? parseInt(process.env.MONGODB_TIMEOUT_MS, 10)
      : MONGO_DEFAULT_TIMEOUT_MS,
  };
}

interface CachedMongoose {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCache: CachedMongoose | undefined;
}

const cached: CachedMongoose = global.mongooseCache ?? { conn: null, promise: null };
global.mongooseCache = cached;

export async function connectToDatabase(): Promise<typeof mongoose> {
  const MONGODB_URI = process.env.MONGODB_URI;

  if (!MONGODB_URI) {
    throw new Error('Please define MONGODB_URI in your .env.local file');
  }

  validateMongoUri(MONGODB_URI);

  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    const options = getMongoConnectionOptions();
    cached.promise = mongoose
      .connect(MONGODB_URI, options)
      .then((m) => m)
      .catch((err) => {
        cached.promise = null;
        throw err;
      });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (err) {
    cached.promise = null;
    throw err;
  }
}

export default connectToDatabase;
