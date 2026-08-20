'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) { setError('Minimum 6 caractères'); return; }
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas'); return; }
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setDone(true);
    setTimeout(() => router.push('/dashboard'), 2000);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6 bg-[#F8F7F4]">
      <Image src="/logo.png" alt="Coop'Panier" width={180} height={66} className="mx-auto" priority />

      <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-sm border border-gray-100">
        {done ? (
          <div className="text-center py-4">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="font-nunito font-black text-xl text-gray-900 mb-2">Mot de passe mis à jour !</h2>
            <p className="text-gray-500 text-sm">Redirection en cours…</p>
          </div>
        ) : (
          <>
            <h2 className="font-nunito font-black text-xl text-gray-900 mb-1">Nouveau mot de passe</h2>
            <p className="text-gray-500 text-sm mb-6">Choisissez un mot de passe sécurisé.</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                  Nouveau mot de passe
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#2D5016]"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                  Confirmer
                </label>
                <input
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
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
                className="w-full bg-[#2D5016] text-white font-nunito font-black py-4 rounded-xl text-base disabled:opacity-60"
              >
                {loading ? '…' : 'Enregistrer'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
