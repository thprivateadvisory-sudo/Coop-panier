import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  AppState,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '@/utils/theme';
import { ScreenHeader } from './ScreenHeader';

type Props = { navigation: any };
type Status = 'loading' | 'granted' | 'denied' | 'undetermined';

export function NotificationsScreen({ navigation }: Props) {
  const [status, setStatus] = useState<Status>('loading');

  const refresh = useCallback(async () => {
    try {
      const { status: s } = await Notifications.getPermissionsAsync();
      setStatus(s as Status);
    } catch {
      setStatus('undetermined');
    }
  }, []);

  useEffect(() => {
    refresh();
    // Re-vérifier au retour des réglages du téléphone
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') refresh(); });
    return () => sub.remove();
  }, [refresh]);

  async function handleEnable() {
    if (status === 'denied') {
      Linking.openSettings();
      return;
    }
    try {
      const { status: s } = await Notifications.requestPermissionsAsync();
      setStatus(s as Status);
    } catch {
      Linking.openSettings();
    }
  }

  const enabled = status === 'granted';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader title="Notifications" onBack={() => navigation.goBack()} />

        <View style={styles.card}>
          <Text style={styles.emoji}>{enabled ? '🔔' : '🔕'}</Text>
          <Text style={styles.statusTitle}>
            {status === 'loading' ? '…' : enabled ? 'Notifications activées' : 'Notifications désactivées'}
          </Text>
          <Text style={styles.statusText}>
            {enabled
              ? 'Vous serez prévenu(e) des nouveautés importantes de Coop\'Panier.'
              : 'Activez les notifications pour être prévenu(e) de votre impact et des nouveautés.'}
          </Text>

          {status !== 'loading' && (
            <TouchableOpacity
              style={[styles.btn, enabled && styles.btnSecondary]}
              onPress={enabled ? () => Linking.openSettings() : handleEnable}
              activeOpacity={0.85}
            >
              <Text style={[styles.btnText, enabled && styles.btnTextSecondary]}>
                {enabled ? 'Gérer dans les réglages' : status === 'denied' ? 'Ouvrir les réglages' : 'Activer les notifications'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.listCard}>
          <Text style={styles.listTitle}>Vous pourrez recevoir</Text>
          <Text style={styles.listItem}>🧾  La confirmation de vos tickets validés</Text>
          <Text style={styles.listItem}>🧺  Une alerte quand vous financez un panier</Text>
          <Text style={styles.listItem}>📊  Votre résumé d'impact mensuel</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.fond },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  card: {
    backgroundColor: colors.blanc,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.bordure,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emoji: { fontSize: 44 },
  statusTitle: { fontFamily: 'Nunito_800ExtraBold', fontSize: 18, color: colors.gris },
  statusText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.grisMoyen,
    textAlign: 'center',
    lineHeight: 20,
  },
  btn: {
    marginTop: spacing.sm,
    alignSelf: 'stretch',
    backgroundColor: colors.vert,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnSecondary: { backgroundColor: colors.blanc, borderWidth: 1.5, borderColor: colors.bordure },
  btnText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 15, color: colors.blanc },
  btnTextSecondary: { color: colors.gris },
  listCard: {
    backgroundColor: colors.blanc,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.bordure,
    padding: spacing.md,
    gap: spacing.sm,
  },
  listTitle: { fontFamily: 'Nunito_800ExtraBold', fontSize: 15, color: colors.gris, marginBottom: 4 },
  listItem: { fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.grisMoyen, lineHeight: 20 },
});
