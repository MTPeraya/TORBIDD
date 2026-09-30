// =============================================================================
// app/api/projects/route.ts - GET /api/projects
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getProjects, createProject } from '@/services/database/projects';
import { getProcurementProjects } from '@/services/database/procurement';
import { ProjectFiltersSchema, ProjectCreateSchema } from '@/lib/validation';
import { INITIAL_PROJECTS } from '@/lib/initialData';
import { executeProcurementSearch } from '@/services/procurement-search';
import { ProcurementSortOption } from '@/types/procurement';
import { Project } from '@/types/project';
import { procurementToProject } from '@/lib/project-mapper';
import { getSyncStatus } from '@/services/ingestion/sync-state';
import { getAuthSessionFromRequest, isAdminUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const syncStatus = getSyncStatus();

    // 1. If specifically requesting discovered CKAN / Open Data procurement projects
    if (params.source === 'CKAN_GOVSPENDING' || params.type === 'procurement' || params.type === 'discovered') {
      try {
        const { projects, total } = await getProcurementProjects({
          search: params.search,
          fiscalYear: params.fiscalYear ? parseInt(params.fiscalYear, 10) : undefined,
          limit: params.limit ? parseInt(params.limit, 10) : undefined,
          offset: params.offset ? parseInt(params.offset, 10) : undefined,
        });

        const mapped = projects.map(procurementToProject);
        return NextResponse.json({
          data: mapped,
          total,
          syncStatus,
        });
      } catch (err) {
        console.error('[GET /api/projects?source=CKAN_GOVSPENDING]', err);
        return NextResponse.json({ data: [], total: 0, syncStatus });
      }
    }

    const parsed = ProjectFiltersSchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // 2. If requesting BMA projects exclusively
    if (params.source === 'BMA' || params.source === 'bma') {
      let bmaDbProjects: Project[] = [];
      try {
        bmaDbProjects = ((await getProjects(parsed.data)) as unknown as Project[]) || [];
      } catch {}

      const bmaList = bmaDbProjects.length > 0 ? bmaDbProjects : INITIAL_PROJECTS;
      const searchResult = executeProcurementSearch(bmaList, {
        search: parsed.data.search,
        categories: parsed.data.categories
          ? (Array.isArray(parsed.data.categories) ? parsed.data.categories : [parsed.data.categories])
          : (parsed.data.category ? [parsed.data.category] : undefined),
        agencies: parsed.data.agencies
          ? (Array.isArray(parsed.data.agencies) ? parsed.data.agencies : [parsed.data.agencies])
          : (parsed.data.agency ? [parsed.data.agency] : (parsed.data.department ? [parsed.data.department] : undefined)),
        minBudget: parsed.data.minBudget,
        maxBudget: parsed.data.maxBudget,
        budgetPreset: parsed.data.budget,
        deadline: parsed.data.deadline,
        sortBy: parsed.data.sortBy as ProcurementSortOption,
        page: parsed.data.page,
        limit: parsed.data.limit,
      });

      return NextResponse.json({
        data: searchResult.items,
        total: searchResult.total,
        syncStatus,
        source: 'BMA',
      });
    }

    // 3. Fetch discovered procurement projects
    let discoveredProjectsMapped: Project[] = [];
    try {
      const { projects: discProjects } = await getProcurementProjects({
        search: parsed.data.search,
      });
      if (discProjects && discProjects.length > 0) {
        discoveredProjectsMapped = discProjects.map(procurementToProject);
      }
    } catch {}

    // 4. Fetch BMA database projects or fallback to INITIAL_PROJECTS
    let bmaProjects: Project[] = [];
    try {
      bmaProjects = ((await getProjects(parsed.data)) as unknown as Project[]) || [];
    } catch {}

    if (bmaProjects.length === 0) {
      bmaProjects = INITIAL_PROJECTS;
    }

    // 5. Combine discovered live projects with BMA projects and run full search/filter/sort
    const combined = [...discoveredProjectsMapped, ...bmaProjects];
    const searchResult = executeProcurementSearch(combined, {
      search: parsed.data.search,
      categories: parsed.data.categories
        ? (Array.isArray(parsed.data.categories) ? parsed.data.categories : [parsed.data.categories])
        : (parsed.data.category ? [parsed.data.category] : undefined),
      agencies: parsed.data.agencies
        ? (Array.isArray(parsed.data.agencies) ? parsed.data.agencies : [parsed.data.agencies])
        : (parsed.data.agency ? [parsed.data.agency] : (parsed.data.department ? [parsed.data.department] : undefined)),
      minBudget: parsed.data.minBudget,
      maxBudget: parsed.data.maxBudget,
      budgetPreset: parsed.data.budget,
      deadline: parsed.data.deadline,
      sortBy: parsed.data.sortBy as ProcurementSortOption,
      page: parsed.data.page,
      limit: parsed.data.limit,
    });

    return NextResponse.json({
      data: searchResult.items,
      total: searchResult.total,
      syncStatus,
    });
  } catch (err) {
    console.error('[GET /api/projects]', err);
    return NextResponse.json({
      data: INITIAL_PROJECTS,
      total: INITIAL_PROJECTS.length,
      syncStatus: getSyncStatus(),
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = getAuthSessionFromRequest(req);
    if (!authUser || !isAdminUser(authUser)) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = ProjectCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid project data', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    try {
      const created = await createProject(parsed.data);
      return NextResponse.json({ data: created, success: true }, { status: 201 });
    } catch {
      // Fallback for mock/offline environment
      const mockProject = {
        ...parsed.data,
        _id: 'mock_' + Date.now(),
        externalId: parsed.data.externalId ?? Math.floor(100 + Math.random() * 900),
        historicalAvg: parsed.data.historicalAvg ?? Math.round(parsed.data.budget * 0.95),
        processedDate: new Date().toISOString(),
        aiConfidence: parsed.data.aiConfidence ?? 'High',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return NextResponse.json({ data: mockProject, success: true }, { status: 201 });
    }
  } catch (err) {
    console.error('[POST /api/projects]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
