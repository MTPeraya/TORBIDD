// =============================================================================
// app/api/projects/route.ts - GET /api/projects
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getProjects, createProject } from '@/services/database/projects';
import { getProcurementProjects } from '@/services/database/procurement';
import { ProjectFiltersSchema, ProjectCreateSchema } from '@/lib/validation';
import { INITIAL_PROJECTS } from '@/lib/initialData';
import { Project } from '@/types/project';
import { procurementToProject } from '@/lib/project-mapper';
import { getSyncStatus } from '@/services/ingestion/sync-state';

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
      let filtered = bmaList;
      if (parsed.data.search) {
        const q = parsed.data.search.toLowerCase();
        filtered = filtered.filter(
          (p) =>
            p.title.th.toLowerCase().includes(q) ||
            p.title.en.toLowerCase().includes(q) ||
            p.department.th.toLowerCase().includes(q) ||
            p.department.en.toLowerCase().includes(q),
        );
      }
      return NextResponse.json({
        data: filtered,
        total: filtered.length,
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
      if (parsed.data.search) {
        const q = parsed.data.search.toLowerCase();
        bmaProjects = bmaProjects.filter(
          (p) =>
            p.title.th.toLowerCase().includes(q) ||
            p.title.en.toLowerCase().includes(q) ||
            p.department.th.toLowerCase().includes(q) ||
            p.department.en.toLowerCase().includes(q),
        );
      }
    }

    // 5. Combine discovered live projects with BMA projects (live projects first)
    const combined = [...discoveredProjectsMapped, ...bmaProjects];
    return NextResponse.json({
      data: combined,
      total: combined.length,
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
