// =============================================================================
// types/procurement-category.ts - Software Category Types & Metadata
// (Supports Issue #147: Software Category Filter)
// =============================================================================

export type SoftwareCategory = 'Website' | 'Mobile App' | 'AI' | 'Database';

export interface CategoryMetadata {
  id: SoftwareCategory;
  name: {
    th: string;
    en: string;
  };
  description: {
    th: string;
    en: string;
  };
  iconName: string;
}

export const SOFTWARE_CATEGORIES: CategoryMetadata[] = [
  {
    id: 'Website',
    name: { th: 'เว็บไซต์และเว็บพอร์ทัล', en: 'Website & Web Portal' },
    description: {
      th: 'การพัฒนาเว็บไซต์ พอร์ทัลบริการภาครัฐ และเว็บแอปพลิเคชัน',
      en: 'Websites, public service portals, and web applications',
    },
    iconName: 'globe',
  },
  {
    id: 'Mobile App',
    name: { th: 'แอปพลิเคชันมือถือ', en: 'Mobile Application' },
    description: {
      th: 'แอปพลิเคชันสำหรับอุปกรณ์พกพา iOS และ Android',
      en: 'Mobile applications for iOS and Android devices',
    },
    iconName: 'smartphone',
  },
  {
    id: 'AI',
    name: { th: 'ปัญญาประดิษฐ์ (AI / ML)', en: 'Artificial Intelligence (AI)' },
    description: {
      th: 'ระบบปัญญาประดิษฐ์ วิเคราะห์ข้อมูลอัจฉริยะ และคอมพิวเตอร์วิทัศน์',
      en: 'AI systems, intelligent analytics, machine learning, and computer vision',
    },
    iconName: 'cpu',
  },
  {
    id: 'Database',
    name: { th: 'ฐานข้อมูลและโครงสร้างพื้นฐาน', en: 'Database & Infrastructure' },
    description: {
      th: 'ระบบคลังข้อมูล บูรณาการฐานข้อมูล และระบบจัดการสารสนเทศ',
      en: 'Data warehousing, database integration, and enterprise data management',
    },
    iconName: 'database',
  },
];

export const VALID_SOFTWARE_CATEGORIES: SoftwareCategory[] = [
  'Website',
  'Mobile App',
  'AI',
  'Database',
];

export function isSoftwareCategory(val: unknown): val is SoftwareCategory {
  return typeof val === 'string' && VALID_SOFTWARE_CATEGORIES.includes(val as SoftwareCategory);
}
