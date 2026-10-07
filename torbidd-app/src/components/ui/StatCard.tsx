'use client';

import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  change: string;
  changeType?: 'positive' | 'neutral' | 'negative' | 'warning';
  icon: React.ReactNode;
  iconColor: 'blue' | 'teal' | 'amber' | 'green' | 'red';
  onClick?: () => void;
  isActive?: boolean;
  title?: string;
}

export function StatCard({
  label,
  value,
  change,
  changeType = 'neutral',
  icon,
  iconColor,
  onClick,
  isActive = false,
  title,
}: StatCardProps) {
  const isClickable = Boolean(onClick);

  return (
    <div
      className={`stat-card ${isClickable ? 'clickable' : ''} ${isActive ? 'active-filter' : ''}`}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      title={title}
      onKeyDown={(e) => {
        if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <div className="stat-card-header">
        <span className="stat-card-label">{label}</span>
        <div className={`stat-card-icon ${iconColor}`}>{icon}</div>
      </div>
      <div className="stat-card-value">{value}</div>
      <div className={`stat-card-change ${changeType}`}>{change}</div>
    </div>
  );
}
