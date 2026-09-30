// =============================================================================
// app/api/procurements/route.ts - GET /api/procurements
// (Supports Issues #150, #154, #155, #156)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { ProcurementFiltersSchema } from '@/lib/validation';
import { executeProcurementSearch } from '@/services/procurement-search';
import { getProjects } from '@/services/database/projects';
import { getProcurementProjects } from '@/services/database/procurement';
import { procurementToProject } from '@/lib/project-mapper';
import { ProcurementSortOption } from '@/types/procurement';
import { Project } from '@/types/project';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const searchParams = url.searchParams;

    // Support both repeated params (?category=Website&category=AI) and comma-separated (?category=Website,AI)
    const rawCategories = searchParams.getAll('categories').concat(searchParams.getAll('category'));
    const categories: string[] = [];
    rawCategories.forEach((c) => {
      c.split(',').forEach((part) => {
        const trimmed = part.trim();
        if (trimmed && !categories.includes(trimmed)) {
          categories.push(trimmed);
        }
      });
    });

    const rawAgencies = searchParams.getAll('agencies').concat(searchParams.getAll('agency'));
    const agencies: string[] = [];
    rawAgencies.forEach((a) => {
      a.split(',').forEach((part) => {
        const trimmed = part.trim();
        if (trimmed && !agencies.includes(trimmed)) {
          agencies.push(trimmed);
        }
      });
    });

    const queryObj: Record<string, unknown> = {
      search: searchParams.get('search') || undefined,
      department: searchParams.get('department') || undefined,
      agency: searchParams.get('agency') || undefined,
      agencies: agencies.length > 0 ? agencies : undefined,
      category: categories.length === 1 ? categories[0] : undefined,
      categories: categories.length > 0 ? categories : undefined,
      budget: searchParams.get('budget') || undefined,
      minBudget: searchParams.get('minBudget') || undefined,
      maxBudget: searchParams.get('maxBudget') || undefined,
      deadline: searchParams.get('deadline') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
    };

    const parsed = ProcurementFiltersSchema.safeParse(queryObj);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid procurement filter parameters',
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const filterData = parsed.data;

    // Fetch real projects from database
    let discoveredMapped: Project[] = [];
    try {
      const { projects: discProjects } = await getProcurementProjects({
        search: filterData.search,
        limit: 1000,
      });
      if (discProjects && discProjects.length > 0) {
        discoveredMapped = discProjects.map(procurementToProject);
      }
    } catch {}

    let dbProjects: Project[] = [];
    try {
      dbProjects = ((await getProjects({
        search: filterData.search,
      })) as unknown as Project[]) || [];
    } catch {}

    const combined = [...discoveredMapped, ...dbProjects];
    const searchResult = executeProcurementSearch(combined, {
      search: filterData.search,
      categories: categories.length > 0 ? categories : (filterData.category ? [filterData.category] : undefined),
      agencies: agencies.length > 0 ? agencies : (filterData.department ? [filterData.department] : undefined),
      minBudget: filterData.minBudget,
      maxBudget: filterData.maxBudget,
      budgetPreset: filterData.budget,
      deadline: filterData.deadline,
      sortBy: (filterData.sortBy as ProcurementSortOption) || 'publishDate_desc',
      page: filterData.page,
      limit: filterData.limit,
    });

    return NextResponse.json({
      data: searchResult.items,
      total: searchResult.total,
      page: searchResult.page,
      limit: searchResult.limit,
      totalPages: searchResult.totalPages,
      filters: filterData,
    });
  } catch (err) {
    console.error('[GET /api/procurements]', err);
    return NextResponse.json({
      data: [],
      total: 0,
      page: 1,
      limit: 12,
      totalPages: 0,
    });
  }
}
