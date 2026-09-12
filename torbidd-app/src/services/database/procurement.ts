// =============================================================================
// services/database/procurement.ts - Procurement Database Services
// =============================================================================

import connectToDatabase from '@/lib/mongodb';
import ProcurementProject, { IProcurementProject } from '@/models/ProcurementProject';
import ProcurementDocument, { IProcurementDocument } from '@/models/ProcurementDocument';
import { DiscoveredProject, ProcurementDocumentRecord } from '@/types/procurement';
import mongoose, { Types } from 'mongoose';

/**
 * Idempotently upsert discovered procurement projects into MongoDB.
 * Ensures no duplicate projects are created for the same externalProjectId.
 */
export async function upsertDiscoveredProjects(
  projects: DiscoveredProject[],
): Promise<{ upsertedCount: number; modifiedCount: number; matchedCount: number }> {
  if (!projects || projects.length === 0) {
    return { upsertedCount: 0, modifiedCount: 0, matchedCount: 0 };
  }

  await connectToDatabase();

  const operations = projects.map((p) => ({
    updateOne: {
      filter: { externalProjectId: p.externalProjectId },
      update: {
        $set: {
          projectName: p.projectName,
          agencyName: p.agencyName,
          fiscalYear: p.fiscalYear,
          source: p.source || 'CKAN_GOVSPENDING',
          sourceUrl: p.sourceUrl || '',
          budget: p.budget ?? 0,
          procurementType: p.procurementType || '',
          updatedAt: new Date(),
        },
        $setOnInsert: {
          externalProjectId: p.externalProjectId,
          discoveredAt: new Date(),
          createdAt: new Date(),
        },
      },
      upsert: true,
    },
  }));

  const result = await ProcurementProject.bulkWrite(operations);

  return {
    upsertedCount: result.upsertedCount,
    modifiedCount: result.modifiedCount,
    matchedCount: result.matchedCount,
  };
}

/**
 * Retrieve discovered procurement projects with optional filtering and pagination.
 */
export async function getProcurementProjects(params: {
  search?: string;
  fiscalYear?: number;
  limit?: number;
  offset?: number;
} = {}): Promise<{ projects: IProcurementProject[]; total: number }> {
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

  const limit = Math.min(params.limit ?? 50, 200);
  const offset = params.offset ?? 0;

  const [projects, total] = await Promise.all([
    ProcurementProject.find(query)
      .sort({ discoveredAt: -1, createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean(),
    ProcurementProject.countDocuments(query),
  ]);

  return { projects: projects as unknown as IProcurementProject[], total };
}

/**
 * Retrieve a project by its 11-digit external project ID.
 */
export async function getProcurementProjectByExternalId(
  externalProjectId: string,
): Promise<IProcurementProject | null> {
  await connectToDatabase();
  return ProcurementProject.findOne({ externalProjectId }).lean() as unknown as Promise<IProcurementProject | null>;
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
 * Retrieve all procurement documents for a project (by externalProjectId or MongoDB _id).
 */
export async function getDocumentsByProjectId(
  projectIdOrExternalId: string,
): Promise<IProcurementDocument[]> {
  await connectToDatabase();

  const isObjectId = Types.ObjectId.isValid(projectIdOrExternalId);
  const query = isObjectId
    ? { $or: [{ projectId: new Types.ObjectId(projectIdOrExternalId) }, { externalProjectId: projectIdOrExternalId }] }
    : { externalProjectId: projectIdOrExternalId };

  return ProcurementDocument.find(query).sort({ downloadedAt: -1 }).lean() as unknown as Promise<IProcurementDocument[]>;
}

/**
 * Retrieve a project together with all its associated documents.
 */
export async function getProjectWithDocuments(
  projectIdOrExternalId: string,
): Promise<{ project: IProcurementProject; documents: IProcurementDocument[] } | null> {
  await connectToDatabase();

  let project: IProcurementProject | null = null;
  if (Types.ObjectId.isValid(projectIdOrExternalId)) {
    project = await ProcurementProject.findById(projectIdOrExternalId).lean() as unknown as IProcurementProject | null;
  }
  if (!project) {
    project = await ProcurementProject.findOne({ externalProjectId: projectIdOrExternalId }).lean() as unknown as IProcurementProject | null;
  }

  if (!project) return null;

  const documents = await ProcurementDocument.find({
    $or: [{ projectId: project._id }, { externalProjectId: project.externalProjectId }],
  }).sort({ downloadedAt: -1 }).lean() as unknown as IProcurementDocument[];

  return { project, documents };
}
