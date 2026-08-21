'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/lib/types';

const ROLES: { value: UserRole; label: string; emoji: string; desc: string }[] = [
  { value: 'contributor', label: 'Contributeur', emoji: '🛒', desc: 'Je scanne mes tickets et finance des paniers' },
  { value: 'beneficiary', label: 'Bénéficiaire', emoji: '🧺', desc: 'Je bénéficie des paniers solidaires' },
  { value: 'association', label: 'Association', emoji: '🤝', desc: 'Je distribue les paniers dans ma structure' },
];

function SetupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [role, setRole] = useState<UserRole>('contributor');
  const [fullName, setFullName] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState('');
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) setReferralCode(refCode.toUpperCase());

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth/login'); return; }
      setUserId(user.id);
      setUserEmail(user.email ?? '');
      if (user.user_metadata?.full_name) setFullName(user.user_metadata.full_name);

      const { data: existing } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (existing?.role) {
        window.location.href = `/dashboard/${existing.role === 'contributor' ? 'contributor' : existing.role === 'beneficiary' ? 'beneficiary' : 'association'}`;
      }
    });
  }, [router, searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) { setError('Entrez votre prénom et nom'); return; }
    setError('');
    setLoading(true);

    try {
      const { error: rpcErr } = await supabase.rpc('create_user_profile', {
        p_user_id: userId,
        p_email: userEmail,
        p_full_name: fullName.trim(),
        p_role: role,
        p_referral_code: referralCode.trim() || null,
      });
      if (rpcErr) throw rpcErr;

      window.location.href =
        role === 'contributor' ? '/dashboard/contributor'
        : role === 'beneficiary' ? '/dashboard/beneficiary'
        : '/dashboard/association';

    } catch (err: any) {
      setError(err.message ?? 'Une erreur est survenue');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6 bg-[#F8F7F4]">
      <div className="text-center">
        <Image src="/logo.png" alt="Coop'Panier" width={220} height={80} className="mx-auto" priority />
        <p className="text-gray-500 text-sm mt-2">Finalisons votre inscription</p>
      </div>

      <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-sm border border-gray-100">
        <h2 className="font-nunito font-black text-xl text-gray-900 mb-6">Qui êtes-vous ?</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
              Prénom et nom
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Marie Dupont"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#2D5016]"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
              Je suis un…
            </label>
            <div className="flex flex-col gap-2">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                    role === r.value ? 'border-[#2D5016] bg-[#EEF4E8]' : 'border-gray-200 bg-white'
                  }`}
                >
                  <span className="text-2xl">{r.emoji}</span>
                  <div>
                    <div className="font-semibold text-sm text-gray-900">{r.label}</div>
                    <div className="text-xs text-gray-500">{r.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {role === 'contributor' && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                Code de parrainage <span className="text-gray-300 normal-case font-normal">(facultatif)</span>
              </label>
              <input
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                placeholder="Ex : X3K9PL"
                maxLength={6}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#2D5016] font-mono tracking-widest"
              />
              {referralCode && (
                <p className="text-xs text-[#2D5016] mt-1">+50 pts offerts à l'inscription !</p>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !userId}
            className="w-full bg-[#2D5016] text-white font-nunito font-black py-4 rounded-xl text-base disabled:opacity-60 hover:opacity-90 transition-opacity"
          >
            {loading ? '…' : 'Accéder à mon espace'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function SetupPage() {
  return (
    <Suspense>
      <SetupForm />
    </Suspense>
  );
}
