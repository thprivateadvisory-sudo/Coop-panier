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
import { useContributorProfile } from '@/hooks/useContributorProfile';

type Challenge = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  target: number;
  bonus: number;
  type: 'scan_count' | 'max_amount';
  progress: number;
  completed: boolean;
};

type LeaderEntry = {
  profile_id: string;
  full_name: string;
  baskets_funded: number;
  subscription_tier: string;
};

type ImpactStats = {
  baskets_distributed: number;
  families_helped: number;
  cities_covered: number;
  total_contributors: number;
};

// Two challenges rotate each ISO week from a pool of 5
const CHALLENGE_POOL = [
  { id: 'c1', title: '5 tickets cette semaine',   emoji: '🎯', description: 'Scannez 5 tickets de caisse cette semaine',           target: 5,  bonus: 100, type: 'scan_count' as const },
  { id: 'c2', title: 'Ticket à 30€',               emoji: '💶', description: 'Scannez un ticket d\'au moins 30€',                   target: 30, bonus: 150, type: 'max_amount' as const },
  { id: 'c3', title: '10 tickets cette semaine',  emoji: '🔥', description: 'Scannez 10 tickets de caisse cette semaine',          target: 10, bonus: 250, type: 'scan_count' as const },
  { id: 'c4', title: 'Ticket à 50€',               emoji: '💰', description: 'Scannez un ticket d\'au moins 50€',                   target: 50, bonus: 300, type: 'max_amount' as const },
  { id: 'c5', title: '3 jours consécutifs',        emoji: '📅', description: 'Scannez un ticket par jour pendant 3 jours',         target: 3,  bonus: 200, type: 'scan_count' as const },
];

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getWeeklyChallenges(): typeof CHALLENGE_POOL {
  const week = getISOWeek(new Date());
  const i = week % CHALLENGE_POOL.length;
  const j = (week + 1) % CHALLENGE_POOL.length;
  return [CHALLENGE_POOL[i], CHALLENGE_POOL[j]];
}

export function CommunautyScreen() {
  const profile = useAuthStore((s) => s.profile);
  const contributor = useContributorProfile(profile?.id ?? '');
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [impactStats, setImpactStats] = useState<ImpactStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [contributor]);

  async function loadData() {
    const weeklyRaw = getWeeklyChallenges();

    // Calculate progress for each challenge from weekly scan data
    const weekStart = getWeekStart();
    const { data: txs } = await supabase
      .from('point_transactions')
      .select('type, amount, metadata, created_at')
      .eq('profile_id', profile?.id)
      .eq('type', 'earn_scan')
      .gte('created_at', weekStart.toISOString());

    const weekScanCount = txs?.length ?? 0;
    const maxAmount = txs?.reduce((max, t) => {
      const amt = t.metadata?.amount ?? 0;
      return amt > max ? amt : max;
    }, 0) ?? 0;

    const resolved: Challenge[] = weeklyRaw.map((c) => {
      let prog = 0;
      if (c.type === 'scan_count') prog = Math.min(weekScanCount, c.target);
      else if (c.type === 'max_amount') prog = Math.min(maxAmount, c.target);
      return { ...c, progress: prog, completed: prog >= c.target };
    });
    setChallenges(resolved);

    // Leaderboard
    const { data: leaders } = await supabase
      .from('contributor_profiles')
      .select('profile_id, baskets_funded, subscription_tier, profiles(full_name)')
      .order('baskets_funded', { ascending: false })
      .limit(10);

    setLeaderboard(
      (leaders ?? []).map((l: any) => ({
        profile_id: l.profile_id,
        full_name: l.profiles?.full_name ?? 'Anonyme',
        baskets_funded: l.baskets_funded,
        subscription_tier: l.subscription_tier,
      }))
    );

    // Impact stats
    const { data: impact } = await supabase.from('impact_stats').select('*').single();
    if (impact) setImpactStats(impact as ImpactStats);

    setLoading(false);
  }

  function getWeekStart(): Date {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.vert} />
      </View>
    );
  }

  const myRank = leaderboard.findIndex((l) => l.profile_id === profile?.id) + 1;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <Text style={styles.pageTitle}>Communauté</Text>

        {/* Weekly challenges */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Défis de la semaine</Text>
            <Text style={styles.sectionSub}>Se renouvellent chaque lundi</Text>
          </View>
          {challenges.map((c) => (
            <View key={c.id} style={[styles.challengeCard, c.completed && styles.challengeCardDone]}>
              <View style={styles.challengeTop}>
                <Text style={styles.challengeEmoji}>{c.emoji}</Text>
                <View style={styles.challengeInfo}>
                  <Text style={styles.challengeTitle}>{c.title}</Text>
                  <Text style={styles.challengeDesc}>{c.description}</Text>
                </View>
                <View style={[styles.bonusBadge, c.completed && styles.bonusBadgeDone]}>
                  <Text style={[styles.bonusText, c.completed && styles.bonusTextDone]}>
                    +{c.bonus} pts
                  </Text>
                </View>
              </View>
              <View style={styles.challengeProgressBg}>
                <View style={[
                  styles.challengeProgressFill,
                  { width: `${(c.progress / c.target) * 100}%` },
                  c.completed && styles.challengeProgressDone,
                ]} />
              </View>
              <Text style={styles.challengeProgressText}>
                {c.completed ? '✅ Défi complété !' : `${c.progress} / ${c.target}`}
              </Text>
            </View>
          ))}
        </View>

        {/* Community impact */}
        {impactStats && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Impact de la communauté</Text>
            <View style={styles.impactGrid}>
              <ImpactCell emoji="🧺" value={impactStats.baskets_distributed.toLocaleString('fr-FR')} label="Paniers distribués" />
              <ImpactCell emoji="👨‍👩‍👧" value={impactStats.families_helped.toLocaleString('fr-FR')} label="Familles aidées" />
              <ImpactCell emoji="🏘️" value={impactStats.cities_covered.toLocaleString('fr-FR')} label="Villes" />
              <ImpactCell emoji="👥" value={impactStats.total_contributors.toLocaleString('fr-FR')} label="Contributeurs" />
            </View>
          </View>
        )}

        {/* Leaderboard */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Classement</Text>
            {myRank > 0 && (
              <Text style={styles.myRankBadge}>Vous : #{myRank}</Text>
            )}
          </View>
          {leaderboard.map((entry, idx) => {
            const isMe = entry.profile_id === profile?.id;
            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
            return (
              <View key={entry.profile_id} style={[styles.leaderRow, isMe && styles.leaderRowMe]}>
                <Text style={styles.leaderRank}>
                  {medal ?? `#${idx + 1}`}
                </Text>
                <View style={styles.leaderAvatar}>
                  <Text style={styles.leaderAvatarText}>{entry.full_name[0]?.toUpperCase()}</Text>
                </View>
                <View style={styles.leaderInfo}>
                  <Text style={[styles.leaderName, isMe && styles.leaderNameMe]}>
                    {isMe ? 'Vous' : entry.full_name}
                  </Text>
                  {entry.subscription_tier !== 'free' && (
                    <Text style={styles.leaderTier}>⚡ {entry.subscription_tier}</Text>
                  )}
                </View>
                <Text style={styles.leaderBaskets}>
                  {entry.baskets_funded} 🧺
                </Text>
              </View>
            );
          })}
          {leaderboard.length === 0 && (
            <Text style={styles.empty}>Pas encore de données de classement.</Text>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function ImpactCell({ emoji, value, label }: { emoji: string; value: string; label: string }) {
  return (
    <View style={styles.impactCell}>
      <Text style={styles.impactEmoji}>{emoji}</Text>
      <Text style={styles.impactValue}>{value}</Text>
      <Text style={styles.impactLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.fond },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxl },

  pageTitle: { fontFamily: 'Nunito-Black', fontSize: 28, color: colors.gris },

  section: { gap: spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: 'Nunito-ExtraBold', fontSize: 16, color: colors.gris },
  sectionSub: { fontFamily: 'Inter-Regular', fontSize: 12, color: colors.grisClair },

  // Challenges
  challengeCard: {
    backgroundColor: colors.blanc,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.bordure,
    padding: spacing.md,
    gap: spacing.sm,
  },
  challengeCardDone: { borderColor: colors.success, backgroundColor: '#F0FBF5' },
  challengeTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  challengeEmoji: { fontSize: 28 },
  challengeInfo: { flex: 1 },
  challengeTitle: { fontFamily: 'Nunito-ExtraBold', fontSize: 14, color: colors.gris },
  challengeDesc: { fontFamily: 'Inter-Regular', fontSize: 12, color: colors.grisMoyen, marginTop: 2 },
  bonusBadge: {
    backgroundColor: colors.vertPale,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  bonusBadgeDone: { backgroundColor: '#D4EDDA' },
  bonusText: { fontFamily: 'Inter-SemiBold', fontSize: 11, color: colors.vert },
  bonusTextDone: { color: colors.success },
  challengeProgressBg: {
    height: 6,
    backgroundColor: colors.bordure,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  challengeProgressFill: { height: '100%', backgroundColor: colors.vert, borderRadius: radius.full },
  challengeProgressDone: { backgroundColor: colors.success },
  challengeProgressText: { fontFamily: 'Inter-Regular', fontSize: 11, color: colors.grisMoyen },

  // Impact grid
  impactGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  impactCell: {
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
  impactEmoji: { fontSize: 22 },
  impactValue: { fontFamily: 'Nunito-Black', fontSize: 20, color: colors.gris },
  impactLabel: { fontFamily: 'Inter-Regular', fontSize: 11, color: colors.grisMoyen, textAlign: 'center' },

  // Leaderboard
  myRankBadge: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: colors.vert,
    backgroundColor: colors.vertPale,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.blanc,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.bordure,
    padding: spacing.md,
  },
  leaderRowMe: { borderColor: colors.vert, backgroundColor: colors.vertPale },
  leaderRank: { fontFamily: 'Nunito-Black', fontSize: 18, width: 32, textAlign: 'center' },
  leaderAvatar: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.vertPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderAvatarText: { fontFamily: 'Nunito-ExtraBold', fontSize: 14, color: colors.vert },
  leaderInfo: { flex: 1 },
  leaderName: { fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.gris },
  leaderNameMe: { color: colors.vert },
  leaderTier: { fontFamily: 'Inter-Regular', fontSize: 11, color: colors.orange },
  leaderBaskets: { fontFamily: 'Nunito-ExtraBold', fontSize: 14, color: colors.gris },

  empty: { fontFamily: 'Inter-Regular', fontSize: 14, color: colors.grisMoyen, textAlign: 'center', paddingVertical: spacing.xl },
});
