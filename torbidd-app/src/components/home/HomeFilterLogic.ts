import { Project } from '@/types/project';
import { isClosingSoon } from '@/lib/utils';
import { isContractAwarded } from '@/services/procurement-filter';

export type HomeFilterTab = 'all' | 'closingSoon' | 'highValue' | 'aiData';

export function filterHomeProjects(projects: Project[], tab: HomeFilterTab): Project[] {
  if (!projects || projects.length === 0) return [];

  switch (tab) {
    case 'closingSoon':
      return projects.filter((p) => !isContractAwarded(p) && isClosingSoon(p.deadline));
    case 'highValue':
      return projects.filter((p) => (p.budget || 0) >= 10_000_000);
    case 'aiData':
      return projects.filter((p) => p.category === 'AI' || p.category === 'Data Analytics');
    case 'all':
    default:
      return projects;
  }
}

export function getHomeOpportunitiesUrl(tab: HomeFilterTab): string {
  switch (tab) {
    case 'closingSoon':
      return '/opportunities?deadline=within7&sortBy=deadline_asc';
    case 'highValue':
      return '/opportunities?minBudget=10000000&sortBy=budget_desc';
    case 'aiData':
      return '/opportunities?categories=AI,Data%20Analytics';
    case 'all':
    default:
      return '/opportunities';
  }
}
