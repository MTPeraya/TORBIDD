/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import {
  getFetchMetadata,
  validateFetchMetadata,
  withCorpHeader,
  corpDenyResponse,
} from '../fetch-metadata';

describe('Fetch Metadata & CORP (ASVS 3.5.8)', () => {
  describe('getFetchMetadata', () => {
    it('extracts Sec-Fetch-* headers accurately', () => {
      const req = new NextRequest('http://localhost:3000/api/documents/123/tor.pdf', {
        headers: {
          'sec-fetch-site': 'same-origin',
          'sec-fetch-mode': 'cors',
          'sec-fetch-dest': 'empty',
        },
      });

      const meta = getFetchMetadata(req);
      expect(meta).toEqual({
        site: 'same-origin',
        mode: 'cors',
        dest: 'empty',
      });
    });

    it('returns nulls when headers are absent', () => {
      const req = new NextRequest('http://localhost:3000/api/documents/123/tor.pdf');
      const meta = getFetchMetadata(req);
      expect(meta).toEqual({
        site: null,
        mode: null,
        dest: null,
      });
    });
  });

  describe('validateFetchMetadata', () => {
    it('allows requests when sec-fetch-site is absent (non-browser clients, cURL, etc.)', () => {
      const req = new NextRequest('http://localhost:3000/api/documents/123/tor.pdf');
      expect(validateFetchMetadata(req)).toBeNull();
    });

    it('allows same-origin requests', () => {
      const req = new NextRequest('http://localhost:3000/api/documents/123/tor.pdf', {
        headers: {
          'sec-fetch-site': 'same-origin',
          'sec-fetch-mode': 'no-cors',
          'sec-fetch-dest': 'image',
        },
      });
      expect(validateFetchMetadata(req)).toBeNull();
    });

    it('allows same-site requests', () => {
      const req = new NextRequest('http://localhost:3000/api/documents/123/tor.pdf', {
        headers: {
          'sec-fetch-site': 'same-site',
          'sec-fetch-mode': 'cors',
          'sec-fetch-dest': 'empty',
        },
      });
      expect(validateFetchMetadata(req)).toBeNull();
    });

    it('allows direct navigation (sec-fetch-site: none)', () => {
      const req = new NextRequest('http://localhost:3000/api/documents/123/tor.pdf', {
        headers: {
          'sec-fetch-site': 'none',
          'sec-fetch-mode': 'navigate',
          'sec-fetch-dest': 'document',
        },
      });
      expect(validateFetchMetadata(req)).toBeNull();
    });

    it('allows cross-site top-level navigation', () => {
      const req = new NextRequest('http://localhost:3000/api/documents/123/tor.pdf', {
        headers: {
          'sec-fetch-site': 'cross-site',
          'sec-fetch-mode': 'navigate',
          'sec-fetch-dest': 'document',
        },
      });
      expect(validateFetchMetadata(req)).toBeNull();
    });

    it('blocks cross-site unauthorized sub-resource embed attempts with 403', async () => {
      const embedDestinations = ['image', 'video', 'audio', 'script', 'embed', 'object'];

      for (const dest of embedDestinations) {
        const req = new NextRequest('http://localhost:3000/api/documents/123/tor.pdf', {
          headers: {
            'sec-fetch-site': 'cross-site',
            'sec-fetch-mode': 'no-cors',
            'sec-fetch-dest': dest,
          },
        });

        const denied = validateFetchMetadata(req);
        expect(denied).not.toBeNull();
        expect(denied?.status).toBe(403);

        const json = await denied?.json();
        expect(json.error).toContain('Cross-origin resource embedding is not permitted');
      }
    });
  });

  describe('withCorpHeader & corpDenyResponse', () => {
    it('attaches Cross-Origin-Resource-Policy: same-origin by default', () => {
      const baseResponse = new NextRequest('http://localhost:3000');
      const res = withCorpHeader(new (require('next/server').NextResponse)('ok'));
      expect(res.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
    });

    it('allows custom CORP directive', () => {
      const res = withCorpHeader(new (require('next/server').NextResponse)('ok'), 'same-site');
      expect(res.headers.get('Cross-Origin-Resource-Policy')).toBe('same-site');
    });

    it('corpDenyResponse returns 403 with CORP header', async () => {
      const res = corpDenyResponse();
      expect(res.status).toBe(403);
      expect(res.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
      const data = await res.json();
      expect(data.error).toContain('Cross-origin resource embedding is not permitted');
    });
  });
});
