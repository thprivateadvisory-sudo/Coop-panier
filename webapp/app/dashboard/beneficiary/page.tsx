'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import type { Profile, BeneficiaryProfile, PickupPoint } from '@/lib/types';

const STATUS_CONFIG = {
  active:    { label: 'Carte active', color: '#16A34A', bg: '#EAF9F1', border: '#16A34A' },
  waitlist:  { label: 'Liste d\'attente', color: '#D97706', bg: '#FEF9EC', border: '#D97706' },
  suspended: { label: 'Suspendu', color: '#DC2626', bg: '#FDECEC', border: '#DC2626' },
};

export default function BeneficiaryDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bene, setBene] = useState<BeneficiaryProfile | null>(null);
  const [pickup, setPickup] = useState<PickupPoint | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/auth/login'); return; }

    const [{ data: prof }, { data: beneData }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('beneficiary_profiles').select('*').eq('profile_id', user.id).single(),
    ]);

    setProfile(prof);
    setBene(beneData);

    if (beneData?.pickup_point_id) {
      const { data: pickupData } = await supabase
        .from('pickup_points')
        .select('*')
        .eq('id', beneData.pickup_point_id)
        .single();
      setPickup(pickupData);
    }

    if (beneData?.qr_code) {
      const QRCode = (await import('qrcode')).default;
      const payload = JSON.stringify({ id: user.id, qr: beneData.qr_code, ts: Date.now() });
      const url = await QRCode.toDataURL(payload, { width: 280, margin: 2, color: { dark: '#2D5016', light: '#FFFFFF' } });
      setQrDataUrl(url);
    }

    setLoading(false);
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

  const status = bene?.status ?? 'waitlist';
  const cfg = STATUS_CONFIG[status];

  return (
    <div className="min-h-screen bg-[#F8F7F4]">
      <div className="bg-[#2D5016] text-white px-6 pt-12 pb-20">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <Image src="/logo.png" alt="Coop'Panier" width={140} height={50} className="brightness-0 invert mb-1" />
            <p className="text-green-200 text-sm">{profile?.full_name}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-sm text-green-200 hover:text-white transition-colors"
          >
            Déconnexion
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 -mt-14 pb-12 flex flex-col gap-5">
        {/* QR Card */}
        <div
          className="bg-white rounded-2xl p-6 shadow-sm text-center"
          style={{ border: `2px solid ${cfg.border}` }}
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold mb-5"
            style={{ backgroundColor: cfg.bg, color: cfg.color }}
          >
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
            {cfg.label}
          </div>

          {status === 'active' && qrDataUrl ? (
            <>
              <img src={qrDataUrl} alt="QR Code bénéficiaire" className="w-48 h-48 mx-auto rounded-xl mb-4" />
              <p className="text-xs text-gray-400">Présentez ce code lors de la distribution</p>
            </>
          ) : status === 'waitlist' ? (
            <div className="py-8">
              <div className="text-5xl mb-4">⏳</div>
              <p className="font-nunito font-bold text-gray-700 text-lg">En liste d'attente</p>
              <p className="text-sm text-gray-400 mt-2">
                Vous serez notifié dès qu'une place se libère dans votre zone.
              </p>
            </div>
          ) : (
            <div className="py-8">
              <div className="text-5xl mb-4">🔒</div>
              <p className="font-nunito font-bold text-gray-700 text-lg">Carte suspendue</p>
              <p className="text-sm text-gray-400 mt-2">Contactez votre association pour plus d'informations.</p>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#EEF4E8] flex items-center justify-center text-2xl">
              🧺
            </div>
            <div>
              <p className="font-nunito font-black text-2xl text-[#2D5016]">
                {bene?.baskets_received ?? 0}
              </p>
              <p className="text-sm text-gray-500">panier{(bene?.baskets_received ?? 0) > 1 ? 's' : ''} reçu{(bene?.baskets_received ?? 0) > 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>

        {/* Pickup point */}
        {pickup && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Point de retrait</p>
            <div className="flex items-start gap-3">
              <span className="text-2xl">📍</span>
              <div>
                <p className="font-nunito font-bold text-gray-900">{pickup.name}</p>
                <p className="text-sm text-gray-500 mt-0.5">{pickup.address}</p>
                {bene?.next_pickup_date && (
                  <p className="text-sm text-[#2D5016] font-semibold mt-2">
                    Prochain retrait : {new Date(bene.next_pickup_date).toLocaleDateString('fr-FR')}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
