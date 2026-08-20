// =============================================================================
// models/HistoricalProject.ts - Mongoose Schema for Historical Procurement Data
// =============================================================================

import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IHistoricalProject extends Document {
  title: { th: string; en: string };
  department: { th: string; en: string };
  year: number;
  category: 'Website' | 'Mobile App' | 'AI' | 'Database';
  budget: number;
  createdAt: Date;
}

const BilingualSchema = new Schema({ th: String, en: String }, { _id: false });

const HistoricalProjectSchema = new Schema<IHistoricalProject>(
  {
    title: { type: BilingualSchema, required: true },
    department: { type: BilingualSchema, required: true },
    year: { type: Number, required: true },
    category: { type: String, required: true, enum: ['Website', 'Mobile App', 'AI', 'Database'] },
    budget: { type: Number, required: true, min: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

HistoricalProjectSchema.index({ category: 1 });
HistoricalProjectSchema.index({ year: 1 });
HistoricalProjectSchema.index({ 'department.th': 1 });

const HistoricalProject: Model<IHistoricalProject> =
  (mongoose.models.HistoricalProject as Model<IHistoricalProject>) ??
  mongoose.model<IHistoricalProject>('HistoricalProject', HistoricalProjectSchema);

export default HistoricalProject;
