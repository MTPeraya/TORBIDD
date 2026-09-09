'use client';

import { useState, useCallback } from 'react';
import { useToast } from '@/contexts/ToastContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ICONS } from '@/components/ui/Icons';

export function useBookmarks() {
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<number>>(() => {
    // Initialize from localStorage on first render ('use client' guarantees window exists)
    try {
      const saved = localStorage.getItem('torbidd_bookmarks');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return new Set<number>(parsed);
      }
    } catch {
      // ignore JSON parse error
    }
    return new Set<number>();
  });

  const { showToast } = useToast();
  const { L } = useLanguage();

  const toggleBookmark = useCallback(
    (id: number, e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation();
        e.preventDefault();
      }

      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
          localStorage.setItem('torbidd_bookmarks', JSON.stringify(Array.from(next)));
          showToast(L('bookmarkRemoved'), ICONS.bookmark);
        } else {
          next.add(id);
          localStorage.setItem('torbidd_bookmarks', JSON.stringify(Array.from(next)));
          showToast(L('bookmarkAdded'), ICONS.bookmarkFilled);
        }
        return next;
      });
    },
    // showToast and L are stable references from context — safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const isBookmarked = useCallback(
    (id: number) => bookmarkedIds.has(id),
    [bookmarkedIds]
  );

  return {
    bookmarkedIds,
    toggleBookmark,
    isBookmarked,
    bookmarkCount: bookmarkedIds.size,
  };
}
