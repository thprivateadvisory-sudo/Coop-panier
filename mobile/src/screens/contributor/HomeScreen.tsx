import React from 'react';
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
import { useAuthStore } from '@/store/authStore';
import { useContributorProfile } from '@/hooks/useContributorProfile';
import { useImpactStats } from '@/hooks/useImpactStats';

type Props = { navigation: any };

export function ContributorHomeScreen({ navigation }: Props) {
  const profile = useAuthStore((s) => s.profile);
  const contributor = useContributorProfile(profile?.id ?? '');
  const { stats } = useImpactStats();

  const pointsToNextBasket = contributor
    ? 500 - (contributor.points_available % 500)
    : 500;
  const progressPct = contributor
    ? ((contributor.points_available % 500) / 500) * 100
    : 0;

  const firstName = profile?.full_name?.split(' ')[0] ?? 'vous';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Bonjour, {firstName} 👋</Text>
            <Text style={styles.subGreeting}>Votre impact aujourd'hui</Text>
          </View>
          <TouchableOpacity
            style={styles.avatar}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.avatarText}>{firstName[0]?.toUpperCase()}</Text>
          </TouchableOpacity>
        </View>

        {/* Points Card */}
        <View style={styles.pointsCard}>
          <View style={styles.pointsRow}>
            <View>
              <Text style={styles.pointsLabel}>Points disponibles</Text>
              {contributor ? (
                <Text style={styles.pointsValue}>
                  {contributor.points_available.toLocaleString('fr-FR')}
                </Text>
              ) : (
                <ActivityIndicator color={colors.blanc} />
              )}
            </View>
            <View style={styles.badgeTotal}>
              <Text style={styles.badgeTotalLabel}>Total cumulé</Text>
              <Text style={styles.badgeTotalValue}>
                {contributor?.points_total.toLocaleString('fr-FR') ?? '—'}
              </Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.progressWrap}>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
            </View>
            <Text style={styles.progressLabel}>
              Plus que {pointsToNextBasket} pts pour financer 1 panier
            </Text>
          </View>
        </View>

        {/* Scan CTA */}
        <TouchableOpacity
          style={styles.scanBtn}
          onPress={() => navigation.navigate('ScanReceipt')}
          activeOpacity={0.85}
        >
          <Text style={styles.scanEmoji}>📸</Text>
          <View>
            <Text style={styles.scanTitle}>Scanner un ticket</Text>
            <Text style={styles.scanSub}>Gagnez des points en quelques secondes</Text>
          </View>
          <Text style={styles.scanArrow}>›</Text>
        </TouchableOpacity>

        {/* Stats rapides */}
        <View style={styles.quickStats}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{contributor?.tickets_scanned ?? '—'}</Text>
            <Text style={styles.statLabel}>Tickets{'\n'}scannés</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{contributor?.baskets_funded ?? '—'}</Text>
            <Text style={styles.statLabel}>Paniers{'\n'}financés</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: colors.orange }]}>
              {stats?.families_helped.toLocaleString('fr-FR') ?? '—'}
            </Text>
            <Text style={styles.statLabel}>Familles{'\n'}aidées</Text>
          </View>
        </View>

        {/* Impact global */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Impact collectif en temps réel</Text>
          <View style={styles.impactGrid}>
            <ImpactTile
              emoji="🧺"
              value={stats?.baskets_distributed.toLocaleString('fr-FR') ?? '…'}
              label="Paniers distribués"
            />
            <ImpactTile
              emoji="🏘️"
              value={stats?.cities_covered.toLocaleString('fr-FR') ?? '…'}
              label="Villes couvertes"
            />
            <ImpactTile
              emoji="👥"
              value={stats?.total_contributors.toLocaleString('fr-FR') ?? '…'}
              label="Contributeurs"
            />
            <ImpactTile
              emoji="🌱"
              value={`${((stats?.total_points_issued ?? 0) / 1000).toFixed(1)}k`}
              label="Points émis"
            />
          </View>
        </View>

        {/* Abonnement */}
        {contributor?.subscription_tier === 'free' && (
          <TouchableOpacity
            style={styles.upgradeCard}
            onPress={() => navigation.navigate('Subscriptions')}
            activeOpacity={0.85}
          >
            <Text style={styles.upgradeEmoji}>⚡</Text>
            <View style={styles.upgradeBody}>
              <Text style={styles.upgradeTitle}>Passez à l'Essentiel — 4,99€/mois</Text>
              <Text style={styles.upgradeSub}>
                2× plus de points sur chaque ticket + badge contributeur
              </Text>
            </View>
            <Text style={styles.upgradeArrow}>›</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ImpactTile({ emoji, value, label }: { emoji: string; value: string; label: string }) {
  return (
    <View style={styles.impactTile}>
      <Text style={styles.impactEmoji}>{emoji}</Text>
      <Text style={styles.impactValue}>{value}</Text>
      <Text style={styles.impactLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.fond },
  scroll: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxl },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { fontFamily: 'Nunito_900Black', fontSize: 24, color: colors.gris },
  subGreeting: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.grisMoyen, marginTop: 2 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: colors.vert,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 18, color: colors.blanc },

  pointsCard: {
    backgroundColor: colors.vert,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  pointsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  pointsLabel: { fontFamily: 'Inter_400Regular', fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  pointsValue: {
    fontFamily: 'Nunito_900Black',
    fontSize: 48,
    color: colors.blanc,
    lineHeight: 52,
  },
  badgeTotal: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'flex-end',
  },
  badgeTotalLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  badgeTotalValue: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 20,
    color: colors.blanc,
  },
  progressWrap: { gap: spacing.sm },
  progressBg: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.orange, borderRadius: radius.full },
  progressLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.8)' },

  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.blanc,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.bordure,
  },
  scanEmoji: { fontSize: 32 },
  scanTitle: { fontFamily: 'Nunito_800ExtraBold', fontSize: 16, color: colors.gris },
  scanSub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.grisMoyen, marginTop: 2 },
  scanArrow: { marginLeft: 'auto', fontSize: 24, color: colors.grisMoyen },

  quickStats: {
    flexDirection: 'row',
    backgroundColor: colors.blanc,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.bordure,
    overflow: 'hidden',
  },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  statDivider: { width: 1, backgroundColor: colors.bordure },
  statNum: {
    fontFamily: 'Nunito_900Black',
    fontSize: 22,
    color: colors.vert,
  },
  statLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: colors.grisMoyen,
    textAlign: 'center',
    marginTop: 2,
    lineHeight: 14,
  },

  section: { gap: spacing.md },
  sectionTitle: { fontFamily: 'Nunito_800ExtraBold', fontSize: 16, color: colors.gris },
  impactGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  impactTile: {
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
  impactEmoji: { fontSize: 24 },
  impactValue: {
    fontFamily: 'Nunito_900Black',
    fontSize: 20,
    color: colors.gris,
  },
  impactLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: colors.grisMoyen,
    textAlign: 'center',
  },

  upgradeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.orangePale,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.orange,
  },
  upgradeEmoji: { fontSize: 28 },
  upgradeBody: { flex: 1 },
  upgradeTitle: { fontFamily: 'Nunito_800ExtraBold', fontSize: 14, color: colors.gris },
  upgradeSub: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.grisMoyen, marginTop: 2 },
  upgradeArrow: { fontSize: 22, color: colors.orange },
});
