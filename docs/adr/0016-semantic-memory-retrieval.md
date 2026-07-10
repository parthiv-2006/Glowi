# ADR 0016: Semantic memory retrieval with pgvector + gte-small

- Status: Accepted
- Date: 2026-07-10

## Context

`assembleMemoryContext` has always ranked non-gotcha memories by importance then
recency, capped at 12. That works while a user has a few dozen memories, but it degrades
in a specific, quiet way as `ai_memories` grows: the same globally-important facts crowd
the context regardless of what the user actually asked, and the memory that would have
made the answer good ("prefers fragrance-free", logged months ago at importance 2) never
surfaces. ARCHITECTURE.md deferred semantic retrieval in v1 with the note that "the seam
is ready" — this change uses that seam.

The forcing constraint on the design: no new external dependency. Anthropic has no
embeddings API, and adding a Voyage/OpenAI key for this would be a second AI vendor to
manage for a background quality feature.

## Decision

**gte-small inside the edge runtime.** Supabase's edge functions ship an embedded model
(`Supabase.ai.Session('gte-small')`, 384-dim, normalized) — zero cost, zero keys, no
network call. `_shared/embeddings.ts` wraps it and returns `null` on any failure, which
callers treat as "no semantic path today".

**Storage** (migration `0020_memory_embeddings.sql`): pgvector (`extensions` schema), a
nullable `embedding vector(384)` column on `ai_memories`, an HNSW cosine index, and a
`match_memories(p_user_id, p_query, p_limit)` SQL function (SECURITY INVOKER, pinned
`search_path`) returning cosine-nearest **active, non-gotcha** rows. Under a user JWT,
RLS still scopes results to the caller; the edge functions call it with the service role.

**Write path:** `extract-memories` embeds each add/update/supersede at write time, so new
memories are searchable immediately. A failed embed stores NULL rather than failing the
op — extraction never becomes dependent on the embedder.

**Read path:** `assembleMemoryContext` gains an optional `queryText`. When present (the
`chat` function passes the user's message), it embeds the query, **self-heals** up to 40
active rows that still lack embeddings (pre-migration corpus — no separate backfill job
needed at this scale), and swaps the ranked block for the `match_memories` result,
relabelled "most relevant to their message first". Everything else — gotchas always
included, `touchMemories` recency bumps, the 12-row cap — is unchanged.

**Fallback is structural, not exceptional.** No query text (`skin-forecast`,
`glow-report` never had one), embedder unavailable, RPC missing, or nothing embedded yet
→ the original importance/recency ranking is used. Semantic retrieval is an upgrade
layered on the existing behavior, never a dependency of it.

## Rejected alternatives

- **Voyage AI (or OpenAI) embeddings.** Better vectors, but a new paid key in function
  secrets and an external call per memory write for quality gains that don't matter at a
  sub-thousand-row corpus. gte-small can be swapped later by re-embedding one column.
- **A standalone backfill job.** Corpora are ≤ tens of rows per user; healing lazily on
  the first semantic chat costs milliseconds and removes an operational step.
- **Hybrid score (similarity × importance).** Arbitrary weights pretending to be
  principled. Gotchas — the rows where importance is safety — are always included
  unranked already; for the rest, relevance-to-the-message is the better signal.
- **Ranking client-side.** Embeddings would have to leave the database and the model
  doesn't run in React Native; retrieval belongs next to the data.

## Verification

Quality gate green (tsc strict, eslint, 150 jest — this change is server-only, the
AIProvider seam is untouched and mock mode is unaffected). Migration applied to
`rfuuznnbctfyqttslrbv`; advisors clean of new findings. Live check: a seeded throwaway
guest with contrasting memories, a chat message about one topic, and the deployed
`match_memories` path returning the on-topic memory first (see the session's verification
transcript); embeddings self-healed for rows inserted without them.

## Consequences

- Chat context now tracks the conversation topic as the memory corpus grows; coach
  quality no longer silently degrades with scale — the exact failure this was deferred
  against.
- Every memory write pays one on-runtime embed (~ms, free). Reads pay one query embed
  plus an indexed ANN lookup.
- `gte-small` is fixed at 384 dims; switching models means a new column/reindex and
  re-embedding all rows — cheap now, worth doing before the corpus is large if ever.
- The `chat` function's context assembly is now async-heavier on first use per user
  (self-heal); steady-state cost is one embed per turn.
