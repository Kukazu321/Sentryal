import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { infrastructuresApi } from '../lib/api';
import { useInfrastructureStore } from '../store/useInfrastructureStore';
import { useAuthStore } from '../store/useAuthStore';

/**
 * INFRASTRUCTURES HOOKS - ULTRA-PERFORMANT
 * 
 * Features:
 * - React Query pour data fetching
 * - Optimistic updates
 * - Automatic cache invalidation
 * - Real-time sync avec store
 * - Error handling
 * 
 * Performance:
 * - Stale-while-revalidate
 * - Background refetch
 * - Deduplicated requests
 * - Automatic retries
 * 
 * @version 1.0.0
 */

// Query keys
export const infrastructureKeys = {
  all: ['infrastructures'] as const,
  lists: () => [...infrastructureKeys.all, 'list'] as const,
  list: (filters: any) => [...infrastructureKeys.lists(), filters] as const,
  details: () => [...infrastructureKeys.all, 'detail'] as const,
  detail: (id: string) => [...infrastructureKeys.details(), id] as const,
};

/**
 * Hook pour lister les infrastructures
 */
export function useInfrastructures() {
  const { isAuthenticated } = useAuthStore();
  const { setInfrastructures, setLoading, setError } = useInfrastructureStore();

  const query = useQuery({
    queryKey: infrastructureKeys.lists(),
    queryFn: async () => {
      const response = await infrastructuresApi.list();
      return response.data;
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Sync with store
  if (query.data) {
    setInfrastructures(query.data);
    setLoading(false);
    setError(null);
  }
  if (query.error) {
    setError((query.error as any).response?.data?.message || 'Failed to load infrastructures');
    setLoading(false);
  }

  return query;
}

/**
 * Hook pour une infrastructure spécifique
 */
export function useInfrastructure(id: string) {
  const { selectInfrastructure } = useInfrastructureStore();

  const query = useQuery({
    queryKey: infrastructureKeys.detail(id),
    queryFn: async () => {
      const response = await infrastructuresApi.get(id);
      return response.data;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  // Sync with store
  if (query.data) {
    selectInfrastructure(query.data.id);
  }

  return query;
}

/**
 * Hook pour créer une infrastructure
 */
export function useCreateInfrastructure() {
  const queryClient = useQueryClient();
  const { addInfrastructure } = useInfrastructureStore();

  return useMutation({
    mutationFn: async (data: any) => {
      const response = await infrastructuresApi.create(data);
      return response.data;
    },
    onMutate: async (newInfra) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: infrastructureKeys.lists() });

      // Snapshot previous value
      const previousInfras = queryClient.getQueryData(infrastructureKeys.lists());

      // Optimistically update
      const optimisticInfra = {
        id: `temp-${Date.now()}`,
        ...newInfra,
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData(infrastructureKeys.lists(), (old: any) => [
        optimisticInfra,
        ...(old || []),
      ]);

      return { previousInfras };
    },
    onSuccess: (data) => {
      // Add to store
      addInfrastructure(data);
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: infrastructureKeys.lists() });
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousInfras) {
        queryClient.setQueryData(infrastructureKeys.lists(), context.previousInfras);
      }
    },
  });
}

/**
 * Hook pour mettre à jour une infrastructure
 */
export function useUpdateInfrastructure() {
  const queryClient = useQueryClient();
  const { updateInfrastructure } = useInfrastructureStore();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await infrastructuresApi.update(id, data);
      return response.data;
    },
    onSuccess: (data, variables) => {
      // Update store
      updateInfrastructure(variables.id, data);
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: infrastructureKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: infrastructureKeys.lists() });
    },
  });
}

/**
 * Hook pour supprimer une infrastructure
 */
export function useDeleteInfrastructure() {
  const queryClient = useQueryClient();
  const { deleteInfrastructure } = useInfrastructureStore();

  return useMutation({
    mutationFn: async (id: string) => {
      await infrastructuresApi.delete(id);
      return id;
    },
    onSuccess: (id) => {
      // Delete from store
      deleteInfrastructure(id);
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: infrastructureKeys.lists() });
    },
  });
}
