'use client';

import React, { createContext, useContext } from 'react';
import { Theme } from '@/types/settings';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      document.body.classList.remove('dark-mode');
      localStorage.removeItem('torbidd_theme');
    }
  }, []);

  const toggleTheme = () => {
    // Dark mode removed: locked to light mode
    if (typeof window !== 'undefined') {
      document.body.classList.remove('dark-mode');
      localStorage.removeItem('torbidd_theme');
    }
  };

  return (
    <ThemeContext.Provider value={{ theme: 'light', toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
