// Edge Function — Webhook Stripe : met à jour le tier en DB après paiement confirmé
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

const PRICE_TO_TIER: Record<string, string> = {
  [Deno.env.get('STRIPE_PRICE_ESSENTIEL') ?? '']: 'essentiel',
  [Deno.env.get('STRIPE_PRICE_ENGAGEMENT') ?? '']: 'engagement',
};

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Signature manquante', { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, WEBHOOK_SECRET);
  } catch (err) {
    return new Response(`Webhook invalide : ${(err as Error).message}`, { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const { profile_id, tier } = session.metadata ?? {};
      if (profile_id && tier) {
        await supabase
          .from('contributor_profiles')
          .update({
            subscription_tier: tier,
            stripe_customer_id: session.customer as string,
          })
          .eq('profile_id', profile_id);
      }
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const priceId = sub.items.data[0]?.price.id ?? '';
      const tier = PRICE_TO_TIER[priceId] ?? 'free';
      // N'agir que si actif — sinon laisser deleted gérer le passage à free
      if (sub.status === 'active') {
        await supabase
          .from('contributor_profiles')
          .update({ subscription_tier: tier })
          .eq('stripe_customer_id', sub.customer as string);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await supabase
        .from('contributor_profiles')
        .update({ subscription_tier: 'free' })
        .eq('stripe_customer_id', sub.customer as string);
      break;
    }

    case 'invoice.payment_failed': {
      // Optionnel : on pourrait notifier l'utilisateur ici
      break;
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
