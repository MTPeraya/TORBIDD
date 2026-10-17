import { renderHook, act } from '@testing-library/react';
import {
  useBookmarks,
  BOOKMARKS_STORAGE_KEY,
  setStoredBookmarks,
} from '../useBookmarks';

describe('useBookmarks hook', () => {
  beforeEach(() => {
    act(() => {
      localStorage.clear();
      setStoredBookmarks(new Set());
    });
  });

  afterEach(() => {
    act(() => {
      localStorage.clear();
      setStoredBookmarks(new Set());
    });
  });

  it('initializes with count 0 when localStorage is empty', () => {
    const { result } = renderHook(() => useBookmarks());
    expect(result.current.bookmarkCount).toBe(0);
    expect(result.current.isBookmarked(101)).toBe(false);
  });

  it('updates bookmarkCount in real-time across multiple instances', () => {
    // Simulate AppShell and ProjectCard rendered concurrently
    const { result: appShellHook } = renderHook(() => useBookmarks());
    const { result: cardHook } = renderHook(() => useBookmarks());

    expect(appShellHook.current.bookmarkCount).toBe(0);
    expect(cardHook.current.bookmarkCount).toBe(0);

    // Toggle bookmark on the card
    act(() => {
      cardHook.current.toggleBookmark(101);
    });

    // Both hooks must immediately reflect the update in real-time
    expect(cardHook.current.isBookmarked(101)).toBe(true);
    expect(cardHook.current.bookmarkCount).toBe(1);
    expect(appShellHook.current.bookmarkCount).toBe(1);
    expect(appShellHook.current.isBookmarked(101)).toBe(true);

    // Toggle off on the card
    act(() => {
      cardHook.current.toggleBookmark(101);
    });

    // Both hooks must decrement immediately
    expect(cardHook.current.isBookmarked(101)).toBe(false);
    expect(cardHook.current.bookmarkCount).toBe(0);
    expect(appShellHook.current.bookmarkCount).toBe(0);
  });

  it('handles string and number IDs interchangeably', () => {
    const { result } = renderHook(() => useBookmarks());

    act(() => {
      result.current.toggleBookmark('67119538991');
    });

    // Check with number or string
    expect(result.current.isBookmarked('67119538991')).toBe(true);
    expect(result.current.isBookmarked(67119538991)).toBe(true);
    expect(result.current.bookmarkCount).toBe(1);

    // Toggle off using number
    act(() => {
      result.current.toggleBookmark(67119538991);
    });

    expect(result.current.isBookmarked('67119538991')).toBe(false);
    expect(result.current.bookmarkCount).toBe(0);
  });

  it('persists changes to localStorage', () => {
    const { result } = renderHook(() => useBookmarks());

    act(() => {
      result.current.toggleBookmark(202);
    });

    const stored = JSON.parse(localStorage.getItem(BOOKMARKS_STORAGE_KEY) || '[]');
    expect(stored).toContain(202);

    act(() => {
      result.current.toggleBookmark(202);
    });

    const storedAfter = JSON.parse(localStorage.getItem(BOOKMARKS_STORAGE_KEY) || '[]');
    expect(storedAfter).not.toContain(202);
  });

  it('clearBookmarks clears all bookmarks in real time', () => {
    const { result: hook1 } = renderHook(() => useBookmarks());
    const { result: hook2 } = renderHook(() => useBookmarks());

    act(() => {
      hook1.current.toggleBookmark(1);
      hook1.current.toggleBookmark(2);
    });

    expect(hook1.current.bookmarkCount).toBe(2);
    expect(hook2.current.bookmarkCount).toBe(2);

    act(() => {
      hook2.current.clearBookmarks();
    });

    expect(hook1.current.bookmarkCount).toBe(0);
    expect(hook2.current.bookmarkCount).toBe(0);
    expect(JSON.parse(localStorage.getItem(BOOKMARKS_STORAGE_KEY) || '[]')).toEqual([]);
  });

  it('syncs across tabs via storage event', () => {
    const { result } = renderHook(() => useBookmarks());
    expect(result.current.bookmarkCount).toBe(0);

    act(() => {
      localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify([505]));
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: BOOKMARKS_STORAGE_KEY,
          newValue: JSON.stringify([505]),
        }),
      );
    });

    expect(result.current.bookmarkCount).toBe(1);
    expect(result.current.isBookmarked(505)).toBe(true);
  });
});
