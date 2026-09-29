// =============================================================================
// models/Project.ts - Mongoose Schema & Model for BMA Procurement Projects
// =============================================================================

import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IProject extends Document {
  externalId: number;
  title: { th: string; en: string };
  department: { th: string; en: string };
  budget: number;
  publishDate: Date;
  deadline: Date;
  category: 'Website' | 'Mobile App' | 'AI' | 'Database';
  procurementType: string;
  description: { th: string; en: string };
  summary?: { th: string; en: string };
  scope: { th: string[]; en: string[] };
  qualifications: { th: string[]; en: string[] };
  requiredTechnologies?: string[];
  technicalRequirements?: { th: string[]; en: string[] };
  extractedQualifications?: Array<{
    id: string;
    description: { th: string; en: string };
    category: 'Legal' | 'Financial' | 'Experience' | 'Technical';
    threshold?: string;
    mandatory: boolean;
  }>;
  historicalAvg: number;
  sourceDocument: string;
  processedDate: Date;
  aiConfidence: 'High' | 'Medium' | 'Low';
  aiClassificationModel?: string;
  extractionStatus?: 'PENDING' | 'EXTRACTED' | 'FAILED';
  createdAt: Date;
  updatedAt: Date;
}

const BilingualSchema = new Schema({ th: { type: String, required: true }, en: { type: String, required: true } }, { _id: false });
const OptionalBilingualSchema = new Schema({ th: { type: String, default: '' }, en: { type: String, default: '' } }, { _id: false });
const BilingualArraySchema = new Schema({ th: [String], en: [String] }, { _id: false });

const ProjectSchema = new Schema<IProject>(
  {
    externalId: { type: Number, required: true, unique: true },
    title: { type: BilingualSchema, required: true },
    department: { type: BilingualSchema, required: true },
    budget: { type: Number, required: true, min: 0 },
    publishDate: { type: Date, required: true },
    deadline: { type: Date, required: true },
    category: { type: String, required: true, enum: ['Website', 'Mobile App', 'AI', 'Database'] },
    procurementType: { type: String, required: true },
    description: { type: BilingualSchema, required: true },
    summary: { type: OptionalBilingualSchema },
    scope: { type: BilingualArraySchema, required: true },
    qualifications: { type: BilingualArraySchema, required: true },
    requiredTechnologies: { type: [String], default: [] },
    technicalRequirements: { type: BilingualArraySchema, default: () => ({ th: [], en: [] }) },
    extractedQualifications: [
      {
        id: { type: String },
        description: { th: String, en: String },
        category: { type: String, enum: ['Legal', 'Financial', 'Experience', 'Technical'], default: 'Legal' },
        threshold: { type: String },
        mandatory: { type: Boolean, default: true },
      },
    ],
    historicalAvg: { type: Number, required: true, min: 0 },
    sourceDocument: { type: String, default: '' },
    processedDate: { type: Date, default: Date.now },
    aiConfidence: { type: String, enum: ['High', 'Medium', 'Low'], default: 'High' },
    aiClassificationModel: { type: String },
    extractionStatus: { type: String, enum: ['PENDING', 'EXTRACTED', 'FAILED'], default: 'PENDING' },
  },
  { timestamps: true },
);

// Indexes for commonly queried fields
ProjectSchema.index({ category: 1 });
ProjectSchema.index({ deadline: 1 });
ProjectSchema.index({ budget: 1 });
ProjectSchema.index({ 'department.th': 1 });
ProjectSchema.index({ publishDate: -1 });

const Project: Model<IProject> =
  (mongoose.models.Project as Model<IProject>) ?? mongoose.model<IProject>('Project', ProjectSchema);

export default Project;
