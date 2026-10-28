'use client';

// =============================================================================
// hooks/useBookmarks.ts - Real-Time Synchronized User Bookmarks Hook
// =============================================================================

import { useSyncExternalStore, useCallback } from 'react';
import { useToast } from '@/contexts/ToastContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ICONS } from '@/components/ui/Icons';

export const BOOKMARKS_STORAGE_KEY = 'torbidd_bookmarks';
export const BOOKMARKS_UPDATED_EVENT = 'torbidd_bookmarks_updated';

// Empty set reference for SSR & initial state
const EMPTY_SET: ReadonlySet<string | number> = new Set<string | number>();

// In-memory reactive store shared by all components across the app
let cachedBookmarks: Set<string | number> = new Set<string | number>();
let isInitialized = false;
const listeners = new Set<() => void>();

function parseStoredBookmarks(): Set<string | number> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const valid = parsed
        .map((item) => (typeof item === 'string' ? item.trim() : item))
        .filter(
          (item) =>
            item !== null &&
            item !== undefined &&
            item !== '' &&
            !Number.isNaN(item),
        );
      return new Set(valid);
    }
  } catch {
    // ignore parse error
  }
  return new Set();
}

function initStoreIfNeeded(): void {
  if (typeof window !== 'undefined' && !isInitialized) {
    cachedBookmarks = parseStoredBookmarks();
    isInitialized = true;
  }
}

function notifySubscribers(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.error('[useBookmarks] Listener callback error:', err);
    }
  });
}

export function setStoredBookmarks(newSet: Set<string | number>): void {
  cachedBookmarks = newSet;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(
        BOOKMARKS_STORAGE_KEY,
        JSON.stringify(Array.from(newSet)),
      );
      window.dispatchEvent(
        new CustomEvent(BOOKMARKS_UPDATED_EVENT, { detail: Array.from(newSet) }),
      );
    } catch (err) {
      console.error('[useBookmarks] Failed to persist to localStorage:', err);
    }
  }
  notifySubscribers();
}

// Global window event listeners (multi-tab storage sync and same-window custom events)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === BOOKMARKS_STORAGE_KEY) {
      cachedBookmarks = parseStoredBookmarks();
      notifySubscribers();
    }
  });

  window.addEventListener(BOOKMARKS_UPDATED_EVENT, () => {
    const fromStorage = parseStoredBookmarks();
    if (
      fromStorage.size !== cachedBookmarks.size ||
      Array.from(fromStorage).some((id) => !cachedBookmarks.has(id))
    ) {
      cachedBookmarks = fromStorage;
      notifySubscribers();
    }
  });
}

function subscribe(callback: () => void): () => void {
  initStoreIfNeeded();
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot(): Set<string | number> {
  initStoreIfNeeded();
  return cachedBookmarks;
}

function getServerSnapshot(): Set<string | number> {
  return EMPTY_SET as Set<string | number>;
}

export function useBookmarks() {
  const bookmarkedIds = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  let showToast: ((message: string, icon?: React.ReactNode) => void) | undefined;
  try {
    const toastContext = useToast();
    showToast = toastContext?.showToast;
  } catch {}

  let rawL: ((key: string) => string) | undefined;
  try {
    const langContext = useLanguage();
    rawL = langContext?.L;
  } catch {}

  const L = useCallback((key: string) => (rawL ? rawL(key) : key), [rawL]);

  const isBookmarked = useCallback(
    (id: number | string | undefined | null): boolean => {
      if (id === undefined || id === null || id === '' || Number.isNaN(id)) {
        return false;
      }
      if (bookmarkedIds.has(id)) return true;
      const numId = Number(id);
      if (!Number.isNaN(numId) && bookmarkedIds.has(numId)) return true;
      const strId = String(id).trim();
      if (strId && bookmarkedIds.has(strId)) return true;
      return false;
    },
    [bookmarkedIds],
  );

  const toggleBookmark = useCallback(
    (id: number | string | undefined | null, e?: React.MouseEvent): void => {
      if (e) {
        e.stopPropagation();
        e.preventDefault();
      }

      if (id === undefined || id === null || id === '' || Number.isNaN(id)) {
        return;
      }

      const current = getSnapshot();
      const next = new Set(current);

      const numId = Number(id);
      const strId = String(id).trim();

      const isPresent =
        next.has(id) ||
        (!Number.isNaN(numId) && next.has(numId)) ||
        (Boolean(strId) && next.has(strId));

      if (isPresent) {
        next.delete(id);
        if (!Number.isNaN(numId)) next.delete(numId);
        if (strId) next.delete(strId);
        setStoredBookmarks(next);
        showToast?.(L('bookmarkRemoved'), ICONS.bookmark);
      } else {
        next.add(id);
        setStoredBookmarks(next);
        showToast?.(L('bookmarkAdded'), ICONS.bookmarkFilled);
      }
    },
    [L, showToast],
  );

  const clearBookmarks = useCallback((): void => {
    setStoredBookmarks(new Set());
    showToast?.(L('bookmarkRemoved'), ICONS.bookmark);
  }, [L, showToast]);

  return {
    bookmarkedIds,
    toggleBookmark,
    isBookmarked,
    bookmarkCount: bookmarkedIds.size,
    clearBookmarks,
  };
}
