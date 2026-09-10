'use client';

import React from 'react';
import { TimelineEvent } from '@/types/project';
import { useLanguage } from '@/contexts/LanguageContext';
import { ICONS } from '@/components/ui/Icons';
import { formatDate, daysUntil } from '@/lib/utils';

interface ProcurementTimelineProps {
  timeline?: TimelineEvent[];
}

export function ProcurementTimeline({ timeline }: ProcurementTimelineProps) {
  const { language, L, getLocalized } = useLanguage();

  if (!timeline || timeline.length === 0) {
    return null;
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
    </div>
  );
}
