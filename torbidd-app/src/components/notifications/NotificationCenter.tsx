'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/contexts/ToastContext';
import { ICONS } from '@/components/ui/Icons';
import { NotificationFeed } from './NotificationFeed';
import { NotificationPreferencesPanel } from './NotificationPreferencesPanel';
import { NotificationItem, NotificationPreferences } from '@/types/notification';

export function NotificationCenter() {
  const { L } = useLanguage();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'feed' | 'preferences'>('feed');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences | undefined>(undefined);

  // Fetch notifications for manual retry or demo triggers
  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) {
        throw new Error('Failed to load notifications from server');
      }
      const json = await res.json();
      setNotifications(json.data || []);
      setUnreadCount(json.unreadCount ?? 0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    let ignore = false;

    fetch('/api/notifications')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load notifications'))))
      .then((json) => {
        if (!ignore) {
          setNotifications(json.data || []);
          setUnreadCount(json.unreadCount ?? 0);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : String(err));
          setIsLoading(false);
        }
      });

    fetch('/api/notifications/preferences')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!ignore && json?.data) {
          setPreferences(json.data);
        }
      })
      .catch(() => {
        if (!ignore) {
          try {
            const saved = localStorage.getItem('torbidd_settings');
            if (saved) setPreferences(JSON.parse(saved));
          } catch {}
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  // Mark an individual notification as read
  const handleMarkAsRead = async (id: string) => {
    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'markRead', id }),
      });
    } catch (err) {
      console.warn('[NotificationCenter] Failed to persist read status:', err);
    }
  };

  // Mark all notifications as read
  const handleMarkAllAsRead = async () => {
    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })),
    );
    setUnreadCount(0);

    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'markAllRead' }),
      });
      showToast(L('markAllRead'), ICONS.check);
    } catch (err) {
      console.warn('[NotificationCenter] Failed to mark all as read:', err);
    }
  };

  // Delete an individual notification
  const handleDelete = async (id: string) => {
    const target = notifications.find((n) => n.id === id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (target && !target.isRead) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.warn('[NotificationCenter] Failed to delete notification:', err);
    }
  };

  // Trigger test/demo evaluation
  const handleTriggerDemo = async () => {
    try {
      const res = await fetch('/api/notifications/trigger-evaluation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'demo_seed' }),
      });
      if (res.ok) {
        showToast(L('triggerDemoNotifs'), ICONS.check);
        await fetchNotifications();
      }
    } catch {
      showToast(L('errorLoadingNotifs'), ICONS.alertTriangle, 'error');
    }
  };

  return (
    <div className="page-content notif-center-page">
      {/* Header */}
      <div className="page-header">
        <div className="notif-header-top">
          <div>
            <h1 className="page-title">{L('notificationCenterTitle')}</h1>
            <p className="page-subtitle">{L('notificationCenterSub')}</p>
          </div>

          {/* Tab Switcher */}
          <div className="notif-tabs" role="tablist">
            <button
              type="button"
              id="notifTabFeed"
              className={`notif-tab-btn ${activeTab === 'feed' ? 'active' : ''}`}
              onClick={() => setActiveTab('feed')}
              role="tab"
              aria-selected={activeTab === 'feed'}
            >
              <span className="notif-tab-icon">{ICONS.bell}</span>
              <span>{L('tabNotifications')}</span>
              {unreadCount > 0 && <span className="notif-tab-badge">{unreadCount}</span>}
            </button>

            <button
              type="button"
              id="notifTabPrefs"
              className={`notif-tab-btn ${activeTab === 'preferences' ? 'active' : ''}`}
              onClick={() => setActiveTab('preferences')}
              role="tab"
              aria-selected={activeTab === 'preferences'}
            >
              <span className="notif-tab-icon">{ICONS.dashboard}</span>
              <span>{L('tabPreferences')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="notif-main-area">
        {activeTab === 'feed' ? (
          <NotificationFeed
            notifications={notifications}
            unreadCount={unreadCount}
            isLoading={isLoading}
            error={error}
            onMarkAsRead={handleMarkAsRead}
            onMarkAllAsRead={handleMarkAllAsRead}
            onDelete={handleDelete}
            onRetry={fetchNotifications}
            onTriggerDemo={handleTriggerDemo}
          />
        ) : (
          <NotificationPreferencesPanel
            initialPreferences={preferences}
            onPreferencesSaved={(saved) => setPreferences(saved)}
          />
        )}
      </div>
    </div>
  );
}
