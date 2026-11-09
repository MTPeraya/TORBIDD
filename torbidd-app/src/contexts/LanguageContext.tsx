'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language } from '@/types/settings';
import { LABELS, LabelKey } from '@/lib/labels';
import { translateDepartment, translateProjectTitle } from '@/services/translation/dictionary';

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: (lang: Language) => void;
  L: (key: LabelKey | string) => string;
  getLocalized: (
    obj: { th: string; en: string } | { th: string[]; en: string[] } | string | string[] | undefined
  ) => string | string[];
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

/** Read the torbidd_locale cookie set by middleware for URL-based locale routing */
function getLocaleCookie(): Language | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)torbidd_locale=([^;]+)/);
  const val = match?.[1];
  return val === 'th' || val === 'en' ? val : null;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    // Priority: 1) Browser URL pathname prefix (/th/... or /en/...)
    //           2) URL-based locale cookie (set by middleware)
    //           3) localStorage preference
    //           4) default 'th'
    if (typeof window !== 'undefined') {
      const pathMatch = window.location.pathname.match(/^\/(th|en)(\/|$)/);
      if (pathMatch) {
        const urlLang = pathMatch[1] as Language;
        document.documentElement.lang = urlLang;
        return urlLang;
      }
      const localeCookie = getLocaleCookie();
      if (localeCookie) {
        document.documentElement.lang = localeCookie;
        return localeCookie;
      }
      const saved = localStorage.getItem('torbidd_lang') as Language;
      if (saved === 'th' || saved === 'en') {
        document.documentElement.lang = saved;
        return saved;
      }
    }
    return 'th';
  });

  // Sync state if browser back/forward button is pressed
  useEffect(() => {
    const handlePopState = () => {
      const pathMatch = window.location.pathname.match(/^\/(th|en)(\/|$)/);
      if (pathMatch) {
        const urlLang = pathMatch[1] as Language;
        setLanguageState(urlLang);
        document.documentElement.lang = urlLang;
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('torbidd_lang', lang);
      document.cookie = `torbidd_locale=${lang}; path=/; max-age=31536000; SameSite=Lax`;
      document.documentElement.lang = lang;

      // Update URL to match new locale: e.g. /th/historical -> /en/historical
      const currentPath = window.location.pathname;
      const currentSearch = window.location.search;
      const stripped = currentPath.replace(/^\/(th|en)(\/|$)/, '/').replace(/\/$/, '') || '/';
      const newPath = `/${lang}${stripped === '/' ? '' : stripped}${currentSearch}`;
      if (window.location.pathname !== newPath) {
        window.history.pushState(null, '', newPath);
      }
    }
  };

  const toggleLanguage = (lang: Language) => {
    setLanguage(lang);
  };

  const L = (key: LabelKey | string): string => {
    const langDict = LABELS[language] as Record<string, string>;
    return langDict[key] || (LABELS.th as Record<string, string>)[key] || key;
  };

  const getLocalized = (
    obj: { th: string; en: string } | { th: string[]; en: string[] } | string | string[] | undefined
  ): string | string[] => {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    if (Array.isArray(obj)) return obj;
    if (language === 'en') {
      if (typeof obj === 'object') {
        if ('en' in obj && obj.en && (!Array.isArray(obj.en) ? obj.en.trim() !== '' : obj.en.length > 0)) {
          // If en is not identical to th, or if th is not Thai
          return obj.en;
        }
        if ('th' in obj && typeof obj.th === 'string') {
          // Automatic translation fallback for Thai text missing English translation
          return translateDepartment(obj.th) || translateProjectTitle(obj.th) || obj.th;
        }
      }
    }
    if (obj.th) return obj.th;
    return '';
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, L, getLocalized }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return ctx;
}
