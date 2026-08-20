// =============================================================================
// services/ai/vertex-ai.ts - Vertex AI Client Initialization
// =============================================================================
// This module initializes the Vertex AI client ONLY on the server side.
// Never import this in client components or expose to the browser.
// =============================================================================

import { VertexAI } from '@google-cloud/vertexai';

const project = process.env.GOOGLE_CLOUD_PROJECT;
const location = process.env.GOOGLE_CLOUD_LOCATION || 'asia-southeast1';

if (!project) {
  // In development without Vertex AI configured, log a warning but don't crash
  console.warn('[VertexAI] GOOGLE_CLOUD_PROJECT not set — AI features will return mock responses.');
}

// Singleton VertexAI client
let _vertexAI: VertexAI | null = null;

export function getVertexAI(): VertexAI {
  if (!_vertexAI && project) {
    _vertexAI = new VertexAI({ project, location });
  }
  if (!_vertexAI) {
    throw new Error('Vertex AI is not configured. Set GOOGLE_CLOUD_PROJECT in .env.local');
  }
  return _vertexAI;
}

export const VERTEX_MODEL_PRO = process.env.VERTEX_AI_MODEL_PRO || 'gemini-1.5-pro';
export const VERTEX_MODEL_FLASH = process.env.VERTEX_AI_MODEL_FLASH || 'gemini-1.5-flash';
