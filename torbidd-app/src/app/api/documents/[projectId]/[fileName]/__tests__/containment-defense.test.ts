/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { AUTH_COOKIE_NAME, signSession, AuthSessionUser } from '@/lib/auth';

jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(true));
jest.mock('@/models/ProcurementProject', () => ({
  __esModule: true,
  default: { findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }) },
}));
jest.mock('@/models/Project', () => ({
  __esModule: true,
  default: { findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }) },
}));

describe('Document Route Path Traversal & Containment Defense (T-04)', () => {
  const regularUser: AuthSessionUser = {
    id: 'user_1',
    email: 'user@example.com',
    role: 'officer',
    name: 'Officer User',
    picture: 'https://example.com/pic.jpg',
    org: 'BMA',
  };

  it('1. rejects unauthenticated access to sensitive or internal documents with HTTP 401', async () => {
    const req = new NextRequest('http://localhost:3000/api/documents/67119538991/internal_budget_audit.pdf');
    const res = await GET(req, {
      params: Promise.resolve({ projectId: '67119538991', fileName: 'internal_budget_audit.pdf' }),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Unauthorized');
  });

  it('2. returns HTTP 404 when authenticated user requests non-existent sensitive document to prevent enumeration', async () => {
    const token = signSession(regularUser);
    const req = new NextRequest('http://localhost:3000/api/documents/67119538991/internal_budget_audit.pdf', {
      headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` },
    });
    const res = await GET(req, {
      params: Promise.resolve({ projectId: '67119538991', fileName: 'internal_budget_audit.pdf' }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Document not found');
  });

  it('3. rejects path traversal in project ID or filename with HTTP 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/documents/..%2fetc/passwd.pdf');
    const res = await GET(req, {
      params: Promise.resolve({ projectId: '..%2fetc', fileName: 'passwd.pdf' }),
    });

    expect(res.status).toBe(400);
  });
});
