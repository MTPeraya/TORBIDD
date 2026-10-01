'use client';

// =============================================================================
// components/admin/ConfirmNonSoftwareModal.tsx
// UC-4: Admin Confirmation Modal for Non-Software Classification & Exclusion
// =============================================================================

import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { ICONS } from '@/components/ui/Icons';
import { Project } from '@/types/project';
import { formatTHB } from '@/lib/utils';

interface ConfirmNonSoftwareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: { permanentlyDelete: boolean }) => Promise<void>;
  project: Project | null;
}

export function ConfirmNonSoftwareModal({
  isOpen,
  onClose,
  onConfirm,
  project,
}: ConfirmNonSoftwareModalProps) {
  const { language } = useLanguage();
  const [submitting, setSubmitting] = useState(false);
  const [permanentlyDelete, setPermanentlyDelete] = useState(false);

  if (!isOpen || !project) return null;

  const handleConfirm = async () => {
    try {
      setSubmitting(true);
      await onConfirm({ permanentlyDelete });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const title = language === 'th' ? project.title?.th : project.title?.en;
  const dept = language === 'th' ? project.department?.th : project.department?.en;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 540 }}
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div
              className="modal-icon-badge"
              style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}
            >
              {ICONS.alertTriangle}
            </div>
            <div>
              <h3 className="modal-title" style={{ color: '#ef4444' }}>
                {language === 'th'
                  ? 'ยืนยันจำแนกเป็นไม่ใช่ซอฟต์แวร์ (UC-4)'
                  : 'Confirm Non-Software Classification (UC-4)'}
              </h3>
              <p className="modal-subtitle">
                #{project.externalId} — {project.category}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            {ICONS.x}
          </button>
        </div>

        <div className="modal-body" style={{ padding: '20px 24px' }}>
          <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 16 }}>
            {language === 'th'
              ? 'คุณกำลังจะยืนยันว่าโครงการนี้ ไม่ใช่โครงการจัดซื้อจัดจ้างด้านซอฟต์แวร์ (Non-Software Related) ตามข้อกำหนดระบบ UC-4'
              : 'You are confirming that this listing is not related to a software procurement project according to system specification UC-4.'}
          </p>

          <div
            style={{
              padding: '14px 16px',
              borderRadius: 8,
              background: 'var(--surface-subtle, rgba(255,255,255,0.03))',
              border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
              marginBottom: 16,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6, fontSize: '0.92rem' }}>{title}</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {dept} • {formatTHB(project.budget)}
            </div>
          </div>

          <div
            style={{
              background: 'rgba(239, 68, 68, 0.06)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: 8,
              padding: '12px 14px',
              marginBottom: 16,
              fontSize: '0.82rem',
              color: 'var(--text-primary)',
            }}
          >
            <div style={{ fontWeight: 600, color: '#dc2626', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              {ICONS.info}
              <span>{language === 'th' ? 'ผลของการดำเนินการตาม UC-4:' : 'System Action per UC-4:'}</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              <li>
                {language === 'th'
                  ? 'โครงการนี้จะถูกคัดแยกออกจากแดชบอร์ดค้นหาโอกาสงานสาธารณะทันที'
                  : 'Listing will be immediately excluded from the public opportunity dashboard.'}
              </li>
              <li>
                {language === 'th'
                  ? 'บันทึกการตัดสินใจของผู้ดูแลระบบสำหรับตรวจสอบ (Audit Log) และการปรับปรุงโมเดล'
                  : 'Administrator decision is recorded for audit tracking and future classification training.'}
              </li>
            </ul>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              cursor: 'pointer',
              padding: '10px 12px',
              borderRadius: 8,
              background: permanentlyDelete ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
              border: permanentlyDelete ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid transparent',
              transition: 'all 0.15s ease',
            }}
          >
            <input
              type="checkbox"
              checked={permanentlyDelete}
              onChange={(e) => setPermanentlyDelete(e.target.checked)}
              id="confirmNonSoftwareDeleteOption"
              style={{ marginTop: 3 }}
            />
            <span style={{ fontSize: '0.85rem', fontWeight: permanentlyDelete ? 700 : 500, color: permanentlyDelete ? '#b91c1c' : 'var(--text-primary)' }}>
              {language === 'th'
                ? 'ลบ/ตัดรายการนี้ออกจากฐานข้อมูลอย่างถาวรทันที (ตามนโยบายการจัดเก็บข้อมูล UC-4 A5)'
                : 'Permanently remove/delete record from database (UC-4 A5 retention policy)'}
            </span>
          </label>
        </div>

        <div
          className="modal-footer"
          style={{
            borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
            padding: '16px 24px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12,
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={submitting}
          >
            {language === 'th' ? 'ยกเลิก' : 'Cancel'}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleConfirm}
            disabled={submitting}
            id="confirmNonSoftwareSubmitBtn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
          >
            {submitting ? 'Processing...' : (language === 'th' ? 'ยืนยันไม่ใช่ซอฟต์แวร์' : 'Confirm Non-Software')}
          </button>
        </div>
      </div>
    </div>
  );
}
