// Edge Function — OCR ticket de caisse via Google Cloud Vision
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

// Ordre = priorité (termes plus spécifiques d'abord)
const STORE_CHAINS: [string, string[]][] = [
  ['E.Leclerc', ['e.leclerc', 'centres e.leclerc', 'centre e.leclerc', 'leclerc']],
  ['Lidl', ['lidl']],
  ['Carrefour Market', ['carrefour market']],
  ['Carrefour City', ['carrefour city']],
  ['Carrefour Express', ['carrefour express']],
  ['Carrefour', ['carrefour']],
  ['Auchan', ['auchan']],
  ['Intermarché', ['intermarché', 'intermarche', 'mousquetaires']],
  ['Monoprix', ['monoprix', "monop'", 'monop ']],
  ['Franprix', ['franprix']],
  ['Hyper U', ['hyper u']],
  ['Super U', ['super u', 'système u', 'systeme u']],
  ['U Express', ['u express']],
  ['Marché U', ['marché u']],
  ['Géant Casino', ['géant casino', 'geant casino']],
  ['Casino Supermarché', ['casino supermarché', 'casino supermarche']],
  ['Petit Casino', ['petit casino']],
  ['Casino', ['casino']],
  ['Picard', ['picard surgelés', 'picard surgeles', 'picard']],
  ['Biocoop', ['biocoop']],
  ['Naturalia', ['naturalia']],
  ['Leader Price', ['leader price']],
  ['Netto', ['netto']],
  ['Cora', ['cora']],
  ['Grand Frais', ['grand frais']],
  ['Colruyt', ['colruyt']],
  ['G20', ['g20']],
  ['Spar', ['spar']],
  ['Simply Market', ['simply market']],
];

function detectStore(text: string): { chain: string | null; rawName: string | null } {
  const lower = text.toLowerCase();
  for (const [chain, keywords] of STORE_CHAINS) {
    if (keywords.some((kw: string) => lower.includes(kw))) {
      return { chain, rawName: chain };
    }
  }
  const lines = text.split('\n').filter((l: string) => l.trim().length > 2);
  return { chain: null, rawName: lines[0]?.trim() ?? null };
}

function extractTotal(text: string): number | null {
  const patterns = [
    /total\s+ttc\s*[:\-]?\s*(\d{1,4}[,\.]\d{2})/i,
    /net\s+à\s+payer\s*[:\-]?\s*(\d{1,4}[,\.]\d{2})/i,
    /à\s+payer\s*[:\-]?\s*(\d{1,4}[,\.]\d{2})/i,
    /total\s+net\s*[:\-]?\s*(\d{1,4}[,\.]\d{2})/i,
    /montant\s+total\s*[:\-]?\s*(\d{1,4}[,\.]\d{2})/i,
    /total\s*[:\-]?\s*(\d{1,4}[,\.]\d{2})/i,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) {
      const v = parseFloat(m[1].replace(',', '.'));
      if (v > 0.5 && v < 2000) return v;
    }
  }
  return null;
}

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const { image_url, image_base64, contributor_id } = await req.json();
  if ((!image_url && !image_base64) || !contributor_id) {
    return new Response(JSON.stringify({ error: 'Missing params' }), { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Image source : URL publique ou base64
  const imagePayload = image_base64
    ? { content: image_base64.replace(/^data:image\/[a-z]+;base64,/, '') }
    : { source: { imageUri: image_url } };

  // 1. OCR Google Vision
  const visionResp = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: imagePayload,
            features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
          },
        ],
      }),
    }
  );

  const visionData = await visionResp.json();
  const fullText: string = visionData.responses?.[0]?.fullTextAnnotation?.text ?? '';

  // 2. Extraction magasin
  const { chain: storeChain, rawName } = detectStore(fullText);

  // 3. Extraction montant
  const total = extractTotal(fullText);

  // 4. Extraction date
  const dateMatch = fullText.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  const purchaseDate = dateMatch
    ? `${dateMatch[3].length === 2 ? '20' + dateMatch[3] : dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`
    : null;

  const confidence = total !== null ? 0.88 : storeChain !== null ? 0.55 : 0.3;

  // 5. Abonnement contributeur
  const { data: contribProfile } = await supabase
    .from('contributor_profiles')
    .select('subscription_tier')
    .eq('profile_id', contributor_id)
    .single();

  const tier = contribProfile?.subscription_tier ?? 'free';
  const multiplier = SUBSCRIPTION_MULTIPLIERS[tier] ?? 1;
  const pointsEarned = total !== null ? Math.round(total * POINTS_PER_EURO * multiplier) : 5;

  // 6. Stockage du ticket
  const { data: receipt, error: receiptError } = await supabase
    .from('receipts')
    .insert({
      contributor_id,
      image_url: image_url ?? 'edge-function',
      store_name: storeChain ?? rawName,
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

  // 7. Crédit des points
  await supabase.rpc('credit_points', {
    p_profile_id: contributor_id,
    p_amount: pointsEarned,
    p_type: 'earn_scan',
    p_reference_id: receipt.id,
    p_description: `Ticket ${storeChain ?? rawName ?? 'inconnu'} — ${total?.toFixed(2) ?? '?'}€`,
  });

  return new Response(
    JSON.stringify({
      store_chain: storeChain,
      store_name: storeChain ?? rawName,
      total_amount: total,
      purchase_date: purchaseDate,
      points_earned: pointsEarned,
      confidence,
      receipt_id: receipt.id,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
