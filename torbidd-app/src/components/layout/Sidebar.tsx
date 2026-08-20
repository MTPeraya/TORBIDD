'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { ICONS } from '@/components/ui/Icons';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  bookmarkCount: number;
}

export function Sidebar({ collapsed, onToggle, bookmarkCount }: SidebarProps) {
  const pathname = usePathname();
  const { L } = useLanguage();

  const isHome = pathname === '/';
  const isDashboard = pathname === '/opportunities' || pathname.startsWith('/opportunities/');
  const isHistorical = pathname === '/historical';
  const isSaved = pathname === '/saved';
  const isNotifications = pathname === '/notifications';

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="sidebar-brand">
        <Link href="/" className="sidebar-brand-logo">
          <div className="sidebar-brand-icon">B</div>
          <div className="sidebar-brand-text">
            <div className="sidebar-brand-name">{L('appName')}</div>
            <div className="sidebar-brand-sub">{L('appSub')}</div>
          </div>
        </Link>
        <button
          className="sidebar-toggle-btn"
          onClick={onToggle}
          title="Toggle sidebar"
          id="sidebarToggleBtn"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">
          <span className="sidebar-link-label">{L('sectionMain')}</span>
        </div>

        <Link
          href="/"
          className={`sidebar-link ${isHome ? 'active' : ''}`}
          data-tooltip={L('navHome')}
        >
          {ICONS.home}
          <span className="sidebar-link-label">{L('navHome')}</span>
        </Link>

        <Link
          href="/opportunities"
          className={`sidebar-link ${isDashboard ? 'active' : ''}`}
          data-tooltip={L('navDashboard')}
        >
          {ICONS.dashboard}
          <span className="sidebar-link-label">{L('navDashboard')}</span>
        </Link>

        <Link
          href="/historical"
          className={`sidebar-link ${isHistorical ? 'active' : ''}`}
          data-tooltip={L('navHistorical')}
        >
          {ICONS.chart}
          <span className="sidebar-link-label">{L('navHistorical')}</span>
        </Link>

        <Link
          href="/saved"
          className={`sidebar-link ${isSaved ? 'active' : ''}`}
          data-tooltip={L('navSaved')}
        >
          {ICONS.bookmark}
          <span className="sidebar-link-label">{L('navSaved')}</span>
          {bookmarkCount > 0 && <span className="sidebar-badge">{bookmarkCount}</span>}
        </Link>

        <div className="sidebar-section-label">
          <span className="sidebar-link-label">{L('sectionTools')}</span>
        </div>

        <Link
          href="/notifications"
          className={`sidebar-link ${isNotifications ? 'active' : ''}`}
          data-tooltip={L('navSettings')}
        >
          {ICONS.bell}
          <span className="sidebar-link-label">{L('navSettings')}</span>
        </Link>
      </nav>

      <div className="sidebar-footer">
        <span className="sidebar-link-label">© 2026 TORBIDD Systems</span>
      </div>
    </aside>
  );
}
