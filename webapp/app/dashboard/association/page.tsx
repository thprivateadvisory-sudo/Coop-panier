'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

type Stats = {
  distributed: number;
  pending: number;
  active: number;
};

type Beneficiary = {
  profile_id: string;
  full_name: string;
  status: 'waitlist' | 'active' | 'suspended';
  baskets_received: number;
};

const STATUS_CFG = {
  active:    { label: 'Actif',         color: '#16A34A', bg: '#EAF9F1' },
  waitlist:  { label: 'Liste attente', color: '#D97706', bg: '#FEF9EC' },
  suspended: { label: 'Suspendu',      color: '#DC2626', bg: '#FDECEC' },
};

export default function AssociationDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pickupName, setPickupName] = useState('');
  const [pickupId, setPickupId] = useState('');
  const [stats, setStats] = useState<Stats>({ distributed: 0, pending: 0, active: 0 });
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'overview' | 'list'>('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/auth/login'); return; }

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setProfile(prof);

    const { data: pickup } = await supabase
      .from('pickup_points')
      .select('id, name')
      .eq('association_profile_id', user.id)
      .eq('active', true)
      .single();

    if (!pickup) { setLoading(false); return; }
    setPickupName(pickup.name);
    setPickupId(pickup.id);

    const [{ data: baskets }, { count: activeCount }, { data: benesData }] = await Promise.all([
      supabase.from('baskets').select('id, status').eq('pickup_point_id', pickup.id),
      supabase.from('beneficiary_profiles').select('*', { count: 'exact', head: true })
        .eq('pickup_point_id', pickup.id).eq('status', 'active'),
      supabase
        .from('beneficiary_profiles')
        .select('profile_id, status, baskets_received, profiles(full_name)')
        .eq('pickup_point_id', pickup.id)
        .order('status'),
    ]);

    setStats({
      distributed: baskets?.filter((b) => b.status === 'distributed').length ?? 0,
      pending: baskets?.filter((b) => b.status === 'assigned').length ?? 0,
      active: activeCount ?? 0,
    });

    setBeneficiaries(
      (benesData ?? []).map((b: any) => ({
        profile_id: b.profile_id,
        full_name: b.profiles?.full_name ?? '—',
        status: b.status,
        baskets_received: b.baskets_received,
      }))
    );

    setLoading(false);
  }

  async function toggleStatus(b: Beneficiary) {
    const newStatus = b.status === 'active' ? 'suspended' : 'active';
    await supabase.from('beneficiary_profiles').update({ status: newStatus }).eq('profile_id', b.profile_id);
    setBeneficiaries((prev) =>
      prev.map((x) => x.profile_id === b.profile_id ? { ...x, status: newStatus } : x)
    );
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

  const filtered = search
    ? beneficiaries.filter((b) => b.full_name.toLowerCase().includes(search.toLowerCase()))
    : beneficiaries;

  return (
    <div className="min-h-screen bg-[#F8F7F4]">
      <div className="bg-[#2D5016] text-white px-6 pt-12 pb-20">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <Image src="/logo.png" alt="Coop'Panier" width={140} height={50} className="brightness-0 invert mb-1" />
            <p className="text-green-200 text-sm">{pickupName || profile?.full_name} 👋</p>
          </div>
          <button onClick={handleSignOut} className="text-sm text-green-200 hover:text-white">
            Déconnexion
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 -mt-14 pb-12 flex flex-col gap-5">
        {/* Tabs */}
        <div className="flex rounded-xl bg-white border border-gray-100 p-1 shadow-sm">
          {(['overview', 'list'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                tab === t ? 'bg-[#2D5016] text-white' : 'text-gray-500'
              }`}
            >
              {t === 'overview' ? '📊 Vue d\'ensemble' : '👥 Bénéficiaires'}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { emoji: '🧺', value: stats.distributed, label: 'Distribués', color: '#2D5016' },
                { emoji: '⏳', value: stats.pending, label: 'En attente', color: '#E8832A' },
                { emoji: '👥', value: stats.active, label: 'Actifs', color: '#2D5016' },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-xl p-4 text-center border border-gray-100">
                  <div className="text-2xl mb-1">{s.emoji}</div>
                  <div className="font-nunito font-black text-2xl" style={{ color: s.color }}>
                    {s.value}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Status breakdown */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Statuts des bénéficiaires</p>
              <div className="flex gap-3">
                {(['active', 'waitlist', 'suspended'] as const).map((s) => {
                  const count = beneficiaries.filter((b) => b.status === s).length;
                  const cfg = STATUS_CFG[s];
                  return (
                    <div
                      key={s}
                      className="flex-1 rounded-xl p-3 text-center"
                      style={{ backgroundColor: cfg.bg }}
                    >
                      <div className="font-nunito font-black text-xl" style={{ color: cfg.color }}>{count}</div>
                      <div className="text-xs font-medium mt-0.5" style={{ color: cfg.color }}>{cfg.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action CTA */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Scanner un bénéficiaire</p>
              <p className="text-sm text-gray-500 mb-4">
                Sur mobile, utilisez l'application Coop'Panier pour scanner les QR codes lors de la distribution.
              </p>
              <div className="bg-[#EEF4E8] rounded-xl p-4 text-center">
                <div className="text-3xl mb-2">📱</div>
                <p className="text-sm font-semibold text-[#2D5016]">Disponible sur iOS & Android</p>
                <p className="text-xs text-gray-500 mt-1">L'app mobile permet de scanner les QR codes bénéficiaires</p>
              </div>
            </div>
          </>
        )}

        {tab === 'list' && (
          <>
            {/* Search */}
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              <input
                type="text"
                placeholder="Rechercher par nom…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white border border-gray-100 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-[#2D5016]"
              />
            </div>

            {/* List */}
            <div className="flex flex-col gap-3">
              {filtered.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
                  <p className="text-gray-400 text-sm">Aucun bénéficiaire trouvé.</p>
                </div>
              ) : filtered.map((b) => {
                const cfg = STATUS_CFG[b.status];
                return (
                  <div
                    key={b.profile_id}
                    className="bg-white rounded-xl p-4 border border-gray-100 flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#EEF4E8] flex items-center justify-center font-nunito font-black text-[#2D5016]">
                      {b.full_name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{b.full_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {b.baskets_received} panier{b.baskets_received !== 1 ? 's' : ''} reçu{b.baskets_received !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: cfg.bg, color: cfg.color }}
                      >
                        {cfg.label}
                      </span>
                      {b.status !== 'waitlist' && (
                        <button
                          onClick={() => toggleStatus(b)}
                          className="text-xs text-gray-400 underline"
                        >
                          {b.status === 'active' ? 'Suspendre' : 'Activer'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
