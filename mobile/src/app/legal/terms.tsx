import { ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Markdown } from '@/components/Markdown';
import { PressableScale, Screen } from '@/components/ui';
import { TERMS_OF_SERVICE } from '@/lib/legal';
import { palette, spacing } from '@/theme';

export default function TermsOfService() {
  const router = useRouter();
  return (
    <Screen>
      <PressableScale onPress={() => router.back()} hitSlop={12} style={styles.back}>
        <Ionicons name="chevron-back" size={26} color={palette.text} />
      </PressableScale>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <Markdown source={TERMS_OF_SERVICE} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', marginBottom: spacing(2) },
  body: { paddingBottom: spacing(12) },
});
