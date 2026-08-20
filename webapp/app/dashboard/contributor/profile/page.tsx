'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import type { Profile, ContributorProfile } from '@/lib/types';

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [contributor, setContributor] = useState<ContributorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#2D5016] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const initials = (profile?.full_name ?? '?').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  const tier = contributor?.subscription_tier ?? 'free';
  const tierLabel = tier === 'engagement' ? 'Engagement' : tier === 'essentiel' ? 'Essentiel' : 'Gratuit';

  return (
    <div className="min-h-screen bg-[#F8F7F4]">
      {/* Header */}
      <div className="bg-[#2D5016] text-white px-6 pt-12 pb-20">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <Image src="/logo.png" alt="Coop'Panier" width={140} height={50} className="brightness-0 invert mb-1" />
            <p className="text-green-200 text-sm">Mon profil</p>
          </div>
          <button onClick={() => router.push('/dashboard/contributor')} className="text-sm text-green-200 hover:text-white">
            ← Retour
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 -mt-14 pb-12 flex flex-col gap-4">
        {/* Avatar + identity */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center">
          <div className="w-20 h-20 rounded-full bg-[#EEF4E8] flex items-center justify-center mx-auto mb-3 font-nunito font-black text-2xl text-[#2D5016]">
            {initials}
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
                className="border-2 border-[#2D5016] rounded-xl px-4 py-2 text-center text-sm font-semibold focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditing(false); setFullName(profile?.full_name ?? ''); }}
                  className="flex-1 border-2 border-gray-200 text-gray-500 py-2 rounded-xl text-sm"
                >
                  Annuler
                </button>
                <button
                  onClick={saveName}
                  disabled={saving || !fullName.trim()}
                  className="flex-1 bg-[#2D5016] text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
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

        {/* Info */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {[
            { label: 'Email', value: profile?.email ?? '—', emoji: '📧' },
            { label: 'Abonnement', value: tierLabel, emoji: '⚡' },
            { label: 'Membre depuis', value: profile?.created_at ? new Date(profile.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '—', emoji: '📅' },
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
            </div>
          ))}
        </div>

        {/* Stats recap */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Mes statistiques</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { emoji: '⭐', value: (contributor?.points_total ?? 0).toLocaleString('fr-FR'), label: 'Points gagnés' },
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

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="w-full border-2 border-red-200 text-red-500 font-semibold py-4 rounded-2xl text-sm hover:bg-red-50 transition-colors"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
