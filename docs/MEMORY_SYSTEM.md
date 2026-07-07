# The AI memory system

Glowi's coach is meant to feel like it *knows you*. Every new conversation — and every
scan interpretation — begins with durable context about who you are, what you're working
on, what's gone wrong before, and where you left off. This document explains how that
works end to end.

## Goals

1. **Continuity** — a new chat never starts from zero; it opens with what matters.
2. **Safety first** — allergies and bad reactions ("gotchas") are always present,
   regardless of ranking.
3. **Transparency & control** — the user can see and delete anything Glowi remembers.
4. **Provider-agnostic** — the same model works in live (Claude) and mock (on-device)
   modes.

## Data model

Memories live in `ai_memories` (per-user, RLS-protected):

| Column | Meaning |
|---|---|
| `type` | `profile_fact` · `preference` · `event` · `gotcha` · `goal` |
| `content` | A concise, standalone sentence |
| `importance` | 1–5 (5 = safety-critical) |
| `source` | `chat` · `scan` · `onboarding` · `system` |
| `source_ref` | Originating scan/session id |
| `status` | `active` · `superseded` |
| `last_accessed_at` | Bumped on retrieval — powers recency ranking |

Onboarding seeds the first memories (skin type → `profile_fact`, goals → `goal`). Scans
write an `event` memory each time. Logging a product reaction
([ADR-0009](adr/0009-reaction-log.md)) writes an importance-5 `gotcha` in the same call
as the `reaction_logs` row (`source: system`, `source_ref` = the log id), which is how
"never recommend this again" reaches every AI surface. Conversations are mined for the
rest.

## Read path — assembling context

`supabase/functions/_shared/memory.ts :: assembleMemoryContext()` builds the block
injected into the system prompt for both `chat` and (future) scan interpretation:

1. **Profile** — name, self-reported skin type, goals.
2. **Safety notes** — *all* `active` `gotcha` memories, unconditionally. A user who said
   "niacinamide breaks me out" must never be recommended niacinamide, even if that fact
   is old.
3. **Ranked memories** — the remaining active memories ordered by
   `importance DESC, last_accessed_at DESC`, capped at the top 12.
4. **Latest scan** — score, estimated type, summary, and concern list from the most
   recent completed scan.
5. **Last session summary** — the one-paragraph recap written when the previous
   conversation ended.
6. **Today's Skin Weather** — if a forecast exists for today, its headline and summary
   are appended, so the coach can answer "what should I change today?" against the same
   environmental read the home screen shows (see [ADR-0005](adr/0005-skin-weather-forecasting.md)).
7. **The Shelf** — the products the user owns (with low-stock flags), so the coach
   recommends what's already in their cabinet rather than sending them shopping (see
   [ADR-0006](adr/0006-the-shelf-inventory.md)).

The assembled block is prepended to the system prompt as a "what you know about this
user" section, framed as ground truth. Retrieved memory ids are then **touched**
(`last_accessed_at = now()`) so recently useful memories surface again next time — a
cheap recency signal without embeddings.

```
PROFILE — name: Sam; skin type: combination; goals: clear breakouts, even tone
SAFETY NOTES (always respect these):
  ⚠ Reported that niacinamide caused a bad reaction.
WHAT YOU REMEMBER ABOUT THIS USER (most important first):
  • [goal] Wants to fade post-acne marks before a wedding in the fall.
  • [preference] Prefers cheaper drugstore products and a short routine.
LATEST SKIN SCAN (Tue Jun 09 2026) — score 74/100 … Concerns: Congestion (52/100), …
LAST CONVERSATION SUMMARY: Discussed starting a BHA; agreed to 2 nights/week …
TODAY'S SKIN WEATHER (San Francisco, CA) — High UV and low humidity. Skin like yours …
PRODUCTS ON THEIR SHELF (recommend what they own): EltaMD UV Clear SPF 46 (spf, running low); …
```

## Write path — extraction

When the user leaves a conversation, the client fire-and-forgets
`AIProvider.extractMemories(sessionId)`.

`extract-memories` reads only the turns not yet mined (tracked by
`chat_sessions.memory_extracted_until`, making it **idempotent** — old turns are never
re-processed), passes them plus the existing memories to a light, cheap model, and gets
back structured operations:

```jsonc
{
  "memories": [
    { "op": "add",       "type": "gotcha", "content": "…", "importance": 5 },
    { "op": "update",    "id": "…",        "type": "preference", "content": "…", "importance": 3 },
    { "op": "supersede", "id": "…",        "type": "profile_fact", "content": "…", "importance": 4 }
  ],
  "session_summary": "2–3 sentence recap…"
}
```

- **add** inserts a new memory.
- **update** refines an existing memory in place (the model is given current memories so
  it can choose to refine rather than duplicate).
- **supersede** archives the old memory (`status = superseded`) and inserts a replacement
  — used when a fact *changed* (e.g. switched skin type), preserving history without
  polluting retrieval.

The prompt instructs the model to keep gotchas at importance 5, to prefer `update` over
duplicate `add`, and to return an empty list when nothing is worth remembering. Every op
is validated server-side (type whitelist, importance clamp, length limits, id ownership)
before it touches the database. Extraction failures are non-fatal — chat works without
them and the next session retries the un-mined turns.

The same call refreshes `chat_sessions.summary`, which becomes the "last session
summary" in the next read.

## Why ranking instead of embeddings (for now)

Semantic retrieval (pgvector) is the obvious future step, and the seam is ready for it.
For v1, importance × recency with an always-on gotcha channel is simple, debuggable, and
more than sufficient at realistic per-user memory counts. Moving to embedding-based
recall is a localized change to `assembleMemoryContext` — noted as a future ADR rather
than premature complexity.

## Mock mode

`MockAIProvider.extractMemories` runs a small heuristic (regex rules for reactions,
skin-type statements, goals, and product mentions) so the entire memory loop is
demonstrable offline with no API calls. It writes the same `ai_memories` rows, so the
"What Glowi remembers" screen and the read path behave identically to live mode.

## Transparency

The **Glowi's memory** screen (`app/memory.tsx`) lists every active memory grouped by
type — safety notes first — and lets the user delete any of them. Deletion is immediate
and permanent, which keeps the user in control of what the AI carries forward.
