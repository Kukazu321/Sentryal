'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

/**
 * REACT QUERY PROVIDER - ULTRA-PERFORMANT
 * 
 * Configuration optimale pour 1B ARR:
 * - Stale time optimisé
 * - Cache time intelligent
 * - Retry logic avec exponential backoff
 * - Devtools en dev
 * 
 * @version 1.0.0
 */

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Stale time - données considérées fraîches pendant 5 min
            staleTime: 5 * 60 * 1000,
            
            // Cache time - garde en cache pendant 10 min
            gcTime: 10 * 60 * 1000,
            
            // Retry logic
            retry: 3,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
            
            // Refetch on window focus
            refetchOnWindowFocus: true,
            
            // Refetch on reconnect
            refetchOnReconnect: true,
            
            // Refetch on mount
            refetchOnMount: true,
          },
          mutations: {
            // Retry mutations
            retry: 1,
            retryDelay: 1000,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} position={"bottom-right" as any} />
      )}
    </QueryClientProvider>
  );
}
