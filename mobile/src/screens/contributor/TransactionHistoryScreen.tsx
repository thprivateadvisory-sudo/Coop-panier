import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '@/utils/theme';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';
import type { PointTransaction } from '@/types';
import { ScreenHeader } from './ScreenHeader';

const TYPE_LABELS: Record<string, { emoji: string; label: string }> = {
  earn_scan: { emoji: '🧾', label: 'Ticket scanné' },
  earn_purchase: { emoji: '🛒', label: 'Achat' },
  earn_bonus: { emoji: '🎁', label: 'Bonus' },
  spend_basket: { emoji: '🧺', label: 'Panier financé' },
  expire: { emoji: '⏳', label: 'Points expirés' },
};

type Props = { navigation: any };

export function TransactionHistoryScreen({ navigation }: Props) {
  const profileId = useAuthStore((s) => s.profile?.id);
  const [items, setItems] = useState<PointTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!profileId) return;
    try {
      const { data, error: err } = await supabase
        .from('point_transactions')
        .select('*')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (err) throw err;
      setItems((data ?? []) as PointTransaction[]);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profileId]);

  useEffect(() => { load(); }, [load]);

  function renderItem({ item }: { item: PointTransaction }) {
    const cfg = TYPE_LABELS[item.type] ?? { emoji: '•', label: 'Opération' };
    const positive = (item.amount ?? 0) >= 0;
    return (
      <View style={styles.row}>
        <Text style={styles.emoji}>{cfg.emoji}</Text>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle} numberOfLines={2}>{item.description || cfg.label}</Text>
          <Text style={styles.rowDate}>
            {item.created_at ? new Date(item.created_at).toLocaleDateString('fr-FR', {
              day: 'numeric', month: 'long', year: 'numeric',
            }) : ''}
          </Text>
        </View>
        <Text style={[styles.amount, { color: positive ? colors.vert : colors.error }]}>
          {positive ? '+' : ''}{item.amount ?? 0} pts
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.pad}>
        <ScreenHeader title="Historique" onBack={() => navigation.goBack()} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.vert} size="large" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(t) => t.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={colors.vert}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>{error ? '⚠️' : '📋'}</Text>
              <Text style={styles.emptyText}>
                {error
                  ? 'Impossible de charger l\'historique. Tirez vers le bas pour réessayer.'
                  : 'Aucune transaction pour le moment.\nScannez votre premier ticket pour gagner des points !'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.fond },
  pad: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.blanc,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.bordure,
    padding: spacing.md,
  },
  emoji: { fontSize: 24 },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.gris },
  rowDate: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.grisClair },
  amount: { fontFamily: 'Nunito_800ExtraBold', fontSize: 15 },
  empty: { alignItems: 'center', gap: spacing.md, marginTop: spacing.xxl, paddingHorizontal: spacing.lg },
  emptyEmoji: { fontSize: 44 },
  emptyText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.grisMoyen,
    textAlign: 'center',
    lineHeight: 21,
  },
});
