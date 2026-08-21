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

      // Profile missing — create it from auth metadata (stored at signup).
      if (!profile && user.user_metadata?.role) {
        const role = user.user_metadata.role as string;
        const full_name = (user.user_metadata.full_name as string) ?? user.email ?? '';

        const { error: profErr } = await supabase.from('profiles').insert(
          { id: user.id, email: user.email, full_name, role }
        );
        // 23505 = unique_violation → already exists, ignore
        if (profErr && profErr.code !== '23505') {
          // INSERT policy missing or other DB error — redirect to setup
          router.push('/auth/setup'); return;
        }

        if (role === 'contributor') {
          await supabase.from('contributor_profiles').insert(
            { profile_id: user.id, subscription_tier: 'free', points_available: 0, points_total: 0, tickets_scanned: 0, baskets_funded: 0 }
          );
        } else if (role === 'beneficiary') {
          await supabase.from('beneficiary_profiles').insert(
            { profile_id: user.id, status: 'waitlist', baskets_received: 0 }
          );
        }
        // association_profiles is created in /auth/setup (has required fields to fill)

        profile = { role };
      }

      // If still no profile, user is authenticated but setup never completed
      if (!profile) { router.push('/auth/setup'); return; }

      if (profile.role === 'contributor') router.push('/dashboard/contributor');
      else if (profile.role === 'beneficiary') router.push('/dashboard/beneficiary');
      else if (profile.role === 'association') router.push('/dashboard/association');
      else router.push('/auth/setup');
    });
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-[#2D5016] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
