'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { ContributorProfile } from '@/lib/types';

const POINTS_PER_EURO = 10;

const TIER_MULTIPLIER: Record<string, number> = {
  free: 1,
  essentiel: 2,
  engagement: 4,
};

type Step = 'camera' | 'amount' | 'processing' | 'success';

export default function ScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('camera');
  const [capturedImage, setCapturedImage] = useState('');
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState('');
  const [pointsEarned, setPointsEarned] = useState(0);
  const [contributor, setContributor] = useState<ContributorProfile | null>(null);
  const [userId, setUserId] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');

  useEffect(() => {
    loadUser();
    startCamera();
    return () => stopCamera();
  }, []);

  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/auth/login'); return; }
    setUserId(user.id);
    const { data } = await supabase
      .from('contributor_profiles')
      .select('*')
      .eq('profile_id', user.id)
      .single();
    setContributor(data);
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setCameraReady(true);
      }
    } catch {
      setCameraError('Caméra indisponible — utilisez le bouton pour importer une photo.');
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  function capture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    setCapturedImage(canvas.toDataURL('image/jpeg', 0.85));
    stopCamera();
    setStep('amount');
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCapturedImage(ev.target?.result as string);
      stopCamera();
      setStep('amount');
    };
    reader.readAsDataURL(file);
  }

  async function submitScan() {
    const euros = parseFloat(amount.replace(',', '.'));
    if (isNaN(euros) || euros <= 0) {
      setAmountError('Entrez un montant valide (ex: 23,50)');
      return;
    }
    if (euros > 1000) {
      setAmountError('Montant trop élevé');
      return;
    }
    setAmountError('');
    setStep('processing');

    const multiplier = TIER_MULTIPLIER[contributor?.subscription_tier ?? 'free'];
    const earned = Math.round(euros * POINTS_PER_EURO * multiplier);

    await supabase.from('contributor_profiles').update({
      points_available: (contributor?.points_available ?? 0) + earned,
      points_total: (contributor?.points_total ?? 0) + earned,
      tickets_scanned: (contributor?.tickets_scanned ?? 0) + 1,
    }).eq('profile_id', userId);

    setPointsEarned(earned);

    await new Promise((r) => setTimeout(r, 1500));
    setStep('success');
  }

  if (step === 'processing') {
    return (
      <div className="min-h-screen bg-[#F8F7F4] flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 border-4 border-[#2D5016] border-t-transparent rounded-full animate-spin" />
        <p className="font-nunito font-bold text-[#2D5016] text-lg">Analyse du ticket…</p>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-[#F8F7F4] flex flex-col items-center justify-center p-6 gap-6">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-sm border border-gray-100">
          <div className="w-20 h-20 bg-[#EEF4E8] rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🎉</span>
          </div>
          <h2 className="font-nunito font-black text-2xl text-gray-900 mb-2">Ticket validé !</h2>
          <p className="text-gray-500 text-sm mb-6">Vos points ont été crédités</p>

          <div className="bg-[#EEF4E8] rounded-2xl p-5 mb-6">
            <p className="text-xs font-semibold text-[#2D5016] uppercase tracking-wide mb-1">Points gagnés</p>
            <p className="font-nunito font-black text-5xl text-[#2D5016]">+{pointsEarned}</p>
            {(contributor?.subscription_tier ?? 'free') !== 'free' && (
              <p className="text-xs text-gray-500 mt-1">
                ×{TIER_MULTIPLIER[contributor?.subscription_tier ?? 'free']} avec votre abonnement{' '}
                <span className="font-semibold capitalize">{contributor?.subscription_tier}</span>
              </p>
            )}
          </div>

          <p className="text-xs text-gray-400 mb-6">
            Total disponible : {((contributor?.points_available ?? 0) + pointsEarned).toLocaleString('fr-FR')} pts
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => router.push('/dashboard/contributor')}
              className="w-full bg-[#2D5016] text-white font-nunito font-black py-4 rounded-xl"
            >
              Retour au tableau de bord
            </button>
            <button
              onClick={() => {
                setCapturedImage('');
                setAmount('');
                setStep('camera');
                startCamera();
              }}
              className="w-full border-2 border-gray-200 text-gray-600 font-semibold py-3 rounded-xl text-sm"
            >
              Scanner un autre ticket
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'amount') {
    return (
      <div className="min-h-screen bg-[#F8F7F4] flex flex-col">
        {/* Header */}
        <div className="bg-[#2D5016] text-white px-6 pt-12 pb-6 flex items-center gap-4">
          <button onClick={() => { setStep('camera'); startCamera(); }} className="text-white/70 hover:text-white">
            ‹ Retour
          </button>
          <h1 className="font-nunito font-black text-lg">Montant du ticket</h1>
        </div>

        <div className="flex-1 px-6 pt-6 flex flex-col gap-5 max-w-lg mx-auto w-full">
          {/* Captured image preview */}
          {capturedImage && (
            <div className="rounded-2xl overflow-hidden border border-gray-200 max-h-48 flex items-center justify-center bg-gray-50">
              <img src={capturedImage} alt="Ticket" className="w-full object-contain max-h-48" />
            </div>
          )}

          {/* Amount input */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 block">
              Montant total du ticket (€)
            </label>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-nunito font-black text-gray-300">€</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                max="1000"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 text-3xl font-nunito font-black text-[#2D5016] focus:outline-none bg-transparent"
                autoFocus
              />
            </div>
            {amountError && (
              <p className="text-red-500 text-xs mt-2">{amountError}</p>
            )}
          </div>

          {/* Points preview */}
          {amount && !isNaN(parseFloat(amount.replace(',', '.'))) && parseFloat(amount.replace(',', '.')) > 0 && (
            <div className="bg-[#EEF4E8] rounded-2xl p-4 flex items-center justify-between">
              <span className="text-sm text-[#2D5016] font-medium">Points à gagner</span>
              <span className="font-nunito font-black text-xl text-[#2D5016]">
                +{Math.round(
                  parseFloat(amount.replace(',', '.')) *
                  POINTS_PER_EURO *
                  TIER_MULTIPLIER[contributor?.subscription_tier ?? 'free']
                ).toLocaleString('fr-FR')}
              </span>
            </div>
          )}

          <button
            onClick={submitScan}
            disabled={!amount}
            className="w-full bg-[#E8832A] text-white font-nunito font-black py-4 rounded-xl text-lg disabled:opacity-40"
          >
            Valider le ticket
          </button>
        </div>
      </div>
    );
  }

  // Camera step
  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-6 pt-12 pb-4">
        <button
          onClick={() => router.push('/dashboard/contributor')}
          className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center text-white text-xl"
        >
          ✕
        </button>
        <p className="text-white font-nunito font-bold text-sm">Scanner un ticket</p>
        <div className="w-10" />
      </div>

      {/* Camera */}
      <div className="flex-1 relative flex items-center justify-center">
        {cameraError ? (
          <div className="text-center px-8">
            <div className="text-5xl mb-4">📷</div>
            <p className="text-white/70 text-sm mb-6">{cameraError}</p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Viewfinder overlay */}
            <div className="relative z-10 w-72 h-48 border-2 border-white/80 rounded-2xl">
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-xl" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-xl" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-xl" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-xl" />
            </div>
          </>
        )}
      </div>

      {/* Guide text */}
      <div className="text-center py-4 px-6">
        <p className="text-white/70 text-sm">Cadrez le ticket de caisse dans le cadre</p>
      </div>

      {/* Controls */}
      <div className="pb-12 px-6 flex items-center justify-center gap-8">
        {/* Import from gallery */}
        <button
          onClick={() => fileRef.current?.click()}
          className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center"
        >
          <span className="text-2xl">🖼️</span>
        </button>

        {/* Capture button */}
        <button
          onClick={cameraError ? () => fileRef.current?.click() : capture}
          disabled={!cameraReady && !cameraError}
          className="w-20 h-20 rounded-full bg-white border-4 border-white/50 flex items-center justify-center disabled:opacity-40"
        >
          <div className="w-14 h-14 rounded-full bg-white border-2 border-gray-300" />
        </button>

        <div className="w-14" />
      </div>

      <canvas ref={canvasRef} className="hidden" />
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
    </div>
  );
}
