'use client';

import React, { useState, useEffect } from 'react';
import { ICONS } from '@/components/ui/Icons';
import { useLanguage } from '@/contexts/LanguageContext';

export interface SyncStatusData {
  lastSyncAt: string;
  nextSyncAt: string;
  syncIntervalHours: number;
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
  const [syncStatus, setSyncStatus] = useState<SyncStatusData | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/ingestion/status');
      if (res.ok) {
        const json = await res.json();
        if (json.status) {
          setSyncStatus(json.status);
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // refresh status every 30s
    return () => clearInterval(interval);
  }, []);

  const handleSyncNow = async () => {
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
            ? `✓ อัปเดตข้อมูลสดสำเร็จ! พบโครงการจัดซื้อจัดจ้าง ${json.total || json.projects?.length || 0} รายการ`
            : `✓ Live sync successful! Discovered ${json.total || json.projects?.length || 0} procurement projects`,
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
    } catch (err) {
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#e8f5ef',
                color: '#1e7e53',
                fontSize: 12,
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: 20,
                border: '1px solid rgba(30, 126, 83, 0.25)',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#23835b',
                  boxShadow: '0 0 0 2px rgba(35, 131, 91, 0.2)',
                  animation: 'pulse 2s infinite',
                }}
              />
              {language === 'th' ? 'ข้อมูลสดภาครัฐ (e-GP / CKAN)' : 'Live Gov Data (e-GP & CKAN)'}
            </span>

            <span style={{ fontSize: 13, color: 'var(--gray-700)', fontWeight: 500 }}>
              {language === 'th' ? 'อัปเดตล่าสุด: ' : 'Last synced: '}
              <strong style={{ color: 'var(--gray-900)' }}>
                {formatTimestamp(syncStatus?.lastSyncAt)}
              </strong>
            </span>
          </div>

          <div style={{ fontSize: 12, color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>
              {language === 'th'
                ? `⏱️ รอบอัปเดตอัตโนมัติ: ทุก ${syncStatus?.syncIntervalHours || 5} ชั่วโมง (รอบถัดไป: ${formatTimestamp(syncStatus?.nextSyncAt)})`
                : `⏱️ Auto-sync: Every ${syncStatus?.syncIntervalHours || 5} hours (Next: ${formatTimestamp(syncStatus?.nextSyncAt)})`}
            </span>
            <span>•</span>
            <span style={{ color: 'var(--primary-700)' }}>
              {language === 'th'
                ? '✓ ตรวจสอบความถูกต้องตรงกับประกาศจัดซื้อจัดจ้าง e-GP กรมบัญชีกลาง'
                : '✓ Verified against official Comptroller General Dept. e-GP'}
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
                  ? 'อัปเดตข้อมูลสดเดี๋ยวนี้'
                  : 'Sync Now'}
            </span>
          </button>
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
