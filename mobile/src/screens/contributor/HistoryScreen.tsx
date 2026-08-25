import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '@/utils/theme';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';

type TxType = 'earn_scan' | 'earn_purchase' | 'earn_bonus' | 'spend_basket' | 'expire';

type Transaction = {
  id: string;
  type: TxType;
  amount: number;
  description: string;
  created_at: string;
};

const TX_CONFIG: Record<TxType, { emoji: string; label: string; color: string }> = {
  earn_scan:     { emoji: '📸', label: 'Ticket scanné',   color: colors.success },
  earn_purchase: { emoji: '🛒', label: 'Achat',           color: colors.success },
  earn_bonus:    { emoji: '⭐', label: 'Bonus',           color: colors.orange },
  spend_basket:  { emoji: '🧺', label: 'Panier financé',  color: colors.error },
  expire:        { emoji: '⌛', label: 'Expiration',      color: colors.grisMoyen },
};

export function HistoryScreen({ navigation }: { navigation: any }) {
  const profile = useAuthStore((s) => s.profile);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    const { data } = await supabase
      .from('point_transactions')
      .select('id, type, amount, description, created_at')
      .eq('profile_id', profile?.id)
      .order('created_at', { ascending: false })
      .limit(100);

    setTransactions((data ?? []) as Transaction[]);
    setLoading(false);
  }

  const totalEarned = transactions
    .filter((t) => t.type.startsWith('earn'))
    .reduce((sum, t) => sum + t.amount, 0);

  const totalSpent = transactions
    .filter((t) => t.type === 'spend_basket')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const totalScans = transactions.filter((t) => t.type === 'earn_scan').length;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.vert} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.pageTitle}>Historique</Text>

      {/* Summary chips */}
      <View style={styles.summary}>
        <View style={styles.chip}>
          <Text style={styles.chipValue}>{totalScans}</Text>
          <Text style={styles.chipLabel}>Tickets scannés</Text>
        </View>
        <View style={[styles.chip, styles.chipGreen]}>
          <Text style={[styles.chipValue, { color: colors.success }]}>+{totalEarned.toLocaleString('fr-FR')}</Text>
          <Text style={styles.chipLabel}>Pts gagnés</Text>
        </View>
        <View style={[styles.chip, styles.chipRed]}>
          <Text style={[styles.chipValue, { color: colors.error }]}>-{totalSpent.toLocaleString('fr-FR')}</Text>
          <Text style={styles.chipLabel}>Pts dépensés</Text>
        </View>
      </View>

      {/* Transaction list */}
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => {
          const cfg = TX_CONFIG[item.type] ?? { emoji: '💫', label: item.type, color: colors.grisMoyen };
          const isEarn = item.amount > 0;
          return (
            <View style={styles.txRow}>
              <View style={styles.txIconWrap}>
                <Text style={styles.txEmoji}>{cfg.emoji}</Text>
              </View>
              <View style={styles.txInfo}>
                <Text style={styles.txLabel}>{cfg.label}</Text>
                {item.description ? (
                  <Text style={styles.txDesc} numberOfLines={1}>{item.description}</Text>
                ) : null}
                <Text style={styles.txDate}>
                  {new Date(item.created_at).toLocaleDateString('fr-FR', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </Text>
              </View>
              <Text style={[styles.txAmount, { color: isEarn ? colors.success : colors.error }]}>
                {isEarn ? '+' : ''}{item.amount.toLocaleString('fr-FR')} pts
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitle}>Aucune transaction</Text>
            <Text style={styles.emptySub}>Scannez votre premier ticket pour gagner des points !</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation.navigate('ScanReceipt')}
            >
              <Text style={styles.emptyBtnText}>Scanner un ticket</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.fond },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  pageTitle: {
    fontFamily: 'Nunito-Black',
    fontSize: 28,
    color: colors.gris,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },

  summary: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  chip: {
    flex: 1,
    backgroundColor: colors.blanc,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.bordure,
    padding: spacing.sm,
    alignItems: 'center',
  },
  chipGreen: { borderColor: colors.success, backgroundColor: '#F0FBF5' },
  chipRed:   { borderColor: colors.error,   backgroundColor: '#FDF0F0' },
  chipValue: { fontFamily: 'Nunito-Black', fontSize: 16, color: colors.gris },
  chipLabel: { fontFamily: 'Inter-Regular', fontSize: 10, color: colors.grisMoyen, textAlign: 'center', marginTop: 2 },

  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  separator: { height: spacing.sm },

  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.blanc,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.bordure,
    padding: spacing.md,
  },
  txIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.fond,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txEmoji: { fontSize: 20 },
  txInfo: { flex: 1 },
  txLabel: { fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.gris },
  txDesc: { fontFamily: 'Inter-Regular', fontSize: 12, color: colors.grisMoyen, marginTop: 1 },
  txDate: { fontFamily: 'Inter-Regular', fontSize: 11, color: colors.grisClair, marginTop: 2 },
  txAmount: { fontFamily: 'Nunito-ExtraBold', fontSize: 14 },

  emptyWrap: { alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.md },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontFamily: 'Nunito-Black', fontSize: 20, color: colors.gris },
  emptySub: { fontFamily: 'Inter-Regular', fontSize: 14, color: colors.grisMoyen, textAlign: 'center' },
  emptyBtn: {
    backgroundColor: colors.vert,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.sm,
  },
  emptyBtnText: { fontFamily: 'Nunito-ExtraBold', fontSize: 15, color: colors.blanc },
});
