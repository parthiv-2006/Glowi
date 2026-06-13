import { Stack } from 'expo-router';

import { palette } from '@/theme';

export default function ScanLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: palette.bg },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="analyzing" options={{ gestureEnabled: false, animation: 'fade' }} />
    </Stack>
  );
}
