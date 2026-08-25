import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '@/utils/theme';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';

type Stats = {
  baskets_distributed: number;
  baskets_pending: number;
  beneficiaries_active: number;
  next_distribution_date?: string;
};

type RecentDistribution = {
  id: string;
  beneficiary_name: string;
  distributed_at: string;
};

type Props = { navigation: any };

export function AssociationHomeScreen({ navigation }: Props) {
  const profile = useAuthStore((s) => s.profile);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentDistribution[]>([]);
  const [pickupName, setPickupName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    loadData();

    // Temps réel : mise à jour quand un panier est distribué
    const channel = supabase
      .channel(`asso_${profile.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'baskets' }, () => {
        loadData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.id]);

  async function loadData() {
    // Récupérer le point de retrait de l'association
    const { data: pickup } = await supabase
      .from('pickup_points')
      .select('id, name')
      .eq('association_profile_id', profile!.id)
      .eq('active', true)
      .single();

    if (!pickup) { setLoading(false); return; }
    setPickupName(pickup.name);

    // Paniers assignés à ce point de retrait
    const { data: baskets } = await supabase
      .from('baskets')
      .select('id, status, distributed_at, beneficiary_profile_id')
      .eq('pickup_point_id', pickup.id);

    const distributed = baskets?.filter((b) => b.status === 'distributed') ?? [];
    const pending     = baskets?.filter((b) => b.status === 'assigned') ?? [];

    // Bénéficiaires actifs sur ce point
    const { count: activeCount } = await supabase
      .from('beneficiary_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('pickup_point_id', pickup.id)
      .eq('status', 'active');

    setStats({
      baskets_distributed: distributed.length,
      baskets_pending: pending.length,
      beneficiaries_active: activeCount ?? 0,
    });

    // Dernières distributions
    const recentBaskets = distributed
      .filter((b) => b.distributed_at)
      .sort((a, b) => new Date(b.distributed_at!).getTime() - new Date(a.distributed_at!).getTime())
      .slice(0, 5);

    setRecent(recentBaskets.map((b) => ({
      id: b.id,
      beneficiary_name: 'Bénéficiaire',
      distributed_at: b.distributed_at!,
    })));

    setLoading(false);
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
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Bonjour 👋</Text>
            <Text style={styles.pickupName}>{pickupName || 'Votre point de retrait'}</Text>
          </View>
          <TouchableOpacity style={styles.settingsBtn} onPress={() => navigation.navigate('AssociationSettings')}>
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Action principale */}
        <TouchableOpacity
          style={styles.scanCard}
          onPress={() => navigation.navigate('ScanBeneficiary')}
          activeOpacity={0.85}
        >
          <Text style={styles.scanEmoji}>📷</Text>
          <View style={styles.scanBody}>
            <Text style={styles.scanTitle}>Valider une remise</Text>
            <Text style={styles.scanSub}>Scannez le QR Code du bénéficiaire</Text>
          </View>
          <View style={styles.scanBadge}>
            <Text style={styles.scanBadgeText}>{stats?.baskets_pending ?? 0} en attente</Text>
          </View>
        </TouchableOpacity>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <StatCard
            emoji="🧺"
            value={stats?.baskets_distributed ?? 0}
            label="Paniers distribués"
            color={colors.vert}
          />
          <StatCard
            emoji="⏳"
            value={stats?.baskets_pending ?? 0}
            label="À distribuer"
            color={colors.orange}
          />
          <StatCard
            emoji="👥"
            value={stats?.beneficiaries_active ?? 0}
            label="Bénéficiaires actifs"
            color={colors.vert}
          />
          <StatCard
            emoji="📅"
            value="—"
            label="Prochain retrait"
            color={colors.grisMoyen}
          />
        </View>

        {/* Bénéficiaires */}
        <TouchableOpacity
          style={styles.menuRow}
          onPress={() => navigation.navigate('BeneficiaryList')}
          activeOpacity={0.85}
        >
          <Text style={styles.menuEmoji}>👥</Text>
          <Text style={styles.menuLabel}>Liste des bénéficiaires</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuRow}
          onPress={() => navigation.navigate('DistributionHistory')}
          activeOpacity={0.85}
        >
          <Text style={styles.menuEmoji}>📋</Text>
          <Text style={styles.menuLabel}>Historique des distributions</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

        {/* Dernières distributions */}
        {recent.length > 0 && (
          <View style={styles.recentSection}>
            <Text style={styles.sectionTitle}>Dernières distributions</Text>
            {recent.map((item) => (
              <View key={item.id} style={styles.recentRow}>
                <View style={styles.recentDot} />
                <Text style={styles.recentName}>{item.beneficiary_name}</Text>
                <Text style={styles.recentDate}>
                  {new Date(item.distributed_at).toLocaleDateString('fr-FR')}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ emoji, value, label, color }: { emoji: string; value: number | string; label: string; color: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={[styles.statValue, { color }]}>
        {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.fond },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxl },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greeting: { fontFamily: 'Inter-Regular', fontSize: 14, color: colors.grisMoyen },
  pickupName: { fontFamily: 'Nunito-Black', fontSize: 22, color: colors.gris, marginTop: 2 },
  settingsBtn: { padding: spacing.xs },
  settingsIcon: { fontSize: 24 },

  scanCard: {
    backgroundColor: colors.vert,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  scanEmoji: { fontSize: 36 },
  scanBody: { flex: 1 },
  scanTitle: { fontFamily: 'Nunito-ExtraBold', fontSize: 18, color: colors.blanc },
  scanSub: { fontFamily: 'Inter-Regular', fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  scanBadge: {
    backgroundColor: colors.orange,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  scanBadgeText: { fontFamily: 'Nunito-ExtraBold', fontSize: 12, color: colors.blanc },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.blanc,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.bordure,
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  statEmoji: { fontSize: 24 },
  statValue: { fontFamily: 'Nunito-Black', fontSize: 22 },
  statLabel: { fontFamily: 'Inter-Regular', fontSize: 11, color: colors.grisMoyen, textAlign: 'center' },

  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.blanc,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.bordure,
    padding: spacing.md,
  },
  menuEmoji: { fontSize: 22 },
  menuLabel: { flex: 1, fontFamily: 'Inter-Regular', fontSize: 14, color: colors.gris },
  menuArrow: { fontSize: 20, color: colors.grisClair },

  recentSection: { gap: spacing.sm },
  sectionTitle: { fontFamily: 'Nunito-ExtraBold', fontSize: 15, color: colors.gris },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.blanc,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.bordure,
    padding: spacing.md,
  },
  recentDot: { width: 8, height: 8, borderRadius: radius.full, backgroundColor: colors.success },
  recentName: { flex: 1, fontFamily: 'Inter-Regular', fontSize: 14, color: colors.gris },
  recentDate: { fontFamily: 'Inter-Regular', fontSize: 12, color: colors.grisMoyen },
});
