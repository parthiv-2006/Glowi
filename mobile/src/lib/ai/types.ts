/**
 * The AI provider seam. The app talks to this interface only; whether the
 * intelligence is the deployed Claude edge functions (live) or the on-device
 * simulator (mock) is a runtime configuration detail. See docs/adr/0003.
 */
import type {
  AIDelta,
  ConflictReport,
  GlowReport,
  ProductComparison,
  ProductIdentification,
  Scan,
  SkinForecast,
} from '../types';

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

export interface GlowReportInput {
  /** Monday (ISO, yyyy-mm-dd) of the completed week to report on. */
  weekStart: string;
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
  /**
   * Compares two completed scans and returns an honest AI-generated change
   * summary. Results are cached in scan_comparisons — calling this twice for
   * the same pair hits the cache on the second call.
   */
  compareScans(input: CompareScanInput): Promise<AIDelta>;
  /**
   * In-store decision support: reads two product photos and returns a verdict
   * grounded in the user's latest scan, shelf, and reaction log. Stateless —
   * persists nothing.
   */
  compareProducts(input: CompareProductsInput): Promise<ProductComparison>;
  /**
   * Returns the Weekly Glow Report for a completed week, generating and caching
   * it on first request. Idempotent per user per week — the second call for the
   * same week hits the cache with no Claude call.
   */
  glowReport(input: GlowReportInput): Promise<GlowReport>;
}

export interface CompareProductsInput {
  /** Base64-encoded product photos (no data: prefix). */
  imageABase64: string;
  imageBBase64: string;
}

export interface IdentifyProductInput {
  /** Base64-encoded product photo (no data: prefix). */
  imageBase64: string;
}

export interface CompareScanInput {
  scanIdBefore: string;
  scanIdAfter: string;
}
