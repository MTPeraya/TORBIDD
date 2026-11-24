import { Project } from '@/types/project';
import { filterHomeProjects, getHomeOpportunitiesUrl } from '../HomeFilterLogic';

const mockProjects = [
  {
    externalId: 1,
    title: { th: 'AI Smart City', en: 'AI Smart City' },
    department: { th: 'สำนักการจราจร', en: 'Traffic Dept' },
    budget: 15_000_000,
    deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days (closing soon)
    category: 'AI',
    status: 'in_progress',
  },
  {
    externalId: 2,
    title: { th: 'Web Portal', en: 'Web Portal' },
    department: { th: 'สำนักยุทธศาสตร์', en: 'Strategy Dept' },
    budget: 4_500_000,
    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    category: 'Website',
    status: 'in_progress',
  },
  {
    externalId: 3,
    title: { th: 'Data Analytics Platform', en: 'Data Analytics Platform' },
    department: { th: 'สำนักการแพทย์', en: 'Medical Dept' },
    budget: 12_000_000,
    deadline: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
    category: 'Data Analytics',
    status: 'in_progress',
  },
  {
    externalId: 4,
    title: { th: 'Awarded Project', en: 'Awarded Project' },
    department: { th: 'สำนักการคลัง', en: 'Finance Dept' },
    budget: 20_000_000,
    deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    category: 'ERP',
    status: 'จัดทำสัญญาแล้ว', // contract awarded -> should not count as closing soon
    winnerName: 'Tech Corp',
  },
] as unknown as Project[];

describe('HomeFilterLogic', () => {
  it('filters all active projects properly', () => {
    const result = filterHomeProjects(mockProjects, 'all');
    expect(result).toHaveLength(4);
  });

  it('filters closing soon projects (within 7 days and not awarded)', () => {
    const result = filterHomeProjects(mockProjects, 'closingSoon');
    expect(result).toHaveLength(1);
    expect(result[0].externalId).toBe(1);
  });

  it('filters high value projects (>= 10M)', () => {
    const result = filterHomeProjects(mockProjects, 'highValue');
    expect(result.map((p) => p.externalId)).toEqual([1, 3, 4]);
  });

  it('filters AI and Data Analytics projects', () => {
    const result = filterHomeProjects(mockProjects, 'aiData');
    expect(result.map((p) => p.externalId)).toEqual([1, 3]);
  });

  it('generates correct opportunities target URLs with proper query params', () => {
    expect(getHomeOpportunitiesUrl('all')).toBe('/opportunities');
    expect(getHomeOpportunitiesUrl('closingSoon')).toBe('/opportunities?deadline=within7&sortBy=deadline_asc');
    expect(getHomeOpportunitiesUrl('highValue')).toBe('/opportunities?minBudget=10000000&sortBy=budget_desc');
    expect(getHomeOpportunitiesUrl('aiData')).toBe('/opportunities?categories=AI,Data%20Analytics');
  });
});
