'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useBookmarks } from '@/hooks/useBookmarks';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();
  const { bookmarkCount } = useBookmarks();

  const isHome = pathname === '/';
  const mainClass = `main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${
    isHome ? 'home-bg' : ''
  }`;

  return (
    <div className="app-layout" id="app">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((prev) => !prev)}
        bookmarkCount={bookmarkCount}
      />
      <div className={mainClass}>
        <Topbar />
        {children}
      </div>
    </div>
  );
}
