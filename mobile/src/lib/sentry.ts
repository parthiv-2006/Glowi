/**
 * Crash reporting (E1).
 *
 * Glowi is a health-adjacent app that handles face photos, sleep data, and cycle
 * phase. A crash reporter is a firehose pointed at a third party, so the defaults
 * are wrong for us by construction and every one of them is turned off below:
 * no screenshots (they would be *of the user's face*), no view hierarchy, no
 * request bodies, no email address. A user is a UUID here and nothing else.
 *
 * Reporting is off entirely until the owner supplies EXPO_PUBLIC_SENTRY_DSN — the
 * app must be perfectly usable without it, so nothing here may throw or block.
 */
import * as Sentry from '@sentry/react-native';

import { env } from './env';

export const sentryEnabled = !!env.sentryDsn;

export function initSentry() {
  Sentry.init({
    dsn: env.sentryDsn,
    // No DSN ⇒ inert. The error boundary still renders its fallback; it just has
    // nowhere to report to, which is the correct behaviour for a dev build.
    enabled: sentryEnabled,
    environment: __DEV__ ? 'development' : 'production',

    // --- Privacy. Do not relax any of these without re-reading docs/legal/privacy-policy.md. ---
    // `sendDefaultPii` would attach IP addresses and request headers.
    sendDefaultPii: false,
    // A screenshot of a crash on the scan or results screen is a photo of the
    // user's face. This must never be true.
    attachScreenshot: false,
    attachViewHierarchy: false,

    // Performance tracing at a sample rate that costs nothing on the free tier and
    // still surfaces a pathological screen. Session replay stays off (same reason
    // as screenshots).
    tracesSampleRate: 0.2,

    /**
     * Breadcrumbs are the other leak: `console.log` and network breadcrumbs would
     * carry scan payloads and chat text off-device. Keep navigation and lifecycle
     * (the useful part for reproducing a crash), drop anything that can hold user
     * content.
     */
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === 'console' || breadcrumb.category === 'xhr') return null;
      return breadcrumb;
    },
  });
}

/**
 * Ties events to a user so a crash report can be correlated with a support
 * request — by opaque id only. Never the email address: it is the one field that
 * turns an anonymous crash into personal data, and Sentry is not a place we have
 * told users their email would go.
 */
export function setSentryUser(userId: string | null) {
  if (!sentryEnabled) return;
  Sentry.setUser(userId ? { id: userId } : null);
}
