'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { ICONS } from '@/components/ui/Icons';
import { NotificationItem, NotificationType, NotificationPriority } from '@/types/notification';

interface NotificationCardProps {
  notification: NotificationItem;
  onMarkAsRead: (id: string) => void;
  onDelete?: (id: string) => void;
}

function formatRelativeTime(dateString: Date | string, lang: 'th' | 'en'): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) {
    return lang === 'th' ? 'เมื่อสักครู่' : 'Just now';
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return lang === 'th' ? `${diffMin} นาทีที่แล้ว` : `${diffMin}m ago`;
  }
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) {
    return lang === 'th' ? `${diffHour} ชั่วโมงที่แล้ว` : `${diffHour}h ago`;
  }
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) {
    return lang === 'th' ? `${diffDay} วันที่แล้ว` : `${diffDay}d ago`;
  }
  return date.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function getTypeMeta(type: NotificationType, lang: 'th' | 'en') {
  switch (type) {
    case 'PROCUREMENT_MATCHED':
      return {
        label: lang === 'th' ? 'โอกาสใหม่ตรงใจ' : 'New Opportunity',
        icon: ICONS.check,
        tagClass: 'badge-matched',
      };
    case 'PROCUREMENT_UPDATED':
    case 'STATUS_CHANGED':
      return {
        label: lang === 'th' ? 'อัปเดตข้อมูล' : 'Saved Update',
        icon: ICONS.clock,
        tagClass: 'badge-updated',
      };
    case 'TOR_UPDATED':
      return {
        label: lang === 'th' ? 'แก้ไข TOR' : 'TOR Revised',
        icon: ICONS.download,
        tagClass: 'badge-tor',
      };
    case 'DEADLINE_APPROACHING':
      return {
        label: lang === 'th' ? 'ใกล้ครบกำหนด' : 'Deadline',
        icon: ICONS.alertTriangle,
        tagClass: 'badge-deadline',
      };
    default:
      return {
        label: lang === 'th' ? 'การแจ้งเตือน' : 'Alert',
        icon: ICONS.bell,
        tagClass: 'badge-default',
      };
  }
}

function getPriorityBadge(priority: NotificationPriority, lang: 'th' | 'en') {
  if (priority === 'URGENT') {
    return (
      <span className="notif-priority-badge notif-priority-urgent">
        {lang === 'th' ? 'ด่วน' : 'Urgent'}
      </span>
    );
  }
  if (priority === 'HIGH') {
    return (
      <span className="notif-priority-badge notif-priority-high">
        {lang === 'th' ? 'สำคัญ' : 'High'}
      </span>
    );
  }
  return null;
}

export function NotificationCard({ notification, onMarkAsRead, onDelete }: NotificationCardProps) {
  const { language, L } = useLanguage();
  const typeMeta = getTypeMeta(notification.type, language);
  const timeFormatted = formatRelativeTime(notification.createdAt, language);

  const title =
    typeof notification.title === 'object'
      ? notification.title[language] || notification.title.th || notification.title.en
      : notification.title;

  const message =
    typeof notification.message === 'object'
      ? notification.message[language] || notification.message.th || notification.message.en
      : notification.message;

  const changedFields = notification.metadata?.changedFields;

  return (
    <div
      className={`notif-card ${!notification.isRead ? 'notif-unread' : 'notif-read'}`}
      data-id={notification.id}
    >
      {!notification.isRead && <span className="notif-unread-indicator" title={L('unreadBadge')} />}

      <div className="notif-card-header">
        <div className="notif-type-cluster">
          <span className={`notif-type-tag ${typeMeta.tagClass}`}>
            <span className="notif-type-icon">{typeMeta.icon}</span>
            <span>{typeMeta.label}</span>
          </span>
          {getPriorityBadge(notification.priority, language)}
        </div>

        <div className="notif-card-meta">
          <span className="notif-timestamp">{timeFormatted}</span>
          {!notification.isRead && (
            <button
              type="button"
              className="notif-action-btn"
              onClick={() => onMarkAsRead(notification.id)}
              title={L('markAsRead')}
              aria-label={L('markAsRead')}
            >
              {ICONS.check}
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="notif-action-btn notif-action-delete"
              onClick={() => onDelete(notification.id)}
              title={L('deleteNotif')}
              aria-label={L('deleteNotif')}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="notif-card-body">
        <h3 className="notif-title">
          <Link
            href={notification.linkUrl}
            onClick={() => {
              if (!notification.isRead) onMarkAsRead(notification.id);
            }}
          >
            {title}
          </Link>
        </h3>
        <p className="notif-message">{message}</p>

        {changedFields && changedFields.length > 0 && (
          <div className="notif-diff-chips">
            {changedFields.map((field, idx) => {
              const label = field.fieldLabel[language] || field.fieldLabel.th;
              return (
                <span key={idx} className="notif-diff-chip">
                  <span className="notif-diff-chip-name">{label}:</span>{' '}
                  <span className="notif-diff-chip-val">{String(field.newValue ?? '')}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      <div className="notif-card-footer">
        <Link
          href={notification.linkUrl}
          className="notif-detail-link"
          onClick={() => {
            if (!notification.isRead) onMarkAsRead(notification.id);
          }}
        >
          <span>{L('viewOpportunity')}</span>
        </Link>
      </div>
    </div>
  );
}
