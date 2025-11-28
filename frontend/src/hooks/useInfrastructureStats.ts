/**
 * useInfrastructureStats Hook - Fetch statistics for each infrastructure
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { supabase as importedSupabase } from '../../lib/supabaseClient';
const supabase: any = importedSupabase as any;

interface InfrastructureStats {
  id: string;
  name: string;
  totalPoints: number;
  activePoints: number;
  areaKm2?: number;
}

// Get token helper
const getSupabaseAccessToken = async (): Promise<string | null> => {
  try {
    const { data } = await supabase.auth.getSession();
    const t = (data?.session as any)?.access_token as string | undefined;
    if (t && t.length > 5000) return null;
    return t ?? null;
  } catch {
    return null;
  }
};

const authedFetch = async (input: string, init: RequestInit = {}) => {
  let token = await getSupabaseAccessToken();
  if (!token) {
    try { await supabase.auth.refreshSession(); } catch { }
    token = await getSupabaseAccessToken();
  }
  if (!token) token = localStorage.getItem('token') || null;
  if (!token) throw new Error('UNAUTHORIZED');

  const doFetch = (tk: string) => fetch(input, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${tk}`,
      'Content-Type': (init.headers as any)?.['Content-Type'] || 'application/json',
    },
  });

  let res = await doFetch(token);
  if (res.status === 401) {
    try { await supabase.auth.refreshSession(); } catch { }
    const refreshed = await getSupabaseAccessToken();
    if (refreshed) res = await doFetch(refreshed);
    if (res.status === 401) {
      try { await supabase.auth.signOut(); } catch { }
      throw new Error('UNAUTHORIZED');
    }
  }
  return res;
};

/**
 * Hook to fetch statistics for all infrastructures
 */
export function useInfrastructureStats(): UseQueryResult<InfrastructureStats[], Error> {
  return useQuery({
    queryKey: ['infrastructureStats'],
    queryFn: async () => {
      // Fetch all infrastructures
      const infraRes = await authedFetch(`${process.env.NEXT_PUBLIC_API_URL}/infrastructures`);
      if (!infraRes.ok) throw new Error('Failed to fetch infrastructures');
      const infraData = await infraRes.json();
      const infrastructures = infraData.infrastructures || [];

      // Fetch map data for each to get real stats
      const statsPromises = infrastructures.map(async (infra: any) => {
        try {
          const mapRes = await authedFetch(`${process.env.NEXT_PUBLIC_API_URL}/infrastructures/${infra.id}/map-data?limit=1`);
          if (mapRes.ok) {
            const mapData = await mapRes.json();
            
            // Calculate area from bbox if available
            let areaKm2: number | undefined;
            if (infra.bbox?.coordinates?.[0]) {
              const coords = infra.bbox.coordinates[0];
              const lngs = coords.map((c: number[]) => c[0]);
              const lats = coords.map((c: number[]) => c[1]);
              const minLon = Math.min(...lngs);
              const maxLon = Math.max(...lngs);
              const minLat = Math.min(...lats);
              const maxLat = Math.max(...lats);
              const latDiff = maxLat - minLat;
              const lonDiff = maxLon - minLon;
              areaKm2 = latDiff * lonDiff * 111 * 111; // Rough calculation
            }

            return {
              id: infra.id,
              name: infra.name,
              totalPoints: mapData.metadata?.totalPoints || 0,
              activePoints: mapData.metadata?.activePoints || 0,
              areaKm2: areaKm2 ? Math.round(areaKm2 * 100) / 100 : undefined,
            };
          }
        } catch (err) {
          console.error(`Failed to fetch stats for ${infra.id}:`, err);
        }
        return {
          id: infra.id,
          name: infra.name,
          totalPoints: 0,
          activePoints: 0,
        };
      });

      return Promise.all(statsPromises);
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}

