// =============================================================================
// services/ai/classifier.ts - Project Classification Service (UC-10)
// Classifies procurement projects into software categories and determines
// whether they are software-related or non-software-related.
// SERVER ONLY — do not import in client components.
// =============================================================================

import { getVertexAI, VERTEX_MODEL_FLASH } from './vertex-ai';
import { ProjectCategory } from '@/types/project';

// UC-10: All valid software categories
export const SOFTWARE_CATEGORIES: ProjectCategory[] = [
  'Website',
  'Mobile App',
  'AI',
  'Database',
  'ERP',
  'Cloud',
  'Data Analytics',
  'Information System',
];

export interface ClassificationResult {
  category: ProjectCategory;
  isSoftwareRelated: boolean;
  confidence: 'High' | 'Medium' | 'Low';
  reasoning: string;
}

// ---------------------------------------------------------------------------
// Keyword-based fallback classifier (no external dependency)
// ---------------------------------------------------------------------------

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
      'ปัญญาประดิษฐ์', 'ai', 'machine learning', 'แผนที่', 'ระบบจีไอเอส',
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

// Keywords that suggest a project is NOT software-related
const NON_SOFTWARE_KEYWORDS = [
  'road construction', 'building construction', 'road works',
  'furniture', 'renovation works', 'maintenance hardware', 'electrical installation',
  'ก่อสร้าง', 'ปรับปรุงอาคาร', 'ถนน', 'ครุภัณฑ์', 'ยานพาหนะ', 'เฟอร์นิเจอร์',
];

/**
 * Rule-based classifier that runs without any external API.
 * Used as fallback and for quick pre-screening.
 */
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
  };
}

// ---------------------------------------------------------------------------
// AI-powered classification prompt (UC-10 extended categories)
// ---------------------------------------------------------------------------

const CLASSIFICATION_PROMPT = (title: string, description: string) => `
You are a procurement classification expert for Bangkok Metropolitan Administration (BMA) software projects.

First, determine if this procurement project is SOFTWARE-RELATED or NOT.
Then, if it is software-related, classify it into exactly one of these categories:
- Website: Web portals, e-government sites, web applications, online services
- Mobile App: iOS/Android applications, mobile platforms, smartphone apps
- AI: Artificial intelligence, machine learning, GIS mapping, computer vision, NLP
- Database: Database systems, data center hardware, server infrastructure, storage
- ERP: Enterprise Resource Planning, HR systems, payroll, accounting, supply chain
- Cloud: Cloud computing services, IaaS/PaaS/SaaS infrastructure, containerization
- Data Analytics: Business intelligence, BI dashboards, data warehouses, big data pipelines
- Information System: Management systems, e-government registration, EMR, document management, MIS

If the project is NOT software-related (e.g., construction, physical equipment, roads), set isSoftwareRelated to false.

Project Title: ${title}
Project Description: ${description}

Respond with ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "category": "Website|Mobile App|AI|Database|ERP|Cloud|Data Analytics|Information System",
  "isSoftwareRelated": true,
  "confidence": "High|Medium|Low",
  "reasoning": "One sentence explanation"
}
`;

const VALID_CATEGORIES = new Set<string>(SOFTWARE_CATEGORIES);
const VALID_CONFIDENCE = new Set(['High', 'Medium', 'Low']);



/**
 * Classifies a procurement project using Vertex AI Gemini.
 * Falls back to keyword-based classification if AI is unavailable.
 */
export async function classifyProject(
  title: string,
  description: string,
): Promise<ClassificationResult> {
  // Return mock if Vertex AI not configured (dev / test)
  if (!process.env.GOOGLE_CLOUD_PROJECT) {
    return classifyByKeywords(title, description);
  }

  try {
    const vertexAI = getVertexAI();
    const model = vertexAI.getGenerativeModel({ model: VERTEX_MODEL_FLASH });

    const result = await model.generateContent(CLASSIFICATION_PROMPT(title, description));
    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    // Strip any markdown fences if present
    const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned) as ClassificationResult;

    // Validate the AI response shape
    if (!VALID_CATEGORIES.has(parsed.category) || !VALID_CONFIDENCE.has(parsed.confidence)) {
      throw new Error('Invalid AI response shape');
    }

    return {
      ...parsed,
      isSoftwareRelated: parsed.isSoftwareRelated !== false, // default true
    };
  } catch (err) {
    console.error('[AI Classifier] Error — falling back to keyword classifier:', err);
    // Fall back to keyword-based classifier on error
    return classifyByKeywords(title, description);
  }
}

/**
 * Bulk classify an array of projects (title + description pairs).
 * Returns results in the same order as the input array.
 */
export async function classifyProjectsBulk(
  projects: Array<{ title: string; description: string }>,
): Promise<ClassificationResult[]> {
  return Promise.all(projects.map(({ title, description }) => classifyProject(title, description)));
}
