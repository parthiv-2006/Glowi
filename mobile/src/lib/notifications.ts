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

/** Replaces any existing Glowi reminders with the AM/PM schedule. */
export async function scheduleRoutineReminders(amTime: string, pmTime: string): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  const am = parseTime(amTime);
  const pm = parseTime(pmTime);

  await Notifications.scheduleNotificationAsync({
    content: { title: 'Good morning ☀️', body: 'Time for your AM skincare routine.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: am.hour, minute: am.minute },
  });
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Wind down 🌙', body: 'Your PM routine is waiting — keep the streak alive.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: pm.hour, minute: pm.minute },
  });
}

export async function cancelRoutineReminders(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}
