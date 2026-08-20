// =============================================================================
// models/UserSettings.ts - Mongoose Schema for Notification Settings
// =============================================================================

import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IUserSettings extends Document {
  sessionId: string;
  emailNotif: boolean;
  dailyDigest: boolean;
  closingAlert: boolean;
  newProjectAlert: boolean;
  interestTags: string[];
  budgetMin: number | null;
  budgetMax: number | null;
  language: 'th' | 'en';
  updatedAt: Date;
}

const UserSettingsSchema = new Schema<IUserSettings>(
  {
    sessionId: { type: String, required: true, unique: true },
    emailNotif: { type: Boolean, default: true },
    dailyDigest: { type: Boolean, default: true },
    closingAlert: { type: Boolean, default: true },
    newProjectAlert: { type: Boolean, default: false },
    interestTags: { type: [String], default: ['Website', 'AI'] },
    budgetMin: { type: Number, default: null },
    budgetMax: { type: Number, default: null },
    language: { type: String, enum: ['th', 'en'], default: 'th' },
  },
  { timestamps: true },
);

const UserSettings: Model<IUserSettings> =
  (mongoose.models.UserSettings as Model<IUserSettings>) ??
  mongoose.model<IUserSettings>('UserSettings', UserSettingsSchema);

export default UserSettings;
