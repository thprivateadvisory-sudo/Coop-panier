// Edge Function — Création de compte sans email de confirmation
// Contourne la limite d'emails Supabase (3/h sur plan gratuit)
// en utilisant l'API admin pour marquer le compte comme déjà confirmé.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const { email, password, fullName, role, referralCode } = await req.json();

  if (!email || !password || (password as string).length < 8) {
    return new Response(
      JSON.stringify({ error: 'Données invalides. Mot de passe minimum 8 caractères.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Crée le compte auth sans envoyer d'email de confirmation
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    user_metadata: { full_name: fullName, role },
    email_confirm: true, // Compte immédiatement actif
  });

  if (authError) {
    const alreadyExists =
      authError.message.toLowerCase().includes('already') ||
      authError.message.toLowerCase().includes('already registered');
    return new Response(
      JSON.stringify({ error: alreadyExists ? 'Un compte existe déjà avec cet email.' : authError.message }),
      { status: alreadyExists ? 409 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const userId = authData.user.id;

  // Crée le profil principal
  await supabase.from('profiles').insert({
    id: userId,
    email,
    full_name: fullName ?? '',
    role: role ?? 'contributor',
  });

  // Crée le sous-profil selon le rôle
  if (role === 'contributor') {
    await supabase.from('contributor_profiles').insert({
      profile_id: userId,
      ...(referralCode?.trim() ? { referred_by: (referralCode as string).trim().toUpperCase() } : {}),
    });
  } else if (role === 'beneficiary') {
    await supabase.from('beneficiary_profiles').insert({ profile_id: userId });
  } else if (role === 'association') {
    await supabase.from('association_profiles').insert({
      profile_id: userId,
      association_name: fullName ?? '',
      address: '',
      city: '',
      postal_code: '',
    });
  }

  return new Response(
    JSON.stringify({ userId }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
