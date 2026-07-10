-- Semantic memory retrieval (ADR-0016): pgvector embeddings on ai_memories so
-- chat context surfaces the memories relevant to what the user just said,
-- instead of only the globally most-important ones. Embeddings are gte-small
-- (384-dim, normalized) computed inside the edge runtime — no external
-- provider, no new key. NULL embeddings are legal: the read path falls back to
-- importance/recency ranking and self-heals missing rows.
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

ALTER TABLE ai_memories ADD COLUMN embedding extensions.vector(384);

COMMENT ON COLUMN ai_memories.embedding IS
  'gte-small (384-dim, normalized) embedding of content. Written by extract-memories, '
  'self-healed by the memory read path; NULL falls back to importance/recency ranking.';

CREATE INDEX ai_memories_embedding_idx ON ai_memories
  USING hnsw (embedding extensions.vector_cosine_ops);

-- Cosine-nearest active non-gotcha memories for one user (gotchas are always
-- included by the assembler, never ranked). SECURITY INVOKER: under a user JWT
-- RLS still scopes rows to the caller; edge functions call it with the
-- service role. Pinned search_path per the function-hardening convention.
CREATE FUNCTION match_memories(
  p_user_id uuid,
  p_query   extensions.vector(384),
  p_limit   int DEFAULT 12
)
RETURNS TABLE (id uuid, type text, content text, importance int, similarity double precision)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT m.id, m.type, m.content, m.importance::int,
         1 - (m.embedding <=> p_query) AS similarity
  FROM ai_memories m
  WHERE m.user_id = p_user_id
    AND m.status = 'active'
    AND m.type <> 'gotcha'
    AND m.embedding IS NOT NULL
  ORDER BY m.embedding <=> p_query
  LIMIT p_limit;
$$;
