/**
 * useMapData Hook - Fetch map data with React Query
 * Enterprise-grade data fetching with caching, refetching, and error handling
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { MapDataResponse } from '@/types/api';

// ============================================================================
// QUERY KEYS
// ============================================================================

export const mapDataKeys = {
  all: ['mapData'] as const,
  byInfrastructure: (id: string) => [...mapDataKeys.all, id] as const,
};

// ============================================================================
// HOOK
// ============================================================================

interface UseMapDataOptions {
  enabled?: boolean;
  refetchInterval?: number;
  staleTime?: number;
  limit?: number; // Limit number of points to fetch (default: 10000)
}

export function useMapData(
  infrastructureId: string | undefined,
  token: string | undefined,
  options: UseMapDataOptions = {}
): UseQueryResult<MapDataResponse, Error> {
  const {
    enabled = true,
    refetchInterval,
    staleTime = 5 * 60 * 1000, // 5 minutes (matches backend cache)
    limit = 10000, // Default limit to prevent loading too many points at once
  } = options;

  return useQuery({
    queryKey: infrastructureId ? mapDataKeys.byInfrastructure(infrastructureId) : ['mapData', 'disabled'],
    queryFn: async () => {
      if (!infrastructureId || !token) {
        throw new Error('Infrastructure ID and token are required');
      }
      return apiClient.getMapData(infrastructureId, token, limit);
    },
    enabled: enabled && !!infrastructureId && !!token,
    staleTime,
    refetchInterval,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}
