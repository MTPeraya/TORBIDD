'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Language } from '@/types/settings';
import { LABELS, LabelKey } from '@/lib/labels';

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

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('th');

  useEffect(() => {
    const saved = localStorage.getItem('torbidd_lang') as Language;
    if (saved === 'th' || saved === 'en') {
      setLanguageState(saved);
      document.documentElement.lang = saved;
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('torbidd_lang', lang);
    document.documentElement.lang = lang;
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
    if (language === 'en' && obj.en) return obj.en;
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
