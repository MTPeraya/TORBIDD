/** @jest-environment node */

import path from 'node:path';
import {
  assertNoPathTraversal,
  assertPdfExtension,
  assertPrivateStorageRoot,
  MAX_PDF_BYTES,
  pdfContentDisposition,
  validatePdfBuffer,
} from '../secure-pdf';

describe('secure PDF policy (SEC-17)', () => {
  const validPdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF');

  it('accepts only .pdf files whose content starts with PDF magic bytes', () => {
    expect(validatePdfBuffer(validPdf, { fileName: 'TOR.pdf' }).storageKey).toMatch(
      /^tor_[a-f0-9]{64}\.pdf$/,
    );
    expect(() => validatePdfBuffer(validPdf, { fileName: 'TOR.exe' })).toThrow(/only files with a \.pdf/i);
    expect(() => validatePdfBuffer(Buffer.from('MZ executable'), { fileName: 'TOR.pdf' })).toThrow(/magic bytes/i);
  });

  it('rejects PDFs larger than 25 MB', () => {
    const oversized = Buffer.alloc(MAX_PDF_BYTES + 1);
    oversized.set(Buffer.from('%PDF-'));
    expect(() => validatePdfBuffer(oversized, { fileName: 'TOR.pdf' })).toThrow(/25 MB/i);
  });

  it.each(['../TOR.pdf', '..\\TOR.pdf', '%2e%2e%2fTOR.pdf', '%252e%252e%252fTOR.pdf'])(
    'rejects traversal form %s',
    (candidate) => {
      expect(() => assertNoPathTraversal(candidate)).toThrow(/path traversal/i);
      expect(() => assertPdfExtension(candidate)).toThrow(/path traversal/i);
    },
  );

  it('refuses document storage under the public web root', () => {
    expect(() => assertPrivateStorageRoot(path.join(process.cwd(), 'public', 'documents'))).toThrow(
      /outside the public web root/i,
    );
  });

  it('builds a controlled CRLF-safe RFC 6266 filename', () => {
    const header = pdfContentDisposition('123\r\nX-Injected: yes');
    expect(header).toContain('filename="TOR_123__X-Injected__yes.pdf"');
    expect(header).toContain("filename*=UTF-8''");
    expect(header).not.toContain('\r');
    expect(header).not.toContain('\n');
  });
});
