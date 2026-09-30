// =============================================================================
// app/api/projects/[id]/tech-specs/route.ts
// Query extracted technical specifications by category (Frontend, Backend, Infra, Security)
// Issue #89: Tech Stack Taxonomy & Categorization Endpoint
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getProjectById,
  getProjectByExternalId,
} from '@/services/database/projects';
import { getProjectWithDocuments } from '@/services/database/procurement';
import { INITIAL_PROJECTS } from '@/lib/initialData';
import { enrichProjectDetail } from '@/lib/projectDetailHelper';
import { Project } from '@/types/project';
import {
  TechCategory,
  CategorizedTechnicalRequirement,
  normalizeTechList,
  categorizeTechnicalRequirement,
  extractTechEntitiesFromText,
} from '@/services/transformation/taxonomy/tech-taxonomy';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const cleanId = id.trim();
    const categoryParam = req.nextUrl.searchParams.get('category');
    const validCategories: TechCategory[] = ['Frontend', 'Backend', 'Infra', 'Security'];
    
    let categoryFilter: TechCategory | 'All' = 'All';
    if (categoryParam) {
      const match = validCategories.find(
        (c) => c.toLowerCase() === categoryParam.trim().toLowerCase(),
      );
      if (match) {
        categoryFilter = match;
      }
    }

    let projectObj: Project | null = null;

    // 1. Try finding in ProcurementProject
    try {
      const procurementData = await getProjectWithDocuments(cleanId);
      if (procurementData?.project) {
        const { procurementToProject } = await import('@/lib/project-mapper');
        const mapped = procurementToProject(procurementData.project);
        projectObj = enrichProjectDetail(mapped);
      }
    } catch {
      // Continue to next lookup
    }

    // 2. Try numeric externalId against existing Project model
    if (!projectObj) {
      const numId = parseInt(cleanId, 10);
      if (!isNaN(numId)) {
        try {
          const project = await getProjectByExternalId(numId);
          if (project) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const raw = typeof (project as any).toObject === 'function' ? (project as any).toObject() : project;
            projectObj = enrichProjectDetail(raw as unknown as Project);
          }
        } catch {}

        if (!projectObj) {
          const fallback = INITIAL_PROJECTS.find((p) => p.externalId === numId);
          if (fallback) {
            projectObj = enrichProjectDetail(fallback);
          }
        }
      }
    }

    // 3. Try ObjectId against existing Project model
    if (!projectObj && /^[0-9a-fA-F]{24}$/.test(cleanId)) {
      try {
        const project = await getProjectById(cleanId);
        if (project) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const raw = typeof (project as any).toObject === 'function' ? (project as any).toObject() : project;
          projectObj = enrichProjectDetail(raw as unknown as Project);
        }
      } catch {}
    }

    // 4. Try matching INITIAL_PROJECTS by string id or externalId
    if (!projectObj) {
      const fallback = INITIAL_PROJECTS.find(
        (p) => String(p.externalId) === cleanId || p._id === cleanId,
      );
      if (fallback) {
        projectObj = enrichProjectDetail(fallback);
      }
    }

    if (!projectObj) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // ─── Extract & Normalize Technologies ────────────────────────────────────
    const rawTechList: string[] = Array.isArray(projectObj.requiredTechnologies)
      ? [...projectObj.requiredTechnologies]
      : [];

    // If empty or sparse, scan text descriptions using taxonomy entity detector
    if (rawTechList.length === 0) {
      const scopeTexts = [
        ...(projectObj.scope?.th || []),
        ...(projectObj.scope?.en || []),
      ].join(' ');
      const textToScan = [
        projectObj.title?.th,
        projectObj.title?.en,
        projectObj.description?.th,
        projectObj.description?.en,
        scopeTexts,
      ].filter(Boolean).join(' ');
      const scanned = extractTechEntitiesFromText(textToScan);
      rawTechList.push(...scanned.map((s) => s.name));
    }

    const allNormalizedTech = normalizeTechList(rawTechList);

    // ─── Extract & Categorize Technical Requirements ─────────────────────────
    const requirements: CategorizedTechnicalRequirement[] = [];
    const techReq = projectObj.technicalRequirements;

    if (techReq) {
      const thList = Array.isArray(techReq.th) ? techReq.th : (typeof techReq.th === 'string' ? [techReq.th] : []);
      const enList = Array.isArray(techReq.en) ? techReq.en : (typeof techReq.en === 'string' ? [techReq.en] : []);
      const maxLen = Math.max(thList.length, enList.length);

      for (let i = 0; i < maxLen; i++) {
        const th = thList[i] || '';
        const en = enList[i] || '';
        const category = categorizeTechnicalRequirement(th, en);
        requirements.push({
          id: `req-${i + 1}`,
          category,
          text: { th, en },
          mandatory: true,
        });
      }
    }

    // Heuristic fallback if no explicit technical requirements exist
    if (requirements.length === 0 && projectObj.extractedQualifications) {
      for (let i = 0; i < projectObj.extractedQualifications.length; i++) {
        const q = projectObj.extractedQualifications[i];
        const category = categorizeTechnicalRequirement(q.description.th, q.description.en);
        requirements.push({
          id: q.id || `qual-${i + 1}`,
          category,
          text: q.description,
          mandatory: q.mandatory,
        });
      }
    }

    // ─── Filter by Category ──────────────────────────────────────────────────
    const counts = {
      total: allNormalizedTech.length,
      Frontend: allNormalizedTech.filter((t) => t.category === 'Frontend').length,
      Backend: allNormalizedTech.filter((t) => t.category === 'Backend').length,
      Infra: allNormalizedTech.filter((t) => t.category === 'Infra').length,
      Security: allNormalizedTech.filter((t) => t.category === 'Security').length,
    };

    const requirementCounts = {
      total: requirements.length,
      Frontend: requirements.filter((r) => r.category === 'Frontend').length,
      Backend: requirements.filter((r) => r.category === 'Backend').length,
      Infra: requirements.filter((r) => r.category === 'Infra').length,
      Security: requirements.filter((r) => r.category === 'Security').length,
    };

    const filteredTech = categoryFilter === 'All'
      ? allNormalizedTech
      : allNormalizedTech.filter((t) => t.category === categoryFilter);

    const filteredReqs = categoryFilter === 'All'
      ? requirements
      : requirements.filter((r) => r.category === categoryFilter);

    return NextResponse.json({
      success: true,
      projectId: cleanId,
      category: categoryFilter,
      counts: {
        technologies: counts,
        requirements: requirementCounts,
      },
      technologies: filteredTech,
      requirements: filteredReqs,
    });
  } catch (err) {
    console.error('[GET /api/projects/[id]/tech-specs]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
