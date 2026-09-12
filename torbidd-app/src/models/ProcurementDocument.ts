// =============================================================================
// models/ProcurementDocument.ts - Mongoose Schema for Procurement Documents (TOR, etc.)
// =============================================================================

import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface IProcurementDocument extends Document {
  projectId: Types.ObjectId;
  externalProjectId: string;
  documentType: 'ATTACH_TOR' | 'ANNOUNCEMENT' | 'OTHER';
  fileName: string;
  filePath: string;
  storageReference: string;
  source: string;
  sourceUrl: string;
  fileSize: number;
  mimeType: string;
  downloadedAt: Date;
  status: 'PROCESSED' | 'DOWNLOADED' | 'FAILED' | 'MISSING';
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProcurementDocumentSchema = new Schema<IProcurementDocument>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'ProcurementProject',
      required: true,
      index: true,
    },
    externalProjectId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    documentType: {
      type: String,
      enum: ['ATTACH_TOR', 'ANNOUNCEMENT', 'OTHER'],
      default: 'ATTACH_TOR',
      required: true,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    filePath: {
      type: String,
      required: true,
      trim: true,
    },
    storageReference: {
      type: String,
      default: '',
      trim: true,
    },
    source: {
      type: String,
      required: true,
      default: 'NATIONAL_EGP',
    },
    sourceUrl: {
      type: String,
      default: '',
      trim: true,
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    mimeType: {
      type: String,
      default: 'application/pdf',
    },
    downloadedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['PROCESSED', 'DOWNLOADED', 'FAILED', 'MISSING'],
      default: 'PROCESSED',
    },
    errorMessage: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

// Prevent duplicate downloads for same external project and filename
ProcurementDocumentSchema.index(
  { externalProjectId: 1, documentType: 1, fileName: 1 },
  { unique: true },
);

const ProcurementDocument: Model<IProcurementDocument> =
  (mongoose.models.ProcurementDocument as Model<IProcurementDocument>) ??
  mongoose.model<IProcurementDocument>('ProcurementDocument', ProcurementDocumentSchema);

export default ProcurementDocument;
