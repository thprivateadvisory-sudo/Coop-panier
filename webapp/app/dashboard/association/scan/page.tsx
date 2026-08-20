'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type ScanResult = {
  beneficiaryName: string;
  basketsReceived: number;
};

type Step = 'camera' | 'processing' | 'success' | 'error';

async function decodeQR(canvas: HTMLCanvasElement): Promise<string | null> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const jsQR = (await import('jsqr')).default;
  const code = jsQR(imageData.data, imageData.width, imageData.height);
  return code?.data ?? null;
}

export default function AssociationScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [step, setStep] = useState<Step>('camera');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [pickupId, setPickupId] = useState('');

  useEffect(() => {
    loadPickup();
    startCamera();
    return () => {
      stopCamera();
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  }, []);

  async function loadPickup() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/auth/login'); return; }
    const { data } = await supabase
      .from('pickup_points')
      .select('id')
      .eq('association_profile_id', user.id)
      .eq('active', true)
      .single();
    if (data) setPickupId(data.id);
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          setCameraReady(true);
          startQRScan();
        };
      }
    } catch {
      setCameraError("Caméra indisponible — importez une image depuis votre galerie.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  function startQRScan() {
    scanIntervalRef.current = setInterval(async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !video.videoWidth) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0);
      const raw = await decodeQR(canvas);
      if (raw) {
        if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
        stopCamera();
        await processQR(raw);
      }
    }, 400);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    stopCamera();
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    setStep('processing');

    const img = new Image();
    img.onload = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d')?.drawImage(img, 0, 0);
      const raw = await decodeQR(canvas);
      if (!raw) {
        showError('Aucun QR code détecté dans cette image.');
        return;
      }
      await processQR(raw);
    };
    img.src = URL.createObjectURL(file);
  }

  async function processQR(raw: string) {
    setStep('processing');
    try {
      const payload = JSON.parse(raw) as { id: string; qr: string };

      const { data: bene, error } = await supabase
        .from('beneficiary_profiles')
        .select('profile_id, status, baskets_received, qr_code, profiles(full_name)')
        .eq('profile_id', payload.id)
        .eq('qr_code', payload.qr)
        .single();

      if (error || !bene) {
        showError('QR code invalide ou bénéficiaire introuvable.');
        return;
      }

      if (bene.status !== 'active') {
        showError("Ce bénéficiaire n'est pas actif.");
        return;
      }

      const newCount = (bene.baskets_received ?? 0) + 1;

      await supabase.from('beneficiary_profiles')
        .update({ baskets_received: newCount })
        .eq('profile_id', payload.id);

      if (pickupId) {
        await supabase.from('baskets').insert({
          pickup_point_id: pickupId,
          beneficiary_profile_id: payload.id,
          status: 'distributed',
        });
      }

      const name = (bene as any).profiles?.full_name ?? 'Bénéficiaire';
      setResult({ beneficiaryName: name, basketsReceived: newCount });
      setStep('success');
    } catch {
      showError('Erreur lors du traitement du QR code.');
    }
  }

  function showError(msg: string) {
    setErrorMsg(msg);
    setStep('error');
  }

  function reset() {
    setStep('camera');
    setCameraError('');
    setErrorMsg('');
    setResult(null);
    setCameraReady(false);
    startCamera();
  }

  if (step === 'processing') {
    return (
      <div className="min-h-screen bg-[#F8F7F4] flex flex-col items-center justify-center gap-5">
        <div className="w-16 h-16 border-4 border-[#2D5016] border-t-transparent rounded-full animate-spin" />
        <p className="font-nunito font-bold text-[#2D5016] text-lg">Vérification…</p>
      </div>
    );
  }

  if (step === 'success' && result) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-md border border-gray-100">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 text-4xl"
            style={{ background: 'linear-gradient(135deg, #2D5016, #4A8025)' }}
          >
            ✅
          </div>
          <h2 className="font-nunito font-black text-2xl text-gray-900 mb-1">Panier distribué !</h2>
          <p className="text-gray-500 text-sm mb-6">{result.beneficiaryName}</p>
          <div className="bg-[#EEF4E8] rounded-2xl p-5 mb-6">
            <p className="text-xs font-semibold text-[#2D5016] uppercase tracking-wide mb-1">Total reçu</p>
            <p className="font-nunito font-black text-5xl text-[#2D5016]">{result.basketsReceived}</p>
            <p className="text-xs text-gray-500 mt-1">panier{result.basketsReceived > 1 ? 's' : ''}</p>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={reset}
              className="w-full font-nunito font-black py-4 rounded-xl text-white"
              style={{ background: 'linear-gradient(135deg, #2D5016, #4A8025)' }}
            >
              Scanner un autre
            </button>
            <button
              onClick={() => router.push('/dashboard/association')}
              className="w-full border-2 border-gray-200 text-gray-600 font-semibold py-3 rounded-xl text-sm"
            >
              Retour au tableau de bord
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen bg-[#F8F7F4] flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-md border border-gray-100">
          <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-5 text-4xl">
            ❌
          </div>
          <h2 className="font-nunito font-black text-xl text-gray-900 mb-2">Échec</h2>
          <p className="text-gray-500 text-sm mb-6">{errorMsg}</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={reset}
              className="w-full font-nunito font-black py-4 rounded-xl text-white"
              style={{ background: 'linear-gradient(135deg, #2D5016, #4A8025)' }}
            >
              Réessayer
            </button>
            <button
              onClick={() => router.push('/dashboard/association')}
              className="w-full border-2 border-gray-200 text-gray-600 font-semibold py-3 rounded-xl text-sm"
            >
              Retour
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-6 pt-12 pb-4">
        <button
          onClick={() => router.push('/dashboard/association')}
          className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center text-white text-xl"
        >
          ✕
        </button>
        <p className="text-white font-nunito font-bold text-sm">Scanner QR bénéficiaire</p>
        <div className="w-10" />
      </div>

      <div className="flex-1 relative flex items-center justify-center">
        {cameraError ? (
          <div className="text-center px-8">
            <div className="text-5xl mb-4">📷</div>
            <p className="text-white/70 text-sm mb-6">{cameraError}</p>
          </div>
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
            <div className="relative z-10 w-64 h-64">
              <div className="absolute inset-0 border-2 border-white/30 rounded-2xl" />
              <div className="absolute -top-0.5 -left-0.5 w-7 h-7 border-t-4 border-l-4 border-white rounded-tl-xl" />
              <div className="absolute -top-0.5 -right-0.5 w-7 h-7 border-t-4 border-r-4 border-white rounded-tr-xl" />
              <div className="absolute -bottom-0.5 -left-0.5 w-7 h-7 border-b-4 border-l-4 border-white rounded-bl-xl" />
              <div className="absolute -bottom-0.5 -right-0.5 w-7 h-7 border-b-4 border-r-4 border-white rounded-br-xl" />
            </div>
          </>
        )}
      </div>

      <div className="text-center py-4 px-6">
        <p className="text-white/60 text-sm">
          {cameraReady ? 'Pointez sur le QR code du bénéficiaire' : 'Initialisation…'}
        </p>
      </div>

      <div className="pb-12 px-6 flex items-center justify-center">
        <button
          onClick={() => fileRef.current?.click()}
          className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center"
          aria-label="Importer une image"
        >
          <span className="text-2xl">🖼️</span>
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}
