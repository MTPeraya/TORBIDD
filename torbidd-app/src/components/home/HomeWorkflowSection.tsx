'use client';

import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { ICONS } from '@/components/ui/Icons';

export function HomeWorkflowSection() {
  const { L } = useLanguage();

  const steps = [
    {
      num: '01',
      icon: ICONS.search,
      title: L('workflowStep1Title'),
      desc: L('workflowStep1Desc'),
    },
    {
      num: '02',
      icon: ICONS.shield,
      title: L('workflowStep2Title'),
      desc: L('workflowStep2Desc'),
    },
    {
      num: '03',
      icon: ICONS.chart,
      title: L('workflowStep3Title'),
      desc: L('workflowStep3Desc'),
    },
  ];

  return (
    <section className="home-workflow-section anim-fade-up anim-delay-3" aria-label={L('workflowTitle')}>
      <div className="workflow-section-header">
        <h2 className="workflow-section-title">{L('workflowTitle')}</h2>
        <p className="workflow-section-subtitle">{L('workflowSubtitle')}</p>
      </div>

      <div className="workflow-grid">
        {steps.map((step) => (
          <div key={step.num} className="workflow-card">
            <div className="workflow-card-top">
              <span className="workflow-number">{step.num}</span>
              <div className="workflow-icon">{step.icon}</div>
            </div>
            <h3 className="workflow-title">{step.title}</h3>
            <p className="workflow-desc">{step.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
