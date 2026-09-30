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
  return `You are a procurement classification expert for Bangkok Metropolitan Administration (BMA) software projects.

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

If the project is NOT software-related, set isSoftwareRelated to false.
The following are NOT software-related (isSoftwareRelated: false):
- Hardware/display/screen rentals or event logistics (e.g., เช่าจอ LCD, เช่าสถานที่, เช่าระบบเสียง, จัดประชุมเชิงปฏิบัติการ, จัดสัมมนา, อาหารว่าง) even if the event topic mentions software or AI.
- Off-the-shelf consumer/retail tool subscriptions or single licenses (e.g., buying licenses for ChatGPT Plus, Claude, Canva, Zoom, Microsoft 365 Family, domain name renewals).
- Physical computer hardware/laptop/printer purchases (even if bundled with Windows/OS).
- Construction, roads, furniture, vehicles, air conditioning, electrical work, renovation.

A project is ONLY software-related (isSoftwareRelated: true) if it involves genuine software engineering: custom software/web/mobile development, enterprise system implementation, data platforms, or enterprise software maintenance.

Project Title: ${title}
Project Description: ${description}

Respond with ONLY valid JSON in this exact format (no markdown, no preamble, no backticks):
{
  "category": "Website|Mobile App|AI|Database|ERP|Cloud|Data Analytics|Information System",
  "isSoftwareRelated": true,
  "confidence": "High|Medium|Low",
  "reasoning": "One sentence explanation"
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
