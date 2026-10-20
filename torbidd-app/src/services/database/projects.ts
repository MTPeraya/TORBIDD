// =============================================================================
// services/database/projects.ts - Project Repository
// =============================================================================

import connectToDatabase from '@/lib/mongodb';
import Project, { IProject } from '@/models/Project';
import ProcurementProject, { IProcurementProject } from '@/models/ProcurementProject';
import { Project as ProjectType, ProjectFilters } from '@/types/project';
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
      { category: regex },
    ];
  }

  // Agency / Department filtering (single or multiple)
  const targetAgencies: string[] = [];
  if (filters.department) targetAgencies.push(filters.department);
  if (filters.agency) targetAgencies.push(filters.agency);
  if (filters.agencies) {
    if (Array.isArray(filters.agencies)) {
      targetAgencies.push(...filters.agencies);
    } else if (typeof filters.agencies === 'string') {
      targetAgencies.push(...filters.agencies.split(',').map((s) => s.trim()));
    }
  }

  if (targetAgencies.length === 1) {
    query.$or = [
      ...(query.$or ? [{ $or: query.$or }] : []),
      { 'department.th': targetAgencies[0] },
      { 'department.en': targetAgencies[0] },
    ];
  } else if (targetAgencies.length > 1) {
    query.$or = [
      ...(query.$or ? [{ $or: query.$or }] : []),
      { 'department.th': { $in: targetAgencies } },
      { 'department.en': { $in: targetAgencies } },
    ];
  }

  // Category filtering (single or multiple)
  const targetCategories: string[] = [];
  if (filters.category) targetCategories.push(filters.category);
  if (filters.categories) {
    if (Array.isArray(filters.categories)) {
      targetCategories.push(...filters.categories);
    } else if (typeof filters.categories === 'string') {
      targetCategories.push(...filters.categories.split(',').map((s) => s.trim()));
    }
  }

  if (targetCategories.length === 1) {
    query.category = targetCategories[0];
  } else if (targetCategories.length > 1) {
    query.category = { $in: targetCategories };
  }

  // UC-10: Software related flag filtering
  if (filters.isSoftwareRelated !== undefined) {
    query.isSoftwareRelated = filters.isSoftwareRelated;
  }

  // UC-10: Classification review status filtering
  if (filters.classificationReviewStatus) {
    query.classificationReviewStatus = filters.classificationReviewStatus;
  }

  // Budget preset filtering
  if (filters.budget) {
    switch (filters.budget) {
      case 'under5m':  query.budget = { $lt: 5_000_000 }; break;
      case '5to10':    query.budget = { $gte: 5_000_000, $lte: 10_000_000 }; break;
      case '10to20':   query.budget = { $gte: 10_000_000, $lte: 20_000_000 }; break;
      case 'above20m': query.budget = { $gt: 20_000_000 }; break;
    }
  }

  // Direct minBudget / maxBudget
  if (filters.minBudget !== undefined || filters.maxBudget !== undefined) {
    query.budget = query.budget || {};
    if (filters.minBudget !== undefined && !isNaN(filters.minBudget)) {
      query.budget.$gte = filters.minBudget;
    }
    if (filters.maxBudget !== undefined && !isNaN(filters.maxBudget)) {
      query.budget.$lte = filters.maxBudget;
    }
  }

  // Deterministic sorting with secondary key
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sortCriteria: Record<string, any> = { publishDate: -1, externalId: -1 };
  if (filters.sortBy === 'publishDate_asc' || filters.sortBy === 'oldest') {
    sortCriteria = { publishDate: 1, externalId: 1 };
  } else if (filters.sortBy === 'budget_desc') {
    sortCriteria = { budget: -1, externalId: -1 };
  } else if (filters.sortBy === 'budget_asc') {
    sortCriteria = { budget: 1, externalId: 1 };
  } else if (filters.sortBy === 'deadline_asc') {
    sortCriteria = { deadline: 1, externalId: 1 };
  } else if (filters.sortBy === 'deadline_desc') {
    sortCriteria = { deadline: -1, externalId: -1 };
  }

  let projects = await Project.find(query).sort(sortCriteria).lean();

  if (filters.deadline) {
    projects = projects.filter((p) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = p as any;
      if (raw.winnerName || raw.status === 'จัดทำสัญญาแล้ว' || raw.status === 'มีผู้ชนะ/ทำสัญญาแล้ว') {
        return false;
      }
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

export async function createProject(data: Record<string, unknown>): Promise<IProject> {
  await connectToDatabase();

  let externalId = data.externalId as number | undefined;
  if (!externalId) {
    const highest = await Project.findOne().sort({ externalId: -1 }).select('externalId').lean();
    externalId = highest?.externalId ? highest.externalId + 1 : 100;
  }

  const budget = Number(data.budget) || 0;
  const historicalAvg = Number(data.historicalAvg) || Math.round(budget * 0.96);

  const newProject = new Project({
    ...data,
    externalId,
    historicalAvg,
    publishDate: new Date(data.publishDate as string),
    deadline: new Date(data.deadline as string),
    processedDate: new Date(),
    aiConfidence: data.aiConfidence || 'High',
    timeline: data.timeline ?? [
      {
        id: 't-1',
        event: { th: 'เผยแพร่เอกสารประกาศร่าง TOR', en: 'Draft TOR Document Published' },
        date: new Date(data.publishDate as string).toISOString().split('T')[0],
        status: 'completed',
      },
      {
        id: 't-2',
        event: { th: 'กำหนดวันสิ้นสุดการรับข้อเสนอ (Deadline)', en: 'Submission Deadline' },
        date: new Date(data.deadline as string).toISOString().split('T')[0],
        status: 'active',
      },
    ],
    budgetBreakdown: data.budgetBreakdown ?? [
      {
        category: { th: 'การพัฒนาและติดตั้งระบบซอฟต์แวร์', en: 'Software Development & Setup' },
        amount: Math.round(budget * 0.65),
        percentage: 65,
      },
      {
        category: { th: 'การทดสอบ การฝึกอบรม และถ่ายทอดเทคโนโลยี', en: 'Testing, Training & Handover' },
        amount: Math.round(budget * 0.2),
        percentage: 20,
      },
      {
        category: { th: 'การดูแลบำรุงรักษาและการรับประกัน (1 ปี)', en: 'Maintenance & 1-Year Warranty' },
        amount: Math.round(budget * 0.15),
        percentage: 15,
      },
    ],
    aiMetadata: data.aiMetadata ?? {
      model: 'Gemini 1.5 Pro / Vertex AI',
      confidenceScore: 95,
      verifiedByHuman: true,
      extractedClausesCount: 8,
      lastVerifiedDate: new Date().toISOString().split('T')[0],
    },
  });

  await newProject.save();
  return newProject.toObject();
}

export async function updateProject(
  idOrExternalId: string | number,
  data: Record<string, unknown>,
): Promise<IProject | IProcurementProject | ProjectType | null> {
  await connectToDatabase();

  const updatePayload = { ...data };
  if (updatePayload.publishDate) {
    updatePayload.publishDate = new Date(updatePayload.publishDate as string);
  }
  if (updatePayload.deadline) {
    updatePayload.deadline = new Date(updatePayload.deadline as string);
  }

  const idStr = String(idOrExternalId).trim();
  const isNumeric = !isNaN(Number(idOrExternalId)) && typeof idOrExternalId !== 'string' ? true : /^\d+$/.test(idStr);

  let updated: IProject | null = null;
  if (isNumeric) {
    updated = await Project.findOneAndUpdate(
      { externalId: Number(idOrExternalId) },
      { $set: updatePayload },
      { new: true },
    ).lean();
  } else if (/^[0-9a-fA-F]{24}$/.test(idStr)) {
    updated = await Project.findByIdAndUpdate(
      idOrExternalId,
      { $set: updatePayload },
      { new: true },
    ).lean();
  }

  if (updated) {
    return updated;
  }

  // If not found in Project, update in ProcurementProject
  const procUpdate: Record<string, unknown> = {};
  if (data.title) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = data.title as any;
    procUpdate.projectName = t.th || t.en || String(t);
  } else if (data.projectName) {
    procUpdate.projectName = String(data.projectName);
  }

  if (data.department) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = data.department as any;
    procUpdate.agencyName = d.th || d.en || String(d);
  } else if (data.agencyName) {
    procUpdate.agencyName = String(data.agencyName);
  }

  if (data.budget !== undefined) procUpdate.budget = Number(data.budget);
  if (data.fiscalYear !== undefined) procUpdate.fiscalYear = Number(data.fiscalYear);
  if (data.category) procUpdate.software_category = String(data.category);
  if (data.procurementType) procUpdate.procurementType = String(data.procurementType);
  if (data.aiConfidence) procUpdate.ai_confidence = data.aiConfidence;

  if (data.isSoftwareRelated !== undefined) {
    procUpdate.is_software = Boolean(data.isSoftwareRelated);
    procUpdate.admin_reviewed = true;
    procUpdate.classified_by = 'admin';
    procUpdate.classified_at = new Date();
    procUpdate.classification_reason = data.isSoftwareRelated
      ? 'Administrator confirmed software classification (UC-10)'
      : 'Administrator confirmed non-software listing (UC-4 A5)';
  }

  if (data.description) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const desc = data.description as any;
    procUpdate.summary = { th: desc.th || desc, en: desc.en || desc };
  } else if (data.summary) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = data.summary as any;
    procUpdate.summary = { th: s.th || s, en: s.en || s };
  }

  const queryOr: Array<Record<string, unknown>> = [{ externalProjectId: idStr }];
  if (/^[0-9a-fA-F]{24}$/.test(idStr)) {
    queryOr.push({ _id: idStr });
  }

  const procDoc = await ProcurementProject.findOneAndUpdate(
    { $or: queryOr },
    { $set: procUpdate },
    { new: true },
  ).lean();

  if (procDoc) {
    const { procurementToProject } = await import('@/lib/project-mapper');
    return procurementToProject(procDoc);
  }

  return null;
}

export async function deleteProject(idOrExternalId: string | number): Promise<boolean> {
  await connectToDatabase();
  const idStr = String(idOrExternalId).trim();
  const isNumeric = !isNaN(Number(idOrExternalId)) && typeof idOrExternalId !== 'string' ? true : /^\d+$/.test(idStr);

  let deleted = false;
  if (isNumeric) {
    const res = await Project.deleteOne({ externalId: Number(idOrExternalId) });
    if (res.deletedCount > 0) deleted = true;
  } else if (/^[0-9a-fA-F]{24}$/.test(idStr)) {
    const res = await Project.findByIdAndDelete(idOrExternalId);
    if (res) deleted = true;
  }

  // Also check and delete from ProcurementProject
  const queryOr: Array<Record<string, unknown>> = [{ externalProjectId: idStr }];
  if (/^[0-9a-fA-F]{24}$/.test(idStr)) {
    queryOr.push({ _id: idStr });
  }

  const procRes = await ProcurementProject.deleteOne({ $or: queryOr });
  if (procRes.deletedCount > 0) deleted = true;

  return deleted;
}

export async function getAdminProjectStats(): Promise<{
  totalProjects: number;
  totalBudget: number;
  activeProjects: number;
  aiEnrichedCount: number;
  categoryCounts: Record<string, number>;
  confidenceCounts: Record<string, number>;
}> {
  await connectToDatabase();
  const [projects, procurementProjects] = await Promise.all([
    Project.find().lean(),
    ProcurementProject.find().lean().catch(() => []),
  ]);
  const now = new Date();

  const stats = {
    totalProjects: projects.length + procurementProjects.length,
    totalBudget:
      projects.reduce((acc, p) => acc + (p.budget || 0), 0) +
      procurementProjects.reduce((acc, p) => acc + (p.budget || 0), 0),
    activeProjects: projects.filter((p) => new Date(p.deadline) >= now).length + procurementProjects.length,
    aiEnrichedCount:
      projects.filter((p) => !!p.aiMetadata?.model || !!p.aiConfidence).length +
      procurementProjects.filter((p) => p.extractionStatus === 'EXTRACTED').length,
    categoryCounts: {} as Record<string, number>,
    confidenceCounts: { High: 0, Medium: 0, Low: 0 } as Record<string, number>,
  };

  for (const p of projects) {
    stats.categoryCounts[p.category] = (stats.categoryCounts[p.category] || 0) + 1;
    if (p.aiConfidence && p.aiConfidence in stats.confidenceCounts) {
      stats.confidenceCounts[p.aiConfidence]++;
    }
  }

  // Count software projects from procurement ingestion
  for (const pp of procurementProjects) {
    const isSw = (pp as unknown as Record<string, unknown>).is_software ?? true;
    const cat = ((pp as unknown as Record<string, unknown>).software_category as string) || (isSw ? 'Information System' : 'Other');
    stats.categoryCounts[cat] = (stats.categoryCounts[cat] || 0) + 1;

    const conf = (pp as unknown as Record<string, unknown>).ai_confidence as string;
    if (conf === 'Medium') {
      stats.confidenceCounts.Medium++;
    } else if (conf === 'Low') {
      stats.confidenceCounts.Low++;
    } else {
      stats.confidenceCounts.High++;
    }
  }

  return stats;
}

