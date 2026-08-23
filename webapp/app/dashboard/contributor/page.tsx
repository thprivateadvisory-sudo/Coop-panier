'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import type { Profile, ContributorProfile } from '@/lib/types';
import { BottomNav } from './_components/BottomNav';

const TIER_CONFIG = {
  free:       { label: 'Gratuit',    multi: 1,    color: '#6B7280', bg: '#F3F4F6' },
  essentiel:  { label: 'Essentiel',  multi: 1.5,  color: '#2D5016', bg: '#EEF4E8' },
  engagement: { label: 'Engagement', multi: 2,    color: '#E8832A', bg: '#FEF3E8' },
};

const LEVELS = [
  { name: 'Graine',      emoji: '🌱', min: 0,     max: 999 },
  { name: 'Solidaire',   emoji: '🤝', min: 1000,  max: 4999 },
  { name: 'Bienfaiteur', emoji: '⭐', min: 5000,  max: 14999 },
  { name: 'Ambassadeur', emoji: '🏆', min: 15000, max: Infinity },
] as const;

const BASKET_COST = 500;

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

function getLevel(totalPts: number) {
  return [...LEVELS].reverse().find((l) => totalPts >= l.min) ?? LEVELS[0];
}

function ProgressRing({ progress, size = 100 }: { progress: number; size?: number }) {
  const sw = 9;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(Math.max(progress, 0), 1));
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEF4E8" strokeWidth={sw} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="#2D5016" strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={`${circ}`}
        strokeDashoffset={`${offset}`}
        style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1)' }}
      />
    </svg>
  );
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
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

export default function ContributorDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [contributor, setContributor] = useState<ContributorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }

      const [{ data: prof }, { data: contrib }, { data: scanTxs }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('contributor_profiles').select('*').eq('profile_id', user.id).single(),
        supabase.from('point_transactions')
          .select('created_at')
          .eq('profile_id', user.id)
          .eq('type', 'earn_scan')
          .gte('created_at', new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString())
          .limit(500),
      ]);

      setProfile(prof);
      setContributor(contrib);
      setStreak(calculateStreak((scanTxs ?? []).map((t) => t.created_at)));
      setLoading(false);

      channel = supabase
        .channel('contributor_' + user.id)
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public',
          table: 'contributor_profiles',
          filter: `profile_id=eq.${user.id}`,
        }, (payload) => setContributor(payload.new as ContributorProfile))
        .subscribe();
    }

    loadData();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7F4]">
        <div className="w-10 h-10 border-4 border-[#2D5016] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tier = (contributor?.subscription_tier ?? 'free') as keyof typeof TIER_CONFIG;
  const tierCfg = TIER_CONFIG[tier];
  const pointsAvail = contributor?.points_available ?? 0;
  const pointsTotal = contributor?.points_total ?? 0;
  const basketsFunded = contributor?.baskets_funded ?? 0;
  const level = getLevel(pointsTotal);
  const firstName = profile?.full_name?.split(' ')[0] ?? '';
  const initials = (profile?.full_name ?? '?').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '?';

  const basketsFundedCalc = Math.floor(pointsTotal / BASKET_COST);
  const effectiveBasketsFunded = Math.max(basketsFunded, basketsFundedCalc);
  const ptsInCycle = pointsTotal % BASKET_COST;
  const progressToBasket = effectiveBasketsFunded === 0
    ? pointsTotal / BASKET_COST
    : ptsInCycle / BASKET_COST;
  const toNext = BASKET_COST - (effectiveBasketsFunded === 0 ? pointsTotal : ptsInCycle);
  const basketJustFunded = basketsFundedCalc > basketsFunded;

  const ptsDisplay = pointsAvail >= 1000
    ? `${(pointsAvail / 1000).toFixed(1)}k`
    : `${pointsAvail}`;

  return (
    <div className="min-h-screen bg-[#F8F7F4] pb-24">
      {/* Hero header */}
      <div
        className="text-white px-6 pt-12 pb-24"
        style={{ background: 'linear-gradient(135deg, #2D5016 0%, #3D6B1F 60%, #4A8025 100%)' }}
      >
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <Image src="/logo.png" alt="Coop'Panier" width={120} height={44} className="brightness-0 invert" priority />
            <p className="text-green-200 text-sm mt-1">
              {getGreeting()}{firstName ? `, ${firstName}` : ''} 👋
            </p>
          </div>
          <button
            onClick={() => router.push('/dashboard/contributor/profile')}
            className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center font-nunito font-black text-sm hover:bg-white/30 transition-colors"
            aria-label="Mon profil"
          >
            {initials}
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 -mt-16 flex flex-col gap-5">
        {/* Points card with ring */}
        <div className="bg-white rounded-3xl p-6 shadow-md border border-gray-100/50">
          <div className="flex items-center gap-5">
            {/* Ring */}
            <div className="relative flex-shrink-0">
              <ProgressRing progress={progressToBasket} size={104} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-nunito font-black text-xl leading-none text-[#2D5016]">
                  {ptsDisplay}
                </span>
                <span className="text-xs text-gray-400">pts</span>
              </div>
            </div>

            {/* Level + progress */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{level.emoji}</span>
                <span className="font-nunito font-black text-gray-900">{level.name}</span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-semibold ml-auto flex-shrink-0"
                  style={{ backgroundColor: tierCfg.bg, color: tierCfg.color }}
                >
                  ×{tierCfg.multi}
                </span>
              </div>

              <>
                <p className="text-xs text-gray-400 mb-1.5">
                  {effectiveBasketsFunded > 0
                    ? `Encore ${toNext} pts pour le panier #${effectiveBasketsFunded + 1}`
                    : `Encore ${toNext} pts pour financer un panier`}
                </p>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min(progressToBasket, 1) * 100}%`,
                      background: 'linear-gradient(90deg, #2D5016, #4A8025)',
                    }}
                  />
                </div>
              </>
            </div>
          </div>
        </div>

        {/* Notification panier nouvellement financé */}
        {basketJustFunded && (
          <div
            className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background: 'linear-gradient(135deg, #2D5016, #4A8025)' }}
          >
            <span className="text-3xl">🧺</span>
            <div className="flex-1">
              <p className="font-nunito font-black text-white text-sm leading-tight">
                Panier #{effectiveBasketsFunded} financé !
              </p>
              <p className="text-green-200 text-xs mt-0.5">
                Une famille va recevoir ce panier grâce à vous.
              </p>
            </div>
          </div>
        )}

        {/* Streak */}
        {streak > 0 && (
          <button
            onClick={() => router.push('/dashboard/contributor/community')}
            className="w-full rounded-2xl p-4 flex items-center gap-3 active:scale-95 transition-transform"
            style={{ background: 'linear-gradient(135deg, #E8832A, #F09840)' }}
          >
            <span className="text-3xl leading-none">🔥</span>
            <div className="flex-1 text-left">
              <p className="font-nunito font-black text-white text-base leading-none">
                {streak} semaine{streak > 1 ? 's' : ''} de streak !
              </p>
              <p className="text-orange-100 text-xs mt-0.5">Voir mes défis de la semaine</p>
            </div>
            <span className="text-white/60 text-xl">›</span>
          </button>
        )}

        {/* Scan CTA */}
        <button
          onClick={() => router.push('/dashboard/contributor/scan')}
          className="w-full rounded-2xl overflow-hidden active:scale-95 transition-transform shadow-sm"
        >
          <div
            className="p-5 flex items-center gap-4"
            style={{ background: 'linear-gradient(135deg, #E8832A, #F09840)' }}
          >
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-3xl flex-shrink-0">
              📸
            </div>
            <div className="text-left flex-1">
              <p className="font-nunito font-black text-white text-xl leading-tight">Scanner un ticket</p>
              <p className="text-orange-100 text-sm">
                +{tierCfg.multi} pt par euro dépensé
              </p>
            </div>
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xl leading-none">›</span>
            </div>
          </div>
        </button>

        {/* Impact */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Votre impact</p>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { emoji: '🧺', value: basketsFunded, label: 'Paniers', sub: 'financés' },
              { emoji: '🧾', value: contributor?.tickets_scanned ?? 0, label: 'Tickets', sub: 'scannés' },
              { emoji: '⭐', value: pointsTotal >= 1000 ? `${(pointsTotal / 1000).toFixed(1)}k` : pointsTotal, label: 'Points', sub: 'cumulés' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-2xl mb-1">{s.emoji}</div>
                <div className="font-nunito font-black text-lg text-[#2D5016]">{s.value}</div>
                <div className="text-xs text-gray-400 leading-tight">{s.label}</div>
              </div>
            ))}
          </div>
          {basketsFunded > 0 && (
            <div className="pt-4 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">
                🌍 Vous avez contribué à{' '}
                <strong className="text-[#2D5016]">{(basketsFunded * 20).toLocaleString('fr-FR')} €</strong> de nourriture solidaire
              </p>
            </div>
          )}
        </div>

        {/* Mes paniers */}
        {basketsFunded > 0 && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
              Mes paniers financés
            </p>
            <div className="flex flex-col gap-2">
              {Array.from({ length: Math.min(basketsFunded, 3) }, (_, i) => {
                const num = basketsFunded - i;
                return (
                  <div key={num} className="flex items-center gap-3 bg-[#EEF4E8] rounded-xl px-4 py-3">
                    <span className="text-xl">🧺</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-nunito font-black text-sm text-[#2D5016]">
                        Panier #{num} — au nom de {firstName || 'vous'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">Distribué à une famille dans le besoin</p>
                    </div>
                  </div>
                );
              })}
              {basketsFunded > 3 && (
                <p className="text-xs text-center text-gray-400 pt-1">
                  + {basketsFunded - 3} autres paniers financés
                </p>
              )}
            </div>
          </div>
        )}

        {/* Referral card */}
        {contributor?.referral_code && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Parrainez vos amis</p>
            <p className="text-sm text-gray-600 mb-3">
              Partagez votre code — votre ami reçoit <strong className="text-[#2D5016]">+50 pts</strong> et vous <strong className="text-[#2D5016]">+100 pts</strong> à son inscription.
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-[#EEF4E8] rounded-xl px-4 py-3 text-center">
                <span className="font-mono font-black text-xl tracking-widest text-[#2D5016]">
                  {contributor.referral_code}
                </span>
              </div>
              <button
                onClick={() => {
                  const url = `${window.location.origin}/auth/setup?ref=${contributor.referral_code}`;
                  navigator.clipboard.writeText(url).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  });
                }}
                className="px-4 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#2D5016' }}
              >
                {copied ? '✓ Copié' : 'Copier le lien'}
              </button>
            </div>
          </div>
        )}

        {/* Upgrade banner (free only) */}
        {tier === 'free' && (
          <button
            onClick={() => router.push('/dashboard/contributor/subscriptions')}
            className="w-full rounded-2xl p-5 text-left active:scale-95 transition-transform"
            style={{ background: 'linear-gradient(135deg, #2D5016, #4A8025)' }}
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚡</span>
              <div className="flex-1">
                <p className="font-nunito font-black text-white text-lg leading-tight">Doublez vos points !</p>
                <p className="text-green-200 text-sm">Essentiel — seulement 4,99 €/mois</p>
              </div>
              <span className="text-white/60 text-2xl">›</span>
            </div>
          </button>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
