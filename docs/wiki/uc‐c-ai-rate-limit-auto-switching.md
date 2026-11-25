Issue: [#307](https://github.com/MTPeraya/TORBIDD/issues/307)

# Rate-limit auto-switching fallback chain with Vertex AI as last provider

## Description

Implement an automated fallback mechanism and dynamic provider switching for the AI classification pipeline to handle rate limits (HTTP 429) and provider errors, ensuring Google Cloud Vertex AI serves as the last AI provider before falling back to rule-based keyword classification.

### Scope

**Rate-Limit Circuit Breaker & Fallback Chain:**
* Implement `FallbackClassifierAdapter` that catches `AiRateLimitError` (HTTP 429) and provider failures
* Enforce canonical provider order: `Google AI Studio (Gemini) -> OpenRouter -> Vertex AI -> Keyword Fallback`
* Strictly position Google Cloud Vertex AI as the final AI provider before deterministic keyword classification
* Maintain an in-memory cooldown state (60s) so subsequent requests in batch/ingestion skip rate-limited providers without incurring failing calls

**Multi-Key Rotation (Google AI Studio):**
* Support comma-separated API keys in `GEMINI_API_KEY` / `GEMINI_API_KEYS`
* Automatically rotate to the next available key when key #1 receives HTTP 429 before falling back to other providers

**Dynamic Provider Switching & Management:**
* Support runtime provider switching via `switchActiveAiProvider()`
* Expose administrative endpoints (`GET /api/admin/ai-provider`, `POST /api/admin/ai-provider`) to view fallback status, switch active providers, or reset cooldowns
* Enhance diagnostics in `/api/ai/classify` and `/api/admin/stats` to report live fallback chain and cooldown status

### Related Files

* `src/services/ai/adapters/fallback-adapter.ts`
* `src/services/ai/adapters/google-ai-studio-adapter.ts`
* `src/services/ai/adapters/openrouter-adapter.ts`
* `src/services/ai/adapters/vertex-ai-adapter.ts`
* `src/services/ai/adapters/index.ts`
* `src/services/ai/adapters/types.ts`
* `src/app/api/admin/ai-provider/route.ts`
* `src/app/api/ai/classify/route.ts`

### Definition of Done

* [ ] Classification pipeline automatically switches to OpenRouter when Google AI Studio hits HTTP 429.
* [ ] Vertex AI is verified as the last AI provider in the fallback chain before keyword classification.
* [ ] Rate-limited providers enter a temporary cooldown to prevent redundant requests during batch classification.
* [ ] Multiple Gemini API keys rotate automatically upon 429 responses.
* [ ] Administrators can inspect provider status and switch the active provider via API.
* [ ] Fallback to keyword classifier occurs gracefully if all AI backends fail or are in cooldown.
* [ ] Automated tests cover fallback ordering, rate-limit switching, and multi-key rotation.
