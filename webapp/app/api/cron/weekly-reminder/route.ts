import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendPushToUser } from '@/lib/push';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Users with push subscriptions who haven't scanned in the last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: recentScanners } = await supabase
    .from('receipts')
    .select('contributor_id')
    .gte('created_at', sevenDaysAgo);

  const recentIds = new Set((recentScanners ?? []).map((r) => r.contributor_id));

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('user_id');

  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const targets = [...new Set(subs.map((s) => s.user_id))].filter(
    (id) => !recentIds.has(id)
  );

  const results = await Promise.allSettled(
    targets.map((userId) =>
      sendPushToUser(userId, {
        title: '🧺 Cette semaine, scannez vos tickets !',
        body: 'Chaque euro compte. Ajoutez vos courses et gagnez des points pour la coopérative.',
        url: '/dashboard/contributor/scan',
      })
    )
  );

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  return NextResponse.json({ sent, total: targets.length });
}
