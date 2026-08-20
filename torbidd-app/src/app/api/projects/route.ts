// =============================================================================
// app/api/projects/route.ts - GET /api/projects
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getProjects } from '@/services/database/projects';
import { ProjectFiltersSchema } from '@/lib/validation';
import { INITIAL_PROJECTS } from '@/lib/initialData';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
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
    } catch {
      // Fallback to initial dataset if DB not yet connected
    }

    return NextResponse.json({ data: INITIAL_PROJECTS, total: INITIAL_PROJECTS.length });
  } catch (err) {
    console.error('[GET /api/projects]', err);
    return NextResponse.json({ data: INITIAL_PROJECTS, total: INITIAL_PROJECTS.length });
  }
}
