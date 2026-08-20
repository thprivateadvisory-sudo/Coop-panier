'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import type { Profile, BeneficiaryProfile, PickupPoint } from '@/lib/types';

const STATUS_CONFIG = {
  active:    { label: 'Carte active',    color: '#16A34A', bg: '#EAF9F1', border: '#16A34A' },
  waitlist:  { label: 'Liste d\'attente', color: '#D97706', bg: '#FEF9EC', border: '#D97706' },
  suspended: { label: 'Suspendu',         color: '#DC2626', bg: '#FDECEC', border: '#DC2626' },
};

export default function BeneficiaryDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bene, setBene] = useState<BeneficiaryProfile | null>(null);
  const [pickup, setPickup] = useState<PickupPoint | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [loading, setLoading] = useState(true);

  // Join pickup point flow
  const [availablePickups, setAvailablePickups] = useState<PickupPoint[]>([]);
  const [joining, setJoining] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  useEffect(() => { loadData(); }, []);

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
    } else {
      // Load available pickup points to join
      const { data: pickups } = await supabase
        .from('pickup_points')
        .select('*')
        .eq('active', true);
      setAvailablePickups(pickups ?? []);
    }

    if (beneData?.qr_code && beneData?.status === 'active') {
      const QRCode = (await import('qrcode')).default;
      const payload = JSON.stringify({ id: user.id, qr: beneData.qr_code, ts: Date.now() });
      const url = await QRCode.toDataURL(payload, {
        width: 280,
        margin: 2,
        color: { dark: '#2D5016', light: '#FFFFFF' },
      });
      setQrDataUrl(url);
    }

    setLoading(false);
  }

  async function joinPickupPoint(pickupPointId: string) {
    setJoining(pickupPointId);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('beneficiary_profiles')
      .update({ pickup_point_id: pickupPointId, status: 'waitlist' })
      .eq('profile_id', user.id);

    const chosen = availablePickups.find((p) => p.id === pickupPointId) ?? null;
    setPickup(chosen);
    setBene((prev) => prev ? { ...prev, pickup_point_id: pickupPointId, status: 'waitlist' } : prev);
    setJoining(null);
    setJoined(true);
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

  // No pickup point yet → join flow
  if (!bene?.pickup_point_id && !joined) {
    return (
      <div className="min-h-screen bg-[#F8F7F4]">
        <div className="bg-[#2D5016] text-white px-6 pt-12 pb-20">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <div>
              <Image src="/logo.png" alt="Coop'Panier" width={140} height={50} className="brightness-0 invert mb-1" />
              <p className="text-green-200 text-sm">{profile?.full_name}</p>
            </div>
            <button onClick={handleSignOut} className="text-sm text-green-200 hover:text-white transition-colors">
              Déconnexion
            </button>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-6 -mt-14 pb-12 flex flex-col gap-4">
          <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center">
            <div className="text-4xl mb-3">🧺</div>
            <h2 className="font-nunito font-black text-xl text-gray-900 mb-2">
              Rejoignez un point de retrait
            </h2>
            <p className="text-sm text-gray-500">
              Choisissez le point de distribution le plus proche de chez vous.
            </p>
          </div>

          {availablePickups.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-gray-100 text-center">
              <div className="text-3xl mb-3">😔</div>
              <p className="font-semibold text-gray-700 mb-1">Aucun point disponible</p>
              <p className="text-sm text-gray-400">
                Aucune association n'a encore créé de point de retrait dans votre zone.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {availablePickups.map((p) => (
                <div key={p.id} className="bg-white rounded-xl p-4 border border-gray-100 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#EEF4E8] flex items-center justify-center text-2xl flex-shrink-0">
                    📍
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-nunito font-bold text-gray-900 truncate">{p.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{p.address}</p>
                  </div>
                  <button
                    onClick={() => joinPickupPoint(p.id)}
                    disabled={!!joining}
                    className="bg-[#2D5016] text-white text-xs font-semibold px-4 py-2 rounded-xl disabled:opacity-50 flex-shrink-0"
                  >
                    {joining === p.id ? '…' : 'Rejoindre'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
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
          <button onClick={handleSignOut} className="text-sm text-green-200 hover:text-white transition-colors">
            Déconnexion
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 -mt-14 pb-12 flex flex-col gap-5">
        {/* Success banner after joining */}
        {joined && (
          <div className="bg-[#EEF4E8] border-2 border-[#2D5016] rounded-2xl p-4 text-center">
            <p className="font-nunito font-bold text-[#2D5016] text-sm">
              ✓ Demande envoyée ! L'association vous activera prochainement.
            </p>
          </div>
        )}

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
            <div className="w-12 h-12 rounded-full bg-[#EEF4E8] flex items-center justify-center text-2xl">🧺</div>
            <div>
              <p className="font-nunito font-black text-2xl text-[#2D5016]">{bene?.baskets_received ?? 0}</p>
              <p className="text-sm text-gray-500">
                panier{(bene?.baskets_received ?? 0) > 1 ? 's' : ''} reçu{(bene?.baskets_received ?? 0) > 1 ? 's' : ''}
              </p>
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
