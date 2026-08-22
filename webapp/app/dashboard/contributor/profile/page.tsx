'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Profile, ContributorProfile } from '@/lib/types';
import { BottomNav } from '../_components/BottomNav';

const TIER_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  free:       { label: 'Gratuit',    color: '#6B7280', bg: '#F3F4F6' },
  essentiel:  { label: 'Essentiel',  color: '#2D5016', bg: '#EEF4E8' },
  engagement: { label: 'Engagement', color: '#E8832A', bg: '#FEF3E8' },
};

const LEVELS = [
  { name: 'Graine',      emoji: '🌱', min: 0 },
  { name: 'Solidaire',   emoji: '🤝', min: 1000 },
  { name: 'Bienfaiteur', emoji: '⭐', min: 5000 },
  { name: 'Ambassadeur', emoji: '🏆', min: 15000 },
];

function getLevel(total: number) {
  return [...LEVELS].reverse().find((l) => total >= l.min) ?? LEVELS[0];
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [contributor, setContributor] = useState<ContributorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/auth/login'); return; }

    const [{ data: prof }, { data: contrib }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('contributor_profiles').select('*').eq('profile_id', user.id).single(),
    ]);

    setProfile(prof);
    setContributor(contrib);
    setFullName(prof?.full_name ?? '');
    setLoading(false);
  }

  async function saveName() {
    if (!fullName.trim() || !profile) return;
    setSaving(true);
    await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', profile.id);
    setProfile((p) => p ? { ...p, full_name: fullName.trim() } : p);
    setSaving(false);
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/auth/login');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7F4]">
        <div className="w-10 h-10 border-4 border-[#2D5016] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const initials = (profile?.full_name ?? '?').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  const tier = contributor?.subscription_tier ?? 'free';
  const tierCfg = TIER_LABELS[tier] ?? TIER_LABELS.free;
  const pointsTotal = contributor?.points_total ?? 0;
  const level = getLevel(pointsTotal);
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    : '—';

  return (
    <div className="min-h-screen bg-[#F8F7F4] pb-24">
      {/* Header */}
      <div
        className="text-white px-6 pt-12 pb-24"
        style={{ background: 'linear-gradient(135deg, #2D5016 0%, #3D6B1F 60%, #4A8025 100%)' }}
      >
        <div className="max-w-lg mx-auto">
          <h1 className="font-nunito font-black text-2xl">Mon profil</h1>
          <p className="text-green-200 text-sm mt-1">Gérez vos informations</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 -mt-16 flex flex-col gap-4">
        {/* Avatar card */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-md text-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-3 font-nunito font-black text-2xl text-white"
            style={{ background: 'linear-gradient(135deg, #2D5016, #4A8025)' }}
          >
            {initials}
          </div>

          {/* Level badge */}
          <div className="flex items-center justify-center gap-1.5 mb-3">
            <span>{level.emoji}</span>
            <span
              className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
              style={{ backgroundColor: '#EEF4E8', color: '#2D5016' }}
            >
              {level.name}
            </span>
          </div>

          {saved && (
            <p className="text-[#2D5016] text-sm font-semibold mb-2">✓ Nom mis à jour</p>
          )}

          {editing ? (
            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoFocus
                className="border-2 border-[#2D5016] rounded-xl px-4 py-2.5 text-center text-sm font-semibold focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditing(false); setFullName(profile?.full_name ?? ''); }}
                  className="flex-1 border-2 border-gray-200 text-gray-500 py-2.5 rounded-xl text-sm"
                >
                  Annuler
                </button>
                <button
                  onClick={saveName}
                  disabled={saving || !fullName.trim()}
                  className="flex-1 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                  style={{ backgroundColor: '#2D5016' }}
                >
                  {saving ? '…' : 'Enregistrer'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="font-nunito font-black text-xl text-gray-900">{profile?.full_name || '—'}</p>
              <button onClick={() => setEditing(true)} className="text-xs text-[#2D5016] underline mt-1">
                Modifier le nom
              </button>
            </>
          )}
        </div>

        {/* Account info */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {[
            { label: 'Email', value: profile?.email ?? '—', emoji: '📧' },
            {
              label: 'Forfait',
              value: tierCfg.label,
              emoji: '⚡',
              badge: { label: tierCfg.label, color: tierCfg.color, bg: tierCfg.bg },
            },
            { label: 'Membre depuis', value: memberSince, emoji: '📅' },
          ].map((item, i, arr) => (
            <div
              key={item.label}
              className={`flex items-center gap-4 px-5 py-4 ${i < arr.length - 1 ? 'border-b border-gray-100' : ''}`}
            >
              <span className="text-xl">{item.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 font-semibold">{item.label}</p>
                <p className="text-sm text-gray-800 font-medium truncate">{item.value}</p>
              </div>
              {'badge' in item && item.badge && (
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: item.badge.bg, color: item.badge.color }}
                >
                  {item.badge.label}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Mes statistiques</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { emoji: '⭐', value: pointsTotal >= 1000 ? `${(pointsTotal / 1000).toFixed(1)}k` : pointsTotal, label: 'Points gagnés' },
              { emoji: '🧾', value: contributor?.tickets_scanned ?? 0, label: 'Tickets' },
              { emoji: '🧺', value: contributor?.baskets_funded ?? 0, label: 'Paniers financés' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-xl mb-1">{s.emoji}</div>
                <div className="font-nunito font-black text-lg text-[#2D5016]">{s.value}</div>
                <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick links */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {[
            { label: 'Historique des points', href: '/dashboard/contributor/history',       emoji: '📋' },
            { label: 'Gérer mon forfait',      href: '/dashboard/contributor/subscriptions', emoji: '⚡' },
            { label: 'Communauté & défis',     href: '/dashboard/contributor/community',     emoji: '🌍' },
          ].map((link, i, arr) => (
            <button
              key={link.href}
              onClick={() => router.push(link.href)}
              className={`flex items-center gap-4 px-5 py-4 w-full text-left hover:bg-gray-50 active:bg-gray-100 transition-colors ${i < arr.length - 1 ? 'border-b border-gray-100' : ''}`}
            >
              <span className="text-xl">{link.emoji}</span>
              <span className="flex-1 text-sm font-medium text-gray-800">{link.label}</span>
              <span className="text-gray-300 text-xl">›</span>
            </button>
          ))}
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="w-full border-2 border-red-200 text-red-500 font-semibold py-4 rounded-2xl text-sm hover:bg-red-50 transition-colors"
        >
          Se déconnecter
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
