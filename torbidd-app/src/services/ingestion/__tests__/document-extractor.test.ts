/**
 * @jest-environment node
 */
// =============================================================================
// services/ingestion/__tests__/document-extractor.test.ts
// Tests: 8. Invalid ZIP, 9. Missing ATTACH_TOR, 10. Successful TOR extraction
// =============================================================================

import { zipSync, strToU8 } from 'fflate';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DocumentExtractor } from '../document-extractor';

describe('DocumentExtractor (ZIP & ATTACH_TOR Processing)', () => {
  const MOCK_PROJECT_ID = '67119538991';
  // Valid PDF header and content
  const VALID_PDF_BYTES = strToU8('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n%%EOF');
  let tempStorageDir: string;

  beforeEach(async () => {
    tempStorageDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'torbidd-test-'));
  });

  afterEach(async () => {
    if (tempStorageDir && fs.existsSync(tempStorageDir)) {
      await fs.promises.rm(tempStorageDir, { recursive: true, force: true });
    }
  });

  // ─── 8. Invalid ZIP ───────────────────────────────────────────────────────
  it('8. should reject invalid or corrupted ZIP files', () => {
    const extractor = new DocumentExtractor({ storagePath: tempStorageDir });
    const invalidZipBuffer = Buffer.from('this is not a zip file at all');

    expect(() => extractor.extractZip(invalidZipBuffer, MOCK_PROJECT_ID)).toThrow(
      /invalid magic signature/i,
    );
  });

  // ─── 9. Missing ATTACH_TOR ────────────────────────────────────────────────
  it('9. should throw descriptive error when archive contains no ATTACH_TOR file', () => {
    const extractor = new DocumentExtractor({ storagePath: tempStorageDir });

    // Create a zip with announcement doc but no TOR file
    const zipData = zipSync({
      'announcement/notice_doc.pdf': VALID_PDF_BYTES,
      'readme.txt': strToU8('Plain text file'),
    });

    const zipBuffer = Buffer.from(zipData);

    expect(() => extractor.extractZip(zipBuffer, MOCK_PROJECT_ID)).toThrow(
      /Missing ATTACH_TOR/i,
    );
  });

  // ─── 10. Successful TOR Extraction ────────────────────────────────────────
  it('10. should extract and validate ATTACH_TOR file successfully', async () => {
    const extractor = new DocumentExtractor({ storagePath: tempStorageDir });

    // Create a zip with Attach_TOR_1.pdf and an announcement doc
    const zipData = zipSync({
      '67119538991/Attach_TOR_1.pdf': VALID_PDF_BYTES,
      '67119538991/annoudoc.pdf': VALID_PDF_BYTES,
      '67119538991/notes.txt': strToU8('Ignored non-pdf'),
    });

    const zipBuffer = Buffer.from(zipData);
    const docs = extractor.extractZip(zipBuffer, MOCK_PROJECT_ID, 'https://process5.gprocurement.go.th/download');

    expect(docs).toHaveLength(2); // Attach_TOR_1.pdf + annoudoc.pdf
    const torDoc = docs.find((d) => d.documentType === 'ATTACH_TOR');
    expect(torDoc).toBeDefined();
    expect(torDoc!.fileName).toBe('Attach_TOR_1.pdf');
    expect(torDoc!.mimeType).toBe('application/pdf');
    expect(torDoc!.content.subarray(0, 5).toString()).toBe('%PDF-');

    // Test persisting to disk
    const persistResult = await extractor.persistDocumentsToDisk(MOCK_PROJECT_ID, docs);
    expect(persistResult).toHaveLength(2);

    const savedTor = persistResult.find((r) => r.document.documentType === 'ATTACH_TOR');
    expect(savedTor).toBeDefined();
    expect(fs.existsSync(savedTor!.absolutePath)).toBe(true);

    const fileContentOnDisk = await fs.promises.readFile(savedTor!.absolutePath);
    expect(fileContentOnDisk.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('10b. should recognize Thai TOR filenames such as "ขอบเขตของงาน"', () => {
    const extractor = new DocumentExtractor({ storagePath: tempStorageDir });

    const zipData = zipSync({
      'docs/ขอบเขตของงาน_จัดซื้อระบบ.pdf': VALID_PDF_BYTES,
    });

    const docs = extractor.extractZip(Buffer.from(zipData), MOCK_PROJECT_ID);
    expect(docs).toHaveLength(1);
    expect(docs[0].documentType).toBe('ATTACH_TOR');
  });

  // ─── Security: Path Traversal Protection ──────────────────────────────────
  it('should detect and reject unsafe Zip Slip / path traversal entries', () => {
    const extractor = new DocumentExtractor({ storagePath: tempStorageDir });

    expect(() => extractor.assertSafeEntryPath('../Attach_TOR.pdf')).toThrow(
      /path traversal/i,
    );
    expect(() => extractor.assertSafeEntryPath('/etc/passwd')).toThrow(
      /path traversal/i,
    );
    expect(() => extractor.assertSafeEntryPath('folder/../../Attach_TOR.pdf')).toThrow(
      /path traversal/i,
    );
    expect(() => extractor.assertSafeEntryPath('Attach_TOR\0.pdf')).toThrow(
      /path traversal/i,
    );
  });

  // ─── Security: PDF Magic Header Validation ────────────────────────────────
  it('should reject non-PDF file disguised as .pdf', () => {
    const extractor = new DocumentExtractor({ storagePath: tempStorageDir });

    // File named Attach_TOR.pdf but containing malicious executable or HTML, not %PDF-
    const fakePdf = strToU8('<html><body>Not a PDF</body></html>');
    const zipData = zipSync({
      'Attach_TOR.pdf': fakePdf,
    });

    expect(() => extractor.extractZip(Buffer.from(zipData), MOCK_PROJECT_ID)).toThrow(
      /%PDF- header missing/i,
    );
  });
});
