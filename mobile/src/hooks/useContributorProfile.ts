import { useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';
import type { ContributorProfile } from '@/types';

export function useContributorProfile(profileId: string) {
  const [profile, setProfile] = useState<ContributorProfile | null>(null);

  useEffect(() => {
    if (!profileId) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function fetchInitial() {
      try {
        const { data } = await supabase
          .from('contributor_profiles')
          .select('*')
          .eq('profile_id', profileId)
          .single();
        if (data) setProfile(data);
      } catch {}
    }

    fetchInitial();

    try {
      channel = supabase
        .channel(`contributor_profile_${profileId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'contributor_profiles',
            filter: `profile_id=eq.${profileId}`,
          },
          (payload) => setProfile(payload.new as ContributorProfile)
        )
        .subscribe();
    } catch {}

    return () => {
      if (channel) {
        try { supabase.removeChannel(channel); } catch {}
      }
    };
  }, [profileId]);

  return profile;
}
