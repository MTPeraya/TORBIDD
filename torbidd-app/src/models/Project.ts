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
  // UC-10: expanded software categories
  category:
    | 'Website'
    | 'Mobile App'
    | 'AI'
    | 'Database'
    | 'ERP'
    | 'Cloud'
    | 'Data Analytics'
    | 'Information System';
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
  sourceUrl?: string;
  documentUrl?: string;
  processedDate: Date;
  aiConfidence: 'High' | 'Medium' | 'Low';
  aiClassificationModel?: string;
  isSoftwareRelated: boolean;                          // UC-10
  classificationReviewStatus?: 'PENDING_REVIEW' | 'APPROVED' | 'CORRECTED'; // UC-10
  classificationReviewedBy?: string;                   // UC-10: admin userId
  classificationReviewedAt?: Date;                     // UC-10
  classificationReviewNote?: string;                   // UC-10: admin note
  extractionStatus?: 'PENDING' | 'EXTRACTED' | 'FAILED';
  timeline?: Array<{
    id: string;
    event: { th: string; en: string };
    date: string;
    description?: { th: string; en: string };
    status: 'completed' | 'active' | 'upcoming';
  }>;
  budgetBreakdown?: Array<{
    category: { th: string; en: string };
    amount: number;
    percentage: number;
  }>;
  highlightedQualifications?: Array<{
    type: 'critical' | 'standard';
    title: { th: string; en: string };
    description: { th: string; en: string };
  }>;
  documentSections?: Array<{
    sectionId: string;
    articleNumber?: string;
    title: { th: string; en: string };
    page: number;
    content: { th: string; en: string };
    extractedHighlights?: Array<{ th: string; en: string }>;
  }>;
  aiMetadata?: {
    model: string;
    confidenceScore: number;
    verifiedByHuman: boolean;
    extractedClausesCount: number;
    lastVerifiedDate: string;
  };
  contactInfo?: {
    department: { th: string; en: string };
    division?: { th: string; en: string };
    phone?: string;
    email?: string;
    officer?: { th: string; en: string };
  };
  createdAt: Date;
  updatedAt: Date;
}

const BilingualSchema = new Schema({ th: { type: String, required: true }, en: { type: String, required: true } }, { _id: false });
const OptionalBilingualSchema = new Schema({ th: { type: String, default: '' }, en: { type: String, default: '' } }, { _id: false });
const BilingualArraySchema = new Schema({ th: [String], en: [String] }, { _id: false });

export const TimelineSchema = new Schema(
  {
    id: { type: String, required: true },
    event: { type: BilingualSchema, required: true },
    date: { type: String, required: true },
    description: { type: BilingualSchema },
    status: { type: String, enum: ['completed', 'active', 'upcoming'], default: 'upcoming' },
  },
  { _id: false },
);

export const BudgetBreakdownSchema = new Schema(
  {
    category: { type: BilingualSchema, required: true },
    amount: { type: Number, required: true },
    percentage: { type: Number, required: true },
  },
  { _id: false },
);

export const HighlightedQualSchema = new Schema(
  {
    type: { type: String, enum: ['critical', 'standard'], default: 'standard' },
    title: { type: BilingualSchema, required: true },
    description: { type: BilingualSchema, required: true },
  },
  { _id: false },
);

export const DocumentSectionSchema = new Schema(
  {
    sectionId: { type: String, required: true },
    articleNumber: { type: String },
    title: { type: BilingualSchema, required: true },
    page: { type: Number, required: true },
    content: { type: BilingualSchema, required: true },
    extractedHighlights: [BilingualSchema],
  },
  { _id: false },
);

export const AiMetadataSchema = new Schema(
  {
    model: { type: String, default: 'Gemini 1.5 Pro / Vertex AI' },
    confidenceScore: { type: Number, default: 95 },
    verifiedByHuman: { type: Boolean, default: true },
    extractedClausesCount: { type: Number, default: 8 },
    lastVerifiedDate: { type: String },
  },
  { _id: false },
);

export const ContactInfoSchema = new Schema(
  {
    department: { type: BilingualSchema, required: true },
    division: { type: BilingualSchema },
    phone: { type: String },
    email: { type: String },
    officer: { type: BilingualSchema },
  },
  { _id: false },
);

const ProjectSchema = new Schema<IProject>(
  {
    externalId: { type: Number, required: true, unique: true },
    title: { type: BilingualSchema, required: true },
    department: { type: BilingualSchema, required: true },
    budget: { type: Number, required: true, min: 0 },
    publishDate: { type: Date, required: true },
    deadline: { type: Date, required: true },
    category: {
      type: String,
      required: true,
      enum: ['Website', 'Mobile App', 'AI', 'Database', 'ERP', 'Cloud', 'Data Analytics', 'Information System'],
    },
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
    sourceUrl: { type: String },
    documentUrl: { type: String },
    processedDate: { type: Date, default: Date.now },
    aiConfidence: { type: String, enum: ['High', 'Medium', 'Low'], default: 'High' },
    aiClassificationModel: { type: String },
    isSoftwareRelated: { type: Boolean, default: true },                          // UC-10
    classificationReviewStatus: {                                                  // UC-10
      type: String,
      enum: ['PENDING_REVIEW', 'APPROVED', 'CORRECTED'],
      default: 'PENDING_REVIEW',
    },
    classificationReviewedBy: { type: String },                                    // UC-10
    classificationReviewedAt: { type: Date },                                      // UC-10
    classificationReviewNote: { type: String },                                    // UC-10
  },
  { timestamps: true },
);

// Indexes for commonly queried fields
ProjectSchema.index({ category: 1 });
ProjectSchema.index({ isSoftwareRelated: 1 });          // UC-10
ProjectSchema.index({ classificationReviewStatus: 1 }); // UC-10
ProjectSchema.index({ deadline: 1 });
ProjectSchema.index({ budget: 1 });
ProjectSchema.index({ 'department.th': 1 });
ProjectSchema.index({ publishDate: -1 });

const Project: Model<IProject> =
  (mongoose.models.Project as Model<IProject>) ?? mongoose.model<IProject>('Project', ProjectSchema);

export default Project;
