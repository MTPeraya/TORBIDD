// =============================================================================
// services/ingestion/document-extractor.ts - Secure ZIP Decompression & TOR Extractor
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { unzipSync, UnzipFileInfo } from 'fflate';
import { ExtractedDocument, DocumentType } from '@/types/procurement';

// Regex patterns to identify TOR files inside Thai government archives
// Matches: "Attach_TOR.pdf", "Attach_TOR_1.pdf", "TOR.pdf", "01_TOR_software.pdf", "ขอบเขตของงาน.pdf", etc.
const TOR_FILE_PATTERN = /(?:^|[_\W])(?:attach[_-]?tor|tor)(?:[_\W]|$)|ขอบเขต.*งาน/iu;
const ANNOUNCEMENT_PATTERN = /annou|ประกาศ/iu;

// Security limits against zip bombs & malicious archives
const MAX_ARCHIVE_ENTRIES = 500;
const MAX_ENTRY_BYTES = 100 * 1024 * 1024; // 100 MB per entry
const MAX_TOTAL_UNCOMPRESSED_BYTES = 500 * 1024 * 1024; // 500 MB total
const MAX_COMPRESSION_RATIO = 500; // 500:1 ratio limit

export interface DocumentExtractorOptions {
  storagePath?: string;
}

export class DocumentExtractor {
  private readonly storagePath: string;

  public constructor(options: DocumentExtractorOptions = {}) {
    this.storagePath =
      options.storagePath ??
      process.env.DOCUMENT_STORAGE_PATH ??
      path.join(process.cwd(), 'storage', 'documents');
  }

  /**
   * Validate archive path to prevent directory traversal attacks (Zip Slip).
   */
  public assertSafeEntryPath(entryName: string): void {
    const normalized = entryName.replaceAll('\\', '/');
    const segments = normalized.split('/');

    if (
      normalized.includes('\0') ||
      normalized.startsWith('/') ||
      /^[a-zA-Z]:/.test(normalized) ||
      segments.includes('..') ||
      segments.some((s) => s.trim() === '..')
    ) {
      throw new Error(`Suspicious or unsafe path traversal detected in ZIP entry: ${entryName}`);
    }
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

      // Validate PDF magic bytes: %PDF- (0x25, 0x50, 0x44, 0x46, 0x2D)
      if (buffer.length < 5 || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
        throw new Error(`Extracted document candidate '${baseName}' is not a valid PDF (%PDF- header missing)`);
      }

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
    const projectDir = path.join(this.storagePath, projectId);
    await fs.promises.mkdir(projectDir, { recursive: true });

    const results = [];
    for (const doc of documents) {
      const safeFileName = path.basename(doc.fileName);
      const filePath = path.join(projectDir, safeFileName);
      await fs.promises.writeFile(filePath, doc.content);

      // Relative path for database portability
      const relativePath = path.join('storage', 'documents', projectId, safeFileName);

      results.push({
        document: doc,
        relativePath,
        absolutePath: filePath,
      });
    }

    return results;
  }
}
