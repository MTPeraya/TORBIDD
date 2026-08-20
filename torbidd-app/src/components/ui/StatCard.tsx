'use client';

import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  change: string;
  changeType?: 'positive' | 'neutral';
  icon: React.ReactNode;
  iconColor: 'blue' | 'teal' | 'amber' | 'green';
}

export function StatCard({
  label,
  value,
  change,
  changeType = 'neutral',
  icon,
  iconColor,
}: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-card-header">
        <span className="stat-card-label">{label}</span>
        <div className={`stat-card-icon ${iconColor}`}>{icon}</div>
      </div>
      <div className="stat-card-value">{value}</div>
      <div className={`stat-card-change ${changeType}`}>{change}</div>
    </div>
  );
}
