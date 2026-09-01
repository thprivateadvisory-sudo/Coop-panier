import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '@/utils/theme';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';

type Beneficiary = {
  profile_id: string;
  full_name: string;
  status: 'waitlist' | 'active' | 'suspended';
  baskets_received: number;
  next_pickup_date?: string;
};

type Props = { navigation: any };

const STATUS_CONFIG = {
  active:    { label: 'Actif',        color: colors.success,    bg: '#EAF9F1' },
  waitlist:  { label: 'Liste attente', color: colors.warning,   bg: '#FEF9EC' },
  suspended: { label: 'Suspendu',     color: colors.error,      bg: '#FDECEC' },
};

export function BeneficiaryListScreen({ navigation }: Props) {
  const profile = useAuthStore((s) => s.profile);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [filtered, setFiltered] = useState<Beneficiary[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBeneficiaries();
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      q ? beneficiaries.filter((b) => b.full_name.toLowerCase().includes(q)) : beneficiaries
    );
  }, [search, beneficiaries]);

  async function loadBeneficiaries() {
    const { data: pickup } = await supabase
      .from('pickup_points')
      .select('id')
      .eq('association_profile_id', profile!.id)
      .eq('active', true)
      .single();

    if (!pickup) { setLoading(false); return; }

    const { data } = await supabase
      .from('beneficiary_profiles')
      .select('profile_id, status, baskets_received, next_pickup_date, profiles(full_name)')
      .eq('pickup_point_id', pickup.id)
      .order('status');

    const list = (data ?? []).map((b: any) => ({
      profile_id: b.profile_id,
      full_name: b.profiles?.full_name ?? '—',
      status: b.status,
      baskets_received: b.baskets_received,
      next_pickup_date: b.next_pickup_date,
    }));

    setBeneficiaries(list);
    setFiltered(list);
    setLoading(false);
  }

  async function toggleStatus(item: Beneficiary) {
    const newStatus = item.status === 'active' ? 'suspended' : 'active';
    await supabase
      .from('beneficiary_profiles')
      .update({ status: newStatus })
      .eq('profile_id', item.profile_id);

    setBeneficiaries((prev) =>
      prev.map((b) => b.profile_id === item.profile_id ? { ...b, status: newStatus } : b)
    );
  }

  function renderItem({ item }: { item: Beneficiary }) {
    const cfg = STATUS_CONFIG[item.status];
    return (
      <View style={styles.card}>
        <View style={styles.cardLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.full_name[0]?.toUpperCase()}</Text>
          </View>
          <View style={styles.info}>
            <Text style={styles.name}>{item.full_name}</Text>
            <Text style={styles.sub}>{item.baskets_received} panier{item.baskets_received !== 1 ? 's' : ''} reçu{item.baskets_received !== 1 ? 's' : ''}</Text>
            {item.next_pickup_date && (
              <Text style={styles.nextDate}>
                Prochain : {new Date(item.next_pickup_date).toLocaleDateString('fr-FR')}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.cardRight}>
          <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          <TouchableOpacity
            style={styles.toggleBtn}
            onPress={() => toggleStatus(item)}
          >
            <Text style={styles.toggleText}>
              {item.status === 'active' ? 'Suspendre' : 'Activer'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.vert} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Bénéficiaires ({beneficiaries.length})</Text>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          placeholder="Rechercher par nom…"
          placeholderTextColor={colors.grisClair}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Résumé */}
      <View style={styles.summary}>
        {(['active', 'waitlist', 'suspended'] as const).map((s) => {
          const count = beneficiaries.filter((b) => b.status === s).length;
          const cfg = STATUS_CONFIG[s];
          return (
            <View key={s} style={[styles.summaryChip, { backgroundColor: cfg.bg }]}>
              <Text style={[styles.summaryCount, { color: cfg.color }]}>{count}</Text>
              <Text style={[styles.summaryLabel, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          );
        })}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.profile_id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <Text style={styles.empty}>Aucun bénéficiaire trouvé.</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.fond },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    paddingBottom: spacing.sm,
  },
  back: { fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.vert },
  title: { fontFamily: 'Nunito_800ExtraBold', fontSize: 18, color: colors.gris },

  searchWrap: { paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  search: {
    borderWidth: 1.5,
    borderColor: colors.bordure,
    borderRadius: radius.md,
    padding: spacing.md,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.gris,
    backgroundColor: colors.blanc,
  },

  summary: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  summaryChip: { flex: 1, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' },
  summaryCount: { fontFamily: 'Nunito_900Black', fontSize: 18 },
  summaryLabel: { fontFamily: 'Inter_400Regular', fontSize: 10, textAlign: 'center' },

  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  separator: { height: spacing.sm },

  card: {
    backgroundColor: colors.blanc,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.bordure,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.vertPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 16, color: colors.vert },
  info: { flex: 1 },
  name: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: colors.gris },
  sub: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.grisMoyen, marginTop: 2 },
  nextDate: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.grisClair, marginTop: 1 },

  cardRight: { alignItems: 'flex-end', gap: spacing.xs },
  statusBadge: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  toggleBtn: { paddingVertical: 3 },
  toggleText: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.grisMoyen, textDecorationLine: 'underline' },

  empty: { fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.grisMoyen, textAlign: 'center', paddingTop: spacing.xxl },
});
