// =============================================================================
// models/ProcurementProject.ts - Mongoose Schema for Discovered Procurement Projects
// =============================================================================

import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IProcurementProject extends Document {
  externalProjectId: string;
  projectName: string;
  agencyName: string;
  fiscalYear: number;
  source: string;
  sourceUrl: string;
  budget?: number;
  contractPrice?: number;
  procurementType?: string;
  summary?: { th: string; en: string };
  requiredTechnologies?: string[];
  technicalRequirements?: { th: string[]; en: string[] };
  extractedQualifications?: Array<{
    id: string;
    description: { th: string; en: string };
    category: 'Legal' | 'Financial' | 'Experience' | 'Technical';
    threshold?: string;
    mandatory: boolean;
  }>;
  extractionStatus?: 'PENDING' | 'EXTRACTED' | 'FAILED';
  contentHash?: string;
  revision: number;
  discoveredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProcurementProjectSchema = new Schema<IProcurementProject>(
  {
    externalProjectId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    projectName: {
      type: String,
      required: true,
      trim: true,
    },
    agencyName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    fiscalYear: {
      type: Number,
      required: true,
      index: true,
    },
    source: {
      type: String,
      required: true,
      default: 'CKAN_GOVSPENDING',
      index: true,
    },
    sourceUrl: {
      type: String,
      default: '',
      trim: true,
    },
    budget: {
      type: Number,
      min: 0,
      default: 0,
    },
    contractPrice: {
      type: Number,
      min: 0,
    },
    procurementType: {
      type: String,
      default: '',
      trim: true,
    },
    summary: {
      th: { type: String, default: '' },
      en: { type: String, default: '' },
    },
    requiredTechnologies: {
      type: [String],
      default: [],
    },
    technicalRequirements: {
      th: { type: [String], default: [] },
      en: { type: [String], default: [] },
    },
    extractedQualifications: [
      {
        id: { type: String },
        description: {
          th: { type: String, default: '' },
          en: { type: String, default: '' },
        },
        category: {
          type: String,
          enum: ['Legal', 'Financial', 'Experience', 'Technical'],
          default: 'Legal',
        },
        threshold: { type: String },
        mandatory: { type: Boolean, default: true },
      },
    ],
    extractionStatus: {
      type: String,
      enum: ['PENDING', 'EXTRACTED', 'FAILED'],
      default: 'PENDING',
    },
    contentHash: {
      type: String,
      index: true,
      trim: true,
    },
    revision: {
      type: Number,
      default: 1,
      min: 1,
    },
    discoveredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true },
);

// Compound and text indexes for search, deduplication & sorting
ProcurementProjectSchema.index({ fiscalYear: -1, discoveredAt: -1 });
ProcurementProjectSchema.index({ externalProjectId: 1, contentHash: 1 });

const ProcurementProject: Model<IProcurementProject> =
  (mongoose.models.ProcurementProject as Model<IProcurementProject>) ??
  mongoose.model<IProcurementProject>('ProcurementProject', ProcurementProjectSchema);

export default ProcurementProject;
