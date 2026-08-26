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

  // Last month boundaries
  const now = new Date();
  const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Receipts from last month, grouped by contributor
  const { data: receipts } = await supabase
    .from('receipts')
    .select('contributor_id, points_earned')
    .gte('created_at', firstOfLastMonth)
    .lt('created_at', firstOfThisMonth)
    .eq('status', 'validated');

  if (!receipts || receipts.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  // Aggregate by user
  const byUser = new Map<string, { count: number; points: number }>();
  for (const r of receipts) {
    const cur = byUser.get(r.contributor_id) ?? { count: 0, points: 0 };
    byUser.set(r.contributor_id, { count: cur.count + 1, points: cur.points + r.points_earned });
  }

  // Only send to users who have a push subscription
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('user_id');

  const subSet = new Set((subs ?? []).map((s) => s.user_id));

  const monthName = new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(
    new Date(firstOfLastMonth)
  );

  const results = await Promise.allSettled(
    [...byUser.entries()]
      .filter(([id]) => subSet.has(id))
      .map(([userId, { count, points }]) =>
        sendPushToUser(userId, {
          title: `📊 Votre bilan de ${monthName}`,
          body: `${count} ticket${count > 1 ? 's' : ''} scanné${count > 1 ? 's' : ''} · ${points} points gagnés. Merci pour votre contribution !`,
          url: '/dashboard/contributor',
        })
      )
  );

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  return NextResponse.json({ sent, total: byUser.size });
}
