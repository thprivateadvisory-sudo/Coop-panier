'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '../_components/BottomNav';

type Transaction = {
  id: string;
  amount_eur: number;
  points_earned: number;
  multiplier: number;
  created_at: string;
};

function groupByMonth(txs: Transaction[]) {
  const groups: Record<string, Transaction[]> = {};
  for (const tx of txs) {
    const key = new Date(tx.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    if (!groups[key]) groups[key] = [];
    groups[key].push(tx);
  }
  return groups;
}

export default function HistoryPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }

      const { data } = await supabase
        .from('point_transactions')
        .select('*')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false });

      setTransactions(data ?? []);
      setLoading(false);
    }
    load();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7F4]">
        <div className="w-10 h-10 border-4 border-[#2D5016] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const groups = groupByMonth(transactions);
  const totalPoints = transactions.reduce((s, t) => s + t.points_earned, 0);

  return (
    <div className="min-h-screen bg-[#F8F7F4] pb-24">
      {/* Header */}
      <div
        className="text-white px-6 pt-12 pb-10"
        style={{ background: 'linear-gradient(135deg, #2D5016 0%, #3D6B1F 100%)' }}
      >
        <div className="max-w-lg mx-auto flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/contributor')}
            className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-xl"
          >
            ‹
          </button>
          <div>
            <h1 className="font-nunito font-black text-xl">Historique des points</h1>
            {transactions.length > 0 && (
              <p className="text-green-200 text-sm">
                {transactions.length} ticket{transactions.length > 1 ? 's' : ''} · {totalPoints.toLocaleString('fr-FR')} pts gagnés
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 pt-5 flex flex-col gap-6">
        {transactions.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 border border-gray-100 text-center">
            <div className="text-5xl mb-4">🧾</div>
            <p className="font-nunito font-bold text-gray-700 text-lg mb-2">Aucun ticket scanné</p>
            <p className="text-sm text-gray-400 mb-6">Scannez votre premier ticket de caisse pour gagner des points.</p>
            <button
              onClick={() => router.push('/dashboard/contributor/scan')}
              className="font-nunito font-black px-6 py-3 rounded-xl text-white text-sm"
              style={{ background: 'linear-gradient(135deg, #E8832A, #F09840)' }}
            >
              📸 Scanner un ticket
            </button>
          </div>
        ) : (
          Object.entries(groups).map(([month, txs]) => {
            const monthTotal = txs.reduce((s, t) => s + t.points_earned, 0);
            return (
              <div key={month}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide capitalize">{month}</p>
                  <p className="text-xs font-semibold text-[#2D5016]">+{monthTotal.toLocaleString('fr-FR')} pts</p>
                </div>
                <div className="flex flex-col gap-2">
                  {txs.map((tx) => {
                    const date = new Date(tx.created_at);
                    const multiLabel = tx.multiplier > 1
                      ? { text: `×${tx.multiplier}`, bg: tx.multiplier === 4 ? '#FEF3E8' : '#EEF4E8', color: tx.multiplier === 4 ? '#E8832A' : '#2D5016' }
                      : null;
                    return (
                      <div key={tx.id} className="bg-white rounded-xl px-4 py-3.5 border border-gray-100 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-[#EEF4E8] flex items-center justify-center text-lg flex-shrink-0">
                          🧾
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm">
                            {tx.amount_eur.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à{' '}
                            {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {multiLabel && (
                            <span
                              className="text-xs font-semibold px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: multiLabel.bg, color: multiLabel.color }}
                            >
                              {multiLabel.text}
                            </span>
                          )}
                          <p className="font-nunito font-black text-[#2D5016] text-lg">
                            +{tx.points_earned.toLocaleString('fr-FR')}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      <BottomNav />
    </div>
  );
}
