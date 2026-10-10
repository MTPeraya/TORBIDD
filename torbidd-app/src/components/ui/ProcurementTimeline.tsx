'use client';

import React from 'react';
import { TimelineEvent } from '@/types/project';
import { useLanguage } from '@/contexts/LanguageContext';
import { ICONS } from '@/components/ui/Icons';
import { formatDate, daysUntil } from '@/lib/utils';

interface ProcurementTimelineProps {
  timeline?: TimelineEvent[];
  sourceUrl?: string;
  externalProjectId?: string;
}

export function ProcurementTimeline({ timeline, sourceUrl, externalProjectId }: ProcurementTimelineProps) {
  const { language, L, getLocalized } = useLanguage();

  const egpUrl =
    sourceUrl ||
    (externalProjectId
      ? `https://process5.gprocurement.go.th/egp-agpc01-web/announcement?keywordSearch=${externalProjectId}`
      : 'https://process5.gprocurement.go.th');

  if (!timeline || timeline.length === 0) {
    return (
      <div className="detail-card timeline-card">
        <div className="timeline-header">
          <h2 className="detail-card-title" style={{ marginBottom: 4, borderBottom: 'none', paddingBottom: 0 }}>
            {ICONS.calendar}
            <span>{L('timelineTitle')}</span>
          </h2>
          <p className="timeline-subtitle">{L('timelineSub')}</p>
        </div>
        <div
          style={{
            padding: '24px 16px',
            textAlign: 'center',
            background: 'var(--slate-50, #f8fafc)',
            borderRadius: '8px',
            border: '1px dashed var(--slate-300, #cbd5e1)',
            marginTop: '12px',
          }}
        >
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>📅</div>
          <p style={{ fontWeight: 600, color: 'var(--slate-700, #334155)', margin: '0 0 6px 0', fontSize: '0.95rem' }}>
            {language === 'th'
              ? 'ยังไม่มีบันทึกกำหนดการขั้นตอนในฐานข้อมูล'
              : 'No milestone schedule recorded in database yet'}
          </p>
          <p style={{ color: 'var(--slate-500, #64748b)', margin: '0 0 16px 0', fontSize: '0.85rem' }}>
            {language === 'th'
              ? 'ท่านสามารถตรวจสอบประกาศ ตารางเวลาประกวดราคา และเอกสาร TOR ได้โดยตรงจากระบบจัดซื้อจัดจ้างภาครัฐ (e-GP)'
              : 'You can check the full procurement schedule, tender documents, and TOR directly on the official e-GP portal.'}
          </p>
          <a
            href={egpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
          >
            <span>{language === 'th' ? 'ตรวจสอบบนระบบ e-GP กรมบัญชีกลาง' : 'Verify on official e-GP portal'}</span>
            {ICONS.externalLink}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="detail-card timeline-card">
      <div className="timeline-header">
        <h2 className="detail-card-title" style={{ marginBottom: 4, borderBottom: 'none', paddingBottom: 0 }}>
          {ICONS.calendar}
          <span>{L('timelineTitle')}</span>
        </h2>
        <p className="timeline-subtitle">{L('timelineSub')}</p>
      </div>

      <div className="procurement-timeline-track">
        {timeline.map((step, idx) => {
          const daysLeft = daysUntil(step.date);
          const isOverdue = daysLeft < 0;
          const isCurrentActive = step.status === 'active' || (!isOverdue && daysLeft <= 14);

          let badgeClass = 'timeline-badge upcoming';
          let statusText = L('statusUpcoming');
          if (step.status === 'completed' || isOverdue) {
            badgeClass = 'timeline-badge completed';
            statusText = L('statusCompleted');
          } else if (isCurrentActive) {
            badgeClass = 'timeline-badge active';
            statusText = L('statusActive');
          }

          return (
            <div key={step.id || idx} className={`timeline-node ${step.status} ${isCurrentActive ? 'node-active' : ''}`}>
              <div className="timeline-node-marker">
                <div className="timeline-dot">
                  {step.status === 'completed' || isOverdue ? (
                    ICONS.check
                  ) : (
                    <span className="dot-index">{idx + 1}</span>
                  )}
                </div>
                {idx < timeline.length - 1 && <div className="timeline-connector" />}
              </div>

              <div className="timeline-content">
                <div className="timeline-top-row">
                  <h4 className="timeline-event-name">{getLocalized(step.event) as string}</h4>
                  <span className={badgeClass}>{statusText}</span>
                </div>

                <div className="timeline-meta-row">
                  <span className="timeline-date">
                    {ICONS.clock}
                    {formatDate(step.date, language)}
                  </span>
                  {!isOverdue && daysLeft >= 0 && (
                    <span className="timeline-countdown-pill">
                      {L('daysRemaining')} {daysLeft} {L('days')}
                    </span>
                  )}
                </div>

                {step.description && (
                  <p className="timeline-desc">{getLocalized(step.description) as string}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Official verification footer */}
      <div
        style={{
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: '1px solid var(--slate-200, #e2e8f0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.8rem',
          color: 'var(--slate-500, #64748b)',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <span>
          {language === 'th'
            ? '✓ แสดงเฉพาะกำหนดการจริงจากฐานข้อมูลภาครัฐ'
            : '✓ Verified official dates from government records'}
        </span>
        <a
          href={egpUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: 'var(--primary-600, #2563eb)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            textDecoration: 'underline',
          }}
        >
          <span>{language === 'th' ? 'ดูประกาศฉบับเต็มบน e-GP' : 'View on e-GP portal'}</span>
          {ICONS.externalLink}
        </a>
      </div>
    </div>
  );
}
