// =============================================================================
// services/ai/tor-extractor.ts - TOR PDF Extraction Service
// Uses Vertex AI Gemini Pro (multimodal) to extract structured data from PDFs.
// SERVER ONLY — do not import in client components.
// =============================================================================

import { getVertexAI, VERTEX_MODEL_PRO } from './vertex-ai';

export interface TorExtractResult {
  title: { th: string; en: string } | null;
  budget: number | null;
  deadline: string | null;
  department: string | null;
  procurementType: string | null;
  scope: string[];
  qualifications: string[];
  confidence: 'High' | 'Medium' | 'Low';
  rawText?: string;
}

const MOCK_EXTRACT: TorExtractResult = {
  title: { th: 'ตัวอย่างชื่อโครงการ', en: 'Sample Project Title' },
  budget: 5000000,
  deadline: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
  department: 'กรุงเทพมหานคร',
  procurementType: 'e-Bidding',
  scope: ['Mock scope item 1', 'Mock scope item 2'],
  qualifications: ['Mock qualification 1'],
  confidence: 'Low',
};

const EXTRACTION_PROMPT = `
You are an expert at reading Thai government procurement documents (TOR - Terms of Reference).

Extract the following fields from the provided document:
- title: Project title in both Thai (th) and English (en) if available
- budget: Total budget amount as a number in Thai Baht (THB). No currency symbols.
- deadline: Submission deadline date in YYYY-MM-DD format
- department: Department/agency name (in Thai)
- procurementType: Type of procurement (e.g., e-Bidding, ประกวดราคา)
- scope: Array of main scope of work items (in English if possible, otherwise Thai)
- qualifications: Array of bidder qualification requirements

Respond with ONLY valid JSON, no markdown fences:
{
  "title": { "th": "...", "en": "..." },
  "budget": 12500000,
  "deadline": "2026-09-30",
  "department": "สำนักการศึกษา",
  "procurementType": "e-Bidding",
  "scope": ["item1", "item2"],
  "qualifications": ["qual1", "qual2"],
  "confidence": "High|Medium|Low"
}
`;

export async function extractTorFromUrl(documentUrl: string): Promise<TorExtractResult> {
  if (!process.env.GOOGLE_CLOUD_PROJECT) return MOCK_EXTRACT;

  try {
    const vertexAI = getVertexAI();
    const model = vertexAI.getGenerativeModel({ model: VERTEX_MODEL_PRO });

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { fileData: { mimeType: 'application/pdf', fileUri: documentUrl } },
          { text: EXTRACTION_PROMPT },
        ],
      }],
    });

    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned) as TorExtractResult;
  } catch (err) {
    console.error('[TOR Extractor] URL extraction error:', err);
    return { ...MOCK_EXTRACT, confidence: 'Low' };
  }
}

export async function extractTorFromBase64(base64: string): Promise<TorExtractResult> {
  if (!process.env.GOOGLE_CLOUD_PROJECT) return MOCK_EXTRACT;

  try {
    const vertexAI = getVertexAI();
    const model = vertexAI.getGenerativeModel({ model: VERTEX_MODEL_PRO });

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'application/pdf', data: base64 } },
          { text: EXTRACTION_PROMPT },
        ],
      }],
    });

    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned) as TorExtractResult;
  } catch (err) {
    console.error('[TOR Extractor] Base64 extraction error:', err);
    return { ...MOCK_EXTRACT, confidence: 'Low' };
  }
}
