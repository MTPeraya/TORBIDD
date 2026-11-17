// =============================================================================
// lib/secure-pdf.ts - Shared security boundary for untrusted procurement PDFs
// =============================================================================

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const MAX_PDF_BYTES = 25 * 1024 * 1024;
export const MAX_PDF_BASE64_LENGTH = Math.ceil(MAX_PDF_BYTES / 3) * 4;

const PDF_MAGIC = Buffer.from('%PDF-', 'ascii');
const HASHED_PDF_NAME = /^tor_[a-f0-9]{64}\.pdf$/;
const ACTIVE_PDF_TOKENS = [
  '/JavaScript',
  '/JS',
  '/Launch',
  '/EmbeddedFile',
  '/RichMedia',
  '/OpenAction',
  '/AA',
  '/XFA',
  '/SubmitForm',
  '/ImportData',
];

export type PdfSecurityCode =
  | 'INVALID_EXTENSION'
  | 'INVALID_MAGIC'
  | 'MALICIOUS_CONTENT'
  | 'PATH_TRAVERSAL'
  | 'PRIVATE_STORAGE_REQUIRED'
  | 'TOO_LARGE';

export class PdfSecurityError extends Error {
  public constructor(
    message: string,
    public readonly code: PdfSecurityCode,
  ) {
    super(message);
    this.name = 'PdfSecurityError';
  }
}

function decodedVariants(value: string): string[] {
  const variants = [value];
  let decoded = value;

  for (let i = 0; i < 2; i += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      variants.push(next);
      decoded = next;
    } catch {
      break;
    }
  }

  return variants;
}

/** Reject literal and encoded traversal before any filesystem operation. */
export function assertNoPathTraversal(value: string, label = 'path'): void {
  for (const variant of decodedVariants(value)) {
    const normalized = variant.replaceAll('\\', '/');
    const segments = normalized.split('/');
    if (
      normalized.includes('\0') ||
      normalized.includes('\r') ||
      normalized.includes('\n') ||
      normalized.startsWith('/') ||
      /^[a-zA-Z]:/.test(normalized) ||
      segments.some((segment) => segment.trim() === '..')
    ) {
      throw new PdfSecurityError(`Unsafe ${label}: path traversal is not allowed`, 'PATH_TRAVERSAL');
    }
  }
}

export function assertPdfExtension(fileName: string): void {
  assertNoPathTraversal(fileName, 'PDF filename');
  const normalized = decodedVariants(fileName).at(-1)!.replaceAll('\\', '/');
  const baseName = path.posix.basename(normalized);

  if (baseName !== normalized || path.posix.extname(baseName).toLowerCase() !== '.pdf') {
    throw new PdfSecurityError('Only files with a .pdf extension are permitted', 'INVALID_EXTENSION');
  }
}

/**
 * Lightweight, fail-closed scan for active PDF features that procurement TORs
 * do not require. This supplements (and does not replace) infrastructure AV.
 */
export function scanPdfForMaliciousContent(buffer: Buffer): void {
  const source = buffer.toString('latin1');
  const detected = ACTIVE_PDF_TOKENS.find((token) => source.includes(token));
  if (detected) {
    throw new PdfSecurityError(
      `PDF contains a disallowed active-content feature (${detected})`,
      'MALICIOUS_CONTENT',
    );
  }
}

export function validatePdfBuffer(
  buffer: Buffer,
  options: { fileName?: string; scan?: boolean } = {},
): { contentHash: string; storageKey: string } {
  if (options.fileName) assertPdfExtension(options.fileName);

  if (buffer.length > MAX_PDF_BYTES) {
    throw new PdfSecurityError(
      `PDF exceeds the ${MAX_PDF_BYTES} byte (25 MB) limit`,
      'TOO_LARGE',
    );
  }
  if (buffer.length < PDF_MAGIC.length || !buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
    throw new PdfSecurityError('PDF magic bytes are invalid (%PDF- header missing)', 'INVALID_MAGIC');
  }
  if (options.scan !== false) scanPdfForMaliciousContent(buffer);

  const contentHash = crypto.createHash('sha256').update(buffer).digest('hex');
  return { contentHash, storageKey: `tor_${contentHash}.pdf` };
}

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

export function assertPrivateStorageRoot(storageRoot: string): string {
  const resolvedRoot = path.resolve(storageRoot);
  const publicRoot = path.resolve(process.cwd(), 'public');
  const comparableRoot = fs.existsSync(resolvedRoot) ? fs.realpathSync(resolvedRoot) : resolvedRoot;
  const comparablePublic = fs.existsSync(publicRoot) ? fs.realpathSync(publicRoot) : publicRoot;

  if (isWithin(comparablePublic, comparableRoot)) {
    throw new PdfSecurityError(
      'Procurement document storage must be outside the public web root',
      'PRIVATE_STORAGE_REQUIRED',
    );
  }

  return resolvedRoot;
}

export async function assertRealPathWithinRoot(storageRoot: string, candidate: string): Promise<void> {
  const root = await fs.promises.realpath(assertPrivateStorageRoot(storageRoot));
  const realCandidate = await fs.promises.realpath(candidate);
  if (!isWithin(root, realCandidate)) {
    throw new PdfSecurityError('Document path escapes private storage', 'PATH_TRAVERSAL');
  }
}

export function resolvePrivatePath(storageRoot: string, ...segments: string[]): string {
  const root = assertPrivateStorageRoot(storageRoot);
  for (const segment of segments) assertNoPathTraversal(segment);
  const resolved = path.resolve(root, ...segments);

  if (!isWithin(root, resolved)) {
    throw new PdfSecurityError('Resolved document path escapes private storage', 'PATH_TRAVERSAL');
  }
  return resolved;
}

export function assertHashedPdfStorageKey(storageKey: string): void {
  if (!HASHED_PDF_NAME.test(storageKey)) {
    throw new PdfSecurityError('Invalid PDF storage key', 'PATH_TRAVERSAL');
  }
}

export async function readValidatedPdfFile(
  filePath: string,
  storageRoot?: string,
): Promise<Buffer> {
  if (filePath.replaceAll('\\', '/').split('/').some((segment) => segment === '..')) {
    throw new PdfSecurityError('PDF path traversal is not allowed', 'PATH_TRAVERSAL');
  }
  const resolved = path.resolve(filePath);
  const publicRoot = path.resolve(process.cwd(), 'public');
  const realResolved = await fs.promises.realpath(resolved);
  const comparablePublic = fs.existsSync(publicRoot) ? await fs.promises.realpath(publicRoot) : publicRoot;

  if (storageRoot) {
    await assertRealPathWithinRoot(storageRoot, realResolved);
  } else if (isWithin(comparablePublic, realResolved)) {
    throw new PdfSecurityError('PDF path must be outside the public web root', 'PRIVATE_STORAGE_REQUIRED');
  }

  const stat = await fs.promises.stat(realResolved);
  if (!stat.isFile()) throw new PdfSecurityError('PDF path is not a file', 'INVALID_EXTENSION');
  if (stat.size > MAX_PDF_BYTES) {
    throw new PdfSecurityError('PDF exceeds the 25 MB limit', 'TOO_LARGE');
  }

  const buffer = await fs.promises.readFile(realResolved);
  validatePdfBuffer(buffer, { fileName: path.basename(realResolved) });
  return buffer;
}

/** Read a Fetch response without buffering an unbounded body in memory. */
export async function readResponseWithLimit(
  response: Response,
  maxBytes: number,
  label: string,
): Promise<Buffer> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new PdfSecurityError(`${label} exceeds the ${maxBytes} byte limit`, 'TOO_LARGE');
  }

  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new PdfSecurityError(`${label} exceeds the ${maxBytes} byte limit`, 'TOO_LARGE');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, total);
}

/** RFC 6266 disposition using an application-controlled, CRLF-safe filename. */
export function pdfContentDisposition(projectId: string, disposition: 'inline' | 'attachment' = 'inline'): string {
  const safeId = projectId.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80) || 'document';
  const fileName = `TOR_${safeId}.pdf`;
  return `${disposition}; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

