/**
 * useGlobalStats Hook - Fetch global statistics across all infrastructures
 * Real data for dashboard and analytics pages
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { supabase as importedSupabase } from '../../lib/supabaseClient';
const supabase: any = importedSupabase as any;

interface GlobalStats {
  totalInfrastructures: number;
  totalPoints: number;
  activePoints: number;
  totalJobs: number;
  activeJobs: number;
  maxDeformationMm: number | null;
  avgCoherence: number | null;
  riskDistribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    stable: number;
    unknown: number;
  };
}

interface TimeSeriesData {
  date: string;
  avgDisplacement: number | null;
  maxDisplacement: number | null;
  minDisplacement: number | null;
  count: number;
}

interface GlobalTimeSeries {
  timeSeries: TimeSeriesData[];
  dateRange: {
    from: string | null;
    to: string | null;
  };
}

interface Job {
  id: string;
  status: string;
  infrastructure_id: string;
  created_at: string;
  completed_at: string | null;
}

interface CriticalInfrastructure {
  id: string;
  name: string;
  risk: 'critical' | 'high' | 'medium' | 'low' | 'stable' | 'unknown';
  latestDisplacement: number | null;
  velocity: number | null;
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
 * Hook to fetch global statistics
 */
export function useGlobalStats(): UseQueryResult<GlobalStats, Error> {
  return useQuery({
    queryKey: ['globalStats'],
    queryFn: async () => {
      // Fetch all infrastructures
      const infraRes = await authedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/infrastructures`);
      if (!infraRes.ok) throw new Error('Failed to fetch infrastructures');
      const infraData = await infraRes.json();
      const infrastructures = infraData.infrastructures || [];

      // Fetch jobs for all infrastructures
      const allJobs: Job[] = [];
      for (const infra of infrastructures) {
        try {
          const jobsRes = await authedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/jobs?infrastructureId=${infra.id}`);
          if (jobsRes.ok) {
            const jobsData = await jobsRes.json();
            allJobs.push(...(jobsData.jobs || []));
          }
        } catch (err) {
          console.error(`Failed to fetch jobs for ${infra.id}:`, err);
        }
      }

      // Fetch map data for all infrastructures to get statistics
      let totalPoints = 0;
      let activePoints = 0;
      let maxDeformationMm: number | null = null;
      let totalCoherence = 0;
      let coherenceCount = 0;
      const riskDistribution = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        stable: 0,
        unknown: 0,
      };

      for (const infra of infrastructures) {
        try {
          const mapRes = await authedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/infrastructures/${infra.id}/map-data?limit=10000`);
          if (mapRes.ok) {
            const mapData = await mapRes.json();
            totalPoints += mapData.metadata?.totalPoints || 0;
            activePoints += mapData.metadata?.activePoints || 0;
            
            // Only use maxDisplacement if there are actual active points with measurements
            if (mapData.metadata?.activePoints > 0 && mapData.metadata?.statistics?.maxDisplacement !== null && mapData.metadata?.statistics?.maxDisplacement !== undefined) {
              const max = mapData.metadata.statistics.maxDisplacement;
              // Only consider if it's a real value (not 0 or default)
              if (max !== 0 && (maxDeformationMm === null || Math.abs(max) > Math.abs(maxDeformationMm))) {
                maxDeformationMm = max;
              }
            }

            // Aggregate risk distribution
            if (mapData.metadata?.riskDistribution) {
              Object.keys(riskDistribution).forEach((key) => {
                riskDistribution[key as keyof typeof riskDistribution] += 
                  mapData.metadata.riskDistribution[key] || 0;
              });
            }

            // Calculate average coherence
            const features = mapData.features || [];
            features.forEach((f: any) => {
              if (f.properties?.latestCoherence !== null && f.properties?.latestCoherence !== undefined) {
                totalCoherence += f.properties.latestCoherence;
                coherenceCount++;
              }
            });
          }
        } catch (err) {
          console.error(`Failed to fetch map data for ${infra.id}:`, err);
        }
      }

      const avgCoherence = coherenceCount > 0 ? totalCoherence / coherenceCount : null;
      const activeJobs = allJobs.filter(j => 
        j.status === 'PENDING' || j.status === 'RUNNING' || j.status === 'PROCESSING'
      ).length;

      return {
        totalInfrastructures: infrastructures.length,
        totalPoints,
        activePoints,
        totalJobs: allJobs.length,
        activeJobs,
        maxDeformationMm,
        avgCoherence,
        riskDistribution,
      };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}

/**
 * Hook to fetch global time series (aggregated across all infrastructures)
 */
export function useGlobalTimeSeries(): UseQueryResult<GlobalTimeSeries, Error> {
  return useQuery({
    queryKey: ['globalTimeSeries'],
    queryFn: async () => {
      // Fetch all infrastructures
      const infraRes = await authedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/infrastructures`);
      if (!infraRes.ok) throw new Error('Failed to fetch infrastructures');
      const infraData = await infraRes.json();
      const infrastructures = infraData.infrastructures || [];

      // Aggregate time series from all infrastructures
      const timeSeriesMap = new Map<string, {
        displacements: number[];
        count: number;
      }>();

      for (const infra of infrastructures) {
        try {
          const mapRes = await authedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/infrastructures/${infra.id}/map-data?limit=10000`);
          if (mapRes.ok) {
            const mapData = await mapRes.json();
            const features = mapData.features || [];
            
            features.forEach((f: any) => {
              const date = f.properties?.latestDate;
              const displacement = f.properties?.latestDisplacement;
              
              if (date && displacement !== null && displacement !== undefined) {
                const dateStr = date.split('T')[0]; // Extract date part
                if (!timeSeriesMap.has(dateStr)) {
                  timeSeriesMap.set(dateStr, { displacements: [], count: 0 });
                }
                const entry = timeSeriesMap.get(dateStr)!;
                entry.displacements.push(displacement);
                entry.count++;
              }
            });
          }
        } catch (err) {
          console.error(`Failed to fetch time series for ${infra.id}:`, err);
        }
      }

      // Convert to array and calculate averages
      const timeSeries: TimeSeriesData[] = Array.from(timeSeriesMap.entries())
        .map(([date, data]) => {
          const displacements = data.displacements.filter(d => d !== null && d !== undefined);
          return {
            date,
            avgDisplacement: displacements.length > 0 
              ? displacements.reduce((a, b) => a + b, 0) / displacements.length 
              : null,
            maxDisplacement: displacements.length > 0 ? Math.max(...displacements) : null,
            minDisplacement: displacements.length > 0 ? Math.min(...displacements) : null,
            count: data.count,
          };
        })
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-24); // Last 24 data points

      const dates = timeSeries.map(t => t.date).filter(Boolean);
      const dateRange = {
        from: dates.length > 0 ? dates[0] : null,
        to: dates.length > 0 ? dates[dates.length - 1] : null,
      };

      return {
        timeSeries,
        dateRange,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // 10 minutes
    retry: 2,
  });
}

/**
 * Hook to fetch critical infrastructures
 */
export function useCriticalInfrastructures(): UseQueryResult<CriticalInfrastructure[], Error> {
  return useQuery({
    queryKey: ['criticalInfrastructures'],
    queryFn: async () => {
      const infraRes = await authedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/infrastructures`);
      if (!infraRes.ok) throw new Error('Failed to fetch infrastructures');
      const infraData = await infraRes.json();
      const infrastructures = infraData.infrastructures || [];

      const criticalInfras: CriticalInfrastructure[] = [];

      for (const infra of infrastructures) {
        try {
          const mapRes = await authedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/infrastructures/${infra.id}/map-data?limit=10000`);
          if (mapRes.ok) {
            const mapData = await mapRes.json();
            const stats = mapData.metadata?.statistics;
            const riskDist = mapData.metadata?.riskDistribution;

            if (stats || riskDist) {
              const maxDisplacement = stats?.maxDisplacement;
              const riskLevel = 
                riskDist?.critical > 0 ? 'critical' :
                riskDist?.high > 0 ? 'high' :
                riskDist?.medium > 0 ? 'medium' :
                riskDist?.low > 0 ? 'low' :
                riskDist?.stable > 0 ? 'stable' : 'unknown';

              if (maxDisplacement !== null && maxDisplacement !== undefined) {
                criticalInfras.push({
                  id: infra.id,
                  name: infra.name,
                  risk: riskLevel,
                  latestDisplacement: maxDisplacement,
                  velocity: stats?.averageVelocity || null,
                });
              }
            }
          }
        } catch (err) {
          console.error(`Failed to fetch data for ${infra.id}:`, err);
        }
      }

      // Sort by risk level and displacement
      criticalInfras.sort((a, b) => {
        const riskOrder = { critical: 0, high: 1, medium: 2, low: 3, stable: 4, unknown: 5 };
        const riskDiff = riskOrder[a.risk] - riskOrder[b.risk];
        if (riskDiff !== 0) return riskDiff;
        const aDisp = Math.abs(a.latestDisplacement || 0);
        const bDisp = Math.abs(b.latestDisplacement || 0);
        return bDisp - aDisp;
      });

      return criticalInfras.slice(0, 10); // Top 10
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}

