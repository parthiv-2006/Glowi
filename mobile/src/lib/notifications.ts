/** Local routine reminders via expo-notifications (no server push). */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function parseTime(hhmm: string): { hour: number; minute: number } {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  return { hour: Number.isFinite(h) ? h : 8, minute: Number.isFinite(m) ? m : 0 };
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

/** Replaces any existing routine reminders with the AM/PM schedule.
 *  Cancels only the routine identifiers so a weekly scan reminder is unaffected. */
export async function scheduleRoutineReminders(amTime: string, pmTime: string): Promise<void> {
  if (Platform.OS === 'web') return;
  // Cancel by identifier — cancelAllScheduledNotificationsAsync would wipe the
  // weekly scan reminder too, so we cancel only what we own here.
  await Notifications.cancelScheduledNotificationAsync('glowi-routine-am').catch(() => {});
  await Notifications.cancelScheduledNotificationAsync('glowi-routine-pm').catch(() => {});
  const am = parseTime(amTime);
  const pm = parseTime(pmTime);

  await Notifications.scheduleNotificationAsync({
    identifier: 'glowi-routine-am',
    content: { title: 'Good morning ☀️', body: 'Time for your AM skincare routine.' },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: am.hour,
      minute: am.minute,
    },
  });
  await Notifications.scheduleNotificationAsync({
    identifier: 'glowi-routine-pm',
    content: { title: 'Wind down 🌙', body: 'Your PM routine is waiting — keep the streak alive.' },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: pm.hour,
      minute: pm.minute,
    },
  });
}

export async function cancelRoutineReminders(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync('glowi-routine-am').catch(() => {});
  await Notifications.cancelScheduledNotificationAsync('glowi-routine-pm').catch(() => {});
}

/** Schedules a repeating weekly nudge to keep up the scan habit.
 *  Safe to call after every successful scan — idempotent via identifier. */
export async function scheduleWeeklyScanReminder(): Promise<void> {
  if (Platform.OS === 'web') return;
  const granted = await requestNotificationPermission();
  if (!granted) return;
  await Notifications.cancelScheduledNotificationAsync('glowi-weekly-scan').catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: 'glowi-weekly-scan',
    content: {
      title: 'Time for your weekly skin scan 📸',
      body: 'Track your progress — it only takes 30 seconds.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 7 * 24 * 60 * 60,
      repeats: true,
    },
  });
}

/**
 * Weekly Monday-morning nudge to open the fresh Glow Report. The deep link is
 * the parameterless marker `/report` — the response listener resolves it to the
 * most recent completed week at tap time, so a repeating schedule never links to
 * a stale week. Idempotent via its identifier; safe to call alongside the other
 * weekly reminders so permission is only requested once.
 */
export async function scheduleGlowReportReminder(): Promise<void> {
  if (Platform.OS === 'web') return;
  const granted = await requestNotificationPermission();
  if (!granted) return;
  await Notifications.cancelScheduledNotificationAsync('glowi-glow-report').catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: 'glowi-glow-report',
    content: {
      title: 'Your Glow Report is ready ✨',
      body: 'See what moved this week — and your focus for the next.',
      data: { url: '/report' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 2, // Monday (1 = Sunday), just after the AM-routine slot.
      hour: 9,
      minute: 0,
    },
  });
}
