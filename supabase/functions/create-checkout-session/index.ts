// Edge Function — Crée une session Stripe Checkout pour un abonnement
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_URL = Deno.env.get('APP_URL')!;

const PRICE_IDS: Record<string, string> = {
  essentiel: Deno.env.get('STRIPE_PRICE_ESSENTIEL')!,
  engagement: Deno.env.get('STRIPE_PRICE_ENGAGEMENT')!,
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { profile_id, tier } = await req.json();

    if (!profile_id || !tier || !PRICE_IDS[tier]) {
      return new Response(JSON.stringify({ error: 'Paramètres invalides' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: profile } = await supabase
      .from('contributor_profiles')
      .select('stripe_customer_id')
      .eq('profile_id', profile_id)
      .single();

    const { data: { user } } = await supabase.auth.admin.getUserById(profile_id);

    let customerId = profile?.stripe_customer_id as string | undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user?.email,
        metadata: { profile_id },
      });
      customerId = customer.id;
      await supabase
        .from('contributor_profiles')
        .update({ stripe_customer_id: customerId })
        .eq('profile_id', profile_id);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: PRICE_IDS[tier], quantity: 1 }],
      mode: 'subscription',
      success_url: `${APP_URL}/dashboard/contributor/subscriptions?success=${tier}`,
      cancel_url: `${APP_URL}/dashboard/contributor/subscriptions`,
      metadata: { profile_id, tier },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
