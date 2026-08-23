import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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
    if (keywords.some((kw) => lower.includes(kw))) {
      return { chain, rawName: chain };
    }
  }
  const lines = text.split('\n').filter((l) => l.trim().length > 2);
  return { chain: null, rawName: lines[0]?.trim() ?? null };
}

export async function POST(req: NextRequest) {
  try {
    // Vérification JWT — seul l'utilisateur lui-même peut soumettre un ticket
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

    const { imageBase64, contributorId } = (await req.json()) as {
      imageBase64: string;
      contributorId: string;
    };

    if (!imageBase64 || !contributorId) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    // Le contributorId doit correspondre au token JWT
    if (authUser.id !== contributorId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const mediaTypeMatch = imageBase64.match(/^data:(image\/[a-z+]+);base64,/);
    const mediaType = (mediaTypeMatch?.[1] ?? 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    const base64Clean = imageBase64.replace(/^data:image\/[a-z+]+;base64,/, '');

    // 1. Upload image → Supabase Storage
    let imageUrl = '';
    try {
      const imageBytes = Buffer.from(base64Clean, 'base64');
      const fileName = `${contributorId}/${Date.now()}.jpg`;
      const { data: up, error: upErr } = await supabase.storage
        .from('receipts')
        .upload(fileName, imageBytes, { contentType: 'image/jpeg', upsert: false });
      if (!upErr && up) {
        const { data: pub } = supabase.storage.from('receipts').getPublicUrl(fileName);
        imageUrl = pub.publicUrl;
      }
    } catch {
      // Bucket non configuré — on continue sans image stockée
    }

    // 2. OCR via Claude
    let storeChain: string | null = null;
    let rawName: string | null = null;
    let detectedAmount: number | null = null;
    let purchaseDate: string | null = null;

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      try {
        const client = new Anthropic({ apiKey: anthropicKey });

        const response = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: mediaType,
                    data: base64Clean,
                  },
                },
                {
                  type: 'text',
                  text: `Tu es un expert en lecture de tickets de caisse français, y compris les tickets digitaux (screenshots d'apps). Lis attentivement chaque ligne et réponds UNIQUEMENT en JSON valide, sans markdown, sans explication.

Format attendu :
{"store":"nom de l'enseigne ou null","total":montant_numerique_ou_null,"date":"YYYY-MM-DD ou null"}

RÈGLES STRICTES :

store : nom de l'enseigne en haut du ticket (logo, en-tête). Ex : "E.Leclerc", "Lidl", "Carrefour", "Carrefour Market", "Auchan", "Intermarché", "Monoprix", "Super U", "Hyper U", "Casino", "Franprix", "Picard", "Biocoop". Si tu vois "Leclerc" ou "Centres E.Leclerc" → "E.Leclerc". null uniquement si vraiment illisible.

total : montant RÉELLEMENT PAYÉ après toutes remises et réductions. PRIORITÉ de lecture (du plus fiable au moins fiable) :
1. "RESTE À PAYER" ou "NET À PAYER" → c'est le montant après remises, prends-le
2. "CB", "VISA", "MASTERCARD", "ESPÈCES" suivi d'un montant → montant effectivement encaissé
3. "TOTAL TTC" ou "MONTANT TTC" si pas de remise appliquée
4. "TOTAL X articles" en DERNIER RECOURS seulement si rien d'autre
ATTENTION : si le ticket montre "Total X articles : 67.47" PUIS "Bon immediat : 9.91" PUIS "Reste à payer : 57.56", le bon montant est 57.56 (pas 67.47). Ne jamais prendre un sous-total avant remise. Retourne un nombre décimal (ex: 57.56). null si vraiment illisible.

date : date d'achat au format YYYY-MM-DD. Cherche DD/MM/YYYY, DD/MM/YY, DD-MM-YYYY, "18 août 2026"… null si absent.`,
                },
              ],
            },
          ],
        });

        const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';

        // Extraire le JSON même si entouré de texte parasite
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const ocrStore: string | null = parsed.store ?? null;
          const ocrTotal: number | null =
            typeof parsed.total === 'number' && parsed.total > 0 && parsed.total <= 1000
              ? parsed.total
              : null;
          const ocrDate: string | null = parsed.date ?? null;

          // Matcher le nom de magasin sur notre liste connue
          if (ocrStore) {
            const { chain, rawName: rn } = detectStore(ocrStore);
            storeChain = chain;
            rawName = chain ?? ocrStore;
          }
          detectedAmount = ocrTotal;
          purchaseDate = ocrDate;
        }
      } catch {
        // Claude indisponible — saisie manuelle
      }
    }

    const confidence = detectedAmount !== null ? 0.92 : storeChain !== null ? 0.6 : 0.3;

    return NextResponse.json({
      storeChain,
      storeName: storeChain ?? rawName,
      detectedAmount,
      purchaseDate,
      confidence,
      imageUrl,
      ocrAvailable: !!anthropicKey,
    });
  } catch (err) {
    console.error('[scan-receipt]', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
