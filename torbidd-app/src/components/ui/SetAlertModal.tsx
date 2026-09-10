'use client';

import React, { useState } from 'react';
import { Project } from '@/types/project';
import { useLanguage } from '@/contexts/LanguageContext';
import { ICONS } from '@/components/ui/Icons';
import { formatDate, daysUntil } from '@/lib/utils';

interface SetAlertModalProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
}

export function SetAlertModal({ project, isOpen, onClose }: SetAlertModalProps) {
  const { language, L, getLocalized } = useLanguage();
  const [notify3Days, setNotify3Days] = useState(true);
  const [notify24Hours, setNotify24Hours] = useState(true);
  const [notifyAmendments, setNotifyAmendments] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  if (!isOpen) return null;

  const daysLeft = daysUntil(project.deadline);

  const handleSaveAlert = () => {
    // Save to localStorage or mock notification service
    try {
      const existingAlerts = JSON.parse(localStorage.getItem('torbidd_opportunity_alerts') || '[]');
      if (!existingAlerts.includes(project.externalId)) {
        existingAlerts.push(project.externalId);
        localStorage.setItem('torbidd_opportunity_alerts', JSON.stringify(existingAlerts));
      }
    } catch {}

    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog alert-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="modal-icon-badge">{ICONS.bell}</div>
            <div>
              <h3 className="modal-title">{L('alertModalTitle')}</h3>
              <p className="modal-subtitle">{L('alertModalSub')}</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            {ICONS.x}
          </button>
        </div>

        <div className="modal-body">
          {/* Opportunity brief card */}
          <div className="alert-project-brief">
            <h4 className="brief-title">{getLocalized(project.title) as string}</h4>
            <div className="brief-meta">
              <span>{getLocalized(project.department) as string}</span>
              <span className="brief-dot">•</span>
              <span className="brief-deadline">
                {L('deadline')}: {formatDate(project.deadline, language)} ({daysLeft >= 0 ? `${daysLeft} ${L('days')}` : L('closedStatus')})
              </span>
            </div>
          </div>

          <div className="alert-options-list">
            <label className="alert-option-item">
              <input
                type="checkbox"
                checked={notify3Days}
                onChange={(e) => setNotify3Days(e.target.checked)}
                className="option-checkbox"
              />
              <div className="option-text">
                <span className="option-title">
                  {language === 'th' ? 'แจ้งเตือนล่วงหน้า 3 วัน' : 'Reminder 3 days before deadline'}
                </span>
                <span className="option-desc">
                  {language === 'th'
                    ? 'เตือนก่อนหมดเวลาส่งข้อเสนอ เพื่อเตรียมหลักประกันและเอกสารสำคัญ'
                    : 'Advance notice to prepare bid bond and mandatory submittals'}
                </span>
              </div>
            </label>

            <label className="alert-option-item">
              <input
                type="checkbox"
                checked={notify24Hours}
                onChange={(e) => setNotify24Hours(e.target.checked)}
                className="option-checkbox"
              />
              <div className="option-text">
                <span className="option-title">
                  {language === 'th' ? 'แจ้งเตือนด่วน 24 ชั่วโมงสุดท้าย' : 'Urgent 24-hour reminder'}
                </span>
                <span className="option-desc">
                  {language === 'th'
                    ? 'ส่งข้อความเตือนทางอีเมลและระบบก่อนปิดรับซอง 24 ชม.'
                    : 'Final notification before the electronic e-GP submission closes'}
                </span>
              </div>
            </label>

            <label className="alert-option-item">
              <input
                type="checkbox"
                checked={notifyAmendments}
                onChange={(e) => setNotifyAmendments(e.target.checked)}
                className="option-checkbox"
              />
              <div className="option-text">
                <span className="option-title">
                  {language === 'th' ? 'แจ้งเตือนเมื่อมีการแก้ไข TOR หรือเอกสารเพิ่มเติม' : 'TOR Amendment & Addenda alerts'}
                </span>
                <span className="option-desc">
                  {language === 'th'
                    ? 'แจ้งทันทีหาก กทม. ออกประกาศแก้ไขคุณสมบัติหรือเลื่อนวันประกวดราคา'
                    : 'Real-time alert if BMA issues clarification or changes terms'}
                </span>
              </div>
            </label>
          </div>

          {isSaved && (
            <div className="alert-success-banner">
              {ICONS.check}
              <span>{L('alertSetSuccess')}</span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={isSaved}>
            {language === 'th' ? 'ยกเลิก' : 'Cancel'}
          </button>
          <button className="btn btn-primary" onClick={handleSaveAlert} disabled={isSaved}>
            {ICONS.bell}
            <span>{isSaved ? (language === 'th' ? 'บันทึกแล้ว!' : 'Saved!') : L('saveSettings')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
