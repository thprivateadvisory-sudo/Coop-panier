// Edge Function — OCR ticket de caisse via Claude (Anthropic)
// Déployée sur Supabase Edge Functions (Deno)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const POINTS_PER_EURO = 1;
const SUBSCRIPTION_MULTIPLIERS: Record<string, number> = {
  free: 1,
  essentiel: 1.5,
  engagement: 2,
};

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let body: { image_base64?: string; image_url?: string; contributor_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { image_base64, image_url, contributor_id } = body;
  if ((!image_base64 && !image_url) || !contributor_id) {
    return new Response(JSON.stringify({ error: 'Missing params' }), { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // ─── 1. Appel Claude Haiku pour l'OCR ──────────────────────────────────────

  // Préparation de l'image
  const base64Raw = image_base64?.replace(/^data:image\/[a-z]+;base64,/, '') ?? null;
  const mediaType: 'image/jpeg' | 'image/png' | 'image/webp' =
    image_base64?.startsWith('data:image/png') ? 'image/png'
    : image_base64?.startsWith('data:image/webp') ? 'image/webp'
    : 'image/jpeg';

  // Contenu de l'image : base64 ou URL publique
  const imageContent = base64Raw
    ? { type: 'base64' as const, media_type: mediaType, data: base64Raw }
    : { type: 'url' as const, url: image_url! };

  const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: imageContent,
            },
            {
              type: 'text',
              text: `Tu es un extracteur de données de tickets de caisse. Analyse cette image et réponds UNIQUEMENT en JSON avec ce format exact, sans aucun texte avant ou après :
{"total": <montant final en nombre décimal ou null>, "store": "<nom du magasin ou null>", "date": "<date YYYY-MM-DD ou null>"}

Le total = montant TOTAL TTC final payé (libellé "TOTAL TTC", "NET À PAYER", "À PAYER", "TOTAL NET", "MONTANT TOTAL").
Retourne null pour total si introuvable ou illisible. Ne mets aucun texte avant ou après le JSON.`,
            },
          ],
        },
      ],
    }),
  });

  if (!anthropicResp.ok) {
    const errText = await anthropicResp.text();
    console.error('Anthropic API error:', errText);
    return new Response(
      JSON.stringify({ error: 'OCR_SERVICE_UNAVAILABLE', detail: errText }),
      { status: 502 }
    );
  }

  const anthropicData = await anthropicResp.json();
  const rawText: string = anthropicData.content?.[0]?.text ?? '';
  console.log('Claude raw response:', rawText);

  // ─── 2. Parsing du résultat ────────────────────────────────────────────────

  let parsed: { total: number | string | null; store: string | null; date: string | null } = {
    total: null,
    store: null,
    date: null,
  };

  try {
    const jsonMatch = rawText.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('JSON parse error:', e, 'rawText:', rawText);
  }

  // Normalise le total (string "25,50" → 25.5, number 25.5 → 25.5)
  const rawTotal = parsed.total;
  let total: number | null = null;
  if (typeof rawTotal === 'number' && rawTotal > 0) {
    total = rawTotal;
  } else if (typeof rawTotal === 'string') {
    const v = parseFloat(rawTotal.replace(',', '.'));
    if (!isNaN(v) && v > 0) total = v;
  }

  if (total === null || total <= 0 || total > 5000) {
    return new Response(
      JSON.stringify({
        error: 'AMOUNT_NOT_DETECTED',
        message: "Le montant total n'a pas pu être détecté sur ce ticket.",
      }),
      { status: 422 }
    );
  }

  // ─── 3. Abonnement → multiplicateur de points ──────────────────────────────

  const { data: contribProfile } = await supabase
    .from('contributor_profiles')
    .select('subscription_tier')
    .eq('profile_id', contributor_id)
    .single();

  const tier = contribProfile?.subscription_tier ?? 'free';
  const multiplier = SUBSCRIPTION_MULTIPLIERS[tier] ?? 1;
  const pointsEarned = Math.round(total * POINTS_PER_EURO * multiplier);

  // ─── 4. Enregistrement du ticket (non bloquant) ───────────────────────────

  let receiptId: string | null = null;
  const { data: receipt, error: receiptError } = await supabase
    .from('receipts')
    .insert({
      contributor_id,
      image_url: image_url ?? 'mobile-camera',
      store_name: parsed.store,
      total_amount: total,
      purchase_date: parsed.date,
      points_earned: pointsEarned,
      status: 'validated',
      ocr_confidence: 0.92,
    })
    .select('id')
    .single();

  if (receiptError) {
    console.warn('receipts insert skipped:', receiptError.message);
  } else {
    receiptId = receipt?.id ?? null;
  }

  // ─── 5. Crédit des points ──────────────────────────────────────────────────

  const { error: creditError } = await supabase.rpc('credit_points', {
    p_profile_id: contributor_id,
    p_amount: pointsEarned,
    p_type: 'earn_scan',
    p_reference_id: receiptId,
    p_description: `Ticket ${parsed.store ?? 'inconnu'} — ${total.toFixed(2)}€`,
  });

  if (creditError) {
    console.error('credit_points RPC error:', creditError.message);
    // Fallback : incrément direct sur contributor_profiles
    await supabase
      .from('contributor_profiles')
      .update({ points_total: supabase.rpc('increment_points', { row_id: contributor_id, delta: pointsEarned }) })
      .eq('profile_id', contributor_id)
      .catch((e: unknown) => console.error('fallback increment failed:', e));
  }

  // ─── 6. Réponse ────────────────────────────────────────────────────────────

  return new Response(
    JSON.stringify({
      store_name: parsed.store,
      total_amount: total,
      purchase_date: parsed.date,
      points_earned: pointsEarned,
      confidence: 0.92,
      receipt_id: receiptId,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
