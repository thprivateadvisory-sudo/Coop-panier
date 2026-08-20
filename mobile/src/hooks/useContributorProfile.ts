import { useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';
import type { ContributorProfile } from '@/types';

export function useContributorProfile(profileId: string) {
  const [profile, setProfile] = useState<ContributorProfile | null>(null);

  useEffect(() => {
    if (!profileId) return;

    async function fetchInitial() {
      const { data } = await supabase
        .from('contributor_profiles')
        .select('*')
        .eq('profile_id', profileId)
        .single();
      if (data) setProfile(data);
    }

    fetchInitial();

    // Points et paniers se mettent à jour en temps réel
    const channel = supabase
      .channel(`contributor_${profileId}`)
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

    return () => { supabase.removeChannel(channel); };
  }, [profileId]);

  return profile;
}
