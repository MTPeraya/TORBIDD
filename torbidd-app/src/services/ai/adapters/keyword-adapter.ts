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

const KEYWORD_RULES: KeywordRule[] = [
  {
    category: 'AI',
    keywords: [
      'artificial intelligence', 'machine learning', 'deep learning', 'neural network',
      'gis', 'geographic information', 'computer vision', 'nlp', 'natural language',
      'ปัญญาประดิษฐ์', 'ai', 'แผนที่', 'ระบบจีไอเอส',
    ],
  },
  {
    category: 'ERP',
    keywords: [
      'erp', 'enterprise resource', 'hr system', 'human resource', 'payroll',
      'accounting system', 'procurement system', 'supply chain', 'sap', 'oracle',
      'ระบบทรัพยากรบุคคล', 'ระบบเงินเดือน', 'ระบบบัญชี', 'ระบบจัดซื้อ',
    ],
  },
  {
    category: 'Cloud',
    keywords: [
      'cloud', 'iaas', 'paas', 'saas', 'azure', 'aws', 'google cloud',
      'virtual machine', 'container', 'kubernetes', 'docker', 'microservices',
      'คลาวด์', 'บริการคลาวด์', 'ระบบคลาวด์',
    ],
  },
  {
    category: 'Data Analytics',
    keywords: [
      'data analytics', 'business intelligence', 'dashboard', 'reporting',
      'data warehouse', 'big data', 'data visualization', 'etl', 'data pipeline',
      'วิเคราะห์ข้อมูล', 'ระบบรายงาน', 'คลังข้อมูล', 'บิ๊กดาต้า',
    ],
  },
  {
    category: 'Mobile App',
    keywords: [
      'mobile', 'ios', 'android', 'application', 'app', 'smartphone',
      'แอปพลิเคชัน', 'แอปมือถือ', 'สมาร์ทโฟน',
    ],
  },
  {
    category: 'Website',
    keywords: [
      'website', 'web portal', 'e-government', 'web application', 'online',
      'เว็บไซต์', 'เว็บพอร์ทัล', 'เว็บแอปพลิเคชัน', 'ระบบออนไลน์', 'เว็บ',
    ],
  },
  {
    category: 'Information System',
    keywords: [
      'information system', 'management system', 'registration system', 'emr',
      'electronic medical', 'hospital information', 'mis', 'document management',
      'ระบบสารสนเทศ', 'ระบบบริหาร', 'ระบบทะเบียน', 'ระบบบันทึก', 'ระบบจัดการ',
    ],
  },
  {
    category: 'Database',
    keywords: [
      'database', 'data center', 'server infrastructure', 'storage', 'backup', 'postgresql',
      'mysql', 'mongodb', 'sql server', 'ฐานข้อมูล', 'เซิร์ฟเวอร์', 'สำรองข้อมูล',
    ],
  },
];

const NON_SOFTWARE_KEYWORDS = [
  'road construction', 'building construction', 'road works',
  'furniture', 'renovation works', 'maintenance hardware', 'electrical installation',
  'ก่อสร้าง', 'ปรับปรุงอาคาร', 'ถนน', 'ครุภัณฑ์', 'ยานพาหนะ', 'เฟอร์นิเจอร์',
];

export function classifyByKeywords(
  title: string,
  description: string,
): ClassificationResult {
  const text = `${title} ${description}`.toLowerCase();

  // Check for non-software indicators first
  const isNonSoftware = NON_SOFTWARE_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()));
  if (isNonSoftware) {
    return {
      category: 'Information System',
      isSoftwareRelated: false,
      confidence: 'Medium',
      reasoning: 'Keyword analysis indicates a non-software procurement (construction, equipment, etc.)',
      provider: 'keyword',
      model: 'rule-based',
    };
  }

  // Score each category
  const scores: Record<string, number> = {};
  for (const rule of KEYWORD_RULES) {
    scores[rule.category] = rule.keywords.filter((kw) => text.includes(kw.toLowerCase())).length;
  }

  const bestCategory = (Object.entries(scores).sort(([, a], [, b]) => b - a)[0] ?? [
    'Information System',
    0,
  ]) as [ProjectCategory, number];

  const [category, score] = bestCategory;
  const confidence: 'High' | 'Medium' | 'Low' = score >= 3 ? 'High' : score >= 1 ? 'Medium' : 'Low';

  return {
    category: score > 0 ? category : 'Information System',
    isSoftwareRelated: true,
    confidence,
    reasoning: `Keyword-based classification: ${score} matching term(s) found for "${category}".`,
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
