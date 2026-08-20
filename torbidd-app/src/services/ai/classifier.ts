// =============================================================================
// services/ai/classifier.ts - Project Classification Service
// Uses Vertex AI Gemini Flash to classify procurement project text.
// SERVER ONLY — do not import in client components.
// =============================================================================

import { getVertexAI, VERTEX_MODEL_FLASH } from './vertex-ai';

export interface ClassificationResult {
  category: 'Website' | 'Mobile App' | 'AI' | 'Database';
  confidence: 'High' | 'Medium' | 'Low';
  reasoning: string;
}

const MOCK_RESULT: ClassificationResult = {
  category: 'Website',
  confidence: 'High',
  reasoning: 'Mock response — configure GOOGLE_CLOUD_PROJECT for live AI classification.',
};

const CLASSIFICATION_PROMPT = (title: string, description: string) => `
You are a procurement classification expert for Bangkok Metropolitan Administration (BMA) software projects.

Classify the following project into exactly one of these four categories:
- Website: Web portals, e-government sites, web applications
- Mobile App: iOS/Android applications, mobile platforms
- AI: Artificial intelligence, machine learning, GIS mapping, computer vision
- Database: Database systems, information systems, data management, EMR

Project Title: ${title}
Project Description: ${description}

Respond with ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "category": "Website|Mobile App|AI|Database",
  "confidence": "High|Medium|Low",
  "reasoning": "One sentence explanation"
}
`;

export async function classifyProject(title: string, description: string): Promise<ClassificationResult> {
  // Return mock if Vertex AI not configured
  if (!process.env.GOOGLE_CLOUD_PROJECT) {
    return MOCK_RESULT;
  }

  try {
    const vertexAI = getVertexAI();
    const model = vertexAI.getGenerativeModel({ model: VERTEX_MODEL_FLASH });

    const result = await model.generateContent(CLASSIFICATION_PROMPT(title, description));
    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    // Strip any markdown fences if present
    const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned) as ClassificationResult;

    // Validate the response
    const validCategories = ['Website', 'Mobile App', 'AI', 'Database'];
    const validConfidence = ['High', 'Medium', 'Low'];
    if (!validCategories.includes(parsed.category) || !validConfidence.includes(parsed.confidence)) {
      throw new Error('Invalid AI response shape');
    }

    return parsed;
  } catch (err) {
    console.error('[AI Classifier] Error:', err);
    return { ...MOCK_RESULT, confidence: 'Low', reasoning: 'Classification failed — using fallback.' };
  }
}
