import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// VAPID public key — public by design, safe to embed
const VAPID_PUBLIC_KEY = 'BKEroJ7qdGYYlWzk65vym1X09F4OWS9eW173V-McNPN8QmfI8s6Am8bLLUnuxhOtLJ0ZAtyxhA-bE6jTJkSLNq8';

let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!privateKey) return;
  webpush.setVapidDetails('mailto:contact@coop-panier.fr', VAPID_PUBLIC_KEY, privateKey);
  vapidConfigured = true;
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string }
) {
  ensureVapid();
  if (!vapidConfigured) return;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, subscription')
    .eq('user_id', userId);

  if (!subs || subs.length === 0) return;

  const results = await Promise.allSettled(
    subs.map((row) =>
      webpush.sendNotification(
        row.subscription as webpush.PushSubscription,
        JSON.stringify(payload)
      )
    )
  );

  // Clean up expired / invalid subscriptions (410 Gone)
  const expired: string[] = [];
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      const err = result.reason as { statusCode?: number };
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        expired.push(subs[i].endpoint);
      }
    }
  });

  if (expired.length > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .in('endpoint', expired);
  }
}
