/**
 * Device health integration — reads last night's sleep from HealthKit (iOS)
 * or Health Connect (Android) to power the diary's suggest-and-confirm
 * auto-fill (ADR-0017). Read-only, opt-in (Profile → "Auto-fill sleep from
 * Health"), and defensive by design: the native modules are imported lazily
 * and every failure path returns null, so Expo Go, the web, denied
 * permissions, and devices without health data all degrade to the plain
 * manual check-in.
 */
import { Platform } from 'react-native';

/** How far back to look for last night's sleep. */
const LOOKBACK_MS = 24 * 60 * 60 * 1000;

/** Apple sleep-analysis category values that count as actually asleep. */
const HK_ASLEEP_VALUES = new Set([
  1, // asleepUnspecified
  3, // asleepCore
  4, // asleepDeep
  5, // asleepREM
]);

/**
 * Hours asleep over the last 24h, or null when unavailable for any reason.
 * Requests read permission on first use (the OS sheet appears once).
 */
export async function getLastNightSleepHours(): Promise<number | null> {
  try {
    if (Platform.OS === 'ios') return await healthKitSleepHours();
    if (Platform.OS === 'android') return await healthConnectSleepHours();
    return null;
  } catch {
    // Missing native module (Expo Go), denied permission, or no data.
    return null;
  }
}

async function healthKitSleepHours(): Promise<number | null> {
  const { isHealthDataAvailable, requestAuthorization, queryCategorySamples } =
    await import('@kingstinct/react-native-healthkit');
  if (!(await isHealthDataAvailable())) return null;
  await requestAuthorization({ toRead: ['HKCategoryTypeIdentifierSleepAnalysis'] });

  const since = Date.now() - LOOKBACK_MS;
  const samples = await queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
    limit: 200,
    ascending: false,
  });
  let ms = 0;
  for (const s of samples) {
    const start = new Date(s.startDate).getTime();
    const end = new Date(s.endDate).getTime();
    if (end <= since || !HK_ASLEEP_VALUES.has(Number(s.value))) continue;
    ms += end - Math.max(start, since);
  }
  return ms > 0 ? ms / 3_600_000 : null;
}

async function healthConnectSleepHours(): Promise<number | null> {
  const { initialize, requestPermission, readRecords } =
    await import('react-native-health-connect');
  if (!(await initialize())) return null;
  await requestPermission([{ accessType: 'read', recordType: 'SleepSession' }]);

  const end = new Date();
  const start = new Date(end.getTime() - LOOKBACK_MS);
  const { records } = await readRecords('SleepSession', {
    timeRangeFilter: {
      operator: 'between',
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    },
  });
  let ms = 0;
  for (const r of records) {
    ms += new Date(r.endTime).getTime() - new Date(r.startTime).getTime();
  }
  return ms > 0 ? ms / 3_600_000 : null;
}
