'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/lib/types';

const ROLES: { value: UserRole; label: string; emoji: string; desc: string }[] = [
  { value: 'contributor', label: 'Contributeur', emoji: '🛒', desc: 'Je scanne mes tickets et finance des paniers' },
  { value: 'beneficiary', label: 'Bénéficiaire', emoji: '🧺', desc: 'Je bénéficie des paniers solidaires' },
  { value: 'association', label: 'Association', emoji: '🤝', desc: 'Je distribue les paniers dans ma structure' },
];

type Mode = 'login' | 'signup' | 'forgot';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [role, setRole] = useState<UserRole>('contributor');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/dashboard');

      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName, role } },
        });
        if (error) throw error;

        // No session = email already used OR confirmation required
        if (!data.session) {
          setInfo('Un email de confirmation a été envoyé. Vérifiez votre boîte mail, ou connectez-vous si vous avez déjà un compte.');
          setLoading(false);
          return;
        }

        if (data.user) {
          const { error: profErr } = await supabase.from('profiles').upsert(
            { id: data.user.id, email, full_name: fullName, role },
            { onConflict: 'id' }
          );
          if (profErr) throw profErr;

          if (role === 'contributor') {
            const { error: e } = await supabase.from('contributor_profiles').upsert(
              { profile_id: data.user.id, subscription_tier: 'free', points_available: 0, points_total: 0, tickets_scanned: 0, baskets_funded: 0 },
              { onConflict: 'profile_id' }
            );
            if (e) throw e;
          } else if (role === 'beneficiary') {
            const { error: e } = await supabase.from('beneficiary_profiles').upsert(
              { profile_id: data.user.id, status: 'waitlist', baskets_received: 0 },
              { onConflict: 'profile_id' }
            );
            if (e) throw e;
          } else if (role === 'association') {
            const { error: e } = await supabase.from('association_profiles').upsert(
              { profile_id: data.user.id, name: fullName },
              { onConflict: 'profile_id' }
            );
            if (e) throw e;
          }
          router.push('/dashboard');
        }

      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
        });
        if (error) throw error;
        setInfo('Un lien de réinitialisation a été envoyé à ' + email);
      }
    } catch (err: any) {
      setError(err.message ?? 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6 bg-[#F8F7F4]">
      <div className="text-center">
        <Image src="/logo.png" alt="Coop'Panier" width={220} height={80} className="mx-auto" priority />
        <p className="text-gray-500 text-sm mt-2">Solidarité alimentaire</p>
      </div>

      <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-sm border border-gray-100">
        {mode !== 'forgot' && (
          <div className="flex rounded-xl bg-gray-100 p-1 mb-6">
            {(['login', 'signup'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); setInfo(''); }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                {m === 'login' ? 'Se connecter' : 'Créer un compte'}
              </button>
            ))}
          </div>
        )}

        {mode === 'forgot' && (
          <div className="mb-6">
            <button onClick={() => { setMode('login'); setError(''); setInfo(''); }} className="text-sm text-gray-400 flex items-center gap-1 mb-4">
              ‹ Retour
            </button>
            <h2 className="font-nunito font-black text-xl text-gray-900 mb-1">Mot de passe oublié</h2>
            <p className="text-gray-500 text-sm">Entrez votre email pour recevoir un lien de réinitialisation.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'signup' && (
            <>
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
            </>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="marie@exemple.fr"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#2D5016]"
            />
          </div>

          {mode !== 'forgot' && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                Mot de passe
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#2D5016]"
              />
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>
          )}
          {info && (
            <div className="bg-[#EEF4E8] border border-[#2D5016]/20 rounded-xl px-4 py-3 text-sm text-[#2D5016]">{info}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2D5016] text-white font-nunito font-black py-4 rounded-xl text-base disabled:opacity-60 hover:opacity-90 transition-opacity"
          >
            {loading ? '…' : mode === 'login' ? 'Se connecter' : mode === 'signup' ? 'Créer mon compte' : 'Envoyer le lien'}
          </button>
        </form>

        {mode === 'login' && (
          <button
            onClick={() => { setMode('forgot'); setError(''); setInfo(''); }}
            className="w-full mt-3 text-sm text-gray-400 hover:text-gray-600 transition-colors text-center"
          >
            Mot de passe oublié ?
          </button>
        )}
      </div>
    </div>
  );
}
