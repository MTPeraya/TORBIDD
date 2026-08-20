'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ICONS } from '@/components/ui/Icons';

export function Topbar() {
  const pathname = usePathname();
  const { language, setLanguage, L } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const getPageCrumb = () => {
    if (pathname === '/') return null;
    if (pathname.startsWith('/opportunities/')) return L('projectDetail');
    if (pathname === '/opportunities') return L('navDashboard');
    if (pathname === '/historical') return L('navHistorical');
    if (pathname === '/saved') return L('navSaved');
    if (pathname === '/notifications') return L('navSettings');
    return null;
  };

  const crumb = getPageCrumb();

  return (
    <header className="topbar">
      <div className="topbar-breadcrumb">
        <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
          <span>{L('breadcrumbHome')}</span>
        </Link>
        {crumb && (
          <>
            {ICONS.chevronRight}
            <span className="active-crumb">{crumb}</span>
          </>
        )}
      </div>

      <div className="topbar-spacer"></div>

      <div className="topbar-actions">
        {/* Language selector */}
        <div className="lang-toggle" style={{ marginRight: 8 }}>
          <button
            type="button"
            className={`lang-btn ${language === 'th' ? 'active' : ''}`}
            onClick={() => setLanguage('th')}
          >
            TH
          </button>
          <button
            type="button"
            className={`lang-btn ${language === 'en' ? 'active' : ''}`}
            onClick={() => setLanguage('en')}
          >
            EN
          </button>
        </div>

        {/* Theme toggle */}
        <button
          type="button"
          className="topbar-icon-btn"
          id="themeToggleBtn"
          onClick={toggleTheme}
          title={theme === 'dark' ? L('lightMode') : L('darkMode')}
        >
          {theme === 'dark' ? ICONS.sun : ICONS.moon}
        </button>

        {/* Notifications button */}
        <Link href="/notifications" className="topbar-icon-btn" title={L('navSettings')}>
          {ICONS.bell}
          <span className="notif-dot"></span>
        </Link>

        {/* User avatar */}
        <div className="topbar-avatar" title="BMA Officer">
          BM
        </div>
      </div>
    </header>
  );
}
