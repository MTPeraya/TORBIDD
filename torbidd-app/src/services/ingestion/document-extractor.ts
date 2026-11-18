// =============================================================================
// services/ingestion/document-extractor.ts - Secure ZIP Decompression & TOR Extractor
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { unzipSync, UnzipFileInfo } from 'fflate';
import { ExtractedDocument, DocumentType } from '@/types/procurement';
import { getIngestionConfig } from '@/lib/config';
import {
  assertNoPathTraversal,
  assertHashedPdfStorageKey,
  assertPrivateStorageRoot,
  assertRealPathWithinRoot,
  MAX_PDF_BYTES,
  resolvePrivatePath,
  validatePdfBuffer,
} from '@/lib/secure-pdf';

// Regex patterns to identify TOR files inside Thai government archives
// Matches: "Attach_TOR.pdf", "Attach_TOR_1.pdf", "TOR.pdf", "01_TOR_software.pdf", "ขอบเขตของงาน.pdf", etc.
const TOR_FILE_PATTERN = /(?:^|[_\W])(?:attach[_-]?tor|tor)(?:[_\W]|$)|ขอบเขต.*งาน/iu;
const ANNOUNCEMENT_PATTERN = /annou|ประกาศ/iu;

// Security limits against zip bombs & malicious archives
const MAX_ARCHIVE_ENTRIES = 500;
const MAX_ENTRY_BYTES = MAX_PDF_BYTES;
const MAX_TOTAL_UNCOMPRESSED_BYTES = MAX_PDF_BYTES;
const MAX_COMPRESSION_RATIO = 500; // 500:1 ratio limit

export interface DocumentExtractorOptions {
  storagePath?: string;
}

export class DocumentExtractor {
  private readonly storagePath: string;

  public constructor(options: DocumentExtractorOptions = {}) {
    this.storagePath = assertPrivateStorageRoot(
      options.storagePath ?? getIngestionConfig().resolvedStoragePath,
    );
  }

  /**
   * Validate archive path to prevent directory traversal attacks (Zip Slip).
   */
  public assertSafeEntryPath(entryName: string): void {
    assertNoPathTraversal(entryName, 'ZIP entry path');
  }

  /**
   * Check if filename corresponds to a TOR document.
   */
  public isTorFileName(fileName: string): boolean {
    const base = path.posix.basename(fileName.replaceAll('\\', '/'));
    return base.toLowerCase().endsWith('.pdf') && TOR_FILE_PATTERN.test(base);
  }

  /**
   * Classify document type based on filename.
   */
  public classifyDocumentType(fileName: string): DocumentType {
    const base = path.posix.basename(fileName.replaceAll('\\', '/'));
    if (this.isTorFileName(base)) return 'ATTACH_TOR';
    if (ANNOUNCEMENT_PATTERN.test(base)) return 'ANNOUNCEMENT';
    return 'OTHER';
  }

  /**
   * Extract all safe files from a ZIP buffer and filter for valid TOR & announcement PDFs.
   */
  public extractZip(zipBuffer: Buffer, projectId: string, sourceUrlBase = ''): ExtractedDocument[] {
    if (!zipBuffer || zipBuffer.length < 4 || zipBuffer[0] !== 0x50 || zipBuffer[1] !== 0x4b) {
      throw new Error(`Invalid ZIP archive provided for project ${projectId}: invalid magic signature`);
    }

    let entryCount = 0;
    let totalUncompressedBytes = 0;
    const projectCleanId = projectId.trim();

    let unzipped: Record<string, Uint8Array>;
    try {
      unzipped = unzipSync(new Uint8Array(zipBuffer), {
        filter: (entry: UnzipFileInfo) => {
          entryCount += 1;
          if (entryCount > MAX_ARCHIVE_ENTRIES) {
            throw new Error(`ZIP contains too many entries (exceeds ${MAX_ARCHIVE_ENTRIES})`);
          }

          this.assertSafeEntryPath(entry.name);
          totalUncompressedBytes += entry.originalSize;

          if (entry.originalSize > MAX_ENTRY_BYTES) {
            throw new Error(`ZIP entry exceeds maximum safe size (${MAX_ENTRY_BYTES} bytes): ${entry.name}`);
          }

          if (totalUncompressedBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
            throw new Error(`ZIP expands beyond maximum safe decompression limit (${MAX_TOTAL_UNCOMPRESSED_BYTES} bytes)`);
          }

          const ratio = entry.size === 0 ? Infinity : entry.originalSize / entry.size;
          if (entry.originalSize > 1024 && ratio > MAX_COMPRESSION_RATIO) {
            throw new Error(`ZIP entry has suspicious compression ratio (${ratio.toFixed(1)}:1): ${entry.name}`);
          }

          // Only keep PDF files
          const lowerName = entry.name.toLowerCase();
          return lowerName.endsWith('.pdf');
        },
      });
    } catch (unzipErr: unknown) {
      const msg = unzipErr instanceof Error ? unzipErr.message : String(unzipErr);
      throw new Error(`Failed to extract ZIP archive for project ${projectCleanId}: ${msg}`);
    }

    const entries = Object.entries(unzipped);
    if (entries.length === 0) {
      // Check if the original zip was empty or had no PDFs
      throw new Error(`No PDF documents found in archive for project ${projectCleanId}`);
    }

    const documents: ExtractedDocument[] = [];

    for (const [entryPath, rawContent] of entries) {
      const baseName = path.posix.basename(entryPath.replaceAll('\\', '/'));
      const buffer = Buffer.from(rawContent);

      // Validate extension, 25 MB cap, magic bytes, and disallowed active content.
      validatePdfBuffer(buffer, { fileName: baseName });

      const docType = this.classifyDocumentType(baseName);

      documents.push({
        fileName: baseName,
        mimeType: 'application/pdf',
        content: buffer,
        documentType: docType,
        sourceUrl: `${sourceUrlBase}#entry=${encodeURIComponent(entryPath)}`,
        fileSize: buffer.length,
      });
    }

    // Ensure at least one ATTACH_TOR document exists
    const hasTor = documents.some((d) => d.documentType === 'ATTACH_TOR');
    if (!hasTor) {
      throw new Error(
        `Missing ATTACH_TOR: Archive for project ${projectCleanId} does not contain any TOR document matching '${TOR_FILE_PATTERN}'`,
      );
    }

    return documents;
  }

  /**
   * Save extracted documents to local disk storage and return disk paths.
   */
  public async persistDocumentsToDisk(
    projectId: string,
    documents: ExtractedDocument[],
  ): Promise<Array<{ document: ExtractedDocument; relativePath: string; absolutePath: string }>> {
    assertNoPathTraversal(projectId, 'project ID');
    const projectDir = resolvePrivatePath(this.storagePath, projectId);
    await fs.promises.mkdir(projectDir, { recursive: true });
    await assertRealPathWithinRoot(this.storagePath, projectDir);

    const results = [];
    for (const doc of documents) {
      const { storageKey } = validatePdfBuffer(doc.content, { fileName: doc.fileName });
      assertHashedPdfStorageKey(storageKey);
      const filePath = resolvePrivatePath(this.storagePath, projectId, storageKey);
      try {
        await fs.promises.writeFile(filePath, doc.content, { flag: 'wx', mode: 0o600 });
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
      }

      // Relative path for database portability
      const relativePath = path.relative(process.cwd(), filePath);

      results.push({
        document: doc,
        relativePath,
        absolutePath: filePath,
      });
    }

    return results;
  }
}
