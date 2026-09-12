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
  procurementType?: string;
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
    procurementType: {
      type: String,
      default: '',
      trim: true,
    },
    discoveredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true },
);

// Compound and text indexes for search & sorting
ProcurementProjectSchema.index({ fiscalYear: -1, discoveredAt: -1 });

const ProcurementProject: Model<IProcurementProject> =
  (mongoose.models.ProcurementProject as Model<IProcurementProject>) ??
  mongoose.model<IProcurementProject>('ProcurementProject', ProcurementProjectSchema);

export default ProcurementProject;
