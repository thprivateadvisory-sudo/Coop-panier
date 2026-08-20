import { useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';
import type { ImpactStats } from '@/types';

export function useImpactStats() {
  const [stats, setStats] = useState<ImpactStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInitial() {
      const { data } = await supabase
        .from('impact_stats')
        .select('*')
        .single();
      if (data) setStats(data);
      setLoading(false);
    }

    fetchInitial();

    // Realtime subscription — tous les compteurs se mettent à jour instantanément
    const channel = supabase
      .channel('impact_stats_realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'impact_stats' },
        (payload) => setStats(payload.new as ImpactStats)
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return { stats, loading };
}
