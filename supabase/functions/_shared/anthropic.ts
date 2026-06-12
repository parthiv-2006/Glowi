/** Minimal Anthropic Messages API client (fetch-based; no SDK dependency). */

const API_URL = 'https://api.anthropic.com/v1/messages';

export const MODELS = {
  /** Vision analysis + chat: quality matters. */
  primary: Deno.env.get('GLOWI_PRIMARY_MODEL') ?? 'claude-sonnet-4-6',
  /** Memory extraction / summarization: cheap and fast. */
  light: Deno.env.get('GLOWI_LIGHT_MODEL') ?? 'claude-haiku-4-5-20251001',
} as const;

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

export interface ClaudeOptions {
  system?: string;
  messages: ClaudeMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export async function callClaude(opts: ClaudeOptions): Promise<string> {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) throw new Error('ANTHROPIC_API_KEY is not configured');

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: opts.model ?? MODELS.primary,
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0.7,
      ...(opts.system ? { system: opts.system } : {}),
      messages: opts.messages,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  return (data.content ?? [])
    .filter((block: { type: string }) => block.type === 'text')
    .map((block: { text: string }) => block.text)
    .join('');
}

/**
 * Extracts the first balanced JSON object or array from model output.
 * Tolerates markdown fences and prose around the JSON.
 */
export function extractJson<T>(text: string): T {
  const start = text.search(/[[{]/);
  if (start === -1) throw new Error('No JSON found in model output');
  const open = text[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
    } else if (ch === '\\' && inString) {
      escaped = true;
    } else if (ch === '"') {
      inString = !inString;
    } else if (!inString) {
      if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) return JSON.parse(text.slice(start, i + 1)) as T;
      }
    }
  }
  throw new Error('Unbalanced JSON in model output');
}
