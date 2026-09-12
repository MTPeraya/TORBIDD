// =============================================================================
// services/ingestion/clients/egp-client.ts - National e-GP Client
// =============================================================================

import { EgpArchiveMetadata } from '@/types/procurement';

const DEFAULT_EGP_ORIGIN = 'https://process5.gprocurement.go.th';
const METADATA_PATH = '/egp-approval-service/apv-common/infoProcureDocAnnounZipTemp';
const DOWNLOAD_PATH = '/egp-upload-service/v1/downloadFileTest';
const PROJECT_ID_PATTERN = /^\d{11}$/;
const MAX_ARCHIVE_BYTES = 100 * 1024 * 1024; // 100MB download limit

export interface EgpClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
}

export interface EgpDownloadResult {
  metadata: EgpArchiveMetadata;
  zipBuffer: Buffer;
  contentLength: number;
}

/**
 * EgpClient - Connects to process5.gprocurement.go.th to retrieve procurement ZIP packages.
 */
export class EgpClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly requestTimeoutMs: number;

  public constructor(options: EgpClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? process.env.EGP_BASE_URL ?? DEFAULT_EGP_ORIGIN).replace(/\/+$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.requestTimeoutMs = options.requestTimeoutMs ?? (Number(process.env.REQUEST_TIMEOUT_MS) || 60_000);
  }

  /**
   * Validate that the project ID is an 11-digit numeric string.
   */
  public assertProjectId(projectId: string): void {
    if (!projectId || !PROJECT_ID_PATTERN.test(projectId.trim())) {
      throw new Error(`e-GP Project ID must contain exactly 11 numeric digits, got: '${projectId}'`);
    }
  }

  /**
   * Fetch archive metadata (zipId and filename) for a given Project ID from e-GP.
   */
  public async getArchiveMetadata(projectId: string): Promise<EgpArchiveMetadata> {
    const cleanId = projectId.trim();
    this.assertProjectId(cleanId);

    const url = new URL(`${this.baseUrl}${METADATA_PATH}`);
    url.searchParams.set('projectId', cleanId);

    let response: Response;
    try {
      response = await this.fetchImpl(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          noToken: 'noToken',
          noDataProfile: 'noDataProfile',
        },
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`e-GP metadata request failed for project ${cleanId}: ${msg}`);
    }

    if (!response.ok) {
      throw new Error(`e-GP metadata request failed with status ${response.status} for project ${cleanId}`);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error(`e-GP returned invalid JSON metadata for project ${cleanId}`);
    }

    // Check payload structure
    const payloadRecord = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : null;
    const data = payloadRecord && typeof payloadRecord.data === 'object' && payloadRecord.data !== null
      ? (payloadRecord.data as Record<string, unknown>)
      : null;

    if (!data) {
      throw new Error(`e-GP has no document metadata available for project ${cleanId}`);
    }

    const zipId = typeof data.zipId === 'string' ? data.zipId : '';
    const archiveName = typeof data.buildName1 === 'string' ? data.buildName1 : `${cleanId}.zip`;

    if (!zipId || zipId.trim().length === 0) {
      throw new Error(`No downloadable archive (missing zipId) found in e-GP for project ${cleanId}`);
    }

    return {
      zipId: zipId.trim(),
      archiveName: archiveName.trim(),
      projectId: cleanId,
    };
  }

  /**
   * Download the ZIP document package from e-GP using the fileId (zipId).
   */
  public async downloadArchive(metadata: EgpArchiveMetadata): Promise<EgpDownloadResult> {
    const url = new URL(`${this.baseUrl}${DOWNLOAD_PATH}`);
    url.searchParams.set('fileId', metadata.zipId);

    let response: Response;
    try {
      response = await this.fetchImpl(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/zip, application/octet-stream',
        },
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`e-GP download connection failed for zipId ${metadata.zipId}: ${msg}`);
    }

    if (!response.ok) {
      throw new Error(`e-GP download failed with status ${response.status} for project ${metadata.projectId}`);
    }

    const headerLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(headerLength) && headerLength > MAX_ARCHIVE_BYTES) {
      throw new Error(`e-GP ZIP archive exceeds maximum safe limit of ${MAX_ARCHIVE_BYTES} bytes`);
    }

    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await response.arrayBuffer();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed reading e-GP ZIP payload: ${msg}`);
    }

    const zipBuffer = Buffer.from(arrayBuffer);

    if (zipBuffer.length > MAX_ARCHIVE_BYTES) {
      throw new Error(`e-GP ZIP archive is too large: ${zipBuffer.length} bytes`);
    }

    // Validate ZIP magic header: PK\x03\x04 or PK\x05\x06 (empty) or starts with 'PK' (0x50, 0x4b)
    if (zipBuffer.length < 4 || zipBuffer[0] !== 0x50 || zipBuffer[1] !== 0x4b) {
      throw new Error(`Downloaded file from e-GP is not a valid ZIP archive for project ${metadata.projectId}`);
    }

    return {
      metadata,
      zipBuffer,
      contentLength: zipBuffer.length,
    };
  }

  /**
   * High-level method: Get metadata and download ZIP package in one step.
   */
  public async fetchProjectZip(projectId: string): Promise<EgpDownloadResult> {
    const metadata = await this.getArchiveMetadata(projectId);
    return this.downloadArchive(metadata);
  }
}
