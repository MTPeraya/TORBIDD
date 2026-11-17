/**
 * @jest-environment node
 *
 * E2E: Bookmark API Route Tests (GET /api/bookmarks, POST /api/bookmarks, DELETE /api/bookmarks/[id])
 *
 * Validates bookmark persistence endpoints:
 *  1. GET /api/bookmarks returns session-scoped bookmark list
 *  2. POST /api/bookmarks creates a valid bookmark record
 *  3. POST /api/bookmarks returns 400 for invalid / non-24-char projectId
 *  4. DELETE /api/bookmarks/[id] successfully removes an existing bookmark
 *  5. DELETE /api/bookmarks/[id] returns 404 when bookmark does not exist
 *  6. DELETE /api/bookmarks/[id] returns 400 for malformed (non-hex) id
 */

import { NextRequest } from 'next/server';
import { GET as BookmarksGET, POST as BookmarksPOST } from '@/app/api/bookmarks/route';
import { DELETE as BookmarksDELETE } from '@/app/api/bookmarks/[id]/route';

// Mock MongoDB and models
jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(true));
jest.mock('@/models/Bookmark');
jest.mock('@/lib/session', () => ({
  SESSION_COOKIE: 'torbidd_session',
  getSessionId: jest.fn().mockReturnValue('sess_test_e2e_bookmark_01'),
}));

describe('E2E: Bookmark API CRUD Endpoints', () => {
  let mockBookmarkStore: Array<{ sessionId: string; projectId: { toString(): string } }>;

  beforeEach(async () => {
    const BookmarkModel = await import('@/models/Bookmark');
    const Bookmark = BookmarkModel.default;
    mockBookmarkStore = [];

    (Bookmark.find as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockImplementation(async () =>
        mockBookmarkStore
          .filter((b) => b.sessionId === 'sess_test_e2e_bookmark_01')
          .map((b) => ({ projectId: { toString: () => b.projectId.toString() } })),
      ),
    });

    (Bookmark.findOneAndUpdate as jest.Mock).mockImplementation(
      async (_filter: any, doc: any) => {
        mockBookmarkStore.push({ sessionId: 'sess_test_e2e_bookmark_01', projectId: doc.projectId });
        return doc;
      },
    );

    (Bookmark.deleteOne as jest.Mock).mockImplementation(async (filter: any) => {
      const idx = mockBookmarkStore.findIndex(
        (b) => b.projectId.toString() === filter.projectId?.toString(),
      );
      if (idx >= 0) {
        mockBookmarkStore.splice(idx, 1);
        return { deletedCount: 1 };
      }
      return { deletedCount: 0 };
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('1.1 GET /api/bookmarks returns empty list for session with no bookmarks', async () => {
    const req = new NextRequest('http://localhost/api/bookmarks', {
      method: 'GET',
      headers: { cookie: 'torbidd_session=sess_test_e2e_bookmark_01' },
    });
    const res = await BookmarksGET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  it('1.2 POST /api/bookmarks creates a valid bookmark record', async () => {
    const validObjectId = 'a1b2c3d4e5f6a1b2c3d4e5f6'; // 24-char hex
    const req = new NextRequest('http://localhost/api/bookmarks', {
      method: 'POST',
      body: JSON.stringify({ projectId: validObjectId }),
      headers: {
        'content-type': 'application/json',
        cookie: 'torbidd_session=sess_test_e2e_bookmark_01',
      },
    });
    const res = await BookmarksPOST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('1.3 POST /api/bookmarks returns 400 for invalid / non-24-char projectId', async () => {
    const req = new NextRequest('http://localhost/api/bookmarks', {
      method: 'POST',
      body: JSON.stringify({ projectId: 'not-a-valid-objectid' }),
      headers: {
        'content-type': 'application/json',
        cookie: 'torbidd_session=sess_test_e2e_bookmark_01',
      },
    });
    const res = await BookmarksPOST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid request body');
  });

  it('1.4 DELETE /api/bookmarks/[id] successfully removes an existing bookmark', async () => {
    const validId = 'b2c3d4e5f6a1b2c3d4e5f6a1';
    const BookmarkModel = await import('@/models/Bookmark');
    (BookmarkModel.default.deleteOne as jest.Mock).mockResolvedValueOnce({ deletedCount: 1 });

    const req = new NextRequest(`http://localhost/api/bookmarks/${validId}`, {
      method: 'DELETE',
      headers: { cookie: 'torbidd_session=sess_test_e2e_bookmark_01' },
    });

    const res = await BookmarksDELETE(req, { params: Promise.resolve({ id: validId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('1.5 DELETE /api/bookmarks/[id] returns 404 when bookmark does not exist', async () => {
    const missingId = 'c3d4e5f6a1b2c3d4e5f6a1b2';
    const BookmarkModel = await import('@/models/Bookmark');
    (BookmarkModel.default.deleteOne as jest.Mock).mockResolvedValueOnce({ deletedCount: 0 });

    const req = new NextRequest(`http://localhost/api/bookmarks/${missingId}`, {
      method: 'DELETE',
      headers: { cookie: 'torbidd_session=sess_test_e2e_bookmark_01' },
    });

    const res = await BookmarksDELETE(req, { params: Promise.resolve({ id: missingId }) });
    expect(res.status).toBe(404);
  });

  it('1.6 DELETE /api/bookmarks/[id] returns 400 for malformed (non-hex) id', async () => {
    const req = new NextRequest('http://localhost/api/bookmarks/not-a-valid-objectid', {
      method: 'DELETE',
      headers: { cookie: 'torbidd_session=sess_test_e2e_bookmark_01' },
    });
    const res = await BookmarksDELETE(req, { params: Promise.resolve({ id: 'not-a-valid-objectid' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid project ID');
  });
});

