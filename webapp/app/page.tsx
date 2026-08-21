'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.push('/dashboard');
      else setChecking(false);
    });
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7F4]">
        <div className="w-10 h-10 border-4 border-[#2D5016] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F7F4] flex flex-col">
      {/* Hero — fills the full viewport */}
      <div
        className="text-white px-6 pt-16 pb-36 relative overflow-hidden flex flex-col justify-between"
        style={{
          background: 'linear-gradient(160deg, #1e3a0f 0%, #2D5016 45%, #3D6B1F 100%)',
          minHeight: '100svh',
        }}
      >
        <div className="max-w-lg mx-auto w-full relative z-10 flex flex-col flex-1">
          <Image src="/logo.png" alt="Coop'Panier" width={160} height={58} className="brightness-0 invert mb-10" priority />
          <div className="flex-1 flex flex-col justify-center">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1.5 mb-6 w-fit">
              <span className="w-2 h-2 rounded-full bg-[#E8832A] flex-shrink-0" />
              <span className="text-green-200 text-xs font-semibold tracking-wide uppercase">Application disponible</span>
            </div>
            <h1 className="font-nunito font-black text-[2.6rem] leading-[1.08] mb-4">
              La solidarité<br />alimentaire,<br /><span className="text-[#a8d080]">ensemble.</span>
            </h1>
            <p className="text-green-200/90 text-base leading-relaxed mb-10">
              Scannez vos tickets de caisse, gagnez des points et financez des paniers pour ceux qui en ont besoin.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => router.push('/auth/login')}
              className="w-full bg-white text-[#2D5016] font-nunito font-black py-4 rounded-2xl text-lg hover:bg-green-50 transition-colors shadow-lg"
            >
              Commencer gratuitement
            </button>
            <button
              onClick={() => router.push('/auth/login')}
              className="w-full border-2 border-white/30 text-white font-semibold py-3.5 rounded-2xl text-base hover:bg-white/10 transition-colors"
            >
              J'ai déjà un compte
            </button>
          </div>
        </div>

        {/* Decorative shapes */}
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-white/5" />
        <div className="absolute top-1/3 -right-16 w-48 h-48 rounded-full bg-white/5" />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-white/5" />
      </div>

      {/* Role cards + stats */}
      <div className="max-w-lg mx-auto px-6 -mt-16 flex flex-col gap-4 pb-12">
        {[
          {
            emoji: '🛒',
            title: 'Contributeurs',
            desc: 'Scannez vos tickets de caisse et gagnez des points à chaque achat. Vos points financent des paniers solidaires.',
            color: '#2D5016',
            bg: '#EEF4E8',
          },
          {
            emoji: '🧺',
            title: 'Bénéficiaires',
            desc: 'Rejoignez un point de retrait près de chez vous et recevez votre panier solidaire grâce à votre QR code personnel.',
            color: '#2D5016',
            bg: '#EEF4E8',
          },
          {
            emoji: '🤝',
            title: 'Associations',
            desc: 'Gérez votre point de retrait, suivez vos bénéficiaires et distribuez les paniers en scannant leurs QR codes.',
            color: '#E8832A',
            bg: '#FEF3E8',
          },
        ].map((item) => (
          <div key={item.title} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
              style={{ backgroundColor: item.bg }}
            >
              {item.emoji}
            </div>
            <div>
              <h3 className="font-nunito font-black text-gray-900 text-lg mb-1">{item.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
            </div>
          </div>
        ))}

        {/* Stats */}
        <div
          className="rounded-2xl p-6 mt-2"
          style={{ background: 'linear-gradient(135deg, #2D5016, #4A8025)' }}
        >
          <p className="text-green-200 text-xs font-semibold uppercase tracking-wide mb-4">Impact collectif</p>
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { value: '10 pts', label: 'par euro dépensé' },
              { value: '500 pts', label: '= 1 panier financé' },
              { value: '20 €', label: 'de valeur par panier' },
            ].map((s) => (
              <div key={s.label}>
                <div className="font-nunito font-black text-white text-xl leading-tight">{s.value}</div>
                <div className="text-green-300 text-xs mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => router.push('/auth/login')}
          className="w-full font-nunito font-black py-4 rounded-2xl text-lg text-white mt-2"
          style={{ background: 'linear-gradient(135deg, #E8832A, #F09840)' }}
        >
          Rejoindre Coop'Panier
        </button>

        <p className="text-center text-xs text-gray-400 pb-4">
          Gratuit · Sans engagement · Impact immédiat
        </p>
      </div>
    </div>
  );
}
