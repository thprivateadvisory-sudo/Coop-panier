'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import type { ContributorProfile } from '@/lib/types';
import { BottomNav } from '../_components/BottomNav';

const PLANS = [
  {
    id: 'free' as const,
    name: 'Gratuit',
    price: 0,
    multiplier: 1,
    emoji: '🌱',
    color: '#6B7280',
    bg: '#F3F4F6',
    border: '#E5E7EB',
    features: ['×1 point par euro', 'Scanner de tickets', 'Tableau de bord'],
  },
  {
    id: 'essentiel' as const,
    name: 'Essentiel',
    price: 4.99,
    multiplier: 1.5,
    emoji: '⭐',
    color: '#2D5016',
    bg: '#EEF4E8',
    border: '#2D5016',
    badge: 'Populaire',
    features: ['×1,5 points par euro', 'Scanner de tickets', 'Tableau de bord complet', 'Historique détaillé'],
  },
  {
    id: 'engagement' as const,
    name: 'Engagement',
    price: 9.99,
    multiplier: 2,
    emoji: '🏆',
    color: '#E8832A',
    bg: '#FEF3E8',
    border: '#E8832A',
    badge: 'Meilleur impact',
    features: ['×2 points par euro', 'Scanner de tickets', 'Tableau de bord complet', 'Historique détaillé', 'Badge Ambassadeur solidaire'],
  },
];

type PlanId = 'free' | 'essentiel' | 'engagement';

export default function SubscriptionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [contributor, setContributor] = useState<ContributorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<PlanId | null>(null);
  const [success, setSuccess] = useState<PlanId | null>(null);

  useEffect(() => {
    loadData();
    // Retour depuis Stripe Checkout avec succès
    const successTier = searchParams.get('success') as PlanId | null;
    if (successTier) {
      setSuccess(successTier);
      setTimeout(() => setSuccess(null), 4000);
    }
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/auth/login'); return; }
    const { data } = await supabase
      .from('contributor_profiles').select('*').eq('profile_id', user.id).single();
    setContributor(data);
    setLoading(false);
  }

  async function selectPlan(planId: PlanId) {
    if (planId === contributor?.subscription_tier) return;
    setUpgrading(planId);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Downgrade vers free : pas de paiement, mise à jour directe
    if (planId === 'free') {
      await supabase.from('contributor_profiles').update({ subscription_tier: 'free' }).eq('profile_id', user.id);
      setContributor((prev) => prev ? { ...prev, subscription_tier: 'free' } : prev);
      setUpgrading(null);
      setSuccess('free');
      setTimeout(() => setSuccess(null), 3000);
      return;
    }

    // Upgrade : Stripe Checkout
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: { profile_id: user.id, tier: planId },
    });

    setUpgrading(null);

    if (error || !data?.url) {
      alert('Impossible de lancer le paiement. Réessayez.');
      return;
    }

    window.location.href = data.url;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7F4]">
        <div className="w-10 h-10 border-4 border-[#2D5016] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const currentTier = (contributor?.subscription_tier ?? 'free') as PlanId;

  return (
    <div className="min-h-screen bg-[#F8F7F4] pb-24">
      <div
        className="text-white px-6 pt-12 pb-20"
        style={{ background: 'linear-gradient(135deg, #2D5016 0%, #3D6B1F 60%, #4A8025 100%)' }}
      >
        <div className="max-w-lg mx-auto">
          <Image src="/logo.png" alt="Coop'Panier" width={120} height={44} className="brightness-0 invert mb-3" />
          <h1 className="font-nunito font-black text-2xl">Forfaits</h1>
          <p className="text-green-200 text-sm mt-1">Multipliez votre impact solidaire</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 -mt-12 flex flex-col gap-4 pb-6">
        {success && (
          <div className="bg-white border-2 border-[#2D5016] rounded-2xl p-4 text-center shadow-sm">
            <p className="font-nunito font-bold text-[#2D5016]">
              ✓ Forfait {PLANS.find((p) => p.id === success)?.name} activé !
            </p>
          </div>
        )}

        {/* Multiplier visual */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Comparez les multiplicateurs</p>
          <div className="flex gap-2">
            {PLANS.map((p) => (
              <div
                key={p.id}
                className={`flex-1 rounded-xl p-3 text-center transition-all ${currentTier === p.id ? 'ring-2' : ''}`}
                style={{
                  backgroundColor: p.bg,
                  outline: currentTier === p.id ? `2px solid ${p.color}` : 'none',
                }}
              >
                <div className="text-xl mb-1">{p.emoji}</div>
                <div className="font-nunito font-black text-lg" style={{ color: p.color }}>×{p.multiplier}</div>
                <div className="text-xs font-medium mt-0.5" style={{ color: p.color }}>{p.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Plan cards */}
        {PLANS.map((plan) => {
          const isCurrent = currentTier === plan.id;
          const isUpgrading = upgrading === plan.id;

          return (
            <div
              key={plan.id}
              className="bg-white rounded-2xl overflow-hidden border-2 transition-all"
              style={{ borderColor: isCurrent ? plan.color : '#E5E7EB' }}
            >
              {/* Plan header */}
              <div className="p-5 pb-4" style={{ backgroundColor: isCurrent ? plan.bg : 'white' }}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{plan.emoji}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-nunito font-black text-lg text-gray-900">{plan.name}</h3>
                        {'badge' in plan && (
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: plan.bg, color: plan.color }}
                          >
                            {plan.badge}
                          </span>
                        )}
                      </div>
                      <p className="font-nunito font-black text-xl" style={{ color: plan.color }}>
                        ×{plan.multiplier} <span className="text-sm font-semibold text-gray-400">pts/€</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {plan.price === 0 ? (
                      <p className="font-nunito font-black text-xl text-gray-400">Gratuit</p>
                    ) : (
                      <>
                        <p className="font-nunito font-black text-2xl text-gray-900">{plan.price} €</p>
                        <p className="text-xs text-gray-400">/mois</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Features */}
              <div className="px-5 pb-4">
                <ul className="flex flex-col gap-1.5 mb-4">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="text-xs" style={{ color: plan.color }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div
                    className="w-full py-3 rounded-xl text-sm font-semibold text-center"
                    style={{ backgroundColor: plan.bg, color: plan.color }}
                  >
                    ✓ Forfait actuel
                  </div>
                ) : (
                  <button
                    onClick={() => selectPlan(plan.id)}
                    disabled={!!upgrading}
                    className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: plan.color }}
                  >
                    {isUpgrading ? '…' : plan.price === 0 ? 'Passer au gratuit' : `Choisir ${plan.name}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        <p className="text-xs text-gray-400 text-center px-4 pb-2">
          Paiement sécurisé par Stripe. Résiliable à tout moment.
        </p>
      </div>

      <BottomNav />
    </div>
  );
}
