/**
 * The product block a chat reply may end with: `<products>["slug"]</products>`.
 *
 * Lives here rather than inline in `chat` so it can be tested directly — it is
 * the one piece of chat that parses model output, and model output is exactly
 * the input you cannot predict. Everything it returns is still validated
 * against the real catalog by the caller before it is persisted; this only has
 * to fail safely, never throw, and never leave the raw block in the prose the
 * user reads.
 */

/**
 * Everything from the opening tag to its close — or to the end of the string if
 * there is no close. Matching the *tag* rather than a well-formed `[...]` inside
 * it is deliberate: a reply cut off at max_tokens ends mid-block
 * (`…<products>["cerave-hyd`), and a pattern that insists on a closing bracket
 * matches nothing, strips nothing, and leaves raw markup sitting in the message
 * the user reads. The block is machinery; it never belongs on screen, in any state.
 */
const BLOCK_RE = /<products>([\s\S]*?)(?:<\/products>|$)/;

/** The JSON array inside the block, if the model finished writing one. */
const ARRAY_RE = /\[[\s\S]*\]/;

/** The model may name at most this many products in one reply. */
const MAX_REFS = 3;

export interface ParsedReply {
  /** The reply as the user sees it — block stripped, trimmed. */
  reply: string;
  /** Slugs the model claimed; still unvalidated against the catalog. */
  productRefs: string[];
}

export function parseProductBlock(raw: string): ParsedReply {
  let productRefs: string[] = [];

  const reply = raw
    .replace(BLOCK_RE, (_match, inner: string) => {
      const array = inner.match(ARRAY_RE);
      if (array) {
        try {
          const slugs: unknown = JSON.parse(array[0]);
          if (Array.isArray(slugs)) {
            productRefs = slugs.filter((s): s is string => typeof s === 'string').slice(0, MAX_REFS);
          }
        } catch {
          // Malformed block — drop it silently; the prose reply stands alone.
          // A recommendation the model garbled is worth less than a reply that
          // still reads correctly.
        }
      }
      return '';
    })
    .trim();

  return { reply, productRefs };
}
