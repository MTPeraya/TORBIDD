'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/contexts/ToastContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ICONS } from '@/components/ui/Icons';

export function useBookmarks() {
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<number>>(new Set());
  const { showToast } = useToast();
  const { L } = useLanguage();

  // Load saved bookmarks from localStorage on mount (and optionally sync with API)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('torbidd_bookmarks');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setBookmarkedIds(new Set(parsed));
        }
      }
    } catch {
      // ignore JSON parse error
    }
  }, []);

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
    [showToast, L]
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
