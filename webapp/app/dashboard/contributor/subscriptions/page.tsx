'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import type { ContributorProfile } from '@/lib/types';

const PLANS = [
  {
    id: 'free',
    name: 'Gratuit',
    price: 0,
    multiplier: 1,
    color: '#6B7280',
    bg: '#F3F4F6',
    border: '#E5E7EB',
    features: ['×1 point par euro dépensé', 'Accès au scanner de tickets', 'Tableau de bord de base'],
  },
  {
    id: 'essentiel',
    name: 'Essentiel',
    price: 4.99,
    multiplier: 2,
    color: '#2D5016',
    bg: '#EEF4E8',
    border: '#2D5016',
    badge: 'Populaire',
    features: ['×2 points par euro dépensé', 'Accès au scanner de tickets', 'Tableau de bord complet', 'Historique détaillé'],
  },
  {
    id: 'engagement',
    name: 'Engagement',
    price: 9.99,
    multiplier: 4,
    color: '#E8832A',
    bg: '#FEF3E8',
    border: '#E8832A',
    badge: 'Meilleur impact',
    features: ['×4 points par euro dépensé', 'Accès au scanner de tickets', 'Tableau de bord complet', 'Historique détaillé', 'Badge Engagement solidaire'],
  },
] as const;

type PlanId = 'free' | 'essentiel' | 'engagement';

export default function SubscriptionsPage() {
  const router = useRouter();
  const [contributor, setContributor] = useState<ContributorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<PlanId | null>(null);
  const [success, setSuccess] = useState<PlanId | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/auth/login'); return; }
    const { data } = await supabase
      .from('contributor_profiles')
      .select('*')
      .eq('profile_id', user.id)
      .single();
    setContributor(data);
    setLoading(false);
  }

  async function selectPlan(planId: PlanId) {
    if (planId === contributor?.subscription_tier) return;
    setUpgrading(planId);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('contributor_profiles')
      .update({ subscription_tier: planId })
      .eq('profile_id', user.id);

    setContributor((prev) => prev ? { ...prev, subscription_tier: planId } : prev);
    setUpgrading(null);
    setSuccess(planId);

    setTimeout(() => setSuccess(null), 3000);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#2D5016] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const currentTier = (contributor?.subscription_tier ?? 'free') as PlanId;

  return (
    <div className="min-h-screen bg-[#F8F7F4]">
      {/* Header */}
      <div className="bg-[#2D5016] text-white px-6 pt-12 pb-20">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <Image src="/logo.png" alt="Coop'Panier" width={140} height={50} className="brightness-0 invert mb-1" />
            <p className="text-green-200 text-sm">Abonnements</p>
          </div>
          <button onClick={() => router.push('/dashboard/contributor')} className="text-sm text-green-200 hover:text-white">
            ← Retour
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 -mt-14 pb-12 flex flex-col gap-4">
        {/* Success banner */}
        {success && (
          <div className="bg-[#EEF4E8] border-2 border-[#2D5016] rounded-2xl p-4 text-center">
            <p className="font-nunito font-bold text-[#2D5016]">
              ✓ Abonnement {PLANS.find(p => p.id === success)?.name} activé !
            </p>
          </div>
        )}

        {/* Intro card */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Multipliez votre impact</p>
          <p className="text-sm text-gray-600">
            Plus votre abonnement est élevé, plus vos tickets de caisse rapportent de points — et plus vous financez de paniers solidaires.
          </p>
        </div>

        {/* Plans */}
        {PLANS.map((plan) => {
          const isCurrent = currentTier === plan.id;
          const isLoading = upgrading === plan.id;

          return (
            <div
              key={plan.id}
              className="bg-white rounded-2xl p-5 border-2 transition-all"
              style={{ borderColor: isCurrent ? plan.color : '#E5E7EB' }}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
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
                  <p className="text-2xl font-nunito font-black" style={{ color: plan.color }}>
                    ×{plan.multiplier}
                    <span className="text-sm font-semibold text-gray-400 ml-1">pts/€</span>
                  </p>
                </div>
                <div className="text-right">
                  {plan.price === 0 ? (
                    <p className="font-nunito font-black text-xl text-gray-400">Gratuit</p>
                  ) : (
                    <>
                      <p className="font-nunito font-black text-2xl text-gray-900">{plan.price}€</p>
                      <p className="text-xs text-gray-400">/mois</p>
                    </>
                  )}
                </div>
              </div>

              <ul className="flex flex-col gap-1.5 mb-4">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                    <span style={{ color: plan.color }}>✓</span> {f}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div
                  className="w-full py-3 rounded-xl text-sm font-semibold text-center"
                  style={{ backgroundColor: plan.bg, color: plan.color }}
                >
                  ✓ Abonnement actuel
                </div>
              ) : (
                <button
                  onClick={() => selectPlan(plan.id as PlanId)}
                  disabled={!!upgrading}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: plan.color }}
                >
                  {isLoading ? '…' : plan.price === 0 ? 'Passer au gratuit' : `Passer à ${plan.name}`}
                </button>
              )}
            </div>
          );
        })}

        {/* Note */}
        <p className="text-xs text-gray-400 text-center px-4">
          Les abonnements sont gérés directement dans l'application. Aucun paiement réel n'est traité pour le moment.
        </p>
      </div>
    </div>
  );
}
