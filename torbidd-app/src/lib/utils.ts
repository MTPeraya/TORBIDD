// =============================================================================
// lib/utils.ts - Shared Utility Functions
// Ported from Demo/app.js utility functions, made TypeScript-safe.
// =============================================================================

import { Language } from '@/types/settings';

// ─── Budget Formatting ──────────────────────────────────────────────────────

export function formatBudget(amount: number, language: Language = 'th'): string {
  const millionLabel = language === 'th' ? 'ล้าน' : 'M';
  if (amount >= 1_000_000) {
    const m = (amount / 1_000_000).toFixed(1);
    return `฿${m} ${millionLabel}`;
  }
  return `฿${amount.toLocaleString('th-TH')}`;
}

export function formatBudgetFull(amount: number, language: Language = 'th'): string {
  const thbLabel = language === 'th' ? 'บาท' : 'THB';
  return `${amount.toLocaleString('th-TH')} ${thbLabel}`;
}

// ─── Date Formatting ────────────────────────────────────────────────────────

const MONTHS_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(dateStr: string, language: Language = 'th'): string {
  const d = new Date(dateStr);
  const months = language === 'th' ? MONTHS_TH : MONTHS_EN;
  const year = language === 'th' ? d.getFullYear() + 543 : d.getFullYear();
  return `${d.getDate()} ${months[d.getMonth()]} ${year}`;
}

// ─── Deadline Helpers ───────────────────────────────────────────────────────

export function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const deadline = new Date(dateStr);
  return Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function isClosingSoon(dateStr: string): boolean {
  const d = daysUntil(dateStr);
  return d >= 0 && d <= 7;
}

export function isNew(publishDate: string): boolean {
  const d = daysUntil(publishDate);
  // Published within the last 3 days (daysUntil returns negative for past dates)
  return d >= -3 && d <= 0;
}

// ─── Budget Status ──────────────────────────────────────────────────────────

export type BudgetStatus = 'above' | 'below' | 'normal';

export function getBudgetStatus(budget: number, historicalAvg: number): BudgetStatus {
  const ratio = budget / historicalAvg;
  if (ratio > 1.2) return 'above';
  if (ratio < 0.8) return 'below';
  return 'normal';
}

// ─── Category Styling ───────────────────────────────────────────────────────

export function getCategoryClass(cat: string): string {
  const map: Record<string, string> = {
    AI: 'ai',
    Website: 'website',
    'Mobile App': 'mobile',
    Database: 'database',
  };
  return map[cat] ?? 'database';
}

// ─── Outlier Detection ──────────────────────────────────────────────────────

export type OutlierStatus = 'high' | 'low' | 'normal';

export function getOutlierStatus(budget: number, categoryAvg: number): OutlierStatus {
  const ratio = budget / categoryAvg;
  if (ratio > 1.3) return 'high';
  if (ratio < 0.7) return 'low';
  return 'normal';
}

// ─── Category Average (from historical data array) ──────────────────────────

export function getCategoryAvg(category: string, data: { category: string; budget: number }[]): number {
  const items = data.filter((d) => d.category === category);
  if (items.length === 0) return 0;
  return items.reduce((sum, d) => sum + d.budget, 0) / items.length;
}
