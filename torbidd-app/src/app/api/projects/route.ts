// =============================================================================
// app/api/projects/route.ts - GET /api/projects
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getProjects } from '@/services/database/projects';
import { getProcurementProjects } from '@/services/database/procurement';
import { ProjectFiltersSchema } from '@/lib/validation';
import { INITIAL_PROJECTS } from '@/lib/initialData';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());

    // If requesting discovered CKAN / Open Data procurement projects
    if (params.source === 'CKAN_GOVSPENDING' || params.type === 'procurement' || params.type === 'discovered') {
      try {
        const { projects, total } = await getProcurementProjects({
          search: params.search,
          fiscalYear: params.fiscalYear ? parseInt(params.fiscalYear, 10) : undefined,
          limit: params.limit ? parseInt(params.limit, 10) : undefined,
          offset: params.offset ? parseInt(params.offset, 10) : undefined,
        });
        return NextResponse.json({ data: projects, total });
      } catch (err) {
        console.error('[GET /api/projects?source=CKAN_GOVSPENDING]', err);
        return NextResponse.json({ data: [], total: 0 });
      }
    }

    const parsed = ProjectFiltersSchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    try {
      const projects = await getProjects(parsed.data);
      if (projects && projects.length > 0) {
        return NextResponse.json({ data: projects, total: projects.length });
      }

      // Check if any discovered procurement projects exist to return
      const { projects: discProjects, total: discTotal } = await getProcurementProjects({
        search: parsed.data.search,
      });
      if (discProjects && discProjects.length > 0) {
        return NextResponse.json({ data: discProjects, total: discTotal });
      }
    } catch {
      // Fallback to initial dataset if DB not yet connected
    }

    return NextResponse.json({ data: INITIAL_PROJECTS, total: INITIAL_PROJECTS.length });
  } catch (err) {
    console.error('[GET /api/projects]', err);
    return NextResponse.json({ data: INITIAL_PROJECTS, total: INITIAL_PROJECTS.length });
  }
}
