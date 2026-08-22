'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { ContributorProfile } from '@/lib/types';
import { BottomNav } from '../_components/BottomNav';

// ── Week helpers ──────────────────────────────────────────────

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay() === 0 ? 7 : d.getDay();
  d.setDate(d.getDate() - (day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function calculateStreak(scanDates: string[]): number {
  if (!scanDates.length) return 0;
  const weekKeys = new Set(
    scanDates.map((iso) => {
      const d = new Date(iso);
      return `${d.getFullYear()}-${getISOWeek(d)}`;
    })
  );
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${getISOWeek(now)}`;
  const offset = weekKeys.has(currentKey) ? 0 : 1;
  let count = 0;
  for (let i = offset; i <= 52; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    if (weekKeys.has(`${d.getFullYear()}-${getISOWeek(d)}`)) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

function anonymize(name: string): string {
  const parts = (name ?? '').trim().split(' ').filter(Boolean);
  if (!parts.length) return 'Anonyme';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0].toUpperCase()}.`;
}

// ── Challenges ────────────────────────────────────────────────

const POOL = [
  { id: 'c0', emoji: '🤝', title: 'Démarrage solidaire',  desc: 'Scannez 2 tickets cette semaine',       type: 'scan_count' as const, target: 2,  bonus: 80  },
  { id: 'c1', emoji: '🎯', title: 'Trio de la semaine',   desc: 'Scannez 3 tickets cette semaine',       type: 'scan_count' as const, target: 3,  bonus: 150 },
  { id: 'c2', emoji: '💶', title: 'Grand achat',           desc: 'Scannez un ticket de plus de 50 €',    type: 'max_amount' as const, target: 50, bonus: 100 },
  { id: 'c3', emoji: '⚡', title: 'Super contributeur',   desc: 'Scannez 5 tickets cette semaine',       type: 'scan_count' as const, target: 5,  bonus: 300 },
  { id: 'c4', emoji: '🌿', title: 'Semaine verte',        desc: 'Scannez 4 tickets cette semaine',       type: 'scan_count' as const, target: 4,  bonus: 200 },
] as const;

type Challenge = typeof POOL[number];
type ChallengeType = Challenge['type'];

function getWeeklyChallenges(weekNum: number): [Challenge, Challenge] {
  const a = POOL[weekNum % POOL.length];
  const b = POOL[(weekNum + 2) % POOL.length];
  return a.id === b.id ? [a, POOL[(weekNum + 3) % POOL.length]] : [a, b];
}

// ── Challenge card ────────────────────────────────────────────

interface ChallengeCardProps {
  ch: Challenge;
  weekScans: number;
  weekMaxAmount: number;
  userId: string;
  weekNum: number;
  creditedKeys: Set<string>;
  onCredited: (key: string) => void;
}

function ChallengeCard({ ch, weekScans, weekMaxAmount, userId, weekNum, creditedKeys, onCredited }: ChallengeCardProps) {
  const current = ch.type === 'scan_count' ? weekScans : weekMaxAmount;
  const progress = Math.min(current / ch.target, 1);
  const done = progress >= 1;
  const year = new Date().getFullYear();
  const bonusKey = `cp_ch_${userId}_${year}_W${weekNum}_${ch.id}`;
  const credited = creditedKeys.has(bonusKey);

  useEffect(() => {
    if (!done || !userId || credited) return;
    let cancelled = false;
    (async () => {
      try {
        await supabase.rpc('credit_points', {
          p_profile_id: userId,
          p_amount: ch.bonus,
          p_type: 'earn_bonus',
          p_description: `Défi semaine — ${ch.title}`,
        });
        if (!cancelled) {
          localStorage.setItem(bonusKey, '1');
          onCredited(bonusKey);
        }
      } catch {
        // retry next visit
      }
    })();
    return () => { cancelled = true; };
  }, [done, userId]);

  return (
    <div
      className="bg-white rounded-2xl p-5 border border-gray-100 relative overflow-hidden"
      style={done ? { borderColor: '#2D5016', background: 'linear-gradient(135deg, #EEF4E8 0%, #FFFFFF 60%)' } : {}}
    >
      {done && (
        <div
          className="absolute top-3 right-3 text-xs font-bold px-2.5 py-1 rounded-full text-white"
          style={{ background: '#2D5016' }}
        >
          {credited ? '✓ Bonus crédité' : '✓ Terminé !'}
        </div>
      )}
      <div className="flex items-start gap-3 mb-3">
        <span className="text-2xl">{ch.emoji}</span>
        <div className="flex-1 min-w-0 pr-20">
          <p className="font-nunito font-black text-gray-900 text-sm">{ch.title}</p>
          <p className="text-xs text-gray-400 mt-0.5">{ch.desc}</p>
        </div>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${progress * 100}%`,
            background: done
              ? 'linear-gradient(90deg, #2D5016, #4A8025)'
              : 'linear-gradient(90deg, #E8832A, #F09840)',
          }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {ch.type === 'scan_count'
            ? `${Math.min(current, ch.target)} / ${ch.target} tickets`
            : `${current.toFixed(0)} / ${ch.target} €`}
        </span>
        <span className="text-xs font-semibold text-[#2D5016]">+{ch.bonus} pts bonus</span>
      </div>
    </div>
  );
}

// ── Leaderboard entry ─────────────────────────────────────────

interface LeaderboardEntry {
  profile_id: string;
  full_name: string;
  baskets_funded: number;
  points_total: number;
}

// ── Main page ─────────────────────────────────────────────────

export default function CommunityPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [weekScans, setWeekScans] = useState(0);
  const [weekMaxAmount, setWeekMaxAmount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [totalBaskets, setTotalBaskets] = useState(0);
  const [loading, setLoading] = useState(true);
  const [creditedKeys, setCreditedKeys] = useState<Set<string>>(new Set());

  const weekNum = getISOWeek(new Date());
  const [ch1, ch2] = useMemo(() => getWeeklyChallenges(weekNum), [weekNum]);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/auth/login'); return; }
    setUserId(user.id);

    // Init credited challenges from localStorage
    const year = new Date().getFullYear();
    const initial = new Set<string>();
    [ch1, ch2].forEach((ch) => {
      const k = `cp_ch_${user.id}_${year}_W${weekNum}_${ch.id}`;
      if (localStorage.getItem(k)) initial.add(k);
    });
    setCreditedKeys(initial);

    const weekStart = getWeekStart(new Date()).toISOString();

    const [
      { data: weekTxs },
      { data: weekReceipts },
      { data: allScans },
      { data: topCps },
      { data: statsData },
    ] = await Promise.all([
      supabase.from('point_transactions')
        .select('id')
        .eq('profile_id', user.id)
        .eq('type', 'earn_scan')
        .gte('created_at', weekStart),
      supabase.from('receipts')
        .select('total_amount')
        .eq('contributor_id', user.id)
        .gte('created_at', weekStart),
      supabase.from('point_transactions')
        .select('created_at')
        .eq('profile_id', user.id)
        .eq('type', 'earn_scan'),
      supabase.from('contributor_profiles')
        .select('profile_id, baskets_funded, points_total')
        .order('baskets_funded', { ascending: false })
        .order('points_total', { ascending: false })
        .limit(10),
      supabase.from('impact_stats').select('baskets_distributed').single(),
    ]);

    setWeekScans((weekTxs ?? []).length);
    setWeekMaxAmount(
      (weekReceipts ?? []).length
        ? Math.max(...(weekReceipts ?? []).map((r) => r.total_amount ?? 0))
        : 0
    );
    setStreak(calculateStreak((allScans ?? []).map((t) => t.created_at)));
    setTotalBaskets(statsData?.baskets_distributed ?? 0);

    // Fetch profile names for leaderboard
    const ids = (topCps ?? []).map((cp) => cp.profile_id);
    if (ids.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', ids);
      const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
      setLeaderboard(
        (topCps ?? []).map((cp) => ({
          profile_id: cp.profile_id,
          full_name: nameMap.get(cp.profile_id) ?? 'Anonyme',
          baskets_funded: cp.baskets_funded ?? 0,
          points_total: cp.points_total ?? 0,
        }))
      );
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7F4]">
        <div className="w-10 h-10 border-4 border-[#2D5016] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const myRank = leaderboard.findIndex((e) => e.profile_id === userId) + 1;
  const MEDALS = ['🥇', '🥈', '🥉'];

  function addCreditedKey(key: string) {
    setCreditedKeys((prev) => new Set(prev).add(key));
  }

  return (
    <div className="min-h-screen bg-[#F8F7F4] pb-24">
      {/* Header */}
      <div
        className="text-white px-6 pt-12 pb-20"
        style={{ background: 'linear-gradient(135deg, #2D5016 0%, #3D6B1F 60%, #4A8025 100%)' }}
      >
        <div className="max-w-lg mx-auto">
          <h1 className="font-nunito font-black text-2xl">Communauté</h1>
          <p className="text-green-200 text-sm mt-1">Défis · Classement · Impact collectif</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 -mt-12 flex flex-col gap-5 pb-6">
        {/* Streak banner */}
        {streak > 0 && (
          <div
            className="rounded-2xl p-4 flex items-center gap-4"
            style={{ background: 'linear-gradient(135deg, #E8832A, #F09840)' }}
          >
            <span className="text-4xl leading-none">🔥</span>
            <div>
              <p className="font-nunito font-black text-white text-xl leading-none">
                {streak} semaine{streak > 1 ? 's' : ''} de streak !
              </p>
              <p className="text-orange-100 text-sm">Continuez l'élan, vous êtes en feu.</p>
            </div>
          </div>
        )}

        {/* Weekly challenges */}
        <div>
          <div className="flex items-center justify-between px-1 mb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Défis de la semaine</p>
            <p className="text-xs text-gray-400">Se renouvellent chaque lundi</p>
          </div>
          <div className="flex flex-col gap-3">
            {[ch1, ch2].map((ch) => (
              <ChallengeCard
                key={ch.id}
                ch={ch}
                weekScans={weekScans}
                weekMaxAmount={weekMaxAmount}
                userId={userId}
                weekNum={weekNum}
                creditedKeys={creditedKeys}
                onCredited={addCreditedKey}
              />
            ))}
          </div>
        </div>

        {/* Leaderboard */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Classement — Paniers financés</p>
            {myRank > 0 && (
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ backgroundColor: '#EEF4E8', color: '#2D5016' }}
              >
                Vous : #{myRank}
              </span>
            )}
          </div>

          {leaderboard.length === 0 ? (
            <div className="px-5 pb-5 text-center">
              <p className="text-4xl mb-2">🏆</p>
              <p className="text-sm text-gray-400">Soyez le premier au classement !</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {leaderboard.map((entry, i) => {
                const isMe = entry.profile_id === userId;
                return (
                  <div
                    key={entry.profile_id}
                    className="flex items-center gap-3 px-5 py-3"
                    style={isMe ? { backgroundColor: '#EEF4E8' } : {}}
                  >
                    <div className="w-6 text-center flex-shrink-0">
                      {i < 3
                        ? <span className="text-lg">{MEDALS[i]}</span>
                        : <span className="text-xs text-gray-400 font-bold">#{i + 1}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${isMe ? 'text-[#2D5016]' : 'text-gray-900'}`}>
                        {isMe ? 'Vous' : anonymize(entry.full_name)}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-nunito font-black text-sm text-[#2D5016]">
                        {entry.baskets_funded} 🧺
                      </p>
                      <p className="text-xs text-gray-400">
                        {entry.points_total >= 1000
                          ? `${(entry.points_total / 1000).toFixed(1)}k`
                          : entry.points_total} pts
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bons partenaires */}
        <div>
          <div className="flex items-center justify-between px-1 mb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Bons partenaires</p>
            {contributor?.subscription_tier === 'free' && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
                Abonnés uniquement
              </span>
            )}
          </div>

          {contributor?.subscription_tier === 'free' ? (
            <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center">
              <div className="text-4xl mb-3">🔒</div>
              <p className="font-nunito font-black text-gray-900 mb-1">Réservé aux abonnés</p>
              <p className="text-sm text-gray-400 mb-4">
                Débloquez des bons de réduction chez nos partenaires en passant à Essentiel ou Engagement.
              </p>
              <button
                onClick={() => router.push('/dashboard/contributor/subscriptions')}
                className="font-nunito font-black px-6 py-3 rounded-xl text-white text-sm"
                style={{ background: 'linear-gradient(135deg, #2D5016, #4A8025)' }}
              >
                Voir les forfaits
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {(() => {
                const tier = contributor?.subscription_tier ?? 'essentiel';
                const scanned = contributor?.tickets_scanned ?? 0;
                const paliers = tier === 'engagement'
                  ? [
                      { tickets: 20,  label: 'Bon partenaire — Palier 1' },
                      { tickets: 50,  label: 'Bon partenaire — Palier 2' },
                      { tickets: 100, label: 'Bon partenaire — Palier 3' },
                    ]
                  : [
                      { tickets: 30,  label: 'Bon partenaire — Palier 1' },
                      { tickets: 75,  label: 'Bon partenaire — Palier 2' },
                      { tickets: 150, label: 'Bon partenaire — Palier 3' },
                    ];

                return paliers.map((p) => {
                  const progress = Math.min(scanned / p.tickets, 1);
                  const done = progress >= 1;
                  return (
                    <div key={p.tickets} className="bg-white rounded-2xl p-5 border border-gray-100">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-2xl">{done ? '🎁' : '🔓'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-nunito font-black text-sm text-gray-900">{p.label}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {done ? 'Bientôt disponible — partenaires en cours' : `${Math.min(scanned, p.tickets)} / ${p.tickets} tickets`}
                          </p>
                        </div>
                        <span
                          className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                          style={done
                            ? { background: '#EEF4E8', color: '#2D5016' }
                            : { background: '#F3F4F6', color: '#6B7280' }}
                        >
                          {done ? '✓ Débloqué' : `${p.tickets} tickets`}
                        </span>
                      </div>
                      {!done && (
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${progress * 100}%`,
                              background: 'linear-gradient(90deg, #2D5016, #4A8025)',
                            }}
                          />
                        </div>
                      )}
                      {done && (
                        <div className="bg-[#EEF4E8] rounded-xl px-3 py-2 text-center">
                          <p className="text-xs text-[#2D5016] font-semibold">
                            🕐 Partenariats en cours de signature — bientôt disponible !
                          </p>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>

        {/* Community impact */}
        <div
          className="rounded-2xl p-5"
          style={{ background: 'linear-gradient(135deg, #2D5016, #3D6B1F)' }}
        >
          <p className="text-xs font-semibold text-green-300 uppercase tracking-wide mb-4">
            Impact collectif — toute la communauté
          </p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center">
              <p className="font-nunito font-black text-3xl text-white">
                {totalBaskets >= 1000
                  ? `${(totalBaskets / 1000).toFixed(1)}k`
                  : totalBaskets}
              </p>
              <p className="text-green-200 text-xs mt-1">paniers distribués</p>
            </div>
            <div className="text-center">
              <p className="font-nunito font-black text-3xl text-white">
                {(totalBaskets * 20).toLocaleString('fr-FR')} €
              </p>
              <p className="text-green-200 text-xs mt-1">de nourriture solidaire</p>
            </div>
          </div>
          <div className="pt-4 border-t border-white/20 text-center">
            <p className="text-green-200 text-sm">
              🌍 Ensemble, on change les choses. Merci.
            </p>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
