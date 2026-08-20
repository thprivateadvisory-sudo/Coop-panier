'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import type { Profile, ContributorProfile } from '@/lib/types';

const TIER_LABELS = {
  free: { label: 'Gratuit', multiplier: '×1', color: 'text-gray-500', bg: 'bg-gray-100' },
  essentiel: { label: 'Essentiel', multiplier: '×2 pts', color: 'text-[#2D5016]', bg: 'bg-[#EEF4E8]' },
  engagement: { label: 'Engagement', multiplier: '×4 pts', color: 'text-[#E8832A]', bg: 'bg-[#FEF3E8]' },
};

const BASKET_COST = 500;

export default function ContributorDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [contributor, setContributor] = useState<ContributorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

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

    // Temps réel
    supabase
      .channel('contributor_' + user.id)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'contributor_profiles',
        filter: `profile_id=eq.${user.id}`,
      }, (payload) => setContributor(payload.new as ContributorProfile))
      .subscribe();
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/auth/login');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#2D5016] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tier = contributor?.subscription_tier ?? 'free';
  const tierInfo = TIER_LABELS[tier];
  const points = contributor?.points_available ?? 0;
  const progress = Math.min((points % BASKET_COST) / BASKET_COST, 1);
  const toNext = BASKET_COST - (points % BASKET_COST);
  const initials = (profile?.full_name ?? '?').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="min-h-screen bg-[#F8F7F4]">
      {/* Header */}
      <div className="bg-[#2D5016] text-white px-6 pt-12 pb-20">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <Image src="/logo.png" alt="Coop'Panier" width={140} height={50} className="brightness-0 invert mb-1" />
            <p className="text-green-200 text-sm">Bonjour{profile?.full_name ? `, ${profile.full_name}` : ''} 👋</p>
          </div>
          <button
            onClick={handleSignOut}
            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-nunito font-black"
          >
            {initials}
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 -mt-14 pb-12 flex flex-col gap-5">
        {/* Points card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Mes points</p>
              <p className="font-nunito font-black text-4xl text-[#2D5016]">
                {points.toLocaleString('fr-FR')}
              </p>
            </div>
            <div className={`px-3 py-1.5 rounded-full text-sm font-semibold ${tierInfo.bg} ${tierInfo.color}`}>
              {tierInfo.label} {tierInfo.multiplier}
            </div>
          </div>

          <div className="mb-1 flex justify-between text-xs text-gray-400">
            <span>Vers le prochain panier</span>
            <span>{toNext} pts restants</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#2D5016] rounded-full transition-all duration-700"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>

        {/* Scanner CTA */}
        <button
          onClick={() => router.push('/dashboard/contributor/scan')}
          className="w-full bg-[#E8832A] text-white rounded-2xl p-5 flex items-center gap-4 hover:opacity-90 transition-opacity"
        >
          <span className="text-4xl">📸</span>
          <div className="text-left flex-1">
            <p className="font-nunito font-black text-lg">Scanner un ticket</p>
            <p className="text-orange-100 text-sm">Gagnez des points sur vos achats</p>
          </div>
          <span className="text-white/60 text-2xl">›</span>
        </button>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { emoji: '⭐', value: contributor?.points_total ?? 0, label: 'Total points' },
            { emoji: '🧾', value: contributor?.tickets_scanned ?? 0, label: 'Tickets' },
            { emoji: '🧺', value: contributor?.baskets_funded ?? 0, label: 'Paniers financés' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl p-4 text-center border border-gray-100">
              <div className="text-xl mb-1">{s.emoji}</div>
              <div className="font-nunito font-black text-xl text-[#2D5016]">
                {s.value.toLocaleString('fr-FR')}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Upgrade banner (free only) */}
        {tier === 'free' && (
          <div className="bg-[#EEF4E8] border-2 border-[#2D5016] rounded-2xl p-5">
            <p className="font-nunito font-black text-[#2D5016] text-lg mb-1">Doublez vos points !</p>
            <p className="text-sm text-gray-600 mb-4">
              Passez à l'abonnement Essentiel et gagnez ×2 points sur chaque ticket.
            </p>
            <button
              onClick={() => router.push('/dashboard/contributor/subscriptions')}
              className="bg-[#2D5016] text-white font-nunito font-black px-5 py-2.5 rounded-xl text-sm"
            >
              Voir les abonnements →
            </button>
          </div>
        )}

        {/* Menu */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {[
            { emoji: '⚡', label: 'Abonnements', href: '/dashboard/contributor/subscriptions' },
            { emoji: '📋', label: 'Historique des points', href: '#' },
            { emoji: '👤', label: 'Mon profil', href: '/dashboard/contributor/profile' },
          ].map((item, i, arr) => (
            <button
              key={item.label}
              onClick={() => item.href !== '#' && router.push(item.href)}
              className={`w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors ${
                i < arr.length - 1 ? 'border-b border-gray-100' : ''
              }`}
            >
              <span className="text-xl">{item.emoji}</span>
              <span className="flex-1 text-sm text-gray-700 font-medium">{item.label}</span>
              <span className="text-gray-300 text-xl">›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
