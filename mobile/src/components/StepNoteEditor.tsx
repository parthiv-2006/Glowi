/**
 * Inline "note" affordance for one routine step — view a saved note, tap to
 * edit, or tap the "Add a note" prompt when there isn't one yet. Saves
 * independently of the routine's own generate/edit flow — see
 * lib/api.ts's updateRoutineStepNote.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText, PressableScale, TextField } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { palette, spacing } from '@/theme';

interface StepNoteEditorProps {
  note: string | null | undefined;
  onSave: (note: string | null) => void;
  saving?: boolean;
}

export function StepNoteEditor({ note, onSave, saving }: StepNoteEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note ?? '');

  function startEditing() {
    haptics.tap();
    setDraft(note ?? '');
    setEditing(true);
  }

  function save() {
    haptics.press();
    const trimmed = draft.trim();
    onSave(trimmed.length ? trimmed : null);
    setEditing(false);
  }

  if (editing) {
    return (
      <View style={styles.editRow}>
        <TextField
          value={draft}
          onChangeText={setDraft}
          placeholder="e.g. skip this when traveling"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={save}
          accessibilityLabel="Step note"
        />
        <View style={styles.editActions}>
          <PressableScale onPress={() => setEditing(false)} haptic={false} style={styles.editBtn}>
            <AppText variant="caption" color={palette.textTertiary}>
              Cancel
            </AppText>
          </PressableScale>
          <PressableScale
            onPress={save}
            haptic={false}
            style={styles.editBtn}
            accessibilityLabel="Save note"
          >
            <AppText variant="caption" color={palette.accentBright}>
              {saving ? 'Saving…' : 'Save'}
            </AppText>
          </PressableScale>
        </View>
      </View>
    );
  }

  if (note) {
    return (
      <PressableScale
        onPress={startEditing}
        haptic={false}
        style={styles.noteRow}
        accessibilityLabel="Edit note"
      >
        <Ionicons name="create-outline" size={13} color={palette.textTertiary} />
        <AppText
          variant="caption"
          color={palette.textSecondary}
          style={styles.noteText}
          numberOfLines={2}
        >
          {note}
        </AppText>
      </PressableScale>
    );
  }

  return (
    <PressableScale
      onPress={startEditing}
      haptic={false}
      style={styles.noteRow}
      accessibilityLabel="Add a note"
    >
      <Ionicons name="add-circle-outline" size={13} color={palette.textTertiary} />
      <AppText variant="caption" color={palette.textTertiary}>
        Add a note
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    marginTop: spacing(1.5),
  },
  noteText: { flex: 1 },
  editRow: { marginTop: spacing(2), gap: spacing(2) },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing(4) },
  editBtn: { paddingVertical: spacing(1) },
});
