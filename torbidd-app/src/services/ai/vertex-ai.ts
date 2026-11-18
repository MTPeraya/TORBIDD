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

/**
 * ASVS req_id 15.1.3 & 15.2.2: Standard execution timeout for Vertex AI prompt calls
 * Prevents loss of availability or thread starvation if cloud endpoints stall.
 */
export const VERTEX_AI_TIMEOUT_MS = 10_000; // 10 seconds

/**
 * Executes a Promise with an enforced timeout, rejecting if the operation exceeds timeoutMs.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = VERTEX_AI_TIMEOUT_MS,
  operationName: string = 'Vertex AI operation',
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`[Timeout] ${operationName} exceeded execution deadline of ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
