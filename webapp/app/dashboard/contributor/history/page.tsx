'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '../_components/BottomNav';

type Transaction = {
  id: string;
  amount_eur: number;
  points_earned: number;
  multiplier: number;
  created_at: string;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export default function HistoryPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPoints, setTotalPoints] = useState(0);
  const [totalEuros, setTotalEuros] = useState(0);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/auth/login'); return; }

    const { data } = await supabase
      .from('point_transactions')
      .select('id, amount_eur, points_earned, multiplier, created_at')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    const txs = (data ?? []) as Transaction[];
    setTransactions(txs);
    setTotalPoints(txs.reduce((s, t) => s + t.points_earned, 0));
    setTotalEuros(txs.reduce((s, t) => s + t.amount_eur, 0));
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7F4]">
        <div className="w-10 h-10 border-4 border-[#2D5016] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F7F4] pb-24">
      <div
        className="text-white px-6 pt-12 pb-20"
        style={{ background: 'linear-gradient(135deg, #2D5016 0%, #3D6B1F 60%, #4A8025 100%)' }}
      >
        <div className="max-w-lg mx-auto">
          <Image src="/logo.png" alt="Coop'Panier" width={120} height={44} className="brightness-0 invert mb-3" />
          <h1 className="font-nunito font-black text-2xl">Historique</h1>
          <p className="text-green-200 text-sm mt-1">Vos tickets scannés</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 -mt-12 flex flex-col gap-4 pb-6">
        {/* Summary card */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Résumé</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { emoji: '🧾', value: transactions.length, label: 'Tickets' },
              { emoji: '💶', value: `${totalEuros.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`, label: 'Total dépensé' },
              { emoji: '⭐', value: totalPoints >= 1000 ? `${(totalPoints / 1000).toFixed(1)}k` : totalPoints, label: 'Points gagnés' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-2xl mb-1">{s.emoji}</div>
                <div className="font-nunito font-black text-lg text-[#2D5016]">{s.value}</div>
                <div className="text-xs text-gray-400 leading-tight">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Transactions list */}
        {transactions.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center border border-gray-100">
            <div className="text-5xl mb-4">🧾</div>
            <p className="font-nunito font-bold text-gray-700 mb-1">Aucun ticket scanné</p>
            <p className="text-sm text-gray-400 mb-5">Scannez votre premier ticket de caisse pour gagner des points.</p>
            <button
              onClick={() => router.push('/dashboard/contributor/scan')}
              className="font-nunito font-black px-6 py-3 rounded-xl text-white text-sm"
              style={{ background: 'linear-gradient(135deg, #E8832A, #F09840)' }}
            >
              Scanner un ticket
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="bg-white rounded-xl p-4 border border-gray-100 flex items-center gap-4"
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
                  style={{ background: 'linear-gradient(135deg, #EEF4E8, #D8ECC8)' }}
                >
                  🧾
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">Ticket de caisse</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDate(tx.created_at)} · {formatTime(tx.created_at)}
                  </p>
                  {tx.multiplier > 1 && (
                    <p className="text-xs text-[#2D5016] mt-0.5">×{tx.multiplier} multiplicateur</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-nunito font-black text-[#2D5016] text-base">
                    +{tx.points_earned.toLocaleString('fr-FR')} pts
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {tx.amount_eur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
