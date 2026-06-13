# ADR 0003: AIProvider Seam with Live and Mock Implementations

- Status: Accepted
- Date: 2026-06-12

## Context

Glowi's intelligence is its core value: skin analysis, chat, and memory extraction. But:

- **Live mode** (Claude edge functions) requires a deployed Supabase project and a valid Anthropic key; blocks development and demos offline
- **Testing** is slow if every test invokes the API
- **Cost** is a concern during development; each scan analysis and chat turn costs API tokens
- **Development velocity** suffers without fast iteration

The app must support both live and mock AI with zero UI or database changes—downstream screens should behave identically.

## Decision

Define an `AIProvider` interface with two implementations:

**Interface:** (`mobile/src/lib/ai/types.ts`)

```typescript
export interface AIProvider {
  readonly mode: 'live' | 'mock';
  analyzeScan(input: AnalyzeScanInput): Promise<Scan>;
  chat(input: ChatInput): Promise<ChatResult>;
  extractMemories(sessionId: string): Promise<ExtractResult>;
}
```

**Live Provider** (`mobile/src/lib/ai/live.ts`)
- Invokes deployed edge functions (`analyze-skin`, `chat`, `extract-memories`)
- Reads scan images from Supabase Storage
- Returns the exact response shape from the server

**Mock Provider** (`mobile/src/lib/ai/mock.ts`)
- Runs entirely on-device (zero network calls, zero API cost)
- **Scans**: cycles through 3 realistic scenarios with plausible, slowly-improving scores (68→74→81) so Progress trends look alive; each scan adds a skin event memory
- **Chat**: keyword-routed responses with real seeded product slugs from the catalog; waits 1.1–2.4s for realism
- **Memory extraction**: heuristic regex rules (allergy mentions, skin type assertions, goals) extract 0–3 memories per session; updates the session summary

Both implementations **persist through the same Supabase tables** (`scans`, `chat_messages`, `ai_memories`, etc.), so every downstream screen (Progress, Chat, Profile) sees identical data and behaves identically.

**Runtime toggle:** `settings.aiMode` (persisted in AsyncStorage) selects the provider; users can switch in Profile → AI Engine.

## Consequences

**Advantages:**

- Full app works offline with zero API cost (development, demos, CI testing)
- Provider is a single seam for extending or swapping implementations later
- Mock data is realistic enough to demo routines, progress trends, and memory extraction
- No database changes between modes; all downstream code is provider-agnostic
- Easier to debug: mock mode is 100% deterministic

**Tradeoffs:**

- Mock logic must be maintained alongside real contracts (if the real API changes, update mock too)
- Mock data is hardcoded scenarios; can't generate truly arbitrary analyses
- Mock scenarios are skincare-specific; adding new features (e.g., nutrition analysis) requires scenario updates
- Products in mock chat are seeded; doesn't test edge cases like recommending unavailable products

**Testing Strategy:**

- Unit tests for both providers use mock and live interchangeably (mock is the fast path)
- Mock provider tests verify scenario rotation and heuristic memory extraction
- Live provider tests (integration) verify error handling and product validation
- Default CI uses mock mode for speed; nightly integration tests use live mode (requires Supabase + Anthropic keys)

