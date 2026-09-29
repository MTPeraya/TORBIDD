/**
 * @jest-environment node
 */
// =============================================================================
// lib/__tests__/config.test.ts
// Tests: Configuration validation, default values, directory auto-creation
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getIngestionConfig, ensureStorageDirectoryExists } from '../config';

describe('Config Module & Environment Validation', () => {
  let tempTestDir: string;

  beforeEach(async () => {
    tempTestDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'torbidd-cfg-test-'));
  });

  afterEach(async () => {
    if (tempTestDir && fs.existsSync(tempTestDir)) {
      await fs.promises.rm(tempTestDir, { recursive: true, force: true });
    }
  });

  it('should load default configuration values when env is empty', () => {
    const config = getIngestionConfig({});

    expect(config.govspendingApiKey).toBe('');
    expect(config.govspendingBaseUrl).toBe('https://opend.data.go.th/govspending/service/egp-contract');
    expect(config.egpBaseUrl).toBe('https://process5.gprocurement.go.th');
    expect(config.bmaBaseUrl).toBe('http://egp2.bangkok.go.th');
    expect(config.requestTimeoutMs).toBe(15000);
    expect(config.documentStoragePath).toBe('./storage/documents');
    expect(config.resolvedStoragePath).toBeDefined();
  });

  it('should parse and apply custom environment variables', () => {
    const customStorage = path.join(tempTestDir, 'custom_docs');
    const mockEnv = {
      GOVSPENDING_API_KEY: 'test-custom-key',
      GOVSPENDING_BASE_URL: 'https://opend.data.go.th/govspending/service/egp-contract',
      EGP_BASE_URL: 'https://process5.gprocurement.go.th',
      REQUEST_TIMEOUT_MS: '25000',
      DOCUMENT_STORAGE_PATH: customStorage,
    };

    const config = getIngestionConfig(mockEnv);

    expect(config.govspendingApiKey).toBe('test-custom-key');
    expect(config.requestTimeoutMs).toBe(25000);
    expect(config.resolvedStoragePath).toBe(customStorage);
    expect(fs.existsSync(customStorage)).toBe(true);
  });

  it('should automatically create storage directory if it does not exist', () => {
    const targetDir = path.join(tempTestDir, 'nested', 'storage', 'tor_files');
    expect(fs.existsSync(targetDir)).toBe(false);

    const resolved = ensureStorageDirectoryExists(targetDir);

    expect(resolved).toBe(targetDir);
    expect(fs.existsSync(targetDir)).toBe(true);
  });

  it('should throw validation error if base URL is malformed', () => {
    const invalidEnv = {
      GOVSPENDING_BASE_URL: 'not-a-valid-url',
    };

    expect(() => getIngestionConfig(invalidEnv)).toThrow();
  });
});
