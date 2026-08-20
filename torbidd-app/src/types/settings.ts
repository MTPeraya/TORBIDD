// =============================================================================
// Types: User Settings & Bookmarks
// =============================================================================

export interface UserSettings {
  _id?: string;
  sessionId: string;
  emailNotif: boolean;
  dailyDigest: boolean;
  closingAlert: boolean;
  newProjectAlert: boolean;
  interestTags: string[];
  budgetMin: number | null;
  budgetMax: number | null;
  language: 'th' | 'en';
  updatedAt?: string;
}

export interface Bookmark {
  _id?: string;
  sessionId: string;
  projectId: string;
  createdAt?: string;
}

export type Language = 'th' | 'en';
export type Theme = 'light' | 'dark';
