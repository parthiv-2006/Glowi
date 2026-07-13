import { afterEach, describe, expect, it } from '@jest/globals';

import {
  identifyUser,
  setAnalyticsSink,
  track,
  type AnalyticsEvent,
  type AnalyticsSink,
} from '@/lib/analytics';
import { useSettings } from '@/stores/settings';

function recordingSink() {
  const events: AnalyticsEvent[] = [];
  const identified: (string | null)[] = [];
  const sink: AnalyticsSink = {
    track: (e) => events.push(e),
    identify: (id) => identified.push(id),
  };
  return { sink, events, identified };
}

describe('analytics seam', () => {
  afterEach(() => {
    setAnalyticsSink(null);
    useSettings.getState().setAnalyticsEnabled(true);
  });

  it('sends nothing when no provider is installed', () => {
    // The shipping state: instrumented, but no vendor chosen. Calling track() must
    // be a no-op rather than a crash — every screen calls it unconditionally.
    expect(() => track('scan_completed')).not.toThrow();
    expect(() => identifyUser('user-1')).not.toThrow();
  });

  it('forwards events to an installed sink', () => {
    const { sink, events } = recordingSink();
    setAnalyticsSink(sink);

    track('scan_completed');
    track('chat_message_sent');

    expect(events).toEqual(['scan_completed', 'chat_message_sent']);
  });

  it('sends nothing at all once the user opts out', () => {
    // The whole privacy promise of the Profile toggle. Opt-out is enforced at the
    // single choke point in track()/identifyUser(), so this must hold for *every*
    // event — including any added after this test was written.
    const { sink, events, identified } = recordingSink();
    setAnalyticsSink(sink);
    useSettings.getState().setAnalyticsEnabled(false);

    track('scan_completed');
    track('checkin_logged');
    identifyUser('user-1');

    expect(events).toEqual([]);
    expect(identified).toEqual([]);
  });

  it('identifies a user by opaque id, and clears it on sign-out', () => {
    const { sink, identified } = recordingSink();
    setAnalyticsSink(sink);

    identifyUser('e6b1c0de-0000-4000-8000-000000000000');
    identifyUser(null);

    // An id, never an email — the type permits nothing else.
    expect(identified).toEqual(['e6b1c0de-0000-4000-8000-000000000000', null]);
  });
});
