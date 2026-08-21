import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const VISION_API_KEY = process.env.GOOGLE_VISION_API_KEY ?? '';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Ordre = priorité (termes plus spécifiques d'abord)
const STORE_CHAINS: [string, string[]][] = [
  ['E.Leclerc', ['e.leclerc', 'centres e.leclerc', 'centre e.leclerc', 'leclerc']],
  ['Lidl', ['lidl']],
  ['Carrefour Market', ['carrefour market']],
  ['Carrefour City', ['carrefour city']],
  ['Carrefour Express', ['carrefour express']],
  ['Carrefour', ['carrefour']],
  ['Auchan', ['auchan']],
  ['Intermarché', ['intermarché', 'intermarche', 'les mousquetaires']],
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
  ['Simply Market', ['simply market', 'simply']],
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

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, contributorId } = (await req.json()) as {
      imageBase64: string;
      contributorId: string;
    };

    if (!imageBase64 || !contributorId) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const base64Clean = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    // 1. Upload image → Supabase Storage (bucket "receipts")
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
      // Storage non configuré — on continue sans image stockée
    }

    // 2. OCR Google Vision
    let storeChain: string | null = null;
    let rawName: string | null = null;
    let detectedAmount: number | null = null;
    let purchaseDate: string | null = null;

    if (VISION_API_KEY) {
      try {
        const resp = await fetch(
          `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requests: [
                {
                  image: { content: base64Clean },
                  features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
                },
              ],
            }),
          }
        );
        const data = await resp.json();
        const fullText: string = data.responses?.[0]?.fullTextAnnotation?.text ?? '';

        const detected = detectStore(fullText);
        storeChain = detected.chain;
        rawName = detected.rawName;
        detectedAmount = extractTotal(fullText);

        const dateMatch = fullText.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
        if (dateMatch) {
          const year =
            dateMatch[3].length === 2 ? '20' + dateMatch[3] : dateMatch[3];
          purchaseDate = `${year}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;
        }
      } catch {
        // OCR failed — saisie manuelle
      }
    }

    const confidence = detectedAmount !== null ? 0.88 : storeChain !== null ? 0.55 : 0.3;

    return NextResponse.json({
      storeChain,
      storeName: storeChain ?? rawName,
      detectedAmount,
      purchaseDate,
      confidence,
      imageUrl,
      ocrAvailable: !!VISION_API_KEY,
    });
  } catch (err) {
    console.error('[scan-receipt]', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
