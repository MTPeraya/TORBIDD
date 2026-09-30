'use client';

import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { ICONS } from '@/components/ui/Icons';
import { NotificationCard } from './NotificationCard';
import { NotificationItem } from '@/types/notification';

interface NotificationFeedProps {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  onMarkAsRead: (id: string) => Promise<void>;
  onMarkAllAsRead: () => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onRetry: () => void;
  onTriggerDemo?: () => Promise<void>;
}

type FilterCategory = 'all' | 'unread' | 'matched' | 'updates' | 'deadlines';

export function NotificationFeed({
  notifications,
  unreadCount,
  isLoading,
  error,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  onRetry,
  onTriggerDemo,
}: NotificationFeedProps) {
  const { L } = useLanguage();
  const [filter, setFilter] = useState<FilterCategory>('all');
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  // Filter items based on active pill
  const filteredNotifications = notifications.filter((item) => {
    if (filter === 'unread') return !item.isRead;
    if (filter === 'matched') return item.type === 'PROCUREMENT_MATCHED';
    if (filter === 'updates')
      return (
        item.type === 'PROCUREMENT_UPDATED' ||
        item.type === 'STATUS_CHANGED' ||
        item.type === 'TOR_UPDATED'
      );
    if (filter === 'deadlines') return item.type === 'DEADLINE_APPROACHING';
    return true;
  });

  const handleMarkAll = async () => {
    setIsMarkingAll(true);
    try {
      await onMarkAllAsRead();
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handleDemoTrigger = async () => {
    if (!onTriggerDemo) return;
    setIsGeneratingDemo(true);
    try {
      await onTriggerDemo();
    } finally {
      setIsGeneratingDemo(false);
    }
  };

  return (
    <div className="notif-feed-container">
      {/* Feed Controls Header */}
      <div className="notif-feed-controls">
        <div className="notif-filter-pills" role="tablist">
          <button
            type="button"
            className={`notif-pill ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            <span>{L('filterAllNotifs')}</span>
            <span className="notif-pill-count">{notifications.length}</span>
          </button>

          <button
            type="button"
            className={`notif-pill ${filter === 'unread' ? 'active' : ''}`}
            onClick={() => setFilter('unread')}
          >
            <span>{L('filterUnreadNotifs')}</span>
            {unreadCount > 0 && <span className="notif-pill-badge">{unreadCount}</span>}
          </button>

          <button
            type="button"
            className={`notif-pill ${filter === 'matched' ? 'active' : ''}`}
            onClick={() => setFilter('matched')}
          >
            <span>{L('filterMatchedNotifs')}</span>
          </button>

          <button
            type="button"
            className={`notif-pill ${filter === 'updates' ? 'active' : ''}`}
            onClick={() => setFilter('updates')}
          >
            <span>{L('filterUpdateNotifs')}</span>
          </button>

          <button
            type="button"
            className={`notif-pill ${filter === 'deadlines' ? 'active' : ''}`}
            onClick={() => setFilter('deadlines')}
          >
            <span>{L('filterDeadlineNotifs')}</span>
          </button>
        </div>

        <div className="notif-header-actions">
          {unreadCount > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleMarkAll}
              disabled={isMarkingAll}
              id="markAllReadBtn"
            >
              {ICONS.check}
              <span>{isMarkingAll ? '...' : L('markAllRead')}</span>
            </button>
          )}

          {onTriggerDemo && (
            <button
              type="button"
              className="btn btn-secondary btn-sm notif-demo-btn"
              onClick={handleDemoTrigger}
              disabled={isGeneratingDemo}
              title={L('triggerDemoNotifs')}
            >
              <span className="notif-demo-sparkle">✨</span>
              <span>{isGeneratingDemo ? L('generatingDemo') : L('triggerDemoNotifs')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="notif-skeleton-list" aria-busy="true">
          {[1, 2, 3].map((n) => (
            <div key={n} className="notif-skeleton-card">
              <div className="skeleton-line skeleton-badge" />
              <div className="skeleton-line skeleton-title" />
              <div className="skeleton-line skeleton-desc" />
              <div className="skeleton-line skeleton-footer" />
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <div className="notif-error-state">
          <div className="notif-error-icon">{ICONS.alertTriangle}</div>
          <h3 className="notif-error-title">{L('errorLoadingNotifs')}</h3>
          <p className="notif-error-desc">{error}</p>
          <button type="button" className="btn btn-primary" onClick={onRetry}>
            <span>{L('retryLoading')}</span>
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredNotifications.length === 0 && (
        <div className="notif-empty-state">
          <div className="notif-empty-icon">{ICONS.bell}</div>
          <h3 className="notif-empty-title">{L('noNotifications')}</h3>
          <p className="notif-empty-desc">{L('noNotificationsDesc')}</p>
          {onTriggerDemo && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleDemoTrigger}
              disabled={isGeneratingDemo}
            >
              <span className="notif-demo-sparkle">✨</span>
              <span>{isGeneratingDemo ? L('generatingDemo') : L('triggerDemoNotifs')}</span>
            </button>
          )}
        </div>
      )}

      {/* Notifications List */}
      {!isLoading && !error && filteredNotifications.length > 0 && (
        <div className="notif-cards-list">
          {filteredNotifications.map((notif) => (
            <NotificationCard
              key={notif.id}
              notification={notif}
              onMarkAsRead={onMarkAsRead}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
