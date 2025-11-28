/**
 * useStatistics Hook - Fetch infrastructure statistics
 * Optimized for dashboard and analytics views
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { StatisticsResponse } from '@/types/api';

// ============================================================================
// QUERY KEYS
// ============================================================================

export const statisticsKeys = {
  all: ['statistics'] as const,
  byInfrastructure: (id: string) => [...statisticsKeys.all, id] as const,
};

// ============================================================================
// HOOK
// ============================================================================

interface UseStatisticsOptions {
  enabled?: boolean;
  refetchInterval?: number;
  staleTime?: number;
}

export function useStatistics(
  infrastructureId: string | undefined,
  token: string | undefined,
  options: UseStatisticsOptions = {}
): UseQueryResult<StatisticsResponse, Error> {
  const {
    enabled = true,
    refetchInterval,
    staleTime = 10 * 60 * 1000, // 10 minutes (matches backend cache)
  } = options;

  return useQuery({
    queryKey: infrastructureId ? statisticsKeys.byInfrastructure(infrastructureId) : ['statistics', 'disabled'],
    queryFn: async () => {
      if (!infrastructureId || !token) {
        throw new Error('Infrastructure ID and token are required');
      }
      return apiClient.getStatistics(infrastructureId, token);
    },
    enabled: enabled && !!infrastructureId && !!token,
    staleTime,
    refetchInterval,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}
