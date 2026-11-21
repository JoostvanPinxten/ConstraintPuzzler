// The session's notice (a hint that is not available, a contradiction, the result of Check)
// as a modal dialog.
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { formatUi } from '../logic/messages';
import type { PuzzleSession } from '../logic/session';
import { COLORS } from '../theme';
import { useSession } from '../useSession';
import { Button } from './Controls';

export function NoticeDialog({ session }: { session: PuzzleSession }) {
  useSession(session);
  const { t } = useTranslation();
  const notice = session.notice;
  if (notice === null) return null;
  return (
    <Modal transparent animationType="fade" onRequestClose={() => session.dismissNotice()}>
      <View style={styles.backdrop}>
        <View style={styles.dialog} accessibilityRole="alert" testID="notice">
          <Text style={styles.title}>{formatUi(notice.title)}</Text>
          <Text style={styles.text}>{formatUi(notice.text)}</Text>
          <View style={styles.buttons}>
            {notice.confirm !== undefined && (
              <Button
                label={formatUi(notice.confirm.label)}
                primary
                onPress={() => {
                  const action = notice.confirm?.action;
                  session.dismissNotice();
                  action?.();
                }}
                testID="notice-confirm"
              />
            )}
            <Button
              label={t('dialog.close')}
              onPress={() => session.dismissNotice()}
              testID="notice-close"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  dialog: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 20,
    maxWidth: 480,
    width: '100%',
    gap: 12,
  },
  title: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  text: { fontSize: 15, color: COLORS.text, lineHeight: 21 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
