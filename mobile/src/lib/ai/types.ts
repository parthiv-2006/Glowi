/**
 * The AI provider seam. The app talks to this interface only; whether the
 * intelligence is the deployed Claude edge functions (live) or the on-device
 * simulator (mock) is a runtime configuration detail. See docs/adr/0003.
 */
import type { Scan } from '../types';

export interface AnalyzeScanInput {
  scanId: string;
  /** Base64 image — used by the mock provider; live mode reads from storage. */
  imageBase64?: string;
}

export interface ChatInput {
  sessionId: string;
  message: string;
}

export interface ChatResult {
  message: string;
  productRefs: string[];
}

export interface ExtractResult {
  extracted: number;
  summaryUpdated: boolean;
}

export interface AIProvider {
  readonly mode: 'live' | 'mock';
  /** Runs analysis and persists the result onto the scan row. */
  analyzeScan(input: AnalyzeScanInput): Promise<Scan>;
  /** Sends a chat turn; both sides are persisted before resolution. */
  chat(input: ChatInput): Promise<ChatResult>;
  /** Consolidates session turns into long-term memories + a summary. */
  extractMemories(sessionId: string): Promise<ExtractResult>;
}
