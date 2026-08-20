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

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [role, setRole] = useState<UserRole>('contributor');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [magicSent, setMagicSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/dashboard');
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName, role } },
        });
        if (error) throw error;
        if (data.user) {
          await supabase.from('profiles').insert({
            id: data.user.id,
            email,
            full_name: fullName,
            role,
          });
          if (role === 'contributor') {
            await supabase.from('contributor_profiles').insert({ profile_id: data.user.id });
          } else if (role === 'beneficiary') {
            await supabase.from('beneficiary_profiles').insert({ profile_id: data.user.id });
          } else if (role === 'association') {
            await supabase.from('association_profiles').insert({
              profile_id: data.user.id,
              name: fullName,
            });
          }
          router.push('/dashboard');
        }
      }
    } catch (err: any) {
      setError(err.message ?? 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLink() {
    if (!email) { setError('Entrez votre email'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setMagicSent(true);
  }

  if (magicSent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-sm border border-gray-100">
          <div className="text-5xl mb-4">📧</div>
          <h2 className="font-nunito font-black text-2xl text-gray-900 mb-2">Vérifiez vos mails</h2>
          <p className="text-gray-500 text-sm">Un lien de connexion a été envoyé à <strong>{email}</strong></p>
          <button onClick={() => setMagicSent(false)} className="mt-6 text-sm text-gray-400 underline">
            Retour
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6">
      {/* Logo */}
      <div className="text-center">
        <Image src="/logo.png" alt="Coop'Panier" width={220} height={80} className="mx-auto" priority />
        <p className="text-gray-500 text-sm mt-2">Solidarité alimentaire</p>
      </div>

      <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-sm border border-gray-100">
        {/* Tabs */}
        <div className="flex rounded-xl bg-gray-100 p-1 mb-6">
          {(['login', 'signup'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              {m === 'login' ? 'Se connecter' : 'Créer un compte'}
            </button>
          ))}
        </div>

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
                        role === r.value
                          ? 'border-[#2D5016] bg-[#EEF4E8]'
                          : 'border-gray-200 bg-white'
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
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="marie@exemple.fr"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#2D5016]"
            />
          </div>

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

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2D5016] text-white font-nunito font-black py-4 rounded-xl text-base disabled:opacity-60 hover:opacity-90 transition-opacity"
          >
            {loading ? '…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <span className="text-gray-300 text-sm">ou</span>
        </div>

        <button
          onClick={handleMagicLink}
          disabled={loading}
          className="w-full mt-3 border-2 border-gray-200 text-gray-600 font-semibold py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors"
        >
          ✉️ Lien de connexion par email
        </button>
      </div>
    </div>
  );
}
