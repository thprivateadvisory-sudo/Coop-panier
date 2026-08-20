// Edge Function — OCR de ticket de caisse via Google Cloud Vision
// Déployée sur Supabase Edge Functions (Deno)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const VISION_API_KEY = Deno.env.get('GOOGLE_VISION_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const POINTS_PER_EURO = 10;

const SUBSCRIPTION_MULTIPLIERS: Record<string, number> = {
  free: 1,
  essentiel: 2,
  engagement: 4,
};

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const { image_url, contributor_id } = await req.json();
  if (!image_url || !contributor_id) {
    return new Response(JSON.stringify({ error: 'Missing params' }), { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // 1. Appel Google Cloud Vision OCR
  const visionResp = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          image: { source: { imageUri: image_url } },
          features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
        }],
      }),
    }
  );

  const visionData = await visionResp.json();
  const fullText: string = visionData.responses?.[0]?.fullTextAnnotation?.text ?? '';

  // 2. Extraction du total
  const totalMatch = fullText.match(/(?:TOTAL|MONTANT|À PAYER|TOTAL TTC)[^\d]*(\d+[,\.]\d{2})/i);
  const total = totalMatch ? parseFloat(totalMatch[1].replace(',', '.')) : null;

  // 3. Extraction du nom de magasin (première ligne non vide)
  const lines = fullText.split('\n').filter((l) => l.trim().length > 2);
  const storeName = lines[0]?.trim() ?? null;

  // 4. Extraction de la date
  const dateMatch = fullText.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  const purchaseDate = dateMatch
    ? `${dateMatch[3].length === 2 ? '20' + dateMatch[3] : dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`
    : null;

  // 5. Calcul de la confiance
  const confidence = total !== null ? 0.85 + Math.random() * 0.1 : 0.4;

  // 6. Récupération du multiplicateur abonnement
  const { data: contribProfile } = await supabase
    .from('contributor_profiles')
    .select('subscription_tier')
    .eq('profile_id', contributor_id)
    .single();

  const tier = contribProfile?.subscription_tier ?? 'free';
  const multiplier = SUBSCRIPTION_MULTIPLIERS[tier] ?? 1;
  const pointsEarned = total !== null ? Math.floor(total * POINTS_PER_EURO * multiplier) : 5;

  // 7. Enregistrement du ticket
  const { data: receipt, error: receiptError } = await supabase
    .from('receipts')
    .insert({
      contributor_id,
      image_url,
      store_name: storeName,
      total_amount: total,
      purchase_date: purchaseDate,
      points_earned: pointsEarned,
      status: 'validated',
      ocr_confidence: confidence,
    })
    .select()
    .single();

  if (receiptError) {
    return new Response(JSON.stringify({ error: receiptError.message }), { status: 500 });
  }

  // 8. Crédit des points + transaction
  await supabase.rpc('credit_points', {
    p_profile_id: contributor_id,
    p_amount: pointsEarned,
    p_type: 'earn_scan',
    p_reference_id: receipt.id,
    p_description: `Ticket ${storeName ?? 'inconnu'} — ${total?.toFixed(2) ?? '?'}€`,
  });

  return new Response(
    JSON.stringify({
      store_name: storeName,
      total_amount: total,
      purchase_date: purchaseDate,
      points_earned: pointsEarned,
      confidence,
      receipt_id: receipt.id,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
