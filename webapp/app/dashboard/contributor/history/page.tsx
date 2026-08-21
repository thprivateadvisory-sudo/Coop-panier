'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '../_components/BottomNav';

type Transaction = {
  id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
};

const TYPE_LABEL: Record<string, string> = {
  earn_scan:     'Ticket scanné',
  earn_purchase: 'Achat',
  earn_bonus:    'Bonus',
  spend_basket:  'Panier financé',
  expire:        'Points expirés',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export default function HistoryPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/auth/login'); return; }

    const { data } = await supabase
      .from('point_transactions')
      .select('id, amount, type, description, created_at')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    setTransactions((data ?? []) as Transaction[]);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7F4]">
        <div className="w-10 h-10 border-4 border-[#2D5016] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const earnTxs = transactions.filter((t) => t.amount > 0);
  const totalPoints = earnTxs.reduce((s, t) => s + t.amount, 0);
  const totalScans = transactions.filter((t) => t.type === 'earn_scan').length;
  const totalSpent = transactions.filter((t) => t.type === 'spend_basket').reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <div className="min-h-screen bg-[#F8F7F4] pb-24">
      <div
        className="text-white px-6 pt-12 pb-20"
        style={{ background: 'linear-gradient(135deg, #2D5016 0%, #3D6B1F 60%, #4A8025 100%)' }}
      >
        <div className="max-w-lg mx-auto">
          <Image src="/logo.png" alt="Coop'Panier" width={120} height={44} className="brightness-0 invert mb-3" />
          <h1 className="font-nunito font-black text-2xl">Historique</h1>
          <p className="text-green-200 text-sm mt-1">Tous vos mouvements de points</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 -mt-12 flex flex-col gap-4 pb-6">
        {/* Summary */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Résumé</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { emoji: '🧾', value: totalScans, label: 'Tickets' },
              { emoji: '⭐', value: totalPoints >= 1000 ? `${(totalPoints / 1000).toFixed(1)}k` : totalPoints, label: 'Pts gagnés' },
              { emoji: '🧺', value: totalSpent >= 1000 ? `${(totalSpent / 1000).toFixed(1)}k` : totalSpent, label: 'Pts dépensés' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-2xl mb-1">{s.emoji}</div>
                <div className="font-nunito font-black text-lg text-[#2D5016]">{s.value}</div>
                <div className="text-xs text-gray-400 leading-tight">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {transactions.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center border border-gray-100">
            <div className="text-5xl mb-4">🧾</div>
            <p className="font-nunito font-bold text-gray-700 mb-1">Aucun mouvement</p>
            <p className="text-sm text-gray-400 mb-5">Scannez votre premier ticket pour gagner des points.</p>
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
            {transactions.map((tx) => {
              const isEarn = tx.amount > 0;
              return (
                <div
                  key={tx.id}
                  className="bg-white rounded-xl p-4 border border-gray-100 flex items-center gap-4"
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
                    style={{ background: isEarn ? 'linear-gradient(135deg, #EEF4E8, #D8ECC8)' : 'linear-gradient(135deg, #FEF3E8, #FDE5C8)' }}
                  >
                    {isEarn ? '🧾' : '🧺'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{TYPE_LABEL[tx.type] ?? tx.type}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDate(tx.created_at)} · {formatTime(tx.created_at)}
                    </p>
                    {tx.description && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{tx.description}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p
                      className="font-nunito font-black text-base"
                      style={{ color: isEarn ? '#2D5016' : '#E8832A' }}
                    >
                      {isEarn ? '+' : ''}{tx.amount.toLocaleString('fr-FR')} pts
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
