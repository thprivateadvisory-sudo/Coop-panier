import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';
import { sendPushToUser } from '@/lib/push';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const POINTS_PER_EURO = 1;
const TIER_MULTIPLIER: Record<string, number> = { free: 1, essentiel: 1.5, engagement: 2 };
const MAX_AMOUNT_EUR = 300;

function computeToken(amount: number, userId: string, window: number): string {
  const secret = process.env.SCAN_HMAC_SECRET ?? SUPABASE_SERVICE_KEY;
  return createHmac('sha256', secret)
    .update(`${amount}|${userId}|${window}`)
    .digest('hex');
}

function verifyAmountToken(amount: number, userId: string, token: string): boolean {
  const now = Math.floor(Date.now() / 300000);
  // Accept current 5-minute window and the previous one to avoid edge-case rejections
  for (const w of [now, now - 1]) {
    const expected = computeToken(amount, userId, w);
    try {
      if (timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(token, 'hex'))) {
        return true;
      }
    } catch {
      // Buffer lengths differ → wrong token format
    }
  }
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user: authUser } } = await authClient.auth.getUser(token);
    if (!authUser) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await req.json() as {
      detectedAmount: number;
      amountToken: string;
      imageHash: string | null;
      imageUrl: string;
      storeName: string | null;
      purchaseDate: string | null;
      ocrConfidence: number | null;
    };

    const { detectedAmount, amountToken, imageHash, imageUrl, storeName, purchaseDate, ocrConfidence } = body;

    // Validate the HMAC token — proves the server issued this amount, not the client
    if (!verifyAmountToken(detectedAmount, authUser.id, amountToken)) {
      return NextResponse.json({ error: 'Montant invalide ou expiré' }, { status: 422 });
    }

    // Hard server-side cap — defence in depth
    if (typeof detectedAmount !== 'number' || detectedAmount <= 0 || detectedAmount > MAX_AMOUNT_EUR) {
      return NextResponse.json({ error: `Montant hors limites (max ${MAX_AMOUNT_EUR} €)` }, { status: 422 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Fetch contributor tier for multiplier
    const { data: profile } = await supabase
      .from('contributor_profiles')
      .select('subscription_tier, baskets_funded')
      .eq('profile_id', authUser.id)
      .single();

    const tier = profile?.subscription_tier ?? 'free';
    const multiplier = TIER_MULTIPLIER[tier] ?? 1;
    const earned = Math.round(detectedAmount * POINTS_PER_EURO * multiplier);

    // Duplicate check by image hash
    if (imageHash) {
      const { data: dupHash } = await supabase
        .from('receipts')
        .select('id')
        .eq('image_hash', imageHash)
        .limit(1);
      if (dupHash && dupHash.length > 0) {
        return NextResponse.json({ error: 'Ce ticket a déjà été utilisé.' }, { status: 409 });
      }
    }

    // Insert receipt
    const { error: insertErr } = await supabase.from('receipts').insert({
      contributor_id: authUser.id,
      image_url: imageUrl || null,
      store_name: storeName ?? null,
      total_amount: detectedAmount,
      purchase_date: purchaseDate ?? null,
      points_earned: earned,
      status: 'validated',
      ocr_confidence: ocrConfidence ?? null,
      image_hash: imageHash || null,
    });

    if (insertErr) {
      if (insertErr.code === '23505') {
        return NextResponse.json({ error: 'Ce ticket a déjà été utilisé.' }, { status: 409 });
      }
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // Credit points
    const { error: rpcErr } = await supabase.rpc('credit_points', {
      p_profile_id: authUser.id,
      p_amount: earned,
      p_type: 'earn_scan',
      p_description: `Ticket ${storeName ?? 'magasin'} — ${detectedAmount.toFixed(2)} €`,
    });

    if (rpcErr) {
      return NextResponse.json({ error: rpcErr.message }, { status: 500 });
    }

    // Read fresh balance and update baskets_funded
    const { data: fresh } = await supabase
      .from('contributor_profiles')
      .select('points_total, points_available')
      .eq('profile_id', authUser.id)
      .single();

    const newTotal = fresh?.points_total ?? 0;
    const newAvailable = fresh?.points_available ?? 0;
    const oldBaskets = profile?.baskets_funded ?? 0;
    const newBaskets = Math.floor(newTotal / 500);

    if (newBaskets !== oldBaskets) {
      await supabase
        .from('contributor_profiles')
        .update({ baskets_funded: newBaskets })
        .eq('profile_id', authUser.id);
    }

    // Send push notification (non-blocking)
    const basketMilestone = newBaskets > oldBaskets;
    const nextMilestone = (newBaskets + 1) * 500;
    const pointsToNext = nextMilestone - newTotal;
    const nearMilestone = !basketMilestone && pointsToNext <= 100 && pointsToNext > 0;

    sendPushToUser(authUser.id,
      basketMilestone
        ? {
            title: '🧺 Panier financé !',
            body: `Grâce à vous, le panier #${newBaskets} est financé. Merci !`,
            url: '/dashboard/contributor',
          }
        : nearMilestone
        ? {
            title: '🎯 Vous y êtes presque !',
            body: `Plus que ${pointsToNext} points pour financer votre prochain panier. Scannez vos tickets !`,
            url: '/dashboard/contributor',
          }
        : {
            title: `+${earned} points gagnés 🎉`,
            body: `Ticket ${storeName ?? 'validé'} — ${detectedAmount.toFixed(2)} € enregistré.`,
            url: '/dashboard/contributor',
          }
    ).catch(() => {}); // Never block the response if push fails

    return NextResponse.json({
      earned,
      newTotal,
      newAvailable,
      newBaskets,
      oldBaskets,
    });
  } catch (err) {
    console.error('[submit-scan]', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
