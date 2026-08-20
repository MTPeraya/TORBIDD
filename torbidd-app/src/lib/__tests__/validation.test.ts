import {
  ProjectFiltersSchema,
  HistoricalFiltersSchema,
  BookmarkCreateSchema,
  SettingsUpdateSchema,
  AiClassifySchema,
} from '../validation';

describe('lib/validation.ts', () => {
  describe('ProjectFiltersSchema', () => {
    it('accepts valid project filter params', () => {
      const result = ProjectFiltersSchema.safeParse({
        search: 'Smart Portal',
        category: 'Website',
        budget: '5to10',
        deadline: 'within7',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid category', () => {
      const result = ProjectFiltersSchema.safeParse({ category: 'Hardware' });
      expect(result.success).toBe(false);
    });
  });

  describe('HistoricalFiltersSchema', () => {
    it('coerces year string to number', () => {
      const result = HistoricalFiltersSchema.safeParse({ year: '2025' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.year).toBe(2025);
      }
    });
  });

  describe('BookmarkCreateSchema', () => {
    it('accepts 24-character hexadecimal ObjectId', () => {
      const result = BookmarkCreateSchema.safeParse({ projectId: '507f1f77bcf86cd799439011' });
      expect(result.success).toBe(true);
    });

    it('rejects invalid ObjectId length', () => {
      const result = BookmarkCreateSchema.safeParse({ projectId: '123' });
      expect(result.success).toBe(false);
    });
  });

  describe('SettingsUpdateSchema', () => {
    it('accepts valid settings with min <= max', () => {
      const result = SettingsUpdateSchema.safeParse({
        emailNotif: true,
        budgetMin: 5_000_000,
        budgetMax: 10_000_000,
      });
      expect(result.success).toBe(true);
    });

    it('rejects settings when budgetMax < budgetMin', () => {
      const result = SettingsUpdateSchema.safeParse({
        budgetMin: 10_000_000,
        budgetMax: 5_000_000,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('AiClassifySchema', () => {
    it('validates title and description', () => {
      const result = AiClassifySchema.safeParse({
        title: 'BMA Smart Traffic',
        description: 'Computer vision camera monitoring system for Bangkok intersections',
      });
      expect(result.success).toBe(true);
    });
  });
});
