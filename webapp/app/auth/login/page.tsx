'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/lib/types';

const ROLES: { value: UserRole; label: string; emoji: string; desc: string }[] = [
  { value: 'contributor', label: 'Contributeur', emoji: '🛒', desc: 'Je scanne mes tickets et finance des paniers' },
  { value: 'beneficiary', label: 'Bénéficiaire', emoji: '🧺', desc: 'Je bénéficie des paniers solidaires' },
  { value: 'association', label: 'Association', emoji: '🤝', desc: 'Je distribue les paniers dans ma structure' },
];

type Mode = 'login' | 'signup' | 'forgot';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>(() =>
    searchParams.get('mode') === 'signup' ? 'signup' : 'login'
  );
  const [role, setRole] = useState<UserRole>('contributor');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    const urlError = searchParams.get('error');
    if (urlError) setError(decodeURIComponent(urlError));
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = '/dashboard';

      } else if (mode === 'signup') {
        if (password.length < 8) {
          setError('Le mot de passe doit contenir au moins 8 caractères.');
          setLoading(false);
          return;
        }
        // Route serveur avec API admin → pas de rate limit email Supabase
        const resp = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, fullName, role }),
        });
        const result = await resp.json();
        if (!resp.ok) throw new Error(result.error ?? 'Erreur lors de la création du compte.');

        // Connexion automatique — le compte est déjà confirmé
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        window.location.href = '/auth/setup';

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
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#2D5016]"
              />
              {mode === 'signup' && (
                <p className="text-xs text-gray-400 mt-1">8 caractères minimum</p>
              )}
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

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
