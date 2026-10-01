// =============================================================================
// types/procurement-category.ts - Software Category Types & Metadata
// (Supports Issue #147: Software Category Filter)
// =============================================================================

export type SoftwareCategory =
  | 'Website'
  | 'Mobile App'
  | 'AI'
  | 'Database'
  | 'ERP'
  | 'Cloud'
  | 'Data Analytics'
  | 'Information System';

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
  {
    id: 'ERP',
    name: { th: 'ระบบทรัพยากรองค์กร (ERP / MIS)', en: 'Enterprise Resource Planning (ERP)' },
    description: {
      th: 'ระบบบริหารทรัพยากรองค์กร การเงิน บัญชี และระบบบริหารจัดการภายใน',
      en: 'ERP systems, financial management, accounting, and internal administration',
    },
    iconName: 'layers',
  },
  {
    id: 'Cloud',
    name: { th: 'คลาวด์และโครงสร้างพื้นฐาน', en: 'Cloud & Infrastructure' },
    description: {
      th: 'บริการคลาวด์ โครงสร้างพื้นฐานเซิร์ฟเวอร์ และระบบเครือข่ายความมั่นคงปลอดภัย',
      en: 'Cloud services, server infrastructure, and secure network hosting',
    },
    iconName: 'cloud',
  },
  {
    id: 'Data Analytics',
    name: { th: 'วิเคราะห์ข้อมูลและ BI', en: 'Data Analytics & BI' },
    description: {
      th: 'การวิเคราะห์ข้อมูล บิ๊กดาต้า แดชบอร์ดผู้บริหาร และ Business Intelligence',
      en: 'Data analytics, big data platforms, executive dashboards, and business intelligence',
    },
    iconName: 'bar-chart',
  },
  {
    id: 'Information System',
    name: { th: 'ระบบสารสนเทศ (e-Service)', en: 'Information System (e-Service)' },
    description: {
      th: 'การพัฒนาระบบสารสนเทศ งานบริการประชาชนอิเล็กทรอนิกส์ และระบบงานเฉพาะด้าน',
      en: 'Information management systems, public e-services, and custom workflows',
    },
    iconName: 'server',
  },
];

export const VALID_SOFTWARE_CATEGORIES: SoftwareCategory[] = [
  'Website',
  'Mobile App',
  'AI',
  'Database',
  'ERP',
  'Cloud',
  'Data Analytics',
  'Information System',
];

export function isSoftwareCategory(val: unknown): val is SoftwareCategory {
  return typeof val === 'string' && VALID_SOFTWARE_CATEGORIES.includes(val as SoftwareCategory);
}
