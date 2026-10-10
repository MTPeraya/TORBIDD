// =============================================================================
// services/ai/adapters/prompt.ts
// Shared prompts and response parsers for AI classification adapters (UC-10)
// =============================================================================

import { ProjectCategory } from '@/types/project';
import { ClassificationResult } from './types';

// UC-10: All 8 valid software categories
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

export const VALID_CATEGORIES_SET = new Set<string>(SOFTWARE_CATEGORIES);
export const VALID_CONFIDENCE_SET = new Set<string>(['High', 'Medium', 'Low']);

export function buildClassificationPrompt(title: string, description: string): string {
  return `You are an expert procurement classifier for Thai government and municipal (e.g. BMA) IT and software projects.

TASK:
1. Determine whether this procurement project is SOFTWARE-RELATED (isSoftwareRelated: true) or NOT (isSoftwareRelated: false).
2. If software-related, classify it into EXACTLY ONE of the following 8 categories:
   - Website: Public web portals, responsive e-services, citizen portals, web applications, CMS platforms.
   - Mobile App: iOS / Android mobile applications, smartphone smart service apps, mobile citizen platforms.
   - AI: Artificial Intelligence, machine learning models, computer vision, GIS spatial mapping/analytics, NLP/Chatbots.
   - Database: Database management systems (DBMS), enterprise database licenses (Oracle, SQL, Postgres), medical PACS/DICOM storage systems, data backup & storage infrastructure.
   - ERP: Enterprise Resource Planning, HR management (HRMS), payroll systems, accounting/budgeting (GFMIS), supply chain & asset management.
   - Cloud: Cloud computing subscriptions (SaaS, PaaS, IaaS), Government Cloud (GDCC), cloud infrastructure, virtualization, hosting.
   - Data Analytics: Business Intelligence (BI), management dashboards, data warehouses, big data analytics, open data pipelines.
   - Information System: Management Information Systems (MIS), e-government registry, Hospital Information Systems (HIS), electronic document systems (e-Saraban).

SOFTWARE-RELATED CRITERIA (isSoftwareRelated: true):
- Custom software, web, mobile, or system development and implementation.
- Procurement of enterprise software licenses, subscriptions, or annual software renewals (e.g., จัดหาลิขสิทธิ์ซอฟต์แวร์, license subscription, software maintenance agreement / MA).
- Cloud computing services, hosting platforms, and database system procurements.
- System integration, data migration, and software maintenance services.

NON-SOFTWARE CRITERIA (isSoftwareRelated: false):
- Physical construction, road work, building repairs, civil engineering, electrical wiring, air conditioning, plumbing.
- Furniture, desks, chairs, uniforms, vehicles, passenger transport, catering, food, logistics.
- Venue rentals and event organization (e.g., เช่าสถานที่, จัดสัมมนา, จัดประชุม) even if the seminar topic mentions computers or AI.
- Pure physical hardware without software systems (e.g. buying empty paper, toner cartridges, bare office desks).

Project Title: ${title}
Project Description: ${description}

Respond with ONLY valid JSON in this exact structure (no markdown fences, no preamble):
{
  "category": "Website|Mobile App|AI|Database|ERP|Cloud|Data Analytics|Information System",
  "isSoftwareRelated": true,
  "confidence": "High|Medium|Low",
  "reasoning": "One concise sentence explaining the classification."
}`;
}

/**
 * Safely parses and validates JSON returned from an LLM.
 * If JSON parsing or shape validation fails, executes fallback generator.
 */
export function parseAndValidateAiResponse(
  rawText: string,
  fallbackFn: () => ClassificationResult,
  metadata?: { provider: string; model: string },
): ClassificationResult {
  try {
    const cleaned = rawText
      .replace(/```json?\n?/gi, '')
      .replace(/```/g, '')
      .trim();

    if (!cleaned) {
      return fallbackFn();
    }

    const parsed = JSON.parse(cleaned) as Partial<ClassificationResult>;

    if (
      !parsed.category ||
      !VALID_CATEGORIES_SET.has(parsed.category) ||
      !parsed.confidence ||
      !VALID_CONFIDENCE_SET.has(parsed.confidence)
    ) {
      return fallbackFn();
    }

    return {
      category: parsed.category as ProjectCategory,
      isSoftwareRelated: parsed.isSoftwareRelated !== false,
      confidence: parsed.confidence as 'High' | 'Medium' | 'Low',
      reasoning:
        typeof parsed.reasoning === 'string' && parsed.reasoning.trim()
          ? parsed.reasoning.trim()
          : `Classified as ${parsed.category} by ${metadata?.provider ?? 'AI'}.`,
      provider: metadata?.provider,
      model: metadata?.model,
    };
  } catch {
    return fallbackFn();
  }
}
