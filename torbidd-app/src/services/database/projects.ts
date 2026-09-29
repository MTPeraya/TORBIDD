// =============================================================================
// services/database/projects.ts - Project Repository
// =============================================================================

import connectToDatabase from '@/lib/mongodb';
import Project, { IProject } from '@/models/Project';
import { ProjectFilters } from '@/types/project';
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
    ];
  }

  if (filters.department) {
    query['department.th'] = filters.department;
  }

  if (filters.category) {
    query.category = filters.category;
  }

  if (filters.budget) {
    switch (filters.budget) {
      case 'under5m':  query.budget = { $lt: 5_000_000 }; break;
      case '5to10':    query.budget = { $gte: 5_000_000, $lte: 10_000_000 }; break;
      case '10to20':   query.budget = { $gte: 10_000_000, $lte: 20_000_000 }; break;
      case 'above20m': query.budget = { $gt: 20_000_000 }; break;
    }
  }

  const projects = await Project.find(query).sort({ publishDate: -1 }).lean();

  if (filters.deadline) {
    return projects.filter((p) => {
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
): Promise<IProject | null> {
  await connectToDatabase();

  const updatePayload = { ...data };
  if (updatePayload.publishDate) {
    updatePayload.publishDate = new Date(updatePayload.publishDate as string);
  }
  if (updatePayload.deadline) {
    updatePayload.deadline = new Date(updatePayload.deadline as string);
  }

  const isNumeric = !isNaN(Number(idOrExternalId)) && typeof idOrExternalId !== 'string' ? true : /^\d+$/.test(String(idOrExternalId));

  let updated: IProject | null = null;
  if (isNumeric) {
    updated = await Project.findOneAndUpdate(
      { externalId: Number(idOrExternalId) },
      { $set: updatePayload },
      { new: true },
    ).lean();
  } else {
    updated = await Project.findByIdAndUpdate(
      idOrExternalId,
      { $set: updatePayload },
      { new: true },
    ).lean();
  }

  return updated;
}

export async function deleteProject(idOrExternalId: string | number): Promise<boolean> {
  await connectToDatabase();
  const isNumeric = !isNaN(Number(idOrExternalId)) && typeof idOrExternalId !== 'string' ? true : /^\d+$/.test(String(idOrExternalId));

  if (isNumeric) {
    const res = await Project.deleteOne({ externalId: Number(idOrExternalId) });
    return res.deletedCount > 0;
  }
  const res = await Project.findByIdAndDelete(idOrExternalId);
  return !!res;
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
  const projects = await Project.find().lean();
  const now = new Date();

  const stats = {
    totalProjects: projects.length,
    totalBudget: projects.reduce((acc, p) => acc + (p.budget || 0), 0),
    activeProjects: projects.filter((p) => new Date(p.deadline) >= now).length,
    aiEnrichedCount: projects.filter((p) => !!p.aiMetadata?.model || !!p.aiConfidence).length,
    categoryCounts: {} as Record<string, number>,
    confidenceCounts: { High: 0, Medium: 0, Low: 0 } as Record<string, number>,
  };

  for (const p of projects) {
    stats.categoryCounts[p.category] = (stats.categoryCounts[p.category] || 0) + 1;
    if (p.aiConfidence && p.aiConfidence in stats.confidenceCounts) {
      stats.confidenceCounts[p.aiConfidence]++;
    }
  }

  return stats;
}

