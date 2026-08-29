import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  if (!SUPABASE_SERVICE_KEY) {
    console.error('[auth/signup] SUPABASE_SERVICE_ROLE_KEY manquant');
    return NextResponse.json({ error: 'Configuration serveur manquante.' }, { status: 500 });
  }

  try {
    const { email, password, fullName, role } = await req.json() as {
      email: string;
      password: string;
      fullName: string;
      role: string;
    };

    if (!email || !password || password.length < 8) {
      return NextResponse.json({ error: 'Données invalides. Mot de passe minimum 8 caractères.' }, { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Crée le compte sans email de confirmation → bypass rate limit Supabase
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { full_name: fullName, role },
      email_confirm: true,
    });

    if (error) {
      const alreadyExists =
        error.message.toLowerCase().includes('already') ||
        (error as any).status === 422;
      return NextResponse.json(
        { error: alreadyExists ? 'Un compte existe déjà avec cet email.' : error.message },
        { status: alreadyExists ? 409 : 400 }
      );
    }

    return NextResponse.json({ userId: data.user.id });
  } catch (err) {
    console.error('[auth/signup]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
