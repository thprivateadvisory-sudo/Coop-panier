'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function DashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth/login'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

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
