'use client';

import React, { useState, useRef, useEffect, useSyncExternalStore, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ICONS } from '@/components/ui/Icons';

interface ProfileData {
  name: string;
  org: string;
  avatar: string | null;
}

const emptyProfile: ProfileData = { name: '', org: '', avatar: null };

function subscribeProfile(callback: () => void) {
  window.addEventListener('torbidd_profile_updated', callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener('torbidd_profile_updated', callback);
    window.removeEventListener('storage', callback);
  };
}

function getProfileSnapshot(): string {
  try {
    return localStorage.getItem('torbidd_profile') ?? '';
  } catch {
    return '';
  }
}

function getProfileServerSnapshot(): string {
  return '';
}

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { language, setLanguage, L } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on route change without setState in effect
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setDropdownOpen(false);
  }

  // Profile data synced from localStorage via useSyncExternalStore
  const profileRaw = useSyncExternalStore(
    subscribeProfile,
    getProfileSnapshot,
    getProfileServerSnapshot
  );

  const profile = useMemo<ProfileData>(() => {
    if (!profileRaw) return emptyProfile;
    try {
      const p = JSON.parse(profileRaw);
      return { name: p.name ?? '', org: p.org ?? '', avatar: p.avatar ?? null };
    } catch {
      return emptyProfile;
    }
  }, [profileRaw]);

  const initials = profile.name
    ? profile.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'BM';

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  const getPageCrumb = () => {
    if (pathname === '/') return null;
    if (pathname.startsWith('/opportunities/')) return L('projectDetail');
    if (pathname === '/opportunities') return L('navDashboard');
    if (pathname === '/historical') return L('navHistorical');
    if (pathname === '/saved') return L('navSaved');
    if (pathname === '/notifications') return L('navSettings');
    if (pathname === '/settings') return L('navProfile');
    if (pathname === '/admin' || pathname.startsWith('/admin')) return L('navAdmin');
    return null;
  };

  const crumb = getPageCrumb();

  const handleLogout = () => {
    setDropdownOpen(false);
    // Clear any local session data
    localStorage.removeItem('torbidd_settings');
    router.push('/');
  };

  return (
    <header className="topbar">
      <div className="topbar-breadcrumb">
        {crumb ? (
          <>
            <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
              <span>{L('breadcrumbHome')}</span>
            </Link>
            {ICONS.chevronRight}
            <span className="active-crumb">{crumb}</span>
          </>
        ) : (
          <span className="active-crumb">{L('breadcrumbHome')}</span>
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

        {/* User avatar with dropdown */}
        <div className="topbar-user-menu" ref={dropdownRef}>
          <button
            type="button"
            className={`topbar-avatar ${dropdownOpen ? 'active' : ''}`}
            id="userAvatarBtn"
            onClick={() => setDropdownOpen((prev) => !prev)}
            aria-haspopup="true"
            aria-expanded={dropdownOpen}
            title="User menu"
          >
            {profile.avatar ? (
              <img src={profile.avatar} alt="avatar" className="topbar-avatar-img" />
            ) : initials}
          </button>

          {dropdownOpen && (
            <div className="user-dropdown" id="userDropdownMenu" role="menu">
              <div className="user-dropdown-header">
                <div className="user-dropdown-avatar">
                  {profile.avatar ? (
                    <img src={profile.avatar} alt="avatar" className="topbar-avatar-img" />
                  ) : initials}
                </div>
                <div className="user-dropdown-info">
                  <div className="user-dropdown-name">{profile.name || 'BMA Officer'}</div>
                  <div className="user-dropdown-role">{profile.org || 'กรุงเทพมหานคร'}</div>
                </div>
              </div>

              <div className="user-dropdown-divider" />

              <Link
                href="/admin"
                className="user-dropdown-item"
                id="dropdownAdminLink"
                role="menuitem"
                onClick={() => setDropdownOpen(false)}
              >
                {ICONS.shield}
                <span>{L('navAdmin')}</span>
              </Link>

              <Link
                href="/settings"
                className="user-dropdown-item"
                id="dropdownProfileLink"
                role="menuitem"
                onClick={() => setDropdownOpen(false)}
              >
                {ICONS.user}
                <span>{L('navProfile')}</span>
              </Link>

              <Link
                href="/notifications"
                className="user-dropdown-item"
                id="dropdownNotifLink"
                role="menuitem"
                onClick={() => setDropdownOpen(false)}
              >
                {ICONS.bell}
                <span>{L('navSettings')}</span>
              </Link>


              <div className="user-dropdown-divider" />

              <button
                type="button"
                className="user-dropdown-item user-dropdown-logout"
                id="dropdownLogoutBtn"
                role="menuitem"
                onClick={handleLogout}
              >
                {ICONS.arrowLeft}
                <span>{L('navLogout')}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
