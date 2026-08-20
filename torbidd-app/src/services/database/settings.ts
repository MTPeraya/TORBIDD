// =============================================================================
// services/database/settings.ts - User Settings Repository
// =============================================================================

import connectToDatabase from '@/lib/mongodb';
import UserSettings, { IUserSettings } from '@/models/UserSettings';

const DEFAULT_SETTINGS = {
  emailNotif: true,
  dailyDigest: true,
  closingAlert: true,
  newProjectAlert: false,
  interestTags: ['Website', 'AI'],
  budgetMin: null,
  budgetMax: null,
  language: 'th' as const,
};

export async function getSettings(sessionId: string): Promise<IUserSettings> {
  await connectToDatabase();
  const settings = await UserSettings.findOne({ sessionId }).lean();
  if (settings) return settings;
  // Return defaults if not yet created (without creating a DB record)
  return { sessionId, ...DEFAULT_SETTINGS } as IUserSettings;
}

export async function upsertSettings(
  sessionId: string,
  update: Partial<IUserSettings>,
): Promise<IUserSettings> {
  await connectToDatabase();
  const result = await UserSettings.findOneAndUpdate(
    { sessionId },
    { $set: { ...update, sessionId } },
    { upsert: true, new: true, runValidators: true },
  ).lean();
  return result!;
}
