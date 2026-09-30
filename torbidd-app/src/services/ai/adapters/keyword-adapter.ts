// =============================================================================
// services/ai/adapters/keyword-adapter.ts
// Deterministic Keyword-Based Fallback Classifier Adapter (UC-10)
// =============================================================================

import { ProjectCategory } from '@/types/project';
import { AiClassifierAdapter, ClassificationResult } from './types';

interface KeywordRule {
  category: ProjectCategory;
  keywords: string[];
}

// --------------------------------------------------------------------------
// Software-positive keyword rules (each match adds to score)
// --------------------------------------------------------------------------
const KEYWORD_RULES: KeywordRule[] = [
  {
    category: 'AI',
    keywords: [
      'artificial intelligence', 'machine learning', 'deep learning', 'neural network',
      'computer vision', 'nlp', 'natural language processing', 'gis', 'geographic information',
      'ปัญญาประดิษฐ์', 'machine learning', 'ระบบจีไอเอส', 'gis', 'chatbot', 'ไอเอ',
      'chatgpt', 'gemini', 'claude',
    ],
  },
  {
    category: 'ERP',
    keywords: [
      'erp', 'enterprise resource', 'hr system', 'human resource', 'payroll',
      'accounting system', 'procurement system', 'supply chain', 'sap', 'oracle',
      'ระบบทรัพยากรบุคคล', 'ระบบเงินเดือน', 'ระบบบัญชี', 'ระบบจัดซื้อ', 'ระบบ erp',
      'ระบบ hr', 'ระบบ hrm', 'hrms', 'hris',
    ],
  },
  {
    category: 'Cloud',
    keywords: [
      'cloud', 'iaas', 'paas', 'saas', 'azure', 'aws', 'google cloud',
      'virtual machine', 'kubernetes', 'docker', 'microservices', 'serverless',
      'คลาวด์', 'บริการคลาวด์', 'ระบบคลาวด์', 'cloud service', 'cloud computing',
      'government cloud', 'g-cloud', 'hosting', 'data hosting',
    ],
  },
  {
    category: 'Data Analytics',
    keywords: [
      'data analytics', 'business intelligence', 'dashboard', 'bi system', 'reporting system',
      'data warehouse', 'big data', 'data visualization', 'etl', 'data pipeline',
      'วิเคราะห์ข้อมูล', 'ระบบรายงาน', 'คลังข้อมูล', 'บิ๊กดาต้า', 'data center analytics',
    ],
  },
  {
    category: 'Mobile App',
    keywords: [
      'mobile application', 'mobile app', 'ios app', 'android app', 'smartphone app',
      'แอปพลิเคชัน', 'แอปมือถือ', 'สมาร์ทโฟน', 'application มือถือ', ' app', 'app ',
    ],
  },
  {
    category: 'Website',
    keywords: [
      'website', 'web portal', 'e-government', 'web application', 'web system',
      'เว็บไซต์', 'เว็บพอร์ทัล', 'เว็บแอปพลิเคชัน', 'ระบบออนไลน์', 'พัฒนาเว็บ',
      'e-service', 'online portal', 'digital service', 'digital platform',
    ],
  },
  {
    category: 'Information System',
    keywords: [
      'information system', 'management system', 'registration system', 'emr',
      'electronic medical record', 'hospital information', 'mis', 'document management',
      'ระบบสารสนเทศ', 'ระบบบริหาร', 'ระบบทะเบียน', 'ระบบบันทึก', 'ระบบจัดการ',
      'software system', 'digital system', 'ระบบสารสนเทศ',
    ],
  },
  {
    category: 'Database',
    keywords: [
      'database', 'data center', 'server infrastructure', 'storage system', 'backup system',
      'postgresql', 'mysql', 'mongodb', 'sql server', 'oracle database',
      'ฐานข้อมูล', 'เซิร์ฟเวอร์', 'สำรองข้อมูล', 'ระบบฐานข้อมูล',
    ],
  },
];

// --------------------------------------------------------------------------
// Hard non-software patterns: ANY match immediately disqualifies the project.
// These CANNOT be overridden by software keywords (even if title contains 'ซอฟต์แวร์').
// E.g.: "เช่าจอ LCD สำหรับโครงการประชุมเชิงปฏิบัติการ... ซอฟต์แวร์" is an LCD rental for an event.
// E.g.: "ซื้อสิทธิ์การใช้งานซอฟต์แวร์ ChatGPT Plus" is a consumer subscription buy.
// --------------------------------------------------------------------------
const HARD_NON_SOFTWARE_PATTERNS = [
  // Display, screen, projector, and AV hardware rentals
  'เช่าจอ', 'จอ lcd', 'lcd สำหรับ', 'จอภาพ', 'จอแสดงภาพ', 'จอโปรเจคเตอร์',
  'เช่าเครื่องฉาย', 'เช่าระบบเสียง', 'เช่าเครื่องเสียง', 'เช่าเครื่องคอมพิวเตอร์',
  'เช่าโน้ตบุ๊ก', 'เช่าแท็บเล็ต',

  // Event logistics, venue rental, catering, meetings, workshops
  'เช่าสถานที่', 'เช่าสถานที่ประชุม', 'เช่าสถานที่จัด', 'ค่าอาหาร', 'อาหารว่าง',
  'จัดเลี้ยง', 'เช่าเต็นท์', 'เช่าโต๊ะ', 'เช่าเก้าอี้', 'จัดนิทรรศการ',
  'จัดประชุม', 'จัดสัมมนา', 'ประชุมเชิงปฏิบัติการ', 'จัดฝึกอบรม', 'ค่าตอบแทนวิทยากร',
  'จัดจ้างจัดประชุม',

  // Vehicle charter, transport, and passenger logistics
  // (Transporting students/personnel to competitions or workshops is transport, not software development)
  'จ้างเหมารถ', 'เหมารถ', 'รถตู้', 'เช่ารถตู้', 'จ้างเหมารถตู้', 'รถบัส', 'เช่ารถบัส',
  'จ้างเหมารถบัส', 'รถรับจ้าง', 'รถสองแถว', 'ค่าพาหนะ', 'ค่าโดยสาร', 'บริการขนส่ง',
  'จ้างเหมายานพาหนะ', 'ยานพาหนะ', 'เช่ารถ',

  // Off-the-shelf consumer/retail tool subscriptions & seat licenses
  // (Software engineering firms build systems, they don't supply retail single licenses)
  'chatgpt', 'claude', 'canva', 'turnitin', 'zoom', 'midjourney',
  'gptzero', 'google ai pro', 'microsoft office 365 family', 'microsoft 365 family',
  'office 365 family', 'office 365 personal', 'office 365 home',
  'ต่ออายุโดเมน', 'โดเมนเนม', 'domain name',
  'autocad', 'ออโต้แคด',

  // Office hardware purchases (PCs, laptops, printers, scanners with bundled Windows/OS)
  'เครื่องคอมพิวเตอร์สำหรับสำนักงาน', 'คอมพิวเตอร์สำหรับสำนักงาน', 'เครื่องคอมพิวเตอร์โน้ตบุ๊ก',
  'คอมพิวเตอร์แบบพกพา', 'คอมพิวเตอร์ตั้งโต๊ะ', 'เครื่องพิมพ์', 'เครื่องสแกนเนอร์',
  'เครื่องถ่ายเอกสาร', 'ซื้อครุภัณฑ์คอมพิวเตอร์', 'จัดซื้อครุภัณฑ์คอมพิวเตอร์',
  'ซื้อเครื่องคอมพิวเตอร์', 'จัดซื้อเครื่องคอมพิวเตอร์', 'ซื้อคอมพิวเตอร์',
  'จัดซื้อคอมพิวเตอร์', 'แป้นพิมพ์และเม้าส์', 'แป้นพิมพ์และเมาส์',
];

// --------------------------------------------------------------------------
// Comprehensive list of terms that indicate NON-software procurement.
// --------------------------------------------------------------------------
const NON_SOFTWARE_KEYWORDS = [
  // Display / event hardware rental
  'เช่าจอ', 'จอ lcd', 'lcd สำหรับ', 'เช่าสถานที่', 'เช่าสถานที่ประชุม',
  'จอโปรเจคเตอร์', 'เช่าวัสดุ', 'เช่าอุปกรณ์',
  // Construction & civil works
  'ก่อสร้าง', 'ก่อสร้างทาง', 'ก่อสร้างอาคาร', 'ปรับปรุงอาคาร', 'ปรับปรุงถนน',
  'จ้างก่อสร้าง', 'ก่อสร้างจ้างเหมา', 'construction', 'road construction',
  // Roads & infrastructure
  'ถนน', 'ทางหลวง', 'ทางจราจร', 'ผิวถนน', 'แอสฟัลต์', 'คอนกรีต', 'สะพาน',
  'ระบบระบายน้ำ', 'ท่อน้ำ', 'ขุดเจาะ', 'บ่อน้ำ', 'ชลประทาน',
  // Physical equipment (hardware only, no software context)
  'ครุภัณฑ์', 'ครุภัณฑ์การแพทย์', 'ครุภัณฑ์วิทยาศาสตร์', 'ครุภัณฑ์ห้องปฏิบัติการ',
  'ครุภัณฑ์สำนักงาน', 'เครื่องมือแพทย์', 'อุปกรณ์การแพทย์', 'เวชภัณฑ์',
  'วัสดุวิทยาศาสตร์', 'วัสดุการแพทย์', 'วัสดุสิ้นเปลือง', 'วัสดุก่อสร้าง',
  // Vehicles and transport
  'ยานพาหนะ', 'รถยนต์', 'รถบรรทุก', 'รถไฟฟ้า', 'รถโดยสาร', 'เรือ', 'อากาศยาน',
  // Furniture and interior
  'เฟอร์นิเจอร์', 'โต๊ะ', 'เก้าอี้', 'ชั้นวาง',
  // Electrical and mechanical (non-IT)
  'ระบบไฟฟ้า', 'ติดตั้งไฟฟ้า', 'ปรับปรุงระบบไฟฟ้า', 'ระบบปรับอากาศ', 'ลิฟต์',
  // Printing/publication (non-digital)
  'พิมพ์หนังสือ', 'จัดพิมพ์', 'สิ่งพิมพ์',
  // Land and surveying
  'ที่ดิน', 'รังวัด', 'สำรวจที่ดิน',
];

// --------------------------------------------------------------------------
// Strong software-positive keywords: any single match strongly indicates software
// (used to rescue projects that contain non-software words but are primarily software development)
// --------------------------------------------------------------------------
const STRONG_SOFTWARE_KEYWORDS = [
  'ซอฟต์แวร์', 'software', 'โปรแกรม', 'application', 'แอปพลิเคชัน',
  'ระบบสารสนเทศ', 'system development', 'พัฒนาระบบ', 'พัฒนาโปรแกรม',
  'ระบบคอมพิวเตอร์', 'information technology', 'digital', 'ดิจิทัล',
  'บริการซอฟต์แวร์', 'บำรุงรักษาซอฟต์แวร์', 'maintenance software',
  'it service', 'บริการไอที', 'cloud service', 'บริการคลาวด์',
  'เช่าซอฟต์แวร์', 'เช่าระบบ', 'บำรุงรักษาระบบ',
  // Single words that unambiguously imply software in procurement context
  ' app', 'app ', ' system', 'system ', ' platform', 'platform ',
];

export function classifyByKeywords(
  title: string,
  description: string,
): ClassificationResult {
  const text = `${title} ${description}`.toLowerCase();

  // 0. Hard non-software patterns: ANY match immediately disqualifies the project.
  //    No strong software keyword can override these.
  const matchedHard = HARD_NON_SOFTWARE_PATTERNS.find((p) => text.includes(p.toLowerCase()));
  if (matchedHard) {
    return {
      category: 'Information System',
      isSoftwareRelated: false,
      confidence: 'High',
      reasoning: `Non-software procurement detected — matched non-software term: "${matchedHard}".`,
      provider: 'keyword',
      model: 'rule-based',
    };
  }

  // 1. Check for strong software-positive signals — these override standard non-software terms.
  //    e.g. "จัดซื้อครุภัณฑ์คอมพิวเตอร์ ซอฟต์แวร์ พร้อมพัฒนาระบบ" is mixed, but
  //    "ซ่อมบำรุงรักษาซอฟต์แวร์ครุภัณฑ์" means software maintenance.
  const hasStrongSoftware = STRONG_SOFTWARE_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()));

  // 2. Check for non-software indicators
  const nonSwMatch = NON_SOFTWARE_KEYWORDS.find((kw) => text.includes(kw.toLowerCase()));
  const isNonSoftware = Boolean(nonSwMatch) && !hasStrongSoftware;

  if (isNonSoftware) {
    return {
      category: 'Information System',
      isSoftwareRelated: false,
      confidence: 'High',
      reasoning: `Keyword analysis indicates non-software procurement — matched: "${nonSwMatch}". No overriding software term found.`,
      provider: 'keyword',
      model: 'rule-based',
    };
  }

  // 3. Score each software category
  const scores: Record<string, number> = {};
  for (const rule of KEYWORD_RULES) {
    scores[rule.category] = rule.keywords.filter((kw) => text.includes(kw.toLowerCase())).length;
  }

  // Only select categories that actually have positive keyword matches (> 0)
  const positiveMatches = Object.entries(scores).filter(([, s]) => s > 0);
  const [category, score] = positiveMatches.length > 0
    ? (positiveMatches.sort(([, a], [, b]) => b - a)[0] as [ProjectCategory, number])
    : (['Information System' as ProjectCategory, 0]);

  // 4. If no software keyword matches at all AND no strong signal → mark as non-software.
  //    (Prevents defaulting everything with no signals to isSoftwareRelated: true)
  if (score === 0 && !hasStrongSoftware) {
    return {
      category: 'Information System',
      isSoftwareRelated: false,
      confidence: 'Low',
      reasoning: 'No software-related keywords found in title or description.',
      provider: 'keyword',
      model: 'rule-based',
    };
  }

  const confidence: 'High' | 'Medium' | 'Low' = score >= 3 ? 'High' : score >= 1 ? 'Medium' : 'Low';

  const reasoning = score > 0
    ? `Keyword-based classification: ${score} matching term(s) found for "${category}".${hasStrongSoftware ? ' Strong software signal detected.' : ''}`
    : `General software procurement classified as Information System.${hasStrongSoftware ? ' Strong software signal detected.' : ''}`;

  return {
    category,
    isSoftwareRelated: true,
    confidence,
    reasoning,
    provider: 'keyword',
    model: 'rule-based',
  };
}

export class KeywordClassifierAdapter implements AiClassifierAdapter {
  public readonly name = 'KeywordFallbackAdapter';
  public readonly provider = 'keyword';
  public readonly model = 'rule-based';

  public isConfigured(): boolean {
    return true;
  }

  public async classify(title: string, description: string): Promise<ClassificationResult> {
    return classifyByKeywords(title, description);
  }

  public async classifyBulk(
    projects: Array<{ title: string; description: string }>,
  ): Promise<ClassificationResult[]> {
    return projects.map((p) => classifyByKeywords(p.title, p.description));
  }
}
