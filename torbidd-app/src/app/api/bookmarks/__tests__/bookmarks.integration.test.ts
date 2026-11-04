/**
 * @jest-environment node
 */
// =============================================================================
// app/api/bookmarks/__tests__/bookmarks.integration.test.ts
// Integration tests for /api/bookmarks/* with real session tokens, in-memory DB & Zod validation
// =============================================================================

import mongoose from 'mongoose';
import { NextRequest } from 'next/server';
import { setupTestDatabase } from '@/test/db-handler';
import { GET as getBookmarksHandler, POST as postBookmarkHandler } from '../route';
import { DELETE as deleteBookmarkHandler } from '../[id]/route';
import Bookmark from '@/models/Bookmark';
import { SESSION_COOKIE } from '@/lib/session';

describe('/api/bookmarks/* API & Session Integration', () => {
  setupTestDatabase();

  const sessionA = 'session_alpha_1111-2222-3333-4444';
  const sessionB = 'session_bravo_5555-6666-7777-8888';
  const validObjectIdA = new mongoose.Types.ObjectId().toHexString();
  const validObjectIdB = new mongoose.Types.ObjectId().toHexString();

  // ─── 1. Zod Validation on POST /api/bookmarks ──────────────────────────────
  describe('Zod Input Validation (POST /api/bookmarks)', () => {
    it('returns 400 with validation details when request body is empty', async () => {
      const req = new NextRequest('http://localhost:3000/api/bookmarks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `${SESSION_COOKIE}=${sessionA}`,
        },
        body: JSON.stringify({}),
      });

      const res = await postBookmarkHandler(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe('Invalid request body');
      expect(json.details.fieldErrors.projectId).toBeDefined();
    });

    it('returns 400 when projectId is not exactly 24 characters', async () => {
      const req = new NextRequest('http://localhost:3000/api/bookmarks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `${SESSION_COOKIE}=${sessionA}`,
        },
        body: JSON.stringify({ projectId: 'too-short-id' }),
      });

      const res = await postBookmarkHandler(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe('Invalid request body');
      expect(json.details.fieldErrors.projectId[0]).toMatch(/24 character/i);
    });

    it('returns 400 when projectId is a number instead of string', async () => {
      const req = new NextRequest('http://localhost:3000/api/bookmarks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `${SESSION_COOKIE}=${sessionA}`,
        },
        body: JSON.stringify({ projectId: 123456789012345678901234 }),
      });

      const res = await postBookmarkHandler(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe('Invalid request body');
    });
  });

  // ─── 2. Real Session Persistence & CRUD ────────────────────────────────────
  describe('Database Persistence & Lifecycle', () => {
    it('saves a bookmark into the in-memory database and returns 201', async () => {
      const req = new NextRequest('http://localhost:3000/api/bookmarks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `${SESSION_COOKIE}=${sessionA}`,
        },
        body: JSON.stringify({ projectId: validObjectIdA }),
      });

      const res = await postBookmarkHandler(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);

      // Verify directly in MongoDB
      const dbDoc = await Bookmark.findOne({
        sessionId: sessionA,
        projectId: new mongoose.Types.ObjectId(validObjectIdA),
      });
      expect(dbDoc).not.toBeNull();
      expect(dbDoc?.sessionId).toBe(sessionA);
    });

    it('retrieves bookmarks for the authenticated session', async () => {
      // Seed two bookmarks for sessionA
      await Bookmark.create({
        sessionId: sessionA,
        projectId: new mongoose.Types.ObjectId(validObjectIdA),
      });
      await Bookmark.create({
        sessionId: sessionA,
        projectId: new mongoose.Types.ObjectId(validObjectIdB),
      });

      const req = new NextRequest('http://localhost:3000/api/bookmarks', {
        headers: { Cookie: `${SESSION_COOKIE}=${sessionA}` },
      });

      const res = await getBookmarksHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data).toHaveLength(2);
      expect(json.data).toContain(validObjectIdA);
      expect(json.data).toContain(validObjectIdB);
    });
  });

  // ─── 3. Multi-Session Isolation ────────────────────────────────────────────
  describe('Session Isolation between Users', () => {
    it('does not allow Session B to see bookmarks saved by Session A', async () => {
      // Session A creates a bookmark
      await Bookmark.create({
        sessionId: sessionA,
        projectId: new mongoose.Types.ObjectId(validObjectIdA),
      });

      // Session B queries bookmarks
      const reqB = new NextRequest('http://localhost:3000/api/bookmarks', {
        headers: { Cookie: `${SESSION_COOKIE}=${sessionB}` },
      });
      const resB = await getBookmarksHandler(reqB);
      expect(resB.status).toBe(200);

      const jsonB = await resB.json();
      expect(jsonB.data).toEqual([]);
    });

    it('does not allow Session B to delete a bookmark created by Session A', async () => {
      // Session A creates a bookmark
      await Bookmark.create({
        sessionId: sessionA,
        projectId: new mongoose.Types.ObjectId(validObjectIdA),
      });

      // Session B attempts to delete Session A's bookmark
      const reqB = new NextRequest(`http://localhost:3000/api/bookmarks/${validObjectIdA}`, {
        method: 'DELETE',
        headers: { Cookie: `${SESSION_COOKIE}=${sessionB}` },
      });
      const resB = await deleteBookmarkHandler(reqB, {
        params: Promise.resolve({ id: validObjectIdA }),
      });

      expect(resB.status).toBe(404);
      const jsonB = await resB.json();
      expect(jsonB.error).toBe('Bookmark not found');

      // Verify Session A's bookmark is still intact
      const count = await Bookmark.countDocuments({ sessionId: sessionA });
      expect(count).toBe(1);
    });
  });

  // ─── 4. DELETE /api/bookmarks/[id] ─────────────────────────────────────────
  describe('DELETE /api/bookmarks/[id]', () => {
    it('returns 400 when id param is not a valid 24-hex string', async () => {
      const req = new NextRequest('http://localhost:3000/api/bookmarks/not-valid-hex-id', {
        method: 'DELETE',
        headers: { Cookie: `${SESSION_COOKIE}=${sessionA}` },
      });

      const res = await deleteBookmarkHandler(req, {
        params: Promise.resolve({ id: 'not-valid-hex-id' }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Invalid project ID');
    });

    it('returns 404 when bookmark does not exist for the session', async () => {
      const unusedId = new mongoose.Types.ObjectId().toHexString();
      const req = new NextRequest(`http://localhost:3000/api/bookmarks/${unusedId}`, {
        method: 'DELETE',
        headers: { Cookie: `${SESSION_COOKIE}=${sessionA}` },
      });

      const res = await deleteBookmarkHandler(req, {
        params: Promise.resolve({ id: unusedId }),
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe('Bookmark not found');
    });

    it('successfully deletes bookmark and returns 200', async () => {
      await Bookmark.create({
        sessionId: sessionA,
        projectId: new mongoose.Types.ObjectId(validObjectIdA),
      });

      const req = new NextRequest(`http://localhost:3000/api/bookmarks/${validObjectIdA}`, {
        method: 'DELETE',
        headers: { Cookie: `${SESSION_COOKIE}=${sessionA}` },
      });

      const res = await deleteBookmarkHandler(req, {
        params: Promise.resolve({ id: validObjectIdA }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);

      // Verify deleted from MongoDB
      const remaining = await Bookmark.countDocuments({ sessionId: sessionA });
      expect(remaining).toBe(0);
    });
  });
});

