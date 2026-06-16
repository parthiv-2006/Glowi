/**
 * The AI provider seam. The app talks to this interface only; whether the
 * intelligence is the deployed Claude edge functions (live) or the on-device
 * simulator (mock) is a runtime configuration detail. See docs/adr/0003.
 */
import type { ConflictReport, ProductIdentification, Scan, SkinForecast } from '../types';

export interface AnalyzeScanInput {
  scanId: string;
  /** Base64 image — used by the mock provider; live mode reads from storage. */
  imageBase64?: string;
}

export interface SkinForecastInput {
  /** Location to forecast for. Defaults to DEFAULT_LOCATION when omitted. */
  latitude?: number;
  longitude?: number;
  locationLabel?: string;
  /** Force regeneration even if today's forecast already exists. */
  refresh?: boolean;
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
  /**
   * Returns today's personalized environmental skin forecast, generating and
   * persisting it on first request of the day. Idempotent per day.
   */
  skinForecast(input?: SkinForecastInput): Promise<SkinForecast>;
  /**
   * Reads a product photo and returns structured details for adding it to the
   * Shelf — does not persist anything. The caller saves the confirmed item.
   */
  identifyProduct(input: IdentifyProductInput): Promise<ProductIdentification>;
  /**
   * Runs an ingredient conflict analysis across the user's active shelf.
   * Results are cached server-side until the shelf changes; this call is
   * idempotent and cheap to call repeatedly.
   */
  checkConflicts(): Promise<ConflictReport>;
}

export interface IdentifyProductInput {
  /** Base64-encoded product photo (no data: prefix). */
  imageBase64: string;
}
