// =============================================================================
// services/database/projects.ts - Project Repository
// =============================================================================

import connectToDatabase from '@/lib/mongodb';
import Project, { IProject } from '@/models/Project';
import { ProjectFilters } from '@/types/project';
import { daysUntil } from '@/lib/utils';

export async function getProjects(filters: ProjectFilters = {}): Promise<IProject[]> {
  await connectToDatabase();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: Record<string, any> = {};

  if (filters.search) {
    const regex = new RegExp(filters.search, 'i');
    query.$or = [
      { 'title.th': regex },
      { 'title.en': regex },
      { 'department.th': regex },
      { 'department.en': regex },
    ];
  }

  if (filters.department) {
    query['department.th'] = filters.department;
  }

  if (filters.category) {
    query.category = filters.category;
  }

  if (filters.budget) {
    switch (filters.budget) {
      case 'under5m':  query.budget = { $lt: 5_000_000 }; break;
      case '5to10':    query.budget = { $gte: 5_000_000, $lte: 10_000_000 }; break;
      case '10to20':   query.budget = { $gte: 10_000_000, $lte: 20_000_000 }; break;
      case 'above20m': query.budget = { $gt: 20_000_000 }; break;
    }
  }

  const projects = await Project.find(query).sort({ publishDate: -1 }).lean();

  if (filters.deadline) {
    return projects.filter((p) => {
      const d = daysUntil(p.deadline.toISOString());
      switch (filters.deadline) {
        case 'within7':   return d >= 0 && d <= 7;
        case 'within30':  return d >= 0 && d <= 30;
        case 'moreThan30': return d > 30;
        default: return true;
      }
    });
  }

  return projects;
}

export async function getProjectById(id: string): Promise<IProject | null> {
  await connectToDatabase();
  return Project.findById(id).lean();
}

export async function getProjectByExternalId(externalId: number): Promise<IProject | null> {
  await connectToDatabase();
  return Project.findOne({ externalId }).lean();
}
