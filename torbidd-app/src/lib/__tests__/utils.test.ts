import {
  formatBudget,
  formatBudgetFull,
  formatDate,
  getBudgetStatus,
  getOutlierStatus,
  getCategoryAvg,
  getCategoryClass,
} from '../utils';

describe('lib/utils.ts', () => {
  describe('formatBudget', () => {
    it('formats millions in Thai', () => {
      expect(formatBudget(53_131_650, 'th')).toBe('฿53.1 ล้าน');
      expect(formatBudget(1_000_000, 'th')).toBe('฿1.0 ล้าน');
    });

    it('formats millions in English', () => {
      expect(formatBudget(53_131_650, 'en')).toBe('฿53.1 M');
      expect(formatBudget(8_200_000, 'en')).toBe('฿8.2 M');
    });

    it('formats numbers under 1 million with locale commas', () => {
      expect(formatBudget(500_000, 'th')).toContain('500,000');
    });
  });

  describe('formatBudgetFull', () => {
    it('formats full amount with Thai Baht currency suffix', () => {
      expect(formatBudgetFull(53_131_650, 'th')).toBe('53,131,650 บาท');
      expect(formatBudgetFull(53_131_650, 'en')).toBe('53,131,650 THB');
    });
  });

  describe('formatDate', () => {
    it('converts date to Buddhist Era year (+543) in Thai', () => {
      const formatted = formatDate('2026-08-01', 'th');
      expect(formatted).toContain('2569');
      expect(formatted).toContain('ส.ค.');
    });

    it('formats date in Gregorian year in English', () => {
      const formatted = formatDate('2026-08-01', 'en');
      expect(formatted).toContain('2026');
      expect(formatted).toContain('Aug');
    });
  });

  describe('getBudgetStatus', () => {
    it('returns "above" when ratio > 1.2', () => {
      expect(getBudgetStatus(130, 100)).toBe('above');
    });

    it('returns "below" when ratio < 0.8', () => {
      expect(getBudgetStatus(70, 100)).toBe('below');
    });

    it('returns "normal" when within 0.8 - 1.2', () => {
      expect(getBudgetStatus(100, 100)).toBe('normal');
      expect(getBudgetStatus(110, 100)).toBe('normal');
      expect(getBudgetStatus(90, 100)).toBe('normal');
    });
  });

  describe('getOutlierStatus', () => {
    it('detects high outliers (> 1.3)', () => {
      expect(getOutlierStatus(140, 100)).toBe('high');
    });

    it('detects low outliers (< 0.7)', () => {
      expect(getOutlierStatus(60, 100)).toBe('low');
    });

    it('detects normal pricing', () => {
      expect(getOutlierStatus(100, 100)).toBe('normal');
    });
  });

  describe('getCategoryAvg', () => {
    it('calculates average budget for a category', () => {
      const data = [
        { category: 'Website', budget: 10_000_000 },
        { category: 'Website', budget: 20_000_000 },
        { category: 'AI', budget: 50_000_000 },
      ];
      expect(getCategoryAvg('Website', data)).toBe(15_000_000);
      expect(getCategoryAvg('AI', data)).toBe(50_000_000);
      expect(getCategoryAvg('Mobile App', data)).toBe(0);
    });
  });

  describe('getCategoryClass', () => {
    it('maps categories to CSS classes', () => {
      expect(getCategoryClass('AI')).toBe('ai');
      expect(getCategoryClass('Website')).toBe('website');
      expect(getCategoryClass('Mobile App')).toBe('mobile');
      expect(getCategoryClass('Database')).toBe('database');
    });
  });
});
