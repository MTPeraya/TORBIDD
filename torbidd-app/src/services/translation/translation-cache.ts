// =============================================================================
// services/translation/translation-cache.ts
// In-memory cache for translated fields, indexed by content hash and field name
// =============================================================================

import crypto from 'crypto';

export interface CacheEntry {
  translation: string;
  field: string;
  contentHash: string;
  createdAt: number;
  expiresAt?: number;
}

export interface TranslationCacheOptions {
  /** Default time-to-live in milliseconds (default: 24 hours, 0 = no expiration) */
  defaultTtlMs?: number;
}

export class TranslationCache {
  private store: Map<string, CacheEntry> = new Map();
  private defaultTtlMs: number;

  constructor(options?: TranslationCacheOptions) {
    this.defaultTtlMs = options?.defaultTtlMs ?? 1000 * 60 * 60 * 24; // 24h
  }

  /**
   * Computes a deterministic SHA-256 hash for source content.
   */
  public static computeContentHash(content: unknown): string {
    let serialized: string;
    if (typeof content === 'string') {
      serialized = content.trim();
    } else if (content === null || content === undefined) {
      serialized = '';
    } else {
      serialized = JSON.stringify(content);
    }
    return crypto.createHash('sha256').update(serialized, 'utf8').digest('hex');
  }

  private makeKey(contentHash: string, field: string): string {
    return `${contentHash.trim()}:${field.trim()}`;
  }

  /**
   * Retrieve cached translation for a specific content hash and field.
   * Returns null if not found or expired.
   */
  public get(contentHash: string, field: string): string | null {
    if (!contentHash || !field) return null;
    const key = this.makeKey(contentHash, field);
    const entry = this.store.get(key);
    if (!entry) return null;

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.translation;
  }

  /**
   * Store translation for a specific content hash and field.
   */
  public set(contentHash: string, field: string, translation: string, ttlMs?: number): void {
    if (!contentHash || !field || translation === undefined || translation === null) return;
    const key = this.makeKey(contentHash, field);
    const now = Date.now();
    const effectiveTtl = ttlMs !== undefined ? ttlMs : this.defaultTtlMs;

    this.store.set(key, {
      contentHash: contentHash.trim(),
      field: field.trim(),
      translation,
      createdAt: now,
      expiresAt: effectiveTtl > 0 ? now + effectiveTtl : undefined,
    });
  }

  /**
   * Checks if translation exists and is valid in cache.
   */
  public has(contentHash: string, field: string): boolean {
    return this.get(contentHash, field) !== null;
  }

  /**
   * Retrieves multiple field translations for a given content hash.
   */
  public getMany(contentHash: string, fields: string[]): Record<string, string | null> {
    const results: Record<string, string | null> = {};
    for (const field of fields) {
      results[field] = this.get(contentHash, field);
    }
    return results;
  }

  /**
   * Stores multiple field translations for a content hash in one operation.
   */
  public setMany(contentHash: string, entries: Record<string, string>, ttlMs?: number): void {
    for (const [field, translation] of Object.entries(entries)) {
      this.set(contentHash, field, translation, ttlMs);
    }
  }

  /**
   * Invalidate all translations associated with a content hash.
   */
  public invalidate(contentHash: string): void {
    if (!contentHash) return;
    const prefix = `${contentHash.trim()}:`;
    for (const key of Array.from(this.store.keys())) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Invalidate a single field translation for a content hash.
   */
  public invalidateField(contentHash: string, field: string): void {
    if (!contentHash || !field) return;
    this.store.delete(this.makeKey(contentHash, field));
  }

  /**
   * Clears all cached translations.
   */
  public clear(): void {
    this.store.clear();
  }

  /**
   * Returns current number of cached entries.
   */
  public size(): number {
    return this.store.size;
  }
}

export const defaultTranslationCache = new TranslationCache();

