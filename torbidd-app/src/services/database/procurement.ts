// =============================================================================
// services/database/procurement.ts - Procurement Database Services
// =============================================================================

import connectToDatabase from '@/lib/mongodb';
import ProcurementProject, { IProcurementProject } from '@/models/ProcurementProject';
import ProcurementDocument, { IProcurementDocument } from '@/models/ProcurementDocument';
import { DeduplicationCheckResult, DiscoveredProject, ProcurementDocumentRecord } from '@/types/procurement';
import mongoose, { Types } from 'mongoose';
import crypto from 'node:crypto';
import { notifyMatchingUsers } from '@/services/procurement-matching';
import { notifySavedProcurementUpdate } from '@/services/procurement-diff';

/**
 * Generate a deterministic SHA-256 content hash for secondary deduplication.
 */
export function generateProjectContentHash(project: Partial<DiscoveredProject>): string {
  const normalized = [
    project.externalProjectId?.trim() ?? '',
    project.projectName?.trim() ?? '',
    String(project.budget ?? 0),
    String(project.fiscalYear ?? ''),
    project.agencyName?.trim() ?? '',
    project.procurementType?.trim() ?? '',
  ].join('|');

  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * Pre-ingestion check logic: Identifies existing, updated (revisions), and duplicate records
 * using primary key (externalProjectId) and secondary key (contentHash) before heavy downstream processing.
 */
export async function checkProjectDeduplication(
  projects: DiscoveredProject[],
): Promise<DeduplicationCheckResult> {
  if (!projects || projects.length === 0) {
    return {
      newProjects: [],
      updatedProjects: [],
      duplicateProjects: [],
      metrics: { totalChecked: 0, newCount: 0, updatedCount: 0, duplicateCount: 0 },
    };
  }

  await connectToDatabase();

  const externalIds = projects.map((p) => p.externalProjectId);
  const existingRecords = await ProcurementProject.find({
    externalProjectId: { $in: externalIds },
  }).lean();

  const existingMap = new Map(existingRecords.map((r) => [r.externalProjectId, r]));

  const newProjects: DiscoveredProject[] = [];
  const updatedProjects: Array<{
    project: DiscoveredProject;
    oldRevision: number;
    newRevision: number;
    reason: string;
  }> = [];
  const duplicateProjects: Array<{
    project: DiscoveredProject;
    existingRevision: number;
  }> = [];

  for (const p of projects) {
    const hash = p.contentHash || generateProjectContentHash(p);
    const enriched: DiscoveredProject = { ...p, contentHash: hash };
    const existing = existingMap.get(p.externalProjectId);

    if (!existing) {
      newProjects.push({ ...enriched, revision: 1 });
    } else {
      const existingHash = existing.contentHash || generateProjectContentHash(existing as unknown as DiscoveredProject);
      if (existingHash !== hash) {
        const oldRev = existing.revision ?? 1;
        const newRev = oldRev + 1;
        updatedProjects.push({
          project: { ...enriched, revision: newRev },
          oldRevision: oldRev,
          newRevision: newRev,
          reason: `Content hash changed from ${existingHash.slice(0, 8)} to ${hash.slice(0, 8)} (budget or project details modified)`,
        });
      } else {
        duplicateProjects.push({
          project: enriched,
          existingRevision: existing.revision ?? 1,
        });
      }
    }
  }

  const result: DeduplicationCheckResult = {
    newProjects,
    updatedProjects,
    duplicateProjects,
    metrics: {
      totalChecked: projects.length,
      newCount: newProjects.length,
      updatedCount: updatedProjects.length,
      duplicateCount: duplicateProjects.length,
    },
  };

  // Structured Logging for Traceability
  console.info('[Deduplication Audit]', {
    totalChecked: result.metrics.totalChecked,
    newCount: result.metrics.newCount,
    updatedCount: result.metrics.updatedCount,
    duplicateCount: result.metrics.duplicateCount,
    duplicateExternalIds: duplicateProjects.map((d) => d.project.externalProjectId),
    updatedRevisions: updatedProjects.map((u) => ({
      externalProjectId: u.project.externalProjectId,
      oldRev: u.oldRevision,
      newRev: u.newRevision,
      reason: u.reason,
    })),
  });

  return result;
}

/**
 * Idempotently upsert discovered procurement projects into MongoDB with conflict resolution.
 * Ensures no duplicate projects are created for the same externalProjectId,
 * tracks contentHash secondary key, and increments revision numbers when project content changes.
 */
export async function upsertDiscoveredProjects(
  projects: DiscoveredProject[],
): Promise<{ upsertedCount: number; modifiedCount: number; matchedCount: number; dedupMetrics?: DeduplicationCheckResult['metrics'] }> {
  if (!projects || projects.length === 0) {
    return { upsertedCount: 0, modifiedCount: 0, matchedCount: 0 };
  }

  await connectToDatabase();

  let dedup: DeduplicationCheckResult | undefined;
  try {
    dedup = await checkProjectDeduplication(projects);
  } catch {
    // Continue if DB check fails
  }

  const updatedRevMap = new Map(dedup?.updatedProjects.map((u) => [u.project.externalProjectId, u.newRevision]) ?? []);

  const operations = projects.map((p) => {
    const hash = p.contentHash || generateProjectContentHash(p);
    const newRev = updatedRevMap.get(p.externalProjectId);

    // Conflict resolution & merge rules
    const updateSet: Record<string, unknown> = {
      projectName: p.projectName,
      agencyName: p.agencyName,
      fiscalYear: p.fiscalYear,
      source: p.source || 'CKAN_GOVSPENDING',
      sourceUrl: p.sourceUrl || '',
      budget: p.budget ?? 0,
      contractPrice: p.contractPrice,
      procurementType: p.procurementType || '',
      contentHash: hash,
      updatedAt: new Date(),
    };

    if (p.publishDate) {
      updateSet.publishDate = p.publishDate instanceof Date ? p.publishDate : new Date(p.publishDate);
    }
    if (p.deadline) {
      updateSet.deadline = p.deadline instanceof Date ? p.deadline : new Date(p.deadline);
    }
    if (p.status) {
      updateSet.status = p.status;
    }
    if (p.torStatus) {
      updateSet.torStatus = p.torStatus;
    }
    if (p.contractDate) {
      updateSet.contractDate = p.contractDate instanceof Date ? p.contractDate : new Date(p.contractDate);
    }
    if (p.contractFinishDate) {
      updateSet.contractFinishDate = p.contractFinishDate instanceof Date ? p.contractFinishDate : new Date(p.contractFinishDate);
    }
    if (p.winnerName) {
      updateSet.winnerName = p.winnerName;
    }
    if (p.medianPrice !== undefined) {
      updateSet.medianPrice = p.medianPrice;
    }
    if (p.timeline && p.timeline.length > 0) {
      updateSet.timeline = p.timeline;
    }
    if (p.rawPayload) {
      updateSet.rawPayload = p.rawPayload;
    }

    updateSet.is_software = p.is_software ?? true;
    updateSet.software_category = p.software_category ?? 'Software / IT';
    updateSet.ai_confidence = p.ai_confidence ?? 'High';
    updateSet.classification_reason = p.classification_reason ?? '';
    updateSet.classified_by = p.classified_by ?? 'rule';
    updateSet.classified_at = p.classified_at
      ? (p.classified_at instanceof Date ? p.classified_at : new Date(p.classified_at))
      : new Date();
    updateSet.admin_reviewed = p.admin_reviewed ?? false;

    if (newRev !== undefined) {
      updateSet.revision = newRev;
    }

    return {
      updateOne: {
        filter: { externalProjectId: p.externalProjectId },
        update: {
          $set: updateSet,
          $setOnInsert: {
            externalProjectId: p.externalProjectId,
            revision: 1,
            discoveredAt: new Date(),
            createdAt: new Date(),
          },
        },
        upsert: true,
      },
    };
  });

  const result = await ProcurementProject.bulkWrite(operations);

  // Trigger outbound notification evaluation for newly discovered and updated projects
  try {
    if (dedup && dedup.newProjects.length > 0) {
      for (const np of dedup.newProjects) {
        notifyMatchingUsers({
          id: np.externalProjectId,
          externalId: np.externalProjectId,
          title: { th: np.projectName, en: np.projectName },
          budget: np.budget ?? 0,
          agencyName: np.agencyName,
          category: np.procurementType,
          requiredTechnologies: np.requiredTechnologies,
        }).catch((err) => console.warn('[Notification] Error evaluating new procurement:', err));
      }
    }

    if (dedup && dedup.updatedProjects.length > 0) {
      for (const up of dedup.updatedProjects) {
        notifySavedProcurementUpdate(
          {
            externalProjectId: up.project.externalProjectId,
            revision: up.oldRevision,
            title: up.project.projectName,
          },
          {
            externalProjectId: up.project.externalProjectId,
            revision: up.newRevision,
            title: up.project.projectName,
            budget: up.project.budget,
            contractPrice: up.project.contractPrice,
          },
        ).catch((err) => console.warn('[Notification] Error evaluating updated procurement:', err));
      }
    }
  } catch (notifErr) {
    console.warn('[Notification] Ingestion notification hook error:', notifErr);
  }

  return {
    upsertedCount: result.upsertedCount,
    modifiedCount: result.modifiedCount,
    matchedCount: result.matchedCount,
    dedupMetrics: dedup?.metrics,
  };
}

import { getCachedDiscoveredProjects, cacheDiscoveredProjects } from '@/services/ingestion/sync-state';

/**
 * Retrieve discovered procurement projects with optional filtering and pagination.
 */
export async function getProcurementProjects(params: {
  search?: string;
  fiscalYear?: number;
  softwareOnly?: boolean;
  limit?: number;
  offset?: number;
} = {}): Promise<{ projects: (IProcurementProject | DiscoveredProject)[]; total: number }> {
  try {
    await connectToDatabase();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: Record<string, any> = {};

    if (params.search) {
      const regex = new RegExp(params.search, 'i');
      query.$or = [
        { projectName: regex },
        { agencyName: regex },
        { externalProjectId: regex },
      ];
    }

    if (params.fiscalYear) {
      query.fiscalYear = params.fiscalYear;
    }

    if (params.softwareOnly) {
      query.is_software = { $ne: false };
    }

    const limit = Math.min(params.limit ?? 100, 1000);
    const offset = params.offset ?? 0;

    const [projects, total] = await Promise.all([
      ProcurementProject.find(query)
        .sort({ discoveredAt: -1, createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      ProcurementProject.countDocuments(query),
    ]);

    if (projects.length > 0) {
      return { projects: projects as unknown as IProcurementProject[], total };
    }
  } catch {
    // If DB is offline or empty, fallback to cached discovered projects
  }

  let cached = getCachedDiscoveredProjects();
  if (params.search) {
    const q = params.search.toLowerCase();
    cached = cached.filter(
      (p) =>
        p.projectName.toLowerCase().includes(q) ||
        p.agencyName.toLowerCase().includes(q) ||
        p.externalProjectId.includes(q),
    );
  }
  if (params.fiscalYear) {
    cached = cached.filter((p) => p.fiscalYear === params.fiscalYear);
  }
  if (params.softwareOnly) {
    cached = cached.filter((p) => p.is_software !== false);
  }

  const total = cached.length;
  const limit = Math.min(params.limit ?? 100, 1000);
  const offset = params.offset ?? 0;
  const sliced = cached.slice(offset, offset + limit);

  return { projects: sliced, total };
}

/**
 * Retrieve a project by its 11-digit external project ID.
 */
export async function getProcurementProjectByExternalId(
  externalProjectId: string,
): Promise<IProcurementProject | null> {
  try {
    await connectToDatabase();
    const proj = await ProcurementProject.findOne({ externalProjectId }).lean();
    if (proj) return proj as unknown as IProcurementProject;
  } catch {}

  const cached = getCachedDiscoveredProjects();
  const found = cached.find((p) => p.externalProjectId === externalProjectId);
  return (found as unknown as IProcurementProject) ?? null;
}

/**
 * Retrieve a project by its MongoDB ObjectId.
 */
export async function getProcurementProjectById(
  id: string,
): Promise<IProcurementProject | null> {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(id)) return null;
  return ProcurementProject.findById(id).lean() as unknown as Promise<IProcurementProject | null>;
}

/**
 * Idempotently save a downloaded/extracted document.
 * If a document with the same externalProjectId, documentType, and fileName exists,
 * it returns the existing document to avoid duplicate downloads.
 */
export async function saveProcurementDocument(
  docData: Omit<ProcurementDocumentRecord, '_id'>,
): Promise<{ document: IProcurementDocument; isNew: boolean }> {
  await connectToDatabase();

  // Check if document already exists
  const existing = await ProcurementDocument.findOne({
    externalProjectId: docData.externalProjectId,
    documentType: docData.documentType,
    fileName: docData.fileName,
  });

  if (existing) {
    // If existing document already downloaded/processed, don't duplicate
    return {
      document: existing as unknown as IProcurementDocument,
      isNew: false,
    };
  }

  // Ensure projectId is a valid ObjectId
  let targetProjectId = docData.projectId;
  if (!mongoose.isValidObjectId(targetProjectId)) {
    // If not a valid ObjectId (e.g. was passed as externalProjectId), lookup project
    const project = await ProcurementProject.findOne({ externalProjectId: docData.externalProjectId });
    if (project) {
      targetProjectId = (project._id as Types.ObjectId).toString();
    }
  }

  const newDoc = new ProcurementDocument({
    projectId: targetProjectId,
    externalProjectId: docData.externalProjectId,
    documentType: docData.documentType,
    fileName: docData.fileName,
    filePath: docData.filePath,
    storageReference: docData.storageReference || docData.filePath,
    source: docData.source || 'NATIONAL_EGP',
    sourceUrl: docData.sourceUrl || '',
    fileSize: docData.fileSize || 0,
    mimeType: docData.mimeType || 'application/pdf',
    downloadedAt: docData.downloadedAt ? new Date(docData.downloadedAt) : new Date(),
    status: docData.status || 'PROCESSED',
    errorMessage: docData.errorMessage,
  });

  const saved = await newDoc.save();
  return {
    document: saved as unknown as IProcurementDocument,
    isNew: true,
  };
}

/**
 * Update a procurement project with AI/heuristic extracted TOR information.
 */
export async function updateProcurementProjectExtraction(
  externalProjectId: string,
  extraction: {
    summary?: { th: string; en: string };
    budget?: number | null;
    deadline?: string | null;
    requiredTechnologies?: string[];
    technicalRequirements?: { th: string[]; en: string[] };
    extractedQualifications?: Array<{
      id: string;
      description: { th: string; en: string };
      category: 'Legal' | 'Financial' | 'Experience' | 'Technical';
      threshold?: string;
      mandatory: boolean;
    }>;
  },
): Promise<IProcurementProject | null> {
  const updateData: Record<string, unknown> = {
    extractionStatus: 'EXTRACTED',
    updatedAt: new Date(),
  };

  if (extraction.summary) updateData.summary = extraction.summary;
  if (extraction.requiredTechnologies) updateData.requiredTechnologies = extraction.requiredTechnologies;
  if (extraction.technicalRequirements) updateData.technicalRequirements = extraction.technicalRequirements;
  if (extraction.extractedQualifications) updateData.extractedQualifications = extraction.extractedQualifications;
  if (extraction.budget && extraction.budget > 0) updateData.budget = extraction.budget;
  if (extraction.deadline) {
    const d = new Date(extraction.deadline);
    if (!isNaN(d.getTime())) {
      updateData.deadline = d;
    }
  }
  updateData.torStatus = 'AVAILABLE';

  try {
    await connectToDatabase();
    const updated = await ProcurementProject.findOneAndUpdate(
      { externalProjectId },
      { $set: updateData },
      { new: true },
    ).lean();

    if (updated) {
      const cached = getCachedDiscoveredProjects();
      const idx = cached.findIndex((p) => p.externalProjectId === externalProjectId);
      if (idx !== -1) {
        cached[idx] = {
          ...cached[idx],
          ...updateData,
        };
        cacheDiscoveredProjects(cached);
      }
      return updated as unknown as IProcurementProject;
    }
  } catch (err) {
    console.warn(`[Procurement DB] Failed to update extraction for ${externalProjectId}:`, err);
  }

  // Update in cache directly if DB is offline
  const cached = getCachedDiscoveredProjects();
  const idx = cached.findIndex((p) => p.externalProjectId === externalProjectId);
  if (idx !== -1) {
    cached[idx] = {
      ...cached[idx],
      ...updateData,
    };
    cacheDiscoveredProjects(cached);
    return cached[idx] as unknown as IProcurementProject;
  }

  return null;
}


/**
 * Retrieve all procurement documents for a project (by externalProjectId or MongoDB _id).
 */
export async function getDocumentsByProjectId(
  projectIdOrExternalId: string,
): Promise<IProcurementDocument[]> {
  try {
    await connectToDatabase();

    const isObjectId = Types.ObjectId.isValid(projectIdOrExternalId);
    const query = isObjectId
      ? { $or: [{ projectId: new Types.ObjectId(projectIdOrExternalId) }, { externalProjectId: projectIdOrExternalId }] }
      : { externalProjectId: projectIdOrExternalId };

    const docs = await ProcurementDocument.find(query).sort({ downloadedAt: -1 }).lean();
    if (docs && docs.length > 0) return docs as unknown as IProcurementDocument[];
  } catch {}

  return [];
}

/**
 * Retrieve a project together with all its associated documents.
 */
export async function getProjectWithDocuments(
  projectIdOrExternalId: string,
): Promise<{ project: IProcurementProject | DiscoveredProject; documents: IProcurementDocument[] } | null> {
  try {
    await connectToDatabase();

    let project: IProcurementProject | null = null;
    if (Types.ObjectId.isValid(projectIdOrExternalId)) {
      project = await ProcurementProject.findById(projectIdOrExternalId).lean() as unknown as IProcurementProject | null;
    }
    if (!project) {
      project = await ProcurementProject.findOne({
        $or: [
          { externalProjectId: projectIdOrExternalId },
          { externalProjectId: { $regex: `^${projectIdOrExternalId}` } },
        ],
      }).lean() as unknown as IProcurementProject | null;
    }

    if (project) {
      const documents = await ProcurementDocument.find({
        $or: [{ projectId: project._id }, { externalProjectId: project.externalProjectId }],
      }).sort({ downloadedAt: -1 }).lean() as unknown as IProcurementDocument[];

      return { project, documents };
    }
  } catch {}

  // Fallback to cached discovered projects
  const cachedList = getCachedDiscoveredProjects();
  const found = cachedList.find(
    (p) =>
      p.externalProjectId === projectIdOrExternalId ||
      p.externalProjectId.startsWith(projectIdOrExternalId) ||
      String(p.externalProjectId).includes(projectIdOrExternalId),
  );
  if (found) {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const projectDir = path.resolve(process.cwd(), 'storage', 'documents', found.externalProjectId);
    const diskDocs: IProcurementDocument[] = [];

    if (fs.existsSync(projectDir)) {
      try {
        const files = fs.readdirSync(projectDir);
        for (const file of files) {
          if (file.toLowerCase().endsWith('.pdf')) {
            const isTor = file.toLowerCase().includes('tor') || file.includes('ขอบเขต');
            const stat = fs.statSync(path.join(projectDir, file));
            diskDocs.push({
              _id: file as unknown,
              projectId: found.externalProjectId as unknown,
              externalProjectId: found.externalProjectId,
              documentType: isTor ? 'ATTACH_TOR' : 'ANNOUNCEMENT',
              fileName: file,
              filePath: `storage/documents/${found.externalProjectId}/${file}`,
              storageReference: path.join(projectDir, file),
              source: 'NATIONAL_EGP',
              sourceUrl: found.sourceUrl,
              fileSize: stat.size,
              mimeType: 'application/pdf',
              downloadedAt: stat.mtime,
              status: 'PROCESSED',
            } as unknown as IProcurementDocument);
          }
        }
      } catch {}
    }

    return { project: found, documents: diskDocs };
  }

  return null;
}
