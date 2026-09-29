// =============================================================================
// app/api/historical/route.ts - GET /api/historical
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAllHistoricalProjects } from '@/services/database/historical';
import { HistoricalFiltersSchema } from '@/lib/validation';
import { INITIAL_HISTORICAL, INITIAL_PROJECTS } from '@/lib/initialData';
import { calculateCategoryStats, aggregateAgencyMetrics } from '@/lib/historicalAnalytics';
import { HistoricalProject } from '@/types/historical';
import { ProjectCategory } from '@/types/project';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = HistoricalFiltersSchema.safeParse(params);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { category, department, year, search, stats, agencies } = parsed.data;

    let allData: HistoricalProject[] = INITIAL_HISTORICAL;
    try {
      const dbAll = await getAllHistoricalProjects();
      if (dbAll && dbAll.length > 0) {
        allData = dbAll as unknown as HistoricalProject[];
      }
    } catch {}

    let filteredData = [...allData];

    if (category) {
      filteredData = filteredData.filter((d) => d.category === category);
    }
    if (department) {
      filteredData = filteredData.filter(
        (d) => d.department.th === department || d.department.en === department,
      );
    }
    if (year) {
      filteredData = filteredData.filter((d) => d.year === year);
    }
    if (search) {
      const q = search.toLowerCase().trim();
      filteredData = filteredData.filter(
        (d) =>
          d.title.th.toLowerCase().includes(q) ||
          d.title.en.toLowerCase().includes(q) ||
          d.department.th.toLowerCase().includes(q) ||
          d.department.en.toLowerCase().includes(q) ||
          (d.description?.th && d.description.th.toLowerCase().includes(q)) ||
          (d.description?.en && d.description.en.toLowerCase().includes(q)),
      );
    }

    const responsePayload: Record<string, unknown> = {
      data: filteredData,
      total: filteredData.length,
    };

    if (stats === 'true') {
      const categories: (ProjectCategory | 'All')[] = ['All', 'Website', 'Mobile App', 'AI', 'Database'];
      const statsMap: Record<string, unknown> = {};
      categories.forEach((cat) => {
        statsMap[cat] = calculateCategoryStats(cat, allData);
      });
      responsePayload.stats = statsMap;
    }

    if (agencies === 'true') {
      responsePayload.agencies = aggregateAgencyMetrics(allData, INITIAL_PROJECTS);
    }

    return NextResponse.json(responsePayload);
  } catch (err) {
    console.error('[GET /api/historical]', err);
    return NextResponse.json({ data: INITIAL_HISTORICAL, total: INITIAL_HISTORICAL.length });
  }
}

