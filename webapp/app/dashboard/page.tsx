'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function DashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth/login'); return; }

      let { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      // Profile missing — happens when INSERT failed at signup (e.g. before RLS fix).
      // Recover using metadata stored in the auth user.
      if (!profile && user.user_metadata?.role) {
        const role = user.user_metadata.role as string;
        const full_name = (user.user_metadata.full_name as string) ?? user.email ?? '';

        await supabase.from('profiles').insert({
          id: user.id,
          email: user.email,
          full_name,
          role,
        });

        if (role === 'contributor') {
          await supabase.from('contributor_profiles').insert({ profile_id: user.id });
        } else if (role === 'beneficiary') {
          await supabase.from('beneficiary_profiles').insert({ profile_id: user.id });
        } else if (role === 'association') {
          await supabase.from('association_profiles').insert({ profile_id: user.id, name: full_name });
        }

        profile = { role };
      }

      if (!profile) { router.push('/auth/login'); return; }

      if (profile.role === 'contributor') router.push('/dashboard/contributor');
      else if (profile.role === 'beneficiary') router.push('/dashboard/beneficiary');
      else if (profile.role === 'association') router.push('/dashboard/association');
      else router.push('/auth/login');
    });
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-[#2D5016] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
