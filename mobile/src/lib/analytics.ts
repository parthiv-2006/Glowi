/**
 * Product analytics — the seam, deliberately without a provider (E2).
 *
 * The owner's decision was to instrument now and choose a vendor later. That is
 * the expensive half done cheaply: re-instrumenting seven flows across a shipped
 * app is real work, while swapping a sink in is one function call. Until
 * `setAnalyticsSink` is given something, `track` is a no-op and the app sends
 * nothing anywhere — no dependency, no network, no bundle weight.
 *
 * **Events carry no properties, by type.** An `AnalyticsEvent` is a bare string
 * from a closed union, so there is no parameter through which a scan score, a chat
 * message, a sleep value or an email could ever reach a vendor — not by accident,
 * not by a future edit. Counts only. That is the whole privacy design, and it is
 * enforced by the compiler rather than by a code-review habit. If a future event
 * genuinely needs a dimension, add it as a *new event name*, not as a payload.
 */
import { useSettings } from '@/stores/settings';

export type AnalyticsEvent =
  | 'session_start'
  | 'scan_completed'
  | 'chat_message_sent'
  | 'checkin_logged'
  | 'report_opened'
  | 'replenishment_viewed'
  | 'upgrade_completed';

export interface AnalyticsSink {
  track(event: AnalyticsEvent): void;
  /** Opaque user id, or null on sign-out. Never an email — see lib/sentry.ts for the same rule. */
  identify(userId: string | null): void;
}

let sink: AnalyticsSink | null = null;

/**
 * Installs the provider. Called with a real sink the day a vendor is chosen
 * (PostHog is the standing recommendation); until then nothing calls this and the
 * seam stays inert. Exported for tests, which install a recording sink.
 */
export function setAnalyticsSink(next: AnalyticsSink | null) {
  sink = next;
}

/**
 * The single choke point. Opt-out is checked here rather than at the call sites,
 * so a screen can never forget it and a new event is private by default.
 */
export function track(event: AnalyticsEvent) {
  if (!useSettings.getState().analyticsEnabled) return;
  sink?.track(event);
}

export function identifyUser(userId: string | null) {
  if (!useSettings.getState().analyticsEnabled) return;
  sink?.identify(userId);
}
