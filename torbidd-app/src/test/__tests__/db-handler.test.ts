/**
 * @jest-environment node
 */
// =============================================================================
// test/__tests__/db-handler.test.ts
// Unit & Integration tests for mongodb-memory-server lifecycle hooks & test isolation
// =============================================================================

import mongoose from 'mongoose';
import {
  setupTestDatabase,
  connectTestDB,
  clearTestDB,
  closeTestDB,
  getMongoServer,
  getMongoUri,
} from '../db-handler';
import connectToDatabase from '@/lib/mongodb';
import Bookmark from '@/models/Bookmark';
import SyncError from '@/models/SyncError';

describe('mongodb-memory-server - Lifecycle Hooks & Database Isolation', () => {
  // Sets up beforeAll (connect), afterEach (clear collections), afterAll (stop)
  setupTestDatabase();

  it('1. should connect to the in-memory database and report active connection', () => {
    expect(mongoose.connection.readyState).toBe(1); // 1 = connected
    expect(getMongoServer()).not.toBeNull();
    const uri = getMongoUri();
    expect(uri).toBeTruthy();
    expect(uri).toMatch(/^mongodb:\/\/127\.0\.0\.1:\d+\//);
    expect(process.env.MONGODB_URI).toBe(uri);
  });

  it('2. should integrate with connectToDatabase() singleton from @/lib/mongodb', async () => {
    const conn = await connectToDatabase();
    expect(conn.connection.readyState).toBe(1);
    expect(conn.connection.host).toBe('127.0.0.1');
  });

  it('3. should write a record in Test A', async () => {
    const bookmark = await Bookmark.create({
      sessionId: 'session_123',
      projectId: new mongoose.Types.ObjectId(),
    });

    expect(bookmark._id).toBeDefined();
    expect(bookmark.sessionId).toBe('session_123');

    const count = await Bookmark.countDocuments();
    expect(count).toBe(1);
  });

  it('4. should be completely isolated in Test B (afterEach cleared the collection)', async () => {
    // The bookmark created in Test A must NOT be present
    const count = await Bookmark.countDocuments();
    expect(count).toBe(0);

    const found = await Bookmark.findOne({ sessionId: 'session_123' });
    expect(found).toBeNull();
  });

  it('5. should support Mongoose schemas and queries in memory', async () => {
    const error = await SyncError.create({
      errorCode: 'TEST_E404',
      errorMessage: 'Item not found in external registry',
      source: 'TEST_SUITE',
      retryCount: 1,
      status: 'PENDING',
    });

    expect(error._id).toBeDefined();
    expect(error.status).toBe('PENDING');

    // Query and update
    const updated = await SyncError.findByIdAndUpdate(
      error._id,
      { status: 'RESOLVED', resolutionNotes: 'Handled in memory test' },
      { returnDocument: 'after' },
    );

    expect(updated?.status).toBe('RESOLVED');
    expect(updated?.resolutionNotes).toBe('Handled in memory test');
  });

  it('6. should be empty again in subsequent test', async () => {
    const errorCount = await SyncError.countDocuments();
    expect(errorCount).toBe(0);
  });
});

describe('Manual db-handler lifecycle controls', () => {
  it('allows manual connect, clear, and close operations', async () => {
    await connectTestDB({ dbName: 'manual-test-db' });
    expect(mongoose.connection.readyState).toBe(1);

    await Bookmark.create({
      sessionId: 'manual_session',
      projectId: new mongoose.Types.ObjectId(),
    });

    let count = await Bookmark.countDocuments();
    expect(count).toBe(1);

    await clearTestDB();
    count = await Bookmark.countDocuments();
    expect(count).toBe(0);

    await closeTestDB();
    expect(mongoose.connection.readyState).toBe(0); // 0 = disconnected
  });
});
