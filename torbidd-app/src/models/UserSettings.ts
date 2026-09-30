// =============================================================================
// models/UserSettings.ts - Mongoose Schema for Notification Settings
// =============================================================================

import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IUserSettings extends Document {
  sessionId: string;
  inAppNotif: boolean;
  emailNotif: boolean;
  dailyDigest: boolean;
  closingAlert: boolean;
  newProjectAlert: boolean;
  newOpportunity?: boolean;
  savedUpdate?: boolean;
  deadlineReminder?: boolean;
  keywords: string[];
  interestTags: string[];
  agencies: string[];
  budgetMin: number | null;
  budgetMax: number | null;
  language: 'th' | 'en';
  email?: string | null;
  updatedAt: Date;
}

const UserSettingsSchema = new Schema<IUserSettings>(
  {
    sessionId: { type: String, required: true, unique: true },
    inAppNotif: { type: Boolean, default: true },
    emailNotif: { type: Boolean, default: true },
    dailyDigest: { type: Boolean, default: true },
    closingAlert: { type: Boolean, default: true },
    newProjectAlert: { type: Boolean, default: false },
    newOpportunity: { type: Boolean, default: true },
    savedUpdate: { type: Boolean, default: true },
    deadlineReminder: { type: Boolean, default: true },
    keywords: { type: [String], default: [] },
    interestTags: { type: [String], default: ['Website', 'AI'] },
    agencies: { type: [String], default: [] },
    budgetMin: { type: Number, default: null },
    budgetMax: { type: Number, default: null },
    language: { type: String, enum: ['th', 'en'], default: 'th' },
    email: { type: String, default: null },
  },
  { timestamps: true },
);

const UserSettings: Model<IUserSettings> =
  (mongoose.models.UserSettings as Model<IUserSettings>) ??
  mongoose.model<IUserSettings>('UserSettings', UserSettingsSchema);

export default UserSettings;
