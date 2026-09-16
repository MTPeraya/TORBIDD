// =============================================================================
// services/database/historical.ts - Historical Data Repository
// =============================================================================

import connectToDatabase from '@/lib/mongodb';
import HistoricalProject, { IHistoricalProject } from '@/models/HistoricalProject';
import { HistoricalFilters } from '@/types/historical';

export async function getHistoricalProjects(filters: HistoricalFilters = {}): Promise<IHistoricalProject[]> {
  await connectToDatabase();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: Record<string, any> = {};

  if (filters.category) query.category = filters.category;
  if (filters.department) query['department.th'] = filters.department;
  if (filters.year) query.year = filters.year;

  if (filters.search) {
    const term = filters.search.trim();
    query.$or = [
      { 'title.th': { $regex: term, $options: 'i' } },
      { 'title.en': { $regex: term, $options: 'i' } },
      { 'description.th': { $regex: term, $options: 'i' } },
      { 'description.en': { $regex: term, $options: 'i' } },
      { 'department.th': { $regex: term, $options: 'i' } },
      { 'department.en': { $regex: term, $options: 'i' } },
    ];
  }

  return HistoricalProject.find(query).sort({ year: -1 }).lean();
}

export async function getAllHistoricalProjects(): Promise<IHistoricalProject[]> {
  await connectToDatabase();
  return HistoricalProject.find({}).sort({ year: -1 }).lean();
}
