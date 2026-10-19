// =============================================================================
// app/api/historical/route.ts - GET /api/historical
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAllHistoricalProjects } from '@/services/database/historical';
import { getProcurementProjects } from '@/services/database/procurement';
import { procurementToProject } from '@/lib/project-mapper';
import { HistoricalFiltersSchema } from '@/lib/validation';
import { calculateCategoryStats, aggregateAgencyMetrics } from '@/lib/historicalAnalytics';
import { HistoricalProject } from '@/types/historical';
import { ProjectCategory, Project } from '@/types/project';

export const dynamic = 'force-dynamic';

function inferCategory(title: string): ProjectCategory {
  const t = title.toLowerCase();
  if (t.includes('ai') || t.includes('ปัญญาประดิษฐ์') || t.includes('วิเคราะห์') || t.includes('กล้อง') || t.includes('gis')) return 'AI';
  if (t.includes('app') || t.includes('แอป') || t.includes('มือถือ') || t.includes('mobile')) return 'Mobile App';
  if (t.includes('ฐานข้อมูล') || t.includes('data') || t.includes('database') || t.includes('คลังข้อมูล') || t.includes('server')) return 'Database';
  return 'Website';
}

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

    let allData: HistoricalProject[] = [];

    // 1. Query MongoDB HistoricalProject collection
    try {
      const dbAll = await getAllHistoricalProjects();
      if (dbAll && dbAll.length > 0) {
        allData = dbAll as unknown as HistoricalProject[];
      }
    } catch (dbErr) {
      console.warn('[GET /api/historical] Error querying historical projects from DB:', dbErr);
    }

    // 2. Query MongoDB ProcurementProject collection (real government procurement projects)
    if (allData.length === 0) {
      try {
        const { projects: discProjects } = await getProcurementProjects({ limit: 500 });
        if (discProjects && discProjects.length > 0) {
          allData = discProjects.map((dp) => ({
            _id: dp._id || dp.externalProjectId,
            title: { th: dp.projectName, en: dp.projectName },
            department: { th: dp.agencyName, en: dp.agencyName },
            year: dp.fiscalYear ? (dp.fiscalYear > 2500 ? dp.fiscalYear - 543 : dp.fiscalYear) : 2024,
            category: inferCategory(dp.projectName),
            budget: dp.budget || dp.contractPrice || dp.medianPrice || 1000000,
            procurementType: dp.procurementType || 'e-Bidding',
            awardedVendor: dp.winnerName ? { th: dp.winnerName, en: dp.winnerName } : undefined,
            description: dp.summary || { th: dp.projectName, en: dp.projectName },
          })) as HistoricalProject[];
        }
      } catch (procErr) {
        console.warn('[GET /api/historical] Error querying procurement projects from DB:', procErr);
      }
    }

    // 3. If database is unpopulated or offline, fetch real data from Thai Open Government Data API (CKAN)
    if (allData.length === 0 && process.env.GOVSPENDING_API_KEY) {
      try {
        const { GovSpendingClient } = await import('@/services/ingestion/clients/govspending-client');
        const client = new GovSpendingClient();
        const govRes = await client.searchProjects({
          keyword: 'ซอฟต์แวร์',
          limit: 100,
          fiscalYear: 2567,
        });
        if (govRes.projects && govRes.projects.length > 0) {
          allData = govRes.projects.map((p) => ({
            _id: p.externalProjectId,
            title: { th: p.projectName, en: p.projectName },
            department: { th: p.agencyName, en: p.agencyName },
            year: p.fiscalYear ? (p.fiscalYear > 2500 ? p.fiscalYear - 543 : p.fiscalYear) : 2024,
            category: inferCategory(p.projectName),
            budget: p.budget || p.contractPrice || p.medianPrice || 1000000,
            procurementType: p.procurementType || 'e-Bidding',
            awardedVendor: p.winnerName ? { th: p.winnerName, en: p.winnerName } : undefined,
            description: p.summary || { th: p.projectName, en: p.projectName },
          })) as HistoricalProject[];
        }
      } catch (liveErr) {
        console.warn('[GET /api/historical] GovSpending API live fetch error:', liveErr);
      }
    }

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
      let activeProjects: Project[] = [];
      try {
        const { projects: discProjects } = await getProcurementProjects();
        if (discProjects) {
          activeProjects = discProjects.map(procurementToProject);
        }
      } catch {}
      responsePayload.agencies = aggregateAgencyMetrics(allData, activeProjects);
    }

    return NextResponse.json(responsePayload);
  } catch (err) {
    console.error('[GET /api/historical]', err);
    return NextResponse.json({ data: [], total: 0 });
  }
}

