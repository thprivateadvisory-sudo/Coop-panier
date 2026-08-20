'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import type { Profile, ContributorProfile } from '@/lib/types';
import { BottomNav } from './_components/BottomNav';

const TIER_CONFIG = {
  free:       { label: 'Gratuit',    multi: 1,  color: '#6B7280', bg: '#F3F4F6' },
  essentiel:  { label: 'Essentiel',  multi: 2,  color: '#2D5016', bg: '#EEF4E8' },
  engagement: { label: 'Engagement', multi: 4,  color: '#E8832A', bg: '#FEF3E8' },
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

export default function ContributorDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [contributor, setContributor] = useState<ContributorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }

      const [{ data: prof }, { data: contrib }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('contributor_profiles').select('*').eq('profile_id', user.id).single(),
      ]);

      setProfile(prof);
      setContributor(contrib);
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

  const inCycle = pointsAvail % BASKET_COST;
  const progressToBasket = pointsAvail > 0 && inCycle === 0 ? 1 : inCycle / BASKET_COST;
  const toNext = inCycle === 0 ? 0 : BASKET_COST - inCycle;
  const basketReady = pointsAvail >= BASKET_COST && inCycle === 0;

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

              {basketReady ? (
                <div className="bg-[#EEF4E8] rounded-xl px-3 py-2">
                  <p className="text-[#2D5016] font-nunito font-black text-sm">🎉 Panier disponible !</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-400 mb-1.5">
                    Encore {toNext} pts pour un panier
                  </p>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${progressToBasket * 100}%`,
                        background: 'linear-gradient(90deg, #2D5016, #4A8025)',
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

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
                +{10 * tierCfg.multi} pts par euro dépensé
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
