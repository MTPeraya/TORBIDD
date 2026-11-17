'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language } from '@/types/settings';
import { LABELS, LabelKey } from '@/lib/labels';
import { translateDepartment, translateProjectTitle, translateProcurementType } from '@/services/translation/dictionary';

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

    // If obj is a plain string
    if (typeof obj === 'string') {
      if (language === 'en' && /[\u0E00-\u0E7F]/.test(obj)) {
        const trimmed = obj.trim();
        // If it looks like a project title:
        if (
          trimmed.startsWith('โครงการ') ||
          trimmed.includes('พัฒนาระบบ') ||
          trimmed.includes('จัดซื้อ') ||
          trimmed.includes('จ้าง')
        ) {
          const proj = translateProjectTitle(trimmed);
          if (proj && proj !== trimmed && !/[\u0E00-\u0E7F]/.test(proj)) return proj;
        }
        // Try department translation
        const dept = translateDepartment(trimmed);
        if (dept && dept !== trimmed && !/[\u0E00-\u0E7F]/.test(dept)) return dept;
        // Try procurement type
        const proc = translateProcurementType(trimmed);
        if (proc && proc !== trimmed && !/[\u0E00-\u0E7F]/.test(proc)) return proc;
        // Fallback project title
        const proj = translateProjectTitle(trimmed);
        if (proj && proj !== trimmed && !/[\u0E00-\u0E7F]/.test(proj)) return proj;
      }
      return obj;
    }

    // If obj is an array of strings
    if (Array.isArray(obj)) {
      if (language === 'en') {
        return obj.map((item) => {
          if (typeof item === 'string' && /[\u0E00-\u0E7F]/.test(item)) {
            return translateDepartment(item) || translateProjectTitle(item) || item;
          }
          return item;
        });
      }
      return obj;
    }

    // If obj is a bilingual object { th, en }
    if (typeof obj === 'object') {
      if (language === 'en') {
        if ('en' in obj && obj.en) {
          if (Array.isArray(obj.en)) {
            if (obj.en.length > 0) return obj.en;
          } else if (typeof obj.en === 'string' && obj.en.trim() !== '') {
            const enVal = obj.en.trim();
            const thVal = typeof obj.th === 'string' ? obj.th.trim() : '';
            const isThai = /[\u0E00-\u0E7F]/.test(enVal);
            const isSameAsTh = enVal === thVal;
            if (!isThai && !isSameAsTh) {
              return enVal;
            }
          }
        }

        // Automatic fallback: translate obj.th to English
        if ('th' in obj) {
          if (Array.isArray(obj.th)) {
            return obj.th;
          }
          if (typeof obj.th === 'string') {
            const thVal = obj.th.trim();
            // If it looks like a project title:
            if (
              thVal.startsWith('โครงการ') ||
              thVal.includes('พัฒนาระบบ') ||
              thVal.includes('จัดซื้อ') ||
              thVal.includes('จ้าง')
            ) {
              const proj = translateProjectTitle(thVal);
              if (proj && !/[\u0E00-\u0E7F]/.test(proj)) return proj;
            }
            // Check department
            const dept = translateDepartment(thVal);
            if (dept && !/[\u0E00-\u0E7F]/.test(dept)) return dept;
            // Check procurement type
            const proc = translateProcurementType(thVal);
            if (proc && !/[\u0E00-\u0E7F]/.test(proc)) return proc;
            // Fallback project title
            const proj = translateProjectTitle(thVal);
            if (proj && !/[\u0E00-\u0E7F]/.test(proj)) return proj;
            return thVal;
          }
        }
      }

      if ('th' in obj && obj.th) return obj.th;
    }

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
