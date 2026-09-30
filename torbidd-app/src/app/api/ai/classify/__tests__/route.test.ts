/**
 * @jest-environment node
 */
// =============================================================================
// app/api/ai/classify/__tests__/route.test.ts
// Unit tests for /api/ai/classify route handler (UC-10)
// =============================================================================

import { NextRequest } from 'next/server';
import { GET, POST } from '../route';

describe('/api/ai/classify Route Handler', () => {
  describe('GET /api/ai/classify', () => {
    it('returns diagnostic status with all 4 providers listed', async () => {
      const response = await GET();
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.data).toBeDefined();
      expect(json.data.providers).toHaveProperty('google-ai-studio');
      expect(json.data.providers).toHaveProperty('vertexai');
      expect(json.data.providers).toHaveProperty('openrouter');
      expect(json.data.providers).toHaveProperty('keyword');
      expect(json.data.providers.keyword.configured).toBe(true);
    });
  });

  describe('POST /api/ai/classify', () => {
    it('returns 400 when title or description is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/ai/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '' }),
      });

      const response = await POST(req);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Invalid request body');
    });

    it('classifies project successfully and returns classification result', async () => {
      const req = new NextRequest('http://localhost:3000/api/ai/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'โครงการพัฒนาระบบคลาวด์และคอนเทนเนอร์ กทม.',
          description: 'ระบบ Kubernetes และ Cloud computing สำหรับบริการกรุงเทพมหานคร',
        }),
      });

      const response = await POST(req);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.data).toBeDefined();
      expect(json.data.category).toBe('Cloud');
      expect(json.data.isSoftwareRelated).toBe(true);
      expect(['High', 'Medium', 'Low']).toContain(json.data.confidence);
    });

    it('accepts custom provider and falls back gracefully when unconfigured', async () => {
      const req = new NextRequest('http://localhost:3000/api/ai/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'จ้างปรับปรุงถนนและสะพานข้ามคลอง',
          description: 'งานก่อสร้างและปรับปรุงโครงสร้างพื้นฐาน',
          provider: 'google-ai-studio',
        }),
      });

      const response = await POST(req);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.data.isSoftwareRelated).toBe(false);
    });
  });
});
