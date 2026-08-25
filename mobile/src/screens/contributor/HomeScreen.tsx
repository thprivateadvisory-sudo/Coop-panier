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
import Svg, { Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '@/utils/theme';
import { useAuthStore } from '@/store/authStore';
import { useContributorProfile } from '@/hooks/useContributorProfile';
import { useImpactStats } from '@/hooks/useImpactStats';

const LEVELS = [
  { name: 'Graine',      emoji: '🌱', min: 0,     max: 999 },
  { name: 'Solidaire',   emoji: '🤝', min: 1000,  max: 4999 },
  { name: 'Bienfaiteur', emoji: '⭐', min: 5000,  max: 14999 },
  { name: 'Ambassadeur', emoji: '🏆', min: 15000, max: Infinity },
];

function getLevel(points: number) {
  return LEVELS.find((l) => points >= l.min && points <= l.max) ?? LEVELS[0];
}

function getLevelProgress(points: number) {
  const level = getLevel(points);
  if (level.max === Infinity) return 1;
  return Math.min((points - level.min) / (level.max - level.min + 1), 1);
}

function getNextLevel(points: number) {
  const idx = LEVELS.findIndex((l) => points >= l.min && points <= l.max);
  return idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
}

function ProgressRing({ progress, size = 128, strokeWidth = 10 }: { progress: number; size?: number; strokeWidth?: number }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const filled = circ * Math.min(Math.max(progress, 0), 1);

  return (
    <Svg width={size} height={size}>
      <Circle
        cx={size / 2} cy={size / 2} r={r}
        stroke="rgba(255,255,255,0.25)"
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Circle
        cx={size / 2} cy={size / 2} r={r}
        stroke={colors.orange}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${filled} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90, ${size / 2}, ${size / 2})`}
      />
    </Svg>
  );
}

type Props = { navigation: any };

export function ContributorHomeScreen({ navigation }: Props) {
  const profile = useAuthStore((s) => s.profile);
  const contributor = useContributorProfile(profile?.id ?? '');
  const { stats } = useImpactStats();

  const firstName = profile?.full_name?.split(' ')[0] ?? 'vous';
  const points = contributor?.points_total ?? 0;
  const available = contributor?.points_available ?? 0;
  const level = getLevel(points);
  const progress = getLevelProgress(points);
  const nextLevel = getNextLevel(points);

  const pointsToNextBasket = 500 - (available % 500);
  const basketProgress = available > 0 ? ((available % 500) / 500) * 100 : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Hero header */}
        <LinearGradient
          colors={['#2D5016', '#3d6b20']}
          style={styles.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.heroTop}>
            <View style={styles.heroGreeting}>
              <Text style={styles.helloText}>Bonjour, {firstName} 👋</Text>
              <View style={styles.levelBadge}>
                <Text style={styles.levelBadgeText}>{level.emoji} {level.name}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.avatarBtn}
              onPress={() => navigation.getParent()?.navigate('Profile')}
            >
              <Text style={styles.avatarText}>{firstName[0]?.toUpperCase()}</Text>
            </TouchableOpacity>
          </View>

          {/* Ring + points */}
          <View style={styles.ringRow}>
            <View style={styles.ringWrap}>
              <ProgressRing progress={progress} size={128} strokeWidth={10} />
              <View style={styles.ringCenter}>
                {contributor ? (
                  <>
                    <Text style={styles.ringPoints}>{available.toLocaleString('fr-FR')}</Text>
                    <Text style={styles.ringLabel}>pts dispo</Text>
                  </>
                ) : (
                  <ActivityIndicator color={colors.blanc} />
                )}
              </View>
            </View>

            <View style={styles.ringInfo}>
              <View style={styles.ringInfoRow}>
                <Text style={styles.ringInfoLabel}>Total cumulé</Text>
                <Text style={styles.ringInfoValue}>{points.toLocaleString('fr-FR')}</Text>
              </View>
              <View style={styles.ringInfoRow}>
                <Text style={styles.ringInfoLabel}>Tickets scannés</Text>
                <Text style={styles.ringInfoValue}>{contributor?.tickets_scanned ?? '—'}</Text>
              </View>
              <View style={styles.ringInfoRow}>
                <Text style={styles.ringInfoLabel}>Paniers financés</Text>
                <Text style={styles.ringInfoValue}>{contributor?.baskets_funded ?? '—'}</Text>
              </View>
              {nextLevel && (
                <Text style={styles.nextLevelHint}>
                  {(nextLevel.min - points).toLocaleString('fr-FR')} pts → {nextLevel.emoji} {nextLevel.name}
                </Text>
              )}
            </View>
          </View>

          {/* Basket progress bar */}
          <View style={styles.basketProgress}>
            <View style={styles.basketProgressBg}>
              <View style={[styles.basketProgressFill, { width: `${basketProgress}%` }]} />
            </View>
            <Text style={styles.basketProgressLabel}>
              Encore {pointsToNextBasket} pts pour financer 1 panier
            </Text>
          </View>
        </LinearGradient>

        {/* Scan CTA */}
        <TouchableOpacity
          style={styles.scanBtn}
          onPress={() => navigation.getParent()?.navigate('ScanReceipt')}
          activeOpacity={0.85}
        >
          <Text style={styles.scanEmoji}>📸</Text>
          <View style={styles.scanBody}>
            <Text style={styles.scanTitle}>Scanner un ticket</Text>
            <Text style={styles.scanSub}>Gagnez des points en quelques secondes</Text>
          </View>
          <Text style={styles.scanArrow}>›</Text>
        </TouchableOpacity>

        {/* Impact collectif */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Impact collectif en temps réel</Text>
          <View style={styles.impactGrid}>
            <ImpactTile emoji="🧺" value={stats?.baskets_distributed.toLocaleString('fr-FR') ?? '…'} label="Paniers distribués" />
            <ImpactTile emoji="🏘️" value={stats?.cities_covered.toLocaleString('fr-FR') ?? '…'} label="Villes couvertes" />
            <ImpactTile emoji="👥" value={stats?.total_contributors.toLocaleString('fr-FR') ?? '…'} label="Contributeurs" />
            <ImpactTile emoji="👨‍👩‍👧" value={stats?.families_helped.toLocaleString('fr-FR') ?? '…'} label="Familles aidées" />
          </View>
        </View>

        {/* Upgrade banner */}
        {contributor?.subscription_tier === 'free' && (
          <TouchableOpacity
            style={styles.upgradeCard}
            onPress={() => navigation.navigate('Subscriptions')}
            activeOpacity={0.85}
          >
            <Text style={styles.upgradeEmoji}>⚡</Text>
            <View style={styles.upgradeBody}>
              <Text style={styles.upgradeTitle}>Passez à l'Essentiel — 4,99€/mois</Text>
              <Text style={styles.upgradeSub}>2× plus de points sur chaque ticket + badge contributeur</Text>
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
  scroll: { gap: spacing.lg, paddingBottom: spacing.xxl },

  // Hero
  hero: {
    padding: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroGreeting: { gap: spacing.xs },
  helloText: { fontFamily: 'Nunito-Bold', fontSize: 18, color: 'rgba(255,255,255,0.9)' },
  levelBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  levelBadgeText: { fontFamily: 'Inter-SemiBold', fontSize: 12, color: colors.blanc },
  avatarBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: 'Nunito-ExtraBold', fontSize: 20, color: colors.blanc },

  ringRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  ringWrap: { position: 'relative', width: 128, height: 128 },
  ringCenter: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPoints: { fontFamily: 'Nunito-Black', fontSize: 26, color: colors.blanc, lineHeight: 30 },
  ringLabel: { fontFamily: 'Inter-Regular', fontSize: 11, color: 'rgba(255,255,255,0.7)' },

  ringInfo: { flex: 1, gap: spacing.sm },
  ringInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ringInfoLabel: { fontFamily: 'Inter-Regular', fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  ringInfoValue: { fontFamily: 'Nunito-ExtraBold', fontSize: 14, color: colors.blanc },
  nextLevelHint: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: colors.orange,
    marginTop: spacing.xs,
  },

  basketProgress: { gap: 6 },
  basketProgressBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  basketProgressFill: { height: '100%', backgroundColor: colors.orange, borderRadius: radius.full },
  basketProgressLabel: { fontFamily: 'Inter-Regular', fontSize: 11, color: 'rgba(255,255,255,0.8)' },

  // Scan
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.blanc,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.bordure,
    marginHorizontal: spacing.xl,
  },
  scanEmoji: { fontSize: 32 },
  scanBody: { flex: 1 },
  scanTitle: { fontFamily: 'Nunito-ExtraBold', fontSize: 16, color: colors.gris },
  scanSub: { fontFamily: 'Inter-Regular', fontSize: 13, color: colors.grisMoyen, marginTop: 2 },
  scanArrow: { fontSize: 24, color: colors.grisMoyen },

  // Impact
  section: { gap: spacing.md, paddingHorizontal: spacing.xl },
  sectionTitle: { fontFamily: 'Nunito-ExtraBold', fontSize: 16, color: colors.gris },
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
  impactValue: { fontFamily: 'Nunito-Black', fontSize: 20, color: colors.gris },
  impactLabel: { fontFamily: 'Inter-Regular', fontSize: 11, color: colors.grisMoyen, textAlign: 'center' },

  // Upgrade
  upgradeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.orangePale,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.orange,
    marginHorizontal: spacing.xl,
  },
  upgradeEmoji: { fontSize: 28 },
  upgradeBody: { flex: 1 },
  upgradeTitle: { fontFamily: 'Nunito-ExtraBold', fontSize: 14, color: colors.gris },
  upgradeSub: { fontFamily: 'Inter-Regular', fontSize: 12, color: colors.grisMoyen, marginTop: 2 },
  upgradeArrow: { fontSize: 22, color: colors.orange },
});
