'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { ICONS } from '@/components/ui/Icons';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  bookmarkCount: number;
}

/** Strip /th or /en locale prefix to get the canonical path */
function stripLocale(path: string): string {
  return path.replace(/^\/(th|en)(\/|$)/, '/').replace(/\/$/, '') || '/';
}

/** Get the locale prefix from a path, e.g. '/th/historical' → 'th' */
function getLocaleFromPath(path: string): 'th' | 'en' | null {
  const m = path.match(/^\/(th|en)(\/|$)/);
  return m ? (m[1] as 'th' | 'en') : null;
}

export function Sidebar({ collapsed, onToggle, bookmarkCount }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { language, setLanguage, L } = useLanguage();
  const { isAuthenticated, isAdmin } = useAuth();

  // Canonical path (without locale prefix) for active state detection
  const canonicalPath = stripLocale(pathname);
  // Current locale from URL (may differ from LanguageContext state briefly on first render)
  const urlLocale = getLocaleFromPath(pathname);

  const isHome = canonicalPath === '/';
  const isDashboard = canonicalPath === '/opportunities' || canonicalPath.startsWith('/opportunities/');
  const isHistorical = canonicalPath === '/historical';
  const isSaved = canonicalPath === '/saved';
  const isAdminRoute = canonicalPath === '/admin' || canonicalPath.startsWith('/admin/');

  /** Navigate to the same page in the given locale using URL-based routing */
  const switchLocale = (newLocale: 'th' | 'en') => {
    setLanguage(newLocale);
    // Navigate to /<locale>/<canonical-path> so the URL reflects the language
    const target = `/${newLocale}${canonicalPath === '/' ? '' : canonicalPath}`;
    router.push(target);
  };

  // Locale-aware hrefs — if currently on a locale-prefixed URL, preserve the prefix
  const localePrefix = urlLocale ? `/${urlLocale}` : '';

  const toggleTooltip = collapsed
    ? (L('expandSidebar') || 'Expand sidebar')
    : (L('collapseSidebar') || 'Collapse sidebar');

  // Active locale for language toggle button UI
  const activeLang = language;

  return (
    <aside
      className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}
      aria-label="Application Sidebar"
    >
      <div className="sidebar-brand">
        <Link
          href="/"
          className="sidebar-brand-logo"
          data-tooltip={collapsed ? L('navHome') : undefined}
          aria-label={L('appName')}
        >
          <div className="sidebar-brand-icon">B</div>
          <div className="sidebar-brand-text">
            <div className="sidebar-brand-name">{L('appName')}</div>
            <div className="sidebar-brand-sub">{L('appSub')}</div>
          </div>
        </Link>
        <button
          className="sidebar-toggle-btn"
          onClick={onToggle}
          title={toggleTooltip}
          aria-label={toggleTooltip}
          data-tooltip={collapsed ? toggleTooltip : undefined}
          id="sidebarToggleBtn"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            {collapsed ? (
              <polyline points="9 18 15 12 9 6" />
            ) : (
              <>
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">
          <span className="sidebar-link-label">{L('sectionMain')}</span>
        </div>

        <Link
          href={`${localePrefix}/`}
          className={`sidebar-link ${isHome ? 'active' : ''}`}
          data-tooltip={L('navHome')}
        >
          {ICONS.home}
          <span className="sidebar-link-label">{L('navHome')}</span>
        </Link>

        <Link
          href={`${localePrefix}/opportunities`}
          className={`sidebar-link ${isDashboard ? 'active' : ''}`}
          data-tooltip={L('navDashboard')}
        >
          {ICONS.dashboard}
          <span className="sidebar-link-label">{L('navDashboard')}</span>
        </Link>

        <Link
          href={`${localePrefix}/historical`}
          className={`sidebar-link ${isHistorical ? 'active' : ''}`}
          data-tooltip={L('navHistorical')}
        >
          {ICONS.chart}
          <span className="sidebar-link-label">{L('navHistorical')}</span>
        </Link>

        <Link
          href={`${localePrefix}/saved`}
          className={`sidebar-link ${isSaved ? 'active' : ''}`}
          data-tooltip={L('navSaved')}
        >
          {ICONS.bookmark}
          <span className="sidebar-link-label">{L('navSaved')}</span>
          {bookmarkCount > 0 && <span className="sidebar-badge">{bookmarkCount}</span>}
        </Link>

        {isAuthenticated && isAdmin && (
          <>
            <div className="sidebar-section-label sidebar-section-tools">
              <span className="sidebar-link-label">{L('sectionTools')}</span>
            </div>

            <Link
              href={`${localePrefix}/admin`}
              className={`sidebar-link ${isAdminRoute ? 'active' : ''}`}
              data-tooltip={L('navAdmin')}
              id="sidebarAdminLink"
            >
              {ICONS.shield}
              <span className="sidebar-link-label">{L('navAdmin')}</span>
              {!collapsed && (
                <span
                  className="sidebar-badge"
                  style={{
                    background: 'rgba(59, 130, 246, 0.15)',
                    color: '#3b82f6',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                  }}
                >
                  ADMIN
                </span>
              )}
            </Link>
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        {/* Language Switcher — switches URL locale prefix + LanguageContext */}
        <div
          className="sidebar-lang-switch"
          style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.5rem' }}
          data-tooltip={collapsed ? (activeLang === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย') : undefined}
          aria-label="Language switcher"
        >
          <button
            type="button"
            onClick={() => switchLocale('th')}
            aria-pressed={activeLang === 'th'}
            style={{
              flex: 1,
              padding: '0.25rem 0.4rem',
              borderRadius: '0.4rem',
              border: `1px solid ${activeLang === 'th' ? 'var(--color-primary, #6366f1)' : 'rgba(255,255,255,0.12)'}`,
              background: activeLang === 'th' ? 'var(--color-primary, #6366f1)' : 'transparent',
              color: activeLang === 'th' ? '#fff' : 'var(--color-text-secondary, rgba(255,255,255,0.5))',
              fontSize: '0.7rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {collapsed ? 'ไทย' : 'ไทย'}
          </button>
          <button
            type="button"
            onClick={() => switchLocale('en')}
            aria-pressed={activeLang === 'en'}
            style={{
              flex: 1,
              padding: '0.25rem 0.4rem',
              borderRadius: '0.4rem',
              border: `1px solid ${activeLang === 'en' ? 'var(--color-primary, #6366f1)' : 'rgba(255,255,255,0.12)'}`,
              background: activeLang === 'en' ? 'var(--color-primary, #6366f1)' : 'transparent',
              color: activeLang === 'en' ? '#fff' : 'var(--color-text-secondary, rgba(255,255,255,0.5))',
              fontSize: '0.7rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {collapsed ? 'EN' : 'EN'}
          </button>
        </div>
        <span className="sidebar-link-label">© 2026 TORBIDD Systems</span>
      </div>
    </aside>
  );
}
