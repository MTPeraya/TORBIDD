'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';

export interface SyncStatusData {
  lastSuccessfulSyncAt?: string;
  lastAttemptAt?: string;
  lastSyncAt: string;
  nextSyncAt: string;
  syncIntervalHours: number;
  triggerType?: 'manual' | 'scheduled';
  recordsSyncedCount?: number;
  health?: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  status: 'idle' | 'syncing' | 'success' | 'error';
  totalDiscovered: number;
  lastDiscoveredCount: number;
  lastError: string | null;
  source?: string;
}

interface LiveSyncBarProps {
  onSyncComplete?: () => void;
  activeFilter?: 'all' | 'live' | 'bma';
  onFilterChange?: (filter: 'all' | 'live' | 'bma') => void;
}

export function LiveSyncBar({
  onSyncComplete,
  activeFilter = 'all',
  onFilterChange,
}: LiveSyncBarProps) {
  const { language } = useLanguage();
  const { isAuthenticated, isAdmin } = useAuth();
  const [syncStatus, setSyncStatus] = useState<SyncStatusData | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchStatus = () => {
    fetch('/api/ingestion/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.status) {
          setSyncStatus(json.status);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // refresh status every 30s
    return () => clearInterval(interval);
  }, []);

  const handleSyncNow = async () => {
    if (!isAuthenticated || !isAdmin) {
      setMessage(
        language === 'th'
          ? '⚠️ เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถสั่งการซิงค์ข้อมูลได้'
          : '⚠️ Only administrators can trigger manual data synchronization',
      );
      setTimeout(() => setMessage(null), 4000);
      return;
    }

    setIsSyncing(true);
    setMessage(
      language === 'th'
        ? 'กำลังเชื่อมต่อและดึงข้อมูลสดจาก Open Government Data (CKAN)...'
        : 'Connecting and fetching live data from CKAN / e-GP...',
    );

    try {
      const res = await fetch('/api/ingestion/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: 'ซอฟต์แวร์', limit: 20 }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setMessage(
          language === 'th'
            ? `✓ อัปเดตข้อมูลสดสำเร็จ! บันทึกโครงการจัดซื้อจัดจ้าง ${json.total || json.projects?.length || 0} รายการ`
            : `✓ Live sync successful! Synced ${json.total || json.projects?.length || 0} procurement projects`,
        );
        if (json.syncStatus) {
          setSyncStatus(json.syncStatus);
        }
        if (onSyncComplete) {
          onSyncComplete();
        }
      } else {
        setMessage(
          language === 'th'
            ? `⚠️ แจ้งเตือน: ${json.message || 'ไม่สามารถเชื่อมต่อ CKAN ได้ในขณะนี้ กำลังแสดงข้อมูลล่าสุด'}`
            : `⚠️ Notice: ${json.message || 'CKAN unavailable, displaying latest cached data'}`,
        );
      }
    } catch {
      setMessage(
        language === 'th'
          ? '⚠️ การเชื่อมต่อขัดข้อง กำลังแสดงข้อมูลที่บันทึกไว้ล่าสุด'
          : '⚠️ Connection timeout, displaying latest cached data',
      );
    } finally {
      setIsSyncing(false);
      setTimeout(() => setMessage(null), 6000);
      fetchStatus();
    }
  };

  const formatTimestamp = (isoString?: string) => {
    if (!isoString) return language === 'th' ? 'เพิ่งอัปเดต' : 'Just now';
    try {
      const date = new Date(isoString);
      return date.toLocaleString(language === 'th' ? 'th-TH' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const isHealthy = syncStatus?.health !== 'DEGRADED' && syncStatus?.status !== 'error';
  const displaySyncTime = syncStatus?.lastSuccessfulSyncAt || syncStatus?.lastSyncAt;

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(244, 249, 252, 0.95) 100%)',
        border: '1px solid rgba(39, 115, 165, 0.2)',
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 24,
        boxShadow: '0 4px 16px rgba(22, 69, 102, 0.06)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        {/* Left: Live Status & Accuracy Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 280 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: isHealthy ? '#e8f5ef' : '#fef2f2',
                color: isHealthy ? '#1e7e53' : '#b91c1c',
                fontSize: 12,
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: 20,
                border: `1px solid ${isHealthy ? 'rgba(30, 126, 83, 0.25)' : 'rgba(185, 28, 28, 0.25)'}`,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: isHealthy ? '#23835b' : '#dc2626',
                  boxShadow: `0 0 0 2px ${isHealthy ? 'rgba(35, 131, 91, 0.2)' : 'rgba(220, 38, 38, 0.2)'}`,
                  animation: 'pulse 2s infinite',
                }}
              />
              {isHealthy
                ? language === 'th'
                  ? '🟢 ระบบเชื่อมต่อสด (Live Active)'
                  : '🟢 Live Sync Active'
                : language === 'th'
                  ? '🔴 การเชื่อมต่อมีปัญหา'
                  : '🔴 Sync Degraded'}
            </span>

            {/* Trigger Type Badge */}
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 6,
                background: syncStatus?.triggerType === 'manual' ? '#eff6ff' : '#f3f4f6',
                color: syncStatus?.triggerType === 'manual' ? '#1d4ed8' : '#4b5563',
                border: '1px solid var(--gray-200)',
                fontWeight: 600,
              }}
            >
              {syncStatus?.triggerType === 'manual'
                ? language === 'th'
                  ? 'สั่งการเอง (Manual)'
                  : 'Manual Trigger'
                : language === 'th'
                  ? 'รอบอัตโนมัติ (Scheduled)'
                  : 'Scheduled Sync'}
            </span>

            <span style={{ fontSize: 13, color: 'var(--gray-700)', fontWeight: 500 }}>
              {language === 'th' ? 'ซิงค์สำเร็จล่าสุด: ' : 'Last successful sync: '}
              <strong style={{ color: 'var(--gray-900)' }}>
                {formatTimestamp(displaySyncTime)}
              </strong>
            </span>
          </div>

          <div style={{ fontSize: 12, color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span>
              {language === 'th'
                ? `⏱️ รอบอัตโนมัติ: ทุก ${syncStatus?.syncIntervalHours || 5} ชม. (ถัดไป: ${formatTimestamp(syncStatus?.nextSyncAt)})`
                : `⏱️ Next scheduled: ${formatTimestamp(syncStatus?.nextSyncAt)}`}
            </span>
            <span>•</span>
            <span style={{ color: 'var(--primary-700)', fontWeight: 600 }}>
              {language === 'th'
                ? `📊 โครงการที่ซิงค์สำเร็จ: ${syncStatus?.recordsSyncedCount ?? syncStatus?.totalDiscovered ?? 0} รายการ`
                : `📊 Synced records: ${syncStatus?.recordsSyncedCount ?? syncStatus?.totalDiscovered ?? 0}`}
            </span>
          </div>
        </div>

        {/* Right: Filter Pills & Sync Now Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {onFilterChange && (
            <div
              style={{
                display: 'inline-flex',
                background: 'var(--gray-100)',
                padding: 3,
                borderRadius: 8,
                border: '1px solid var(--gray-200)',
              }}
            >
              <button
                type="button"
                onClick={() => onFilterChange('all')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: activeFilter === 'all' ? 'var(--white)' : 'transparent',
                  color: activeFilter === 'all' ? 'var(--primary-700)' : 'var(--gray-700)',
                  boxShadow: activeFilter === 'all' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {language === 'th' ? 'ทั้งหมด' : 'All'}
              </button>
              <button
                type="button"
                onClick={() => onFilterChange('live')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: activeFilter === 'live' ? 'var(--white)' : 'transparent',
                  color: activeFilter === 'live' ? '#1e7e53' : 'var(--gray-700)',
                  boxShadow: activeFilter === 'live' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {language === 'th' ? '🟢 ข้อมูลสดภาครัฐ (e-GP)' : '🟢 Live Gov (e-GP)'}
              </button>
              <button
                type="button"
                onClick={() => onFilterChange('bma')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: activeFilter === 'bma' ? 'var(--white)' : 'transparent',
                  color: activeFilter === 'bma' ? 'var(--primary-700)' : 'var(--gray-700)',
                  boxShadow: activeFilter === 'bma' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {language === 'th' ? 'กรุงเทพมหานคร (BMA)' : 'BMA Projects'}
              </button>
            </div>
          )}

          {isAuthenticated && isAdmin && (
            <button
              type="button"
              id="syncLiveGovBtn"
              onClick={handleSyncNow}
              disabled={isSyncing}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 18px',
                borderRadius: 8,
                border: 'none',
                background: isSyncing
                  ? 'var(--gray-400)'
                  : 'linear-gradient(135deg, #2773a5 0%, #1b557c 100%)',
                color: '#ffffff',
                fontSize: 13,
                fontWeight: 600,
                cursor: isSyncing ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(39, 115, 165, 0.25)',
                transition: 'all 0.2s ease',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  transform: isSyncing ? 'rotate(360deg)' : 'none',
                  transition: 'transform 1s linear infinite',
                }}
              >
                🔄
              </span>
              <span>
                {isSyncing
                  ? language === 'th'
                    ? 'กำลังซิงค์ข้อมูลสด...'
                    : 'Syncing live data...'
                  : language === 'th'
                    ? 'อัปเดตข้อมูลสดเดี๋ยวนี้ (Admin)'
                    : 'Sync Now (Admin)'}
              </span>
            </button>
          )}
        </div>
      </div>

      {message && (
        <div
          style={{
            marginTop: 12,
            padding: '8px 14px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            background: message.startsWith('✓') ? '#e8f5ef' : '#fdf7ed',
            color: message.startsWith('✓') ? '#1e7e53' : '#b7791f',
            border: message.startsWith('✓')
              ? '1px solid rgba(30, 126, 83, 0.2)'
              : '1px solid rgba(183, 121, 31, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>{message}</span>
        </div>
      )}
    </div>
  );
}
